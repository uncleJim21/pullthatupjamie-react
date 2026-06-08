# Tape backend — relevant tickers per synthesize response

## Why this exists

Every Tape result currently renders an "On the tape" ticker strip below the input — that's a key part of the visual signature, and for finance users it's load-bearing context ("when I read a story about Apple, I expect AAPL on the tape; for an AI-bubble debate, I expect the Mag-7"). Today the strip is **hardcoded per-canon-fixture** on the client (`TICKERS_BRIEF_OIL`, `TICKERS_SPLIT_AI`, `TICKERS_ARC_GROMEN`). The moment a real user runs a non-canon query — say a Split on "bulls vs bears on AAPL" — the strip renders the wrong tickers because it has no choice but to fall back to the canon constants.

We tried the obvious client-side workarounds (regex `\$TICKER` over candidate text, ticker-shaped topic shortcuts). They cover narrow cases but fail at the thing that actually matters: **semantic relevance**. A Brief on "Strait of Hormuz oil supply shock" should put XOM / CVX / OXY / SLB on the tape even if no candidate text mentions them explicitly, because that's what a human curator would do. The judgment is fundamentally model-shaped, and the model already has the topic + candidate pool open. So the right home for this logic is the backend, on the `synthesize` call we're already making.

This spec adds one structured field — `tickers: string[]` — to every `synthesize` response, defines its per-kind semantics, and specifies where the client renders it.

## The contract — one field, all kinds

Every successful `synthesize` response gains a top-level `tickers` field:

```json
{
  "kind": "<dossier|brief|split|arc|readin>",
  "text": "...",
  "tickers": ["AAPL", "MSFT", "GOOGL", "META", "AMZN"],
  "tokens": {...},
  "model": "...",
  "_meta": {...}
}
```

### Field rules

- **Type**: `string[]` (always present, never `null`; use `[]` if no confident picks).
- **Symbols**: real, currently-listed equity tickers. Prefer US listings (NASDAQ, NYSE). For non-US-listed names, use the form the user would type into Yahoo Finance — `TM` not `7203.T`, `BABA` not `9988.HK`, `^TNX` for the 10-year, `DX-Y.NYB` for DXY, `CL=F` for crude.
- **Order**: by relevance, highest first. The client renders left-to-right in this order.
- **Count**: aim for **4–8** per response. Less than 4 is fine if you can't confidently justify more. More than 8 is noise — trim.
- **No fabrication**: if the topic is genuinely not about specific names (e.g. "what is the credit crunch") return `[]`. Strict honesty over completeness — empty is a valid render state.
- **Stable across cache hits**: deterministic for the same input. Cache the `tickers` field along with `text` in the existing synthesize cache (no separate key).

### Implementation freedom

Three viable paths; pick whichever fits the existing service shape:

1. **Marker in the synthesis text**, parsed off and lifted into a structured field. Add `## TICKERS\n- AAPL\n- MSFT\n...` to the end of every kind's prompt. Backend parses, strips from `text`, populates `tickers`. Cheapest — no extra LLM call.
2. **Structured secondary call**. After the main `synthesize` returns, fire a tiny follow-up: "given this topic + these citations, name 4–8 tickers a finance pro would put on the tape." DeepSeek V4 Flash / Haiku 4.5 — ~$0.0002 per call. Cleaner separation of concerns.
3. **Corpus-metadata-first, model fallback**. If your podcast corpus is tagged with `companies_mentioned`, aggregate across the candidate pool first; only call a model if the metadata is empty. Best long-term but only feasible if the metadata exists.

Whichever path you pick, the response shape stays the same.

## Per-kind semantics

The model needs to know what "relevant" means per kind. Bake these into the per-kind prompt (or the secondary call's system message):

### `kind: 'dossier'` — person

> Tickers this person is on record about: the names they're known for covering, plus anything heavily represented in the supplied candidates. Skip ones they merely mentioned in passing.

Examples:
- Dossier on **Mohamed El-Erian** → `["^TNX", "DX-Y.NYB", "GLD"]` (rates, dollar, gold — what he opines on, not stocks)
- Dossier on **Cathie Wood** → `["TSLA", "COIN", "PATH", "RBLX"]`
- Dossier on **Warren Buffett** → `["BRK-B", "AAPL", "OXY", "KO"]`

### `kind: 'brief'` — topic, trailing week

> Tickers most exposed to the story being briefed. For commodity / macro stories, include the underlying (oil, gold, rates). For company-specific or sector stories, include the obvious operators.

Examples:
- Brief on **"Strait of Hormuz oil supply shock"** → `["CL=F", "XOM", "CVX", "OXY", "SLB", "^TNX"]`
- Brief on **"the AI bubble"** → `["NVDA", "MSFT", "GOOGL", "META", "AAPL", "AMZN", "AVGO", "AMD"]`
- Brief on **"yield-curve inversion"** → `["^TNX", "^IRX", "TLT", "^GSPC"]`

### `kind: 'split'` — two camps on one topic

> Same logic as Brief — what's at stake in the debate. Should reflect the topic, not the side names.

Examples:
- Split on **"bulls vs bears on AAPL"** → `["AAPL", "MSFT", "GOOGL"]` (peer context)
- Split on **"the AI bubble"** → Mag-7
- Split on **"Druckenmiller vs Burry on the dollar"** → `["DX-Y.NYB", "^TNX", "GLD", "BTC-USD"]`

### `kind: 'arc'` — person's evolving thesis

> Same logic as Dossier — what this person covers — but biased toward the names they reference IN THE TRACKED THESIS, not their full beat.

Examples:
- Arc on **Luke Gromen, "debt-spiral thesis"** → `["GLD", "^TNX", "DX-Y.NYB", "BTC-USD"]`
- Arc on **Stan Druckenmiller, "AI capex thesis"** → `["NVDA", "MSFT", "META"]`

### `kind: 'readin'` — ticker company

> Tickers are the company's **peers**, not the company itself. The client already knows the primary ticker from the input. Pick 4–6 peers a finance pro would use to triangulate.

Examples:
- Read-in on **AAPL** → `["MSFT", "GOOGL", "META", "AMZN", "NVDA"]` (mega-cap tech peers)
- Read-in on **APP** (AppLovin) → `["TTD", "U", "RBLX", "META", "GOOGL"]` (adtech / digital ads)
- Read-in on **CRWV** (CoreWeave) → `["NVDA", "ORCL", "MSFT", "GOOGL"]` (AI compute hyperscalers)

If the queried ticker isn't a real listed equity, return `[]`.

## Client surfacing (where this renders)

To save you guessing how this gets used: every action's View renders an `<TapeTickerStrip symbols={result.tickers}>` slot in a fixed location. Once `tickers` lands in the response shape, the client switches from canon constants to `result.tickers` with a single edit per View:

| Action       | Strip location                                  | Falls back to                            |
| ------------ | ----------------------------------------------- | ---------------------------------------- |
| Dossier      | Below header, above topic groups                | (currently `tickersForDossier(person)`)  |
| Brief        | Below the headline                              | (currently `TICKERS_BRIEF_OIL`)          |
| Split        | Below the topic tag, above the two columns      | (currently `TICKERS_SPLIT_AI`)           |
| Arc          | Below header, above the conviction chart        | (currently `TICKERS_ARC_GROMEN`)         |
| Read-in      | Deep-depth "Peers" strip (NOT the header card)  | (currently `TICKERS_READIN_APP_PEERS`)   |

Empty array → strip hides. No tickers, no strip. Better than wrong tickers.

The Read-in **header card** is unaffected by this change — it stays driven by the queried ticker via the existing `/api/tape/quote/:slug` proxy. This spec only governs the secondary strip ("On the tape" / "Peers").

## Canon fallback (out of scope for backend, noting for completeness)

The frontend has hand-curated canon fixtures (`SPLIT_AI`, `BRIEF_OIL`, `ARC_GROMEN`, etc.) that short-circuit the live pipeline entirely. Those don't call `synthesize`, so they don't get `tickers` from this spec. The client will keep populating canon results' tickers from the existing constants. No backend work needed there — that's a one-line client change to add `tickers: TICKERS_X` to the canon result shapes.

## Caching

Same as `synthesize` already does: include `tickers` in the cached response body under `tape:syn:v1:...`. No new keys, no new TTLs. If you implement option (1) (marker in the synthesis text), the cache automatically captures it; if (2) (secondary call), make sure the secondary's result is cached alongside the primary so the second hit doesn't pay twice.

## Evidence (what motivated this)

User ran Split: `personA="bulls"`, `personB="bears"`, `topic="aapl"`. Synthesis text was correctly about Apple. The "On the tape" strip rendered `NVDA, META, MSFT, GOOGL, AVGO, AMD` (the hardcoded `TICKERS_SPLIT_AI` Mag-7 constant) instead of `AAPL` plus relevant peers. The client has no way to fix this — it has no relevance signal beyond the topic string itself.

## What we'd like back

1. Confirmation `tickers: string[]` will land on every `synthesize` response with the per-kind semantics above.
2. Whether you'd prefer option (1) marker-in-text or (2) secondary-call. Either is fine for us; (1) saves cost, (2) is cleaner. If you have corpus-metadata-first ((3)), that's the dream.
3. A quick re-run of one of these inputs after the change lands, so we can confirm the field shape end-to-end before wiring the client:
   - Split: `personA="bulls"`, `personB="bears"`, `topic="aapl"` → expect tickers ≈ `["AAPL", "MSFT", "GOOGL", ...]`
   - Brief: `topic="oil & the Strait of Hormuz"` → expect tickers ≈ `["CL=F", "XOM", "CVX", "OXY", ...]`
   - Read-in: `ticker="CRWV"` → expect tickers ≈ `["NVDA", "ORCL", "MSFT", ...]` (peers, not CRWV itself)

## Out of scope this round

- Live price / sparkline data on the returned tickers — those still flow through `/api/tape/quote/:slug` on the client.
- Ticker mention COUNTS or per-clip ticker tags — just a flat ordered list this round.
- Sector / industry classification — order is the only ranking signal.
- Per-citation ticker tagging — separate problem, not blocking.

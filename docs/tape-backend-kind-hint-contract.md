# Tape backend — per-kind contract for `topic-quotes` / `person-quotes`

## Why this exists

Two things just happened:

1. **Client now sends a `kind` hint** on every `topic-quotes` and
   `person-quotes` request. The hint identifies which Tape action is the
   caller (`brief` / `narrative` / `readin` / `split` / `dossier`).
2. **Client stopped pinning `minDate`** in retrieval requests. Backend owns
   window selection. The kind hint is how backend knows which window/policy
   to apply.

You already confirmed the `kind: 'brief'` path works correctly (7d default,
auto-expand to 30d / 90d on thin results, gold case resolves 5/5). This
memo documents what the client expects for the **other four kinds** and
asks for explicit confirmation / pushback on each.

## What the client now sends

Every retrieval call from the Tape services now includes `kind` and does
NOT pin `minDate`. Concrete:

```js
// Brief
topicQuotes({ query, themes, groupBy: 'creator', kind: 'brief',
              filters: { mainstream: true, candidatesLimit: 30 } })

// Narrative — all/consensus
topicQuotes({ query, themes, kind: 'narrative',
              filters: { mainstream: true, candidatesLimit: 60,
                         disableRecencyWeighting: true } })

// Narrative — bull/bear
topicQuotes({ query, themes, groupBy: 'bull-bear', kind: 'narrative',
              filters: { mainstream: true, candidatesLimit: 60,
                         disableRecencyWeighting: true } })

// Narrative — named person
personQuotes({ name, themes: [topic], kind: 'narrative',
               filters: { guestsOnly: true, dedicatedOnly: false,
                          mainstream: true, episodesLimit: 15,
                          quotesPerEpisode: 4, candidatesLimit: 60,
                          disableRecencyWeighting: true } })

// Read-in
topicQuotes({ query: ticker, themes: [ticker, `${ticker} stock company business`],
              kind: 'readin',
              filters: { mainstream: true, candidatesLimit: 20 } })

// Split — camp mode
topicQuotes({ query: topic, themes: [topic], groupBy: 'bull-bear',
              kind: 'split',
              filters: { mainstream: true, candidatesLimit: 30 } })

// Split — named A vs B (two parallel calls)
personQuotes({ name: personA, themes: [topic], kind: 'split' })
personQuotes({ name: personB, themes: [topic], kind: 'split' })

// Dossier
personQuotes({ name: person, themes: DEFAULT_DOSSIER_THEMES,
               kind: 'dossier' })
```

## Per-kind expected backend behavior

Confirm or push back on each row. Where you've already implemented it,
just note that. Where the implementation differs from this table, tell us
what you actually do and we'll align.

| Kind | Default window | Auto-expand on thin | Recency weighting | Notes |
| ---- | -------------- | ------------------- | ----------------- | ----- |
| `brief` | 7 days | 7d → 30d → 90d (CONFIRMED shipped) | 1 week half-life or strong recency | "This week's read" framing — recency is load-bearing |
| `narrative` | 24–36 months | No auto-expand (window already wide) | **Disabled** (`disableRecencyWeighting: true` honored) | Per the cadence memo: time dimension IS the point |
| `readin` | 12–18 months | Maybe to 24m on thin | 6-month half-life | Business velocity matters — old quotes can mislead (ORCL 2021 case) |
| `split` | 6–12 months | Maybe to 18m on thin | 6-month half-life | Current debate, not historical |
| `dossier` | 18–24 months | Maybe to 36m on thin | 18-month half-life | Person's positions evolve; older stuff is biography |

These mirror the half-life table in
[tape-backend-recency-weighting.md](tape-backend-recency-weighting.md).

## Specific asks

1. **Confirm `kind` is wired through on `topic-quotes` and `person-quotes`.**
   Brief is confirmed. Confirm the other four respect it (or tell us which
   ones don't yet).
2. **Confirm per-kind window defaults.** Match the table or tell us your
   actual values.
3. **Confirm auto-expand policy per kind.** Brief is confirmed; what about
   the other kinds when results are thin?
4. **Confirm `disableRecencyWeighting: true` is honored for Narrative.**
   We're sending it; want to verify it actually disables weighting on the
   backend side (otherwise multi-year buckets get age-penalized into
   nothing).

## Withdrawn ask

**Ask #0 from [tape-backend-retrieval-relevance-memo.md](tape-backend-retrieval-relevance-memo.md)
(NLP escalation to /api/pull inside topic-quotes) is WITHDRAWN.** You were
right — it breaks the Tape / pull separation we explicitly established.
The request-shape fix (`kind` hint + drop pinned `minDate`) resolves the
gold case without coupling. Sorry for the noise.

## Accepted offer

Your offer to make Brief's auto-expand robust to a client-pinned `minDate`
("treat it as the step-1 floor and widen anyway"): **accepted** as
defense-in-depth, low priority. The client fix above means we don't pin
`minDate` anymore on Brief, so this is belt-and-suspenders. Ship if cheap;
don't prioritize.

## Acceptance tests per kind

After the client patch lands and you confirm backend behavior, we'll
re-run these to validate the full pipeline:

| Kind | Test query | Expected |
| ---- | ---------- | -------- |
| Brief | `topic: "gold prognosis"` (no asOf needed beyond today) | ≥5 candidates, all literally containing "gold" or a gold proxy, auto-widened to 30d if needed (`windowDays`/`windowExpanded` surfaced per the confidence + cadence memo) |
| Brief | `topic: "oil & the Strait of Hormuz"` (today) | ≥5 candidates, all on-topic, 7d window sufficient (`windowExpanded: false`) |
| Narrative | `topic: "the AI bubble"` (no group, ~36mo) | 20+ candidates distributed across the window; cluster late 2025–2026 |
| Read-in | `ticker: "CRWV"` | All candidates literally mention CRWV / CoreWeave; no wine companies, no leveraged ETFs |
| Split | `personA: "Bulls", personB: "Bears", topic: "AAPL"` | Each side has multiple candidates; topic stays AAPL |
| Dossier | `person: "Mohamed El-Erian"` | 5+ dedicated appearances; positions span the last 18 months |

## Out of scope this round

- Cross-kind retrieval (e.g. one endpoint covering all kinds). The current
  composite endpoints (`topic-quotes`, `person-quotes`) are the right
  abstraction.
- New endpoints. We're using what's there; just confirming the contract.
- Per-section confidence (Read-in WHAT_THEY_DO vs SMART_MONEY etc.). Still
  out of scope per the prior memo.

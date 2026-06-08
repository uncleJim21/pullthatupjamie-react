# Tape backend — `topic-quotes` retrieval relevance (urgent)

## TL;DR

`POST /api/tape/topic-quotes` is returning candidates that are
**semantically adjacent but not actually about the query**. Today's failure:
Brief on `topic: "gold prognosis"` came back with 3 candidates — none of
which contain the word "gold." The synthesizer correctly returned
`confidence: 'empty'`, but the real problem is upstream: gold is one of the
most-covered macro topics in the corpus and we got nothing on it.

This isn't a synthesis bug. The synthesizer did its job. **Retrieval is the
break.**

## Evidence

Request (raw):
```json
POST /api/tape/synthesize
{
  "kind": "brief",
  "input": { "topic": "gold prognosis" },
  "candidates": [/* 3 items, all from topic-quotes */]
}
```

The three candidates `topic-quotes` returned:

| # | Source | Date | Snippet (first 80 chars) | Contains "gold"? |
| - | ------ | ---- | ------------------------ | ---------------- |
| 1 | Bloomberg Surveillance | 2026-06-03 | "raised your S&P 500 price target to eight thousand… Middle East… AI capex…" | **No** |
| 2 | Bloomberg Surveillance | 2026-05-28 | "bond moves priced outcuts… ECB, Japan, Australia, central bank hikes…" | **No** |
| 3 | All-In | 2026-05-29 | "Pope vs AI… defending these guys… apocalyptic future…" | **No** |

Zero literal mention of gold across 3 results. The corpus has Real Vision,
Macro Voices, Forward Guidance, Grant Williams, Hidden Forces — gold gets
discussed weekly on multiple of those. Something is filtering it all out, or
nothing is retrieving it in the first place.

Also notable: only **3 candidates returned total**, well under any reasonable
limit. Retrieval recall is broken before relevance is even a question.

## What's likely wrong (in priority order)

### 1. No literal-term anchoring on the query

When the topic contains a clear noun ("gold," "oil," "AAPL," "Hormuz"),
candidates that don't contain that exact word (case-insensitive, with simple
plural/possessive tolerance) should either:
- be **boosted DOWN** in ranking, or
- be filtered out entirely past a threshold.

Pure-vector semantic search will happily return "S&P 500 target raised"
when asked about "gold prognosis" because the embeddings cluster all
finance-ish chatter together. A literal-term constraint stops the
hallucinated relevance.

### 2. No theme expansion on natural-language queries

"Gold prognosis" is not phrasing anyone uses on a macro podcast. Real
phrasings: "gold price target," "gold rally," "gold breakout," "gold safe
haven," "gold $X handle," "gold miners," "gold/silver ratio." The backend
should expand the user query into 3-6 plausible podcast phrasings before
fanning out to `search-quotes`. We flagged this in the original
conform-to-contract spec; still pending.

Theme expansion shape:
- Send the user's topic to a cheap LLM call (Haiku 4.5 or DeepSeek Flash)
  with instruction: "Give me 4-6 ways a macro podcaster would phrase
  discussion of this topic." Cost: ~$0.0001 per query.
- Use the expanded themes as the search-quotes input.
- Cache by canonicalized user query, TTL 24h+ — most queries repeat.

### 3. Mainstream allowlist may be too narrow for gold

Audit the allowlist for gold coverage. Real Vision, Macro Voices, Hidden
Forces, Grant Williams, Forward Guidance, and Tim Ferriss all cover gold
seriously. If any of those are excluded by the current allowlist OR are in
the deny list, gold queries will look like Bloomberg-on-bonds because that's
all that survives.

### 4. Relevance score threshold is too low (or absent)

If `topic-quotes` returns candidates ordered by vector-similarity score and
truncates at top-N regardless of absolute score, you get garbage results for
any query the corpus doesn't actually cover. A minimum absolute relevance
floor (drop candidates below score X) would return an empty pool when the
corpus truly doesn't have material — letting the client show the right
empty-state instead of feeding the synthesizer noise.

## Asks (in priority order)

### 0. NLP escalation inside `topic-quotes` (highest leverage)

When `topic-quotes`'s first-pass vector retrieval returns zero candidates
(or all candidates fail the literal-term anchor / relevance floor below),
**escalate internally to `/api/pull`** before giving up. The pull agent does
multi-step agentic retrieval — exactly the behavior `topic-quotes` lacks
when its single-pass vector search fails.

Shape:

```
topic-quotes handler:
  1. First-pass: vector search + theme expansion (current).
  2. If candidates.length === 0 OR all candidates fall below relevance floor:
     → call /api/pull internally with a NL prompt like:
         "Find recent (last 30d) mainstream podcast quotes about <topic>.
          Cite each one with {{clip:pineconeId}} tokens. Prefer Bloomberg,
          Macro Voices, Real Vision, Forward Guidance, Hidden Forces."
     → parse the {{clip:id}} tokens from pull's text
     → hydrate each id into the standard candidate shape via get-hierarchy
     → return those as if they came from first-pass.
  3. If both passes empty: return `confidence: 'empty'` with reason.
```

**Critical:** the escalation is entirely server-side. The client never sees
`/api/pull`. The Tape-specific abstraction (topic-quotes / person-quotes /
synthesize) is preserved as the only client-facing surface.

Why this matters: `/api/pull` is the agent that has actually been
demonstrated to find macro material reliably. Right now, when `topic-quotes`
can't find gold (today's failure) we have no recourse — but the SAME corpus,
via pull, would surface dozens of gold quotes. The retrieval intelligence
exists; it's just locked behind the wrong endpoint for Tape's use case.

The asks below are still valid as quality improvements to first-pass — but
escalation is the resilience play.

### 1. Add literal-term anchoring

For queries containing a recognizable noun, post-filter candidates: keep
only those where `text.toLowerCase()` contains the term (or a stemmed /
plural variant). Single-line patch on the search-quotes consumer.

### 2. Theme expansion (PARTIALLY LANDED — confirm shipping path)

We saw `themes: 6` in the recent response → expansion IS running. Confirm
which approach you took (LLM rewrite vs synonym map vs other) and how
themes are derived. The gold-prognosis failure suggests the expanded themes
aren't actually surfacing gold material, so the expansion logic may need
tuning even though it's wired up.

### 3. Audit the mainstream allowlist for gold coverage gaps

If Real Vision / Macro Voices / Hidden Forces / Grant Williams / Forward
Guidance aren't in the allowlist, add them. Gold queries shouldn't be
disproportionately starved by allowlist gaps.

### 4. Add a relevance-score floor

If top vector match is below threshold, return zero candidates (empty pool)
rather than top-3 noise. Client already handles empty gracefully. This also
becomes the trigger condition for the NLP escalation in ask 0.

## What the client will do

Nothing on this fix — retrieval is your domain. The client renders whatever
candidate quality you ship. We already handle `confidence: 'empty'`
gracefully via the new pill / empty-state UI from the previous memo.

## Re-test target

Same query, same date, paste back the new `topic-quotes` response:

```
POST /api/tape/topic-quotes
{
  "query": "gold prognosis",
  "themes": ["gold prognosis"],
  "filters": { "mainstream": true, "candidatesLimit": 20, "minDate": "<7d ago>" }
}
```

Expected after fix: at minimum 5-10 candidates, **every one containing the
word "gold" or a clear gold proxy** (GLD, gold miners, bullion, etc.). If
the 7d window is genuinely too thin (low gold mentions this week), the
auto-expand from the [confidence + cadence memo](tape-backend-confidence-and-cadence-memo.md)
should kick in to 30d / 90d and surface real material.

## Out of scope this round

- Reranking with a second-stage cross-encoder. Literal-term + theme expansion
  is the 80% fix; cross-encoder reranking is the next level.
- Per-corpus relevance calibration. Single global threshold is fine for v1.
- Negative-query filtering ("gold" should NOT match "Goldman Sachs" or
  "Goldilocks economy"). Edge case, can punt.

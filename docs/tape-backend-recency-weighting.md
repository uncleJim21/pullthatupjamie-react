# Tape backend — recency weighting on candidate retrieval

## Why

Read-in on ORCL surfaced quotes from 2021 — when Oracle was a legacy database company. Today it's an AI compute hyperscaler. The 2021 quotes aren't *wrong*; they're catastrophically off-base for the current business. Same risk applies to NVDA pre-2023 (gaming GPUs vs AI compute), TSLA pre-2020 (luxury sedans vs mass-market EV maker), and any name where the underlying thesis changed materially.

Today the retrieval layer (`topic-quotes`, `person-quotes`) treats a high-relevance quote from 2021 the same as a high-relevance quote from last month. We need to **weight candidates by recency**, with the strength of the decay tunable per kind.

A hard cutoff is wrong — Buffett on Goldman in 2008 is still good color. A soft decay is right — older quotes can survive when their relevance score is strong enough to overcome the age penalty.

## The contract

Soft recency weighting added to candidate scoring inside `topic-quotes` and `person-quotes`. Applied as a multiplicative factor against the relevance score during candidate ranking, before truncation to `candidatesLimit`.

### Scoring formula

```
weighted_score = relevance_score * exp(-age_months / half_life_months)
```

Where:
- `relevance_score` is whatever you compute today (embedding similarity + span + signals).
- `age_months` is months between the candidate's `publishedDate` and `now`.
- `half_life_months` is per-kind (see table below). Candidates this old get exactly half-weight.

`exp(-age / hl)` gives a smooth decay. A quote at 1 half-life keeps 50% of its score; 2 half-lives = 25%; 3 half-lives = 12.5%. A 2021 quote against a 6-month half-life loses ~98% of its weight — effectively filtered, but only if newer candidates exist to push it out. A 2-year-old quote against an 18-month half-life keeps ~40% — survives if it's strong enough.

### Per-kind half-lives

| Kind     | Half-life       | Rationale                                                                              |
| -------- | --------------- | -------------------------------------------------------------------------------------- |
| Brief    | **1 week**      | The action's framing is "this week." Anything older is the wrong window.               |
| Read-in  | **6 months**    | Business velocity. Old quotes can be wrong about the current company.                  |
| Split    | **6 months**    | Current debate, not historical. Same logic as Read-in.                                 |
| Dossier  | **18 months**   | Person's positions evolve. Older stuff is biography, not their current beat.           |
| Arc      | **none / disabled** | The whole point of Arc IS the time dimension. Recency weighting would destroy it. |

For Arc, the retrieval shouldn't weight at all — let the synthesizer see the full multi-year spread.

### Where this lives

Inside `topic-quotes` and `person-quotes`, in the ranking step that runs after dedup + before `candidatesLimit` truncation. Request body gains an optional override; if the caller doesn't specify, backend looks up the half-life from the kind being requested (or a sensible default if no kind context is available).

### Request shape (optional override)

```json
{
  "query": "...",
  "themes": [...],
  "filters": {
    "mainstream": true,
    "halfLifeMonths": 6,         // <-- NEW. Optional. Per-kind default if absent.
    "disableRecencyWeighting": false  // <-- NEW. Optional escape hatch for Arc.
  }
}
```

Most callers won't set these — the per-kind default is correct. The override exists so:
- Arc can pass `disableRecencyWeighting: true` and get the full historical spread.
- A future user-facing "see older context" affordance can pass a longer half-life.

### Response shape

Add to `_meta`:

```json
{
  "_meta": {
    "underlying": {...},
    "cached": false,
    "halfLifeApplied": 6,                  // <-- NEW. The decay used, for transparency.
    "weightingDisabled": false             // <-- NEW. True if Arc-style no-weighting.
  }
}
```

Lets us surface "pulled from ~6 months" to the user later if we want.

## Side benefit: solves stale-cache reads

Recency weighting compounds gracefully with caching: a candidate that was high-ranked 30 days ago when first cached now ages naturally on the next cache miss. No need to bust the cache more aggressively just because content is older — the weighting handles it.

## Stretch goal (out of scope this round): regime detection

The ideal version of this asks the model: "did this company / topic change materially in a recent window?" — and if yes, drops the half-life dynamically. For NVDA: "before ChatGPT" vs "after ChatGPT" — pre-2023 quotes get penalized harder, not just by absolute age but by regime.

Too complex for v1. Mention so it's on record. The fixed per-kind half-lives above handle the average case correctly; regime detection is the next 80→95% improvement.

## What we'd like back

1. Confirmation the weighting can land in `topic-quotes` and `person-quotes` with the per-kind half-life table above.
2. Confirmation Arc bypasses weighting (or uses a much longer half-life, e.g. 60 months).
3. Whether `_meta.halfLifeApplied` surfaces in responses — we'd render a small "pulled from the last X months" hint when present.
4. After ship: a quick re-run of `Read-in on ORCL` so we can confirm 2021 quotes no longer dominate when current ones exist.

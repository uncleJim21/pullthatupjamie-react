# Tape backend — confidence tiers + adaptive cadence + Brief auto-expand

## TL;DR

Three changes to `synthesize`, applied across all five kinds:

1. **Confidence tier on `_meta`** — explicit enum (`strong` / `partial` /
   `thin` / `empty`) so the client can show a "limited data" pill instead of
   silently producing or returning nothing. Same enum across every kind;
   per-kind criteria for tier assignment.

2. **Adaptive bucket cadence** (Narrative only) — drop the static "yearly
   for >3y" rule. Bucket widths follow data density. Where the conversation
   was active, narrower buckets; where it was sparse, wider.

3. **Brief auto-expanding window** — when the 7-day window is too thin,
   widen to 30d (then 90d if still thin) automatically. Backend reports
   which window it actually used. Solves the "gold prognosis returned empty
   for THIS WEEK when there's a month-old story" case.

## Why we're writing this

Two real failures that have the same root cause:

- **Narrative on "ai bubble"** → 23 on-topic candidates, `synthesizedEmpty:
  true` because the synth couldn't fill 3 evenly-spaced buckets across a
  36-month window (most coverage clusters in the last 6 months).
- **Brief on "gold prognosis"** → topic-quotes returned zero candidates for
  the 7-day window, no auto-widening. Even though gold gets discussed
  monthly across mainstream macro shows.

Both look like missing data; both are actually about **uneven distribution
across the requested window**. The fix is to let the backend communicate
WHAT it found and how confidently, and to adapt the window when the
default is too narrow.

## Change 1 — Confidence tier (all kinds)

### Response addition (every `synthesize` response)

```json
{
  "kind": "<dossier|brief|split|narrative|readin>",
  "text": "...",
  "_meta": {
    "candidateCount": 23,
    "confidence": "partial",
    "confidenceReason": "Coverage clusters in the last 6 months; earlier history sparse.",
    "synthesizedEmpty": false,
    // ... existing fields
  }
}
```

### Tier enum (unified across all kinds)

| Tier | Render outcome | General meaning |
| ---- | -------------- | --------------- |
| **`strong`** | Full result; no pill | Synthesis well-grounded in plentiful, distributed data |
| **`partial`** | Result + yellow pill with `confidenceReason` | Synthesis succeeded but coverage is uneven or limited |
| **`thin`** | Result + red pill with `confidenceReason` | Output rendered but trajectory/claims are weak |
| **`empty`** | Empty state, `text: ""`, `confidenceReason` shown verbatim | Below the threshold for any meaningful synthesis |

The tier is **the backend's editorial judgment** — not strictly derivable
from `candidateCount`. A backend with a strong classifier may say `strong`
on 12 candidates if they're high-quality and well-spread; another may say
`partial` on 30 if they cluster in a single window.

### `confidenceReason`

One short sentence (≤100 chars) the client renders verbatim. Examples
across kinds:

- (Narrative) `"Coverage clusters in Oct 2025 – Apr 2026; earlier history sparse."`
- (Brief) `"Widened to 30 days; only 4 mentions this week."`
- (Read-in) `"Limited bear-case material; smart-money strip incomplete."`
- (Split) `"Person B side thinly represented; contrast weak."`
- (Dossier) `"Subject has only 3 mainstream appearances — narrow sample."`

### Per-kind tier criteria

These are guideposts. Backend can override per its own editorial judgment.

#### Narrative

| Tier | When |
| ---- | ---- |
| `strong` | 20+ candidates, ≥2 per bucket, distribution spans most of requested range, 4+ buckets emitted |
| `partial` | 10-25 candidates, clustered in a sub-window, OR fewer than half the buckets the range would naturally support |
| `thin` | <10 candidates OR only 1-2 buckets warranted |
| `empty` | Below the threshold for even a single bucket |

#### Brief

| Tier | When |
| ---- | ---- |
| `strong` | 3+ distinct publishers in the effective window, multiple quotes per publisher |
| `partial` | Only 1-2 publishers OR backend had to widen past 7d (note in `confidenceReason`) |
| `thin` | <3 total quotes, single source |
| `empty` | No relevant quotes even after auto-widening to 90d |

#### Read-in

| Tier | When |
| ---- | ---- |
| `strong` | WHAT_THEY_DO + PULSE + both SMART_MONEY sides + RISKS all confidently rendered |
| `partial` | One major section (SMART_MONEY BULL/BEAR, RISKS) couldn't be synthesized |
| `thin` | Only WHAT_THEY_DO + a marquee quote; no bull/bear structure available |
| `empty` | Ticker not in corpus or zero meaningful mentions |

#### Split

| Tier | When |
| ---- | ---- |
| `strong` | Both sides have 4+ quotes each, contrast meaningful |
| `partial` | One side significantly thinner (e.g. 8 vs 2) |
| `thin` | <4 total quotes across both sides combined |
| `empty` | One or both sides have zero quotes |

#### Dossier

| Tier | When |
| ---- | ---- |
| `strong` | 5+ dedicated-episode appearances, 3+ distinct topic groups |
| `partial` | 3-5 appearances, may be missing recent positions |
| `thin` | <3 appearances OR all from non-dedicated episodes |
| `empty` | Person not in corpus |

## Change 2 — Adaptive bucket cadence (Narrative only)

### Drop these from the existing narrative spec

- The "at least 3 BUCKET blocks REQUIRED" floor. **Replace with: at least 1
  bucket** if confidence is `thin` or better.
- The static cadence table (`<12mo → monthly`, `1-3y → quarterly`, `>3y →
  yearly`). **Replace with: per-bucket cadence chosen by density.**

### Variable-width buckets

Each bucket's window matches the **local density** of the candidate stream,
not the overall requested range. For "ai bubble" with 23 candidates
clustered in late 2025 / early 2026:

```
## BUCKET | 2023-01-01 | 2024-12-31 | <sentiment>     // 2 years, sparse
## BUCKET | 2025-01-01 | 2025-09-30 | <sentiment>     // 9 months, building
## BUCKET | 2025-10-01 | 2025-12-31 | <sentiment>     // 3 months, dense
## BUCKET | 2026-01-01 | 2026-02-28 | <sentiment>     // 2 months, dense
## BUCKET | 2026-03-01 | 2026-04-30 | <sentiment>     // 2 months, recent
```

Variable widths are correct output. Client renders them with non-uniform
spacing on the trajectory chart (x-axis is date midpoint, not bucket index
— already implemented).

### Two implementation paths

**Path A — LLM-decided boundaries (recommended).** Feed sorted candidates
to the synthesizer with the instruction: "Choose 3-8 bucket boundaries that
reflect the rhythm of the conversation. Narrower windows where coverage is
dense; wider where sparse. Each bucket needs ≥2 candidates."

**Path B — Pre-processed density buckets.** Rolling-window candidate count
(60-day windows), cut at density transitions, pass fixed windows to the
synthesizer. More code, more deterministic.

### Constraints

- Minimum 1 bucket, maximum ~10 buckets.
- ≥2 candidates per bucket.
- Chronological, non-overlapping.
- Variable widths explicitly allowed.

## Change 3 — Brief auto-expanding window

### Why

`topic: "gold prognosis", asOfDate: 2026-06-02` returned zero candidates
because nothing was said about gold in the literal 7-day window ending that
date. Real macro analysts care about gold; just not on a precise weekly
cadence. The "this week" framing is the wrong default — should be a
preference, not a hard constraint.

### Behavior

When `kind: 'brief'`, retrieval starts at the standard 7-day window. If
fewer than **3 candidates** survive (after mainstream allowlist + topic
match), backend automatically widens:

| Step | Window | Trigger |
| ---- | ------ | ------- |
| 1 | 7 days | Default |
| 2 | 30 days | <3 candidates from step 1 |
| 3 | 90 days | <3 candidates from step 2 |
| 4 | Give up | <3 candidates from step 3 → `confidence: 'empty'` |

The `asOfDate` (window end) stays fixed; only the lookback extends.

### Response addition

```json
{
  "_meta": {
    "windowDays": 30,                                   // NEW: actual lookback used
    "windowExpanded": true,                              // NEW: true if past the default 7d
    // ... confidence fields, etc.
  }
}
```

When `windowExpanded === true`, `confidenceReason` should mention it
explicitly so the user understands the result isn't strictly "this week":

- `"Widened to 30 days; only 4 mentions in the past week."`
- `"Widened to 90 days; gold coverage thin in recent windows."`

### Client behavior

- Brief result header displays a small "Widened to 30 days" pill when
  `windowExpanded` is true.
- Confidence pill renders alongside per the general pattern.

## Client UX — pill labels (not banners)

Reusing existing `tape-tag` / `tape-pill` patterns rather than introducing
a new banner element. One small inline component, used identically across
all kinds.

### Placement

- **Narrative** (the primary surface) — pill in the result header row,
  alongside the topic title and group filter tag.
- **Brief / Read-in / Split / Dossier** — pill in result header, same slot
  as the existing topic/person tag.

### Pill styling per tier

- `strong` → not rendered (no pill at all).
- `partial` → yellow border + yellow text, label: `PARTIAL`. Hover/click
  reveals `confidenceReason`.
- `thin` → red border + red text, label: `THIN`. Same hover/click reveal.
- `empty` → no pill; empty state replaces the entire result and shows
  `confidenceReason` as the message.

### For Brief specifically

When `_meta.windowExpanded === true`, render an additional small pill next
to the confidence pill: `30d` or `90d` (whichever was used). Faint accent
color. Signals "this isn't strictly the trailing week."

## Acceptance tests

Re-run each after ship; paste raw responses back so we can validate before
users hit them.

| Kind | Query | Expected `confidence` | Notes |
| ---- | ----- | --------------------- | ----- |
| Narrative | `topic: "ai bubble"` (no group, 36mo range) | `partial` | 4-6 mixed-width buckets, recent monthly windows present, reason mentions clustering |
| Brief | `topic: "gold prognosis"` (asOf today) | `partial` or `thin` | `windowExpanded: true`, `windowDays: 30+`, at least 2-3 publishers surface |
| Brief | `topic: "oil & the Strait of Hormuz"` (asOf today) | `strong` | 7d window sufficient; no auto-expand |
| Read-in | `ticker: "CRWV"` | `partial` | WHAT_THEY_DO present, SMART_MONEY likely incomplete, reason names the gap |
| Split | `personA: "bulls", personB: "Druckenmiller", topic: "rate cuts"` | `partial` | Asymmetric coverage flagged |
| Dossier | `person: "Howard Marks"` | `strong` or `partial` depending on corpus depth |

## What we'd like back

1. Confirmation `_meta.confidence` + `confidenceReason` + `candidateCount`
   ship on **every** kind, using the unified enum.
2. Confirmation the Narrative-specific adaptive cadence ships (Path A or B,
   either's fine — let us know which).
3. Confirmation the Brief auto-expanding window ships, with
   `_meta.windowDays` + `_meta.windowExpanded` on the response.
4. Per-kind acceptance test results pasted back after ship.

## What we'll do on our side

- Add `confidence`, `confidenceReason`, `candidateCount` to
  `TapeResponseMeta` in `tapeClient.ts`.
- Add `windowDays`, `windowExpanded` to the same type (Brief-specific but
  cheap to keep on the shared shape).
- Build a `<ConfidencePill>` component sized as a `tape-tag`. Render in the
  header of all five action result Views.
- For Narrative: also gets a `windowExpanded` style affordance if you
  decide auto-expand applies (out of scope for v1 since Narrative's window
  is already 36mo+).
- For Brief: render the `30d` / `90d` pill when `windowExpanded`.
- For all kinds: when `confidence === 'empty'`, replace the result with
  the empty state and render `confidenceReason` verbatim as the message.

## Out of scope this round

- Per-section confidence on Read-in (e.g. high confidence on WHAT_THEY_DO,
  low on SMART_MONEY). The kind-level tier with a descriptive reason is
  enough for v1.
- Auto-expanding window on kinds other than Brief. Narrative's window is
  already wide; Dossier / Read-in / Split don't have a "this week" framing.
- User-tunable confidence threshold. Backend's editorial judgment is the
  source of truth.

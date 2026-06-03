# Tape backend — Narrative endpoint spec

This is the canonical spec for what backend needs to build to power the new
**Narrative** action. Supersedes the earlier exploratory doc
[tape-arc-reshape-spec.md](tape-arc-reshape-spec.md) — the front end has
shipped, the UX is locked, this is the contract.

## Context

The frontend has a mock-only implementation of Narrative live in production
behind the demo gate. View: `src/components/tape/actions/NarrativeView.tsx`.
Service: `src/services/tape/narrativeService.ts` (canon-only fallback today).
Once you ship the live path described below, we wire `narrativeService` to
hit your endpoint the same way `dossierService` etc. already do.

## What the action does

Topic-first analysis of how the **prevailing view** on something has drifted
over time. Optional group filter narrows the population:
- `bulls` / `bears` → sentiment-camp filter on the topic
- `<named person>` → that person's quotes only (preserves the Gromen
  "track record" use-case as a special case of the same action)
- omitted / `all` → consensus across all mainstream sources

Output is chronological buckets, each carrying:
- A 2-3 sentence stance summary for the window
- 1-4 supporting citations
- **A signed sentiment value (-5 to +5)** — this is load-bearing for the
  trajectory chart on the client

Plus inflection callouts (when the narrative shifted) and an optional
forward-looking gloss.

## Endpoint: `synthesize { kind: 'narrative' }`

Same envelope as other kinds. New marker contract:

```
## THESIS: <one-sentence current consensus / group's current view>

## BUCKET | <ISO start> | <ISO end> | <signed sentiment: -5..+5>
<2-3 sentence stance summary for this window>
{{clip:id}}
{{clip:id}}

## BUCKET | <ISO start> | <ISO end> | <signed sentiment: -5..+5>
<...>
{{clip:id}}

## INFLECTION
- <YYYY-Qn OR ISO date>: <one-sentence what changed and (briefly) why>
- <...>

## FORWARD: <one-line where this trajectory is heading>
```

- `## THESIS` and **at least 3** `## BUCKET` blocks are REQUIRED.
- `## INFLECTION` and `## FORWARD` are OPTIONAL — omit if the candidates don't
  confidently support them (do NOT render empty section headers).
- Buckets MUST be in chronological order, oldest → newest.
- Sentiment is the **third pipe-delimited field** on each `## BUCKET` line.
  Integer, -5 to +5 inclusive. **Required** on every bucket.

## Sentiment rubric (the new thing)

Sentiment is signed conviction-on-the-thesis. Sign indicates direction,
magnitude indicates how forcefully the prevailing voices in the window were
stating that position.

### Direction (sign)

- **Positive** = the prevailing voices supported / advanced the thesis
- **Negative** = the prevailing voices contradicted / pushed back against it
- **Zero** = ambivalent, mixed, or genuinely neutral

A **sign-flip across zero between adjacent buckets is a reversal** — the
client automatically renders a "REVERSAL" marker at the zero crossing on the
trajectory chart. Don't smooth this out; if you see a reversal in the data,
let the sentiment values reflect it.

### Magnitude (1-5)

| Magnitude | Language cues |
| --------- | ------------- |
| **5** | Absolute, no hedging: "definitely," "guaranteed," "no question," "obviously," "the only outcome" |
| **4** | Strong: "I'm convinced," "this is clear," "the data is unambiguous" |
| **3** | Confident but caveated: "I think," "probably," "the best read is" |
| **2** | Soft: "could," "might," "worth considering," "leaning toward" |
| **1** | Highly hedged: "possibly," "one scenario is," "not impossible" |

### Special case — named-person filter (Gromen, Druckenmiller, etc.)

When `group` is a specific person, sentiment measures **their conviction
strength** on the thesis. Sign reflects whether they support or oppose it
(usually + since they're the thesis source). The Gromen canon illustrates
this: his sentiment ramps from +2 (cautious framing in 2021) to +5 (fully
landed in 2026), even though he never reversed direction.

### Special case — group filter (bulls / bears / all)

Sentiment measures the **aggregate direction × confidence** of the chosen
group's quotes in that window. If "bulls on AAPL" became more emphatic, the
magnitude goes up. If a chunk of them capitulated (e.g. after a brutal
earnings miss), sentiment can drop or even flip negative.

## Bucket cadence

Backend picks based on the date range available:

| Range covered    | Bucket cadence |
| ---------------- | -------------- |
| < 12 months      | Monthly        |
| 1-3 years        | Quarterly      |
| > 3 years        | Yearly         |

Don't surface the cadence choice in the response — the client renders
whatever start/end pairs come back.

## Retrieval expectations (upstream of synthesize)

Before calling `synthesize`, retrieve candidates via the existing
`topic-quotes` / `person-quotes` endpoints with these constraints:

1. **Wide time window** — default 24-36 months. Extend to all available
   history when the topic and corpus permit.
2. **Recency weighting DISABLED** for Narrative. The
   [recency weighting spec](tape-backend-recency-weighting.md) explicitly
   carves Narrative out — pass `disableRecencyWeighting: true` if the
   feature has shipped, otherwise just don't apply it.
3. **Group filter applied at retrieval**:
   - `bulls` / `bears` → use the existing `topic-quotes.groupBy: 'bull-bear'`
     classifier; keep only the matching side.
   - `<named person>` → route via `person-quotes` with the topic in
     `themes`.
   - omitted / `all` → standard mainstream filter only.
4. **Target ~30-60 candidates** spread across the window. Don't truncate
   aggressively; the synthesizer needs material to bucket.
5. Reuse the **mainstream allowlist** from the editorial taste config.

## Tickers field

Same as every other kind — include `tickers: string[]` on the response
populated per the [tickers spec](tape-backend-tickers-spec.md). For
Narrative, pick the names most exposed to the **topic**, not the group
filter. ("Narrative on AI capex" → Mag-7 regardless of whether you're
filtered to bulls or bears.)

## Response JSON shape

```json
{
  "kind": "narrative",
  "text": "## THESIS: ...\n\n## BUCKET | 2023-01-01 | 2023-12-31 | 4\n...",
  "tickers": ["GLD", "TLT", "DX-Y.NYB", "%5ETNX"],
  "tokens": { "input": 4120, "output": 1830 },
  "model": "claude-haiku-4-5-20251001",
  "elapsedMs": 24300,
  "_meta": {
    "cached": false,
    "tier": "qualitative",
    "fetchedAt": "...",
    "stale": false
  }
}
```

The client parses `text` against the marker contract. No additional
top-level fields are needed for this kind.

## Caching

Standard `synthesize` cache: `tape:syn:v1:narrative:{sha256(input + candidates + model)}`,
TTL 2h. Same eviction / refresh semantics as the other kinds.

## Compliance

The kind-compliance validator from
[tape-backend-kind-compliance.md](tape-backend-kind-compliance.md) should
extend to Narrative:

```python
REQUIRED_MARKERS["narrative"]  = ["## THESIS", "## BUCKET |"]
FORBIDDEN_CROSS_KIND["narrative"] = ["## WHAT_THEY_DO", "## PULSE |", "## HEADLINE", "## PUBLISHER", "## TOPIC:", "## PERSON:"]
```

Plus: validate that **every** `## BUCKET` line has a parseable signed integer
in the third pipe slot. If a bucket is missing sentiment, treat as
compliance failure → one auto-retry → 502 if it fails again.

## Evidence — what to test against once shipped

Three queries we'll re-run end-to-end after you ship:

1. **Canon-shaped**: `topic: "the sovereign debt endgame", group: "Luke Gromen"`
   — should produce ~5 buckets spanning 2021-2026 with sentiment climbing
   roughly +2 → +5 (matches the hand-curated canon already in the client).
2. **Bull-bear consensus on a hot topic**: `topic: "the AI bubble", group: "bears"`
   — should produce ~6-8 buckets with sentiment trajectory reflecting
   whether the bear case has gained or lost ground over the window. We
   expect to see at least one inflection point.
3. **Open consensus, no group**: `topic: "rate cuts in 2026"` —
   should show recent debate, likely shorter window (monthly buckets),
   sentiment probably ambivalent with some sign-flips as Fed guidance
   evolved.

After ship, paste the raw `synthesize.text` for each back to us so we can
validate end-to-end before users hit it.

## Out of scope this round

- **Sentiment over time at sub-bucket resolution** (e.g. continuous curve
  instead of bucketed points). The bucket model is the contract; finer
  resolution is a future polish.
- **Per-citation sentiment scoring**. We only score at the bucket level for
  now.
- **Cross-group comparison** ("bulls vs bears on AI capex over time, on the
  same chart"). Interesting follow-up but separate spec.
- **Real-time alerts when sentiment flips**. Big feature, separate spec.

## What we'd like back

1. Confirmation the new `kind: 'narrative'` will ship with the marker
   contract + signed sentiment per bucket.
2. Confirmation Narrative bypasses recency weighting (per §3 of the
   retrieval expectations).
3. Confirmation the group filter (`bulls` / `bears` / `<named person>`)
   routes correctly through `topic-quotes` / `person-quotes`.
4. After ship: raw `synthesize.text` for each of the three test queries in
   the Evidence section, pasted back so we can validate the parser path
   before wiring the live service.

Once those land, wiring up `narrativeService.ts` to call the live endpoint
is a 10-minute change on our side — the View, types, and canon-fallback
shape are all already in place.

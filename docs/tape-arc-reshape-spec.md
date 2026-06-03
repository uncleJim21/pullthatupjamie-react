# Tape — Arc reshape spec (Path A)

## Decision: replace single-person Arc with topic-drift

The existing Arc — "how did *this person's* thesis evolve" — was load-bearing on the Gromen canon and fragile everywhere else. The reshape: **inputs are now topic-first**, with an optional `group` filter. Output traces how consensus (or a chosen group's view) on that topic drifted over time.

Gromen canon migrates cleanly: `topic: "the sovereign debt endgame"` + `group: "Luke Gromen"` → same underlying data, reframed.

## Naming — keep "Arc" or rename?

Brainstorm with explicit "I know what this means exactly" criterion:

| Name | Length | Verdict |
| ---- | ------ | ------- |
| **Drift** | 5 chars | **Recommended.** Means gradual change over time. Finance-adjacent ("the narrative is drifting"). Reads naturally: "Drift on AI capex," "Drift on Fed policy." Distinct from every other action. |
| Arc | 3 chars | Current name. Implies single subject (which is no longer true). Conceptually right (a curve over time) but only if you know the word. |
| Track | 5 chars | Short and finance-friendly, but bleeds into "track record" and "track changes." |
| Trace | 5 chars | Passive — "trace the shift" sounds like recap, not analysis. |
| Shift | 5 chars | Implies one moment of change, not gradual evolution. Closer to an inflection event than a multi-period view. |
| Chronicle | 9 chars | Crystal clear but feels journalistic, not analytical. Long. |

**Recommendation: Drift.** Both shorter than "Chronicle" and clearer than "Arc" — anyone seeing "Drift on AI capex" in the launcher knows immediately that the action will show how thinking has moved over time. The canonical use ("the bulls' drift on AI capex Q1 → Q3") is exactly the verb finance pros already use.

If you keep "Arc": fine, but the spec below works the same — only the label in the launcher changes.

The rest of this spec uses **Arc** as the placeholder. Substitute "Drift" if you go with the rename.

## Input shape

```ts
interface ArcInput {
  topic: string;                    // required
  group?: string;                   // optional filter; see semantics below
  refresh?: boolean;
  model?: TapeModel;
}
```

### `group` semantics

| Value                | Meaning                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| omitted / `"all"`    | Consensus across all mainstream sources                                  |
| `"bulls"`            | Quotes the classifier tags as bullish on the topic                       |
| `"bears"`            | Quotes the classifier tags as bearish on the topic                       |
| `"hawks"` / `"doves"`| Same idea for monetary-policy framings (optional v2)                     |
| `<named person>`     | Filter to one person's quotes — preserves the Gromen "track record" use  |

The first three are well-defined; backend should reuse the same `bull-bear` classifier already wired into `topic-quotes.groupBy`. Named-person filter routes through `person-quotes` with topic themes.

## Result shape

```ts
interface ArcBucket {
  start: string;        // ISO date — bucket start (inclusive)
  end: string;          // ISO date — bucket end (inclusive)
  stance: string;       // 2-3 sentence prevailing stance for this window
  citations: TapeCitation[];  // 1-4 supporting clips from this bucket
}

interface ArcInflection {
  date: string;         // ISO date when consensus shifted
  description: string;  // 1-sentence what changed and (briefly) why
}

interface ArcResult {
  topic: string;
  group?: string;       // echoed back; UI surfaces it
  thesis: string;       // current consensus position (or current view of the group filter)
  buckets: ArcBucket[]; // chronological, oldest → newest
  inflections: ArcInflection[];   // shifts called out
  forwardCall?: string; // where the trajectory seems to be heading
  generatedAt: string;
  _meta?: TapeResponseMeta;
  tickers?: string[];
}
```

Bucket cadence: backend chooses based on the date range available. Default heuristic: monthly buckets for ranges < 12mo, quarterly buckets for 1-3y, yearly for >3y. Backend returns whatever cadence it used; client renders as-is.

## Synthesize marker contract

```
## THESIS: <current consensus / group's current view in one sentence>

## BUCKET | <ISO start> | <ISO end>
<2-3 sentence stance summary for this window>
{{clip:id}}
{{clip:id}}

## BUCKET | <ISO start> | <ISO end>
<...>
{{clip:id}}

## INFLECTION
- <ISO date>: <what changed and (briefly) why>
- <ISO date>: <what changed and why>

## FORWARD: <one-line where this trajectory is heading>
```

- `## THESIS`, at least 3 `## BUCKET` blocks required.
- `## INFLECTION` and `## FORWARD` optional — omit if not confidently supported.

## Retrieval — what backend needs to do

1. **Date span:** for Arc, retrieval uses a wide window (e.g. 24-36 months) and **bypasses** the recency weighting from the [recency-weighting spec](tape-backend-recency-weighting.md) — the time dimension IS the point.
2. **Group filter:**
   - `bulls` / `bears` → run the existing bull-bear classifier on topic-quotes results, keep only the matching side.
   - Named person → use `person-quotes` with the topic in themes.
   - omitted / `all` → no filter beyond the standard mainstream allowlist.
3. **Bucketing:** sort candidates chronologically, group into buckets by the chosen cadence, ensure each bucket has at least 2 candidates (drop buckets that don't to avoid hallucinated stances on thin evidence).

## Client UX — Easy buttons for group selection

The new Arc form gets quick-select chips next to the `group` input. One-click fills the field — typing remains available for named persons or anything custom.

```
TOPIC: [_______________________]
GROUP: [_______________________]   [ All voices ] [ Bulls ] [ Bears ] [ Custom… ]
```

Same paradigm for **Split** (the existing A vs B action) — Person A and Person B get quick-select chips so the user doesn't have to type `bulls` and `bears`:

```
PERSON A: [_____________]  [ Bulls ] [ Bears ] [ Hawks ] [ Doves ]
PERSON B: [_____________]  [ Bulls ] [ Bears ] [ Hawks ] [ Doves ]
TOPIC:    [_____________]
```

The Easy buttons are pure client UI — backend doesn't know they exist. They just fill the input field. The existing camp-mode routing in `splitService.ts` (`isCampMode`) already handles `bulls` / `bears` strings correctly.

## Canon migration

`ARC_GROMEN` becomes:

```ts
const ARC_GROMEN: ArcResult = {
  topic: "the sovereign debt endgame",
  group: "Luke Gromen",
  thesis: "Washington can't fund itself without printing, the bond market eventually breaks, and gold quietly takes the baton from Treasuries.",
  buckets: [
    {
      start: "2023-01-01", end: "2023-06-30",
      stance: "Early framing: persistent deficits + rising rates = trouble for the bond market.",
      citations: [/* 1-2 from original calls[] in this window */],
    },
    {
      start: "2023-07-01", end: "2023-12-31",
      stance: "Mid-cycle: TGA dynamics start to matter; gold positioning becomes the trade.",
      citations: [/* ... */],
    },
    // ... more buckets from the existing 5 calls[] chronology
  ],
  inflections: [
    { date: "2024-Q1", description: "Pivot from 'rates breaking the bond market' to 'gold taking the baton' as the leading framing." },
  ],
  forwardCall: "Forced dollar devaluation against gold this decade, FDR-style, as the only way out of the debt spiral.",
  // ...
};
```

The existing `calls[]` data is the source — same clips, regrouped into buckets and a thesis/inflection layer.

`mockArc` canon match becomes topic-keyed plus optional group:
```ts
mockArc({ topic: "debt", group: "Luke Gromen" }) → ARC_GROMEN
mockArc({ topic: "sovereign debt endgame" }) → ARC_GROMEN  // group-agnostic match
```

## Client changes (rough scope)

- `tapeTypes.ts`: rewrite `ArcInput` (`person` → `topic` + optional `group`), rewrite `ArcResult` (`calls` → `buckets`, add `inflections` + `thesis` + `group`).
- `arcService.ts`: rewrite — topic-driven retrieval, group filter handling, new marker parser.
- `ArcView.tsx`: form gets `topic` + `group` fields with Easy buttons; result render becomes chronological bucket strip + inflection callout layer + forward chip.
- `SplitView.tsx`: add Easy buttons to Person A / Person B inputs (no backend change).
- `mockTapeData.ts`: `ARC_GROMEN` reshaped to bucket form (one-time migration of the existing canon data).
- `TapeCommandSurface.tsx`: secondary action label updated ("Watch a view evolve" → "Watch consensus drift on a topic"); example pill updated.

## What we'd like back from backend

1. Confirmation `synthesize` can ship the new marker contract for `kind: 'arc'` (THESIS / BUCKET / INFLECTION / FORWARD).
2. Confirmation `topic-quotes` and `person-quotes` can accept a `group` filter (`bulls` / `bears` / named-person) and return only matching candidates.
3. Confirmation the per-kind recency weighting from [tape-backend-recency-weighting.md](tape-backend-recency-weighting.md) is disabled (or set to a very long half-life, e.g. 60mo) for Arc.
4. After ship: re-run on `topic: "the AI bubble", group: "bulls"` and paste back the synthesize response so we can validate the bucket/inflection structure end-to-end before wiring the client.

## Out of scope this round

- Sentiment-over-time chart visualization. Buckets + inflection list is enough for v1; a sparkline-style sentiment plot is the next polish round.
- Custom date-range override on Arc. Backend picks the cadence and span; client doesn't expose tunables yet.
- Group filters beyond bulls / bears / hawks / doves / named-person. "Central bankers," "hedge funds," etc. require a corpus-side taxonomy that doesn't exist yet.
- Real-time alerts when an inflection happens. Big feature, separate spec.

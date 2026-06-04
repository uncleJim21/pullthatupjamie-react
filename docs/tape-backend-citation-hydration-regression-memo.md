# Tape backend — citation hydration regression on kind-level endpoints

## TL;DR

The migration to kind-level endpoints (`/api/tape/dossier`, `/brief`,
`/split`, `/narrative`, `/readin`) **dropped citation hydration**. Live
results that used to return 3-6 clips per section now return **zero**.
This is a regression caused by collapsing what was a two-step client
pipeline into a single backend handler — and the backend handler isn't
doing the resolution step the client used to do.

The fix: each kind endpoint must run the same candidate-pool resolution
the client used to run, and populate the citation fields in its response
before returning.

## Evidence

### Case 1: Read-in on `ORCL`

[See attached screenshot from user.]

- `confidence: 'partial'` pill rendered.
- `whatTheyDo` prose looked GOOD (long, detailed). But also has **dangling
  whitespace + periods** like `"...this trend ."` and `"...services and
  products ."` — strong signal that `{{clip:id}}` tokens were emitted by
  the synth then **stripped without resolving** when the response was
  constructed.
- **No marquee citation** rendered (`pulse.marqueeCitation.pineconeId` is
  empty).
- **No `whatTheyDoCitations`** — the inline pills helper found no
  resolvable tokens.
- **No `## SMART_MONEY: BULL` / `BEAR` sections** — bulls/bears arrays
  empty.

### Case 2: Split on `Bulls` vs `Bears` topic `nuclear energy`

[See attached screenshot from user.]

- `confidence: 'thin'` pill rendered.
- Tickers populated (URA, NLR, CCJ, DNN — good).
- Both sides have stance summaries (Bulls advocate for nuclear…; Bears
  express concerns about safety…).
- **Both sides show "No cited positions."** — `sideA.citations` and
  `sideB.citations` are empty arrays.
- The Where-they-diverge contrast block renders.

Both cases show the **same shape**: the textual synthesis succeeded — the
prose is reasonable, the stance is reasonable, the structure is correct
— but the citation arrays come back empty. That's the regression.

## Architectural diagnosis — what changed

### Old pipeline (client did the two-step)

```
client
  ├── POST /api/tape/topic-quotes  → returns candidates: TapeCandidate[]  (the pool, ~20-30 items)
  │
  ├── POST /api/tape/synthesize     → returns text with {{clip:id}} tokens
  │
  └── CLIENT: resolveCitationsFromCandidates(text, pool)
              → for each {{clip:id}} in text, look up id in pool
              → return TapeCitation[] fully hydrated
              → attach per section in the parsed Result
```

The critical step was that **the client held the full candidate pool**.
Even when synth used only a handful of clip ids in its text, those ids
resolved against a fat pool the client knew about. Citations were dense.

### New pipeline (backend owns the full path)

```
client
  └── POST /api/tape/<kind>  → returns fully-parsed XResult with citations[] populated
```

Per the kind-endpoints spec, the backend handler internally does the same
work: retrieve candidates → synthesize → parse markers → resolve clip
tokens → populate citations[] on each section → return.

**The missing step today appears to be the resolution.** Backend is
running retrieval and synthesis (text comes back well-formed), but is
either:
1. Not parsing `{{clip:id}}` tokens out of the synth text, OR
2. Not looking them up in the candidate pool, OR
3. Looking them up but dropping the results before serializing the
   response, OR
4. The synth itself isn't emitting `{{clip:id}}` tokens in the new
   endpoint's prompt (different prompt template than the old `synthesize`
   endpoint used).

### Why this didn't happen in the old architecture

Because the resolver lived on the client and ran on a candidate pool the
client could see. If a synth response had no clip tokens, the client
could STILL build citations[] by attaching some subset of the pool as
"corroborating quotes" (we never did this, but we could have).

In the new architecture, if the resolver doesn't run server-side, the
client has zero recourse. It just receives `citations: []`.

## Ask: replicate the old hydration query inside each kind endpoint

The fix is for each kind endpoint to, **after the synth call returns**:

1. Extract all `{{clip:id}}` tokens from the synth text (same regex the
   client used: `/\{\{clip:([^}]+)\}\}/g`).
2. Build a `Map<pineconeId, TapeCandidate>` from the candidate pool that
   was passed to synth.
3. For each section the marker parser produced (e.g. `## PERSON: Bulls`
   block in Split, `## SMART_MONEY: BULL` in Read-in, etc.), find the
   clip tokens inside THAT block's text range, look them up in the map,
   and assemble `citations: TapeCitation[]` for that section.
4. Special-case Read-in's `whatTheyDo` — keep the tokens in the prose
   text AS-IS (client renders inline pills) AND populate
   `whatTheyDoCitations` with the resolved set.

This is essentially the body of `resolveCitationsFromCandidates` from
the client's old `tapeClient.ts` — please port it server-side.

## Stronger ask: surface a citation floor

Even AFTER hydration is fixed, sparse synth output is a separate problem
(per the [citation density memo](tape-backend-citation-density-memo.md)).
But consider this stronger fallback:

> If, after synth + resolution, a kind's required citation arrays are
> empty (e.g. Split's both sides have zero clips), attach **the top-K
> candidates from the pool by relevance** as the citations for each
> section anyway. They may not be the synthesizer's hand-picked picks,
> but they're real, on-topic quotes from the candidate pool that
> definitely exist and definitely play.

This is the "even if the synth is being shy, show some receipts" floor.
The client renders any non-empty citations array; backend just needs to
ensure the array isn't empty when the pool wasn't.

## Acceptance test

Re-run after the fix lands. We'll paste the raw JSON response from
DevTools so we can verify per-section citation counts.

| Query | Expected after fix |
| ----- | ------------------ |
| Read-in on `ORCL` | `marqueeCitation.pineconeId` populated; `whatTheyDoCitations` has 3-6 entries matching the inline tokens in `whatTheyDo`; `smartMoney.bulls`/`bears` each have 2+ citations |
| Split on Bulls vs Bears, topic `"nuclear energy"` | `sideA.citations` ≥ 3, `sideB.citations` ≥ 3, each properly attributed to its side |
| Brief on `"oil & the Strait of Hormuz"` | Each `## PUBLISHER:` section's `citations` array has 2-4 entries |
| Dossier on `"Mohamed El-Erian"` | Each topic group's `citations` array has 3-5 entries |

## What we won't do client-side

Nothing — the response shape is right (the fields exist on the Result
types). They're just coming back empty. The fix is entirely in the
backend's kind-endpoint handlers.

## Why this is a v1 blocker

Tape's pitch is "real quotes, timestamped and sourced." Empty
`citations: []` arrays make the demo render explanatory prose with NO
ground-truth evidence — exactly the opposite of the product's value. The
hydration step lived on the client and worked. It needs to live on the
backend now and work.

The architecture migration was correct (it removed brittleness elsewhere
and let backend own the editorial pipeline). The execution missed this
specific step. Putting it back is a small, contained fix.

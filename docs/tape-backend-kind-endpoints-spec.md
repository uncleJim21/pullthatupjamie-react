# Tape backend — kind-level endpoints (consolidated spec)

## Why this exists

Today the client orchestrates the pipeline for every Tape action:

```
client → topic-quotes (or person-quotes)
       → synthesize { kind }
       → parse markers
       → resolve citations
       → render
```

That seam — client managing candidates between retrieval and synthesis —
is where every fragility we've hit lives: brittle window pinning, kind-specific
routing logic duplicated across `*Service.ts` files, marker parsers on the
client, error fallbacks per kind, candidate pool management. None of that
intelligence should live on the client.

**Proposal:** one endpoint per kind. Backend owns the full pipeline. Client
becomes a thin transport wrapper that calls the right endpoint and renders
the response.

`topic-quotes` / `person-quotes` / `synthesize` stay as **internal primitives**
the new endpoints compose. They don't disappear — they just stop being
client-facing. The Tape demo client only ever calls the five kind endpoints
below.

## What stays the same (still applies, just consolidated)

The new endpoints are internally an orchestration of work already specced
across prior memos. Treat the following as already-accepted contracts that
each new endpoint must honor:

- **Marker contract per kind** — [tape-backend-conform-to-contract.md](tape-backend-conform-to-contract.md)
  and [tape-backend-narrative-spec.md](tape-backend-narrative-spec.md).
- **Tickers field** — every response includes `tickers: string[]` per
  [tape-backend-tickers-spec.md](tape-backend-tickers-spec.md).
- **Confidence tiers** — `_meta.confidence` / `confidenceReason` /
  `candidateCount` per [tape-backend-confidence-and-cadence-memo.md](tape-backend-confidence-and-cadence-memo.md).
- **Recency weighting** — per-kind half-lives per
  [tape-backend-recency-weighting.md](tape-backend-recency-weighting.md).
- **Brief auto-expand** — 7d → 30d → 90d, surfaced as `_meta.windowDays`
  / `_meta.windowExpanded`. Same memo as confidence.
- **Adaptive cadence (Narrative)** — variable-width buckets per the
  narrative spec.
- **Kind compliance / cross-kind marker bleed prevention** —
  [tape-backend-kind-compliance.md](tape-backend-kind-compliance.md).

The new kind endpoints just BUNDLE all of the above behind one HTTP call per
action.

## Common conventions

### Auth

Same JWT Bearer used everywhere else. 401 / 429 / 502 / 404 error shapes
unchanged.

### Request envelope

Each endpoint accepts a kind-specific JSON body (defined below). Common
optional fields available across all kinds:

- `refresh?: boolean` — bypass cache, force a fresh synthesis.
- `model?: 'quality' | 'fast'` — synthesis tier. Defaults to `'quality'`.

### Response envelope

Every response is a kind-specific `Result` shape (defined below) with these
shared fields:

```ts
interface CommonResultFields {
  generatedAt: string;              // ISO
  tickers: string[];                // backend-curated, per tickers spec
  _meta: TapeResponseMeta;          // see below
}

interface TapeResponseMeta {
  // Existing fields
  cached?: boolean;
  revalidated?: boolean;
  tier?: 'quantitative' | 'qualitative';
  fetchedAt?: string;
  cachedAt?: string;
  ageSec?: number;
  freshUntil?: string;
  stale?: boolean;
  staleReason?: string;
  source?: string;
  forced?: boolean;

  // From confidence + cadence memo
  candidateCount?: number;
  confidence?: 'strong' | 'partial' | 'thin' | 'empty';
  confidenceReason?: string;

  // Brief-only
  windowDays?: number;
  windowExpanded?: boolean;
}
```

### Caching

Per-kind cache keys: `tape:kind:<kind>:v1:<sha256(canonicalized_body)>`,
TTL 2 hours. Same eviction + `refresh: true` semantics as the current
`synthesize` cache. The kind endpoint should cache the FULL response
(parsed result, not raw synthesize text), so cache hits are zero-cost on
both retrieval and synthesis.

### Empty handling

When the pipeline can't produce a valid result, return `200` with the kind's
Result shape populated by the empty fallback for that kind (zero topics /
sections / buckets / etc.) plus `_meta.confidence: 'empty'` and a
`confidenceReason` string the client renders verbatim.

`200 + empty result + confidence: empty` is preferred over `4xx` because the
client wants to render the explanatory empty-state, not a global error
toast.

### Errors

- `401` — JWT missing/invalid.
- `429` — quota exceeded (existing `QuotaExceededData` shape).
- `502` — upstream failure (e.g. `/api/pull` returned an error).
- `400` — request body invalid (missing required field, malformed date).

---

## Endpoint 1: `POST /api/tape/dossier`

### Request

```ts
interface DossierRequest {
  person: string;          // required — name to build a dossier on
  refresh?: boolean;
  model?: 'quality' | 'fast';
}
```

### Response

```ts
interface DossierResponse {
  person: string;          // echoed back
  topics: DossierTopicGroup[];
  appearances: DossierAppearance[];
  generatedAt: string;
  tickers: string[];
  _meta: TapeResponseMeta;
}

interface DossierTopicGroup {
  topic: string;                   // e.g. "Inflation and the Fed"
  positionSummary: string;         // 2-3 sentence stance, NO clip tokens
  citations: TapeCitation[];       // fully-resolved citations (already hydrated)
}

interface DossierAppearance {
  show: string;
  episodeTitle: string;
  publishedDate?: string;
  citationCount: number;
}
```

### Internal flow

1. Resolve `person` via `corpus/people` (existing behavior).
2. Pull dedicated-episode quotes via `person-quotes` internally (the
   existing primitive) with default themes (Fed/rates/recession/stocks/oil
   etc., as the current `DEFAULT_DOSSIER_THEMES` in `dossierService.ts`).
3. Apply Dossier window policy: ~18-month half-life recency weighting.
4. Call internal `synthesize { kind: 'dossier' }`.
5. Parse `## TOPIC: ... ## APPEARANCES` markers per the existing dossier
   contract.
6. Resolve `{{clip:id}}` tokens against the candidate pool — return
   FULLY-HYDRATED `TapeCitation` objects per topic. The client should NOT
   need a separate `get-hierarchy` round trip.
7. Backfill `appearances` from `person-quotes.appearances` if the
   synthesis omitted `## APPEARANCES` (current client does this).
8. Compute and populate `tickers` per the tickers spec — tickers this
   person is on record about, ordered by relevance.
9. Compute confidence tier per the per-kind table in the confidence memo.

### Notes

- If person not found in corpus: return 200 with empty topics/appearances
  and `_meta.confidence: 'empty'`, `confidenceReason:
  "${person} has no mainstream appearances surfaced in the corpus."`

---

## Endpoint 2: `POST /api/tape/brief`

### Request

```ts
interface BriefRequest {
  topic: string;                   // required
  asOfDate: string;                // required, ISO date (yyyy-mm-dd)
  refresh?: boolean;
  model?: 'quality' | 'fast';
}
```

Note: client no longer sends `minDate`/`maxDate`. Backend owns the window.
The `asOfDate` is the right edge; backend picks the left edge per the
auto-expand policy.

### Response

```ts
interface BriefResponse {
  topic: string;
  asOfDate: string;                // echoed back unchanged
  headline: string;
  sections: BriefPublisherSection[];
  generatedAt: string;
  tickers: string[];
  _meta: TapeResponseMeta;         // includes windowDays + windowExpanded
}

interface BriefPublisherSection {
  publisher: string;               // creator / show name
  summary: string;                 // 2-3 sentences, NO clip tokens
  citations: TapeCitation[];       // fully hydrated
}
```

### Internal flow

1. Retrieve via internal `topic-quotes` with `groupBy: 'creator'`. Start
   at 7-day window ending `asOfDate`.
2. **Auto-expand on thin retrieval** per the confidence + cadence memo:
   7d → 30d → 90d. Set `_meta.windowDays` to the lookback ultimately used
   and `_meta.windowExpanded: true` when past 7d.
3. Apply literal-term anchoring (you confirmed this is shipped).
4. Call internal `synthesize { kind: 'brief' }`.
5. Parse `# HEADLINE:` + `## PUBLISHER: …` markers.
6. Resolve `{{clip:id}}` tokens against the candidate pool — return
   hydrated `TapeCitation[]` per section.
7. Compute `tickers` (names exposed to the story — e.g. Hormuz → `XOM`,
   `CVX`, `CL=F`, `^TNX`).
8. Compute confidence tier. When `windowExpanded: true`, mention it in
   `confidenceReason` ("Widened to 30 days; only 4 mentions in the past
   week.").

### Notes

- If all of 7d / 30d / 90d return no on-topic candidates: 200 with empty
  sections + `_meta.confidence: 'empty'`.

---

## Endpoint 3: `POST /api/tape/split`

### Request

```ts
interface SplitRequest {
  personA: string;                 // can be a name OR a camp shorthand ('Bulls'/'Bears')
  personB: string;                 // same
  topic: string;
  refresh?: boolean;
  model?: 'quality' | 'fast';
}
```

### Response

```ts
interface SplitResponse {
  topic: string;
  sideA: SplitSide;
  sideB: SplitSide;
  contrastSummary?: string;
  generatedAt: string;
  tickers: string[];
  _meta: TapeResponseMeta;
}

interface SplitSide {
  person: string;                  // echoes the input personA / personB
  positionSummary: string;         // 2-3 sentences, NO clip tokens
  citations: TapeCitation[];
}
```

### Internal flow

1. **Camp-mode detection** — if either `personA` or `personB` is one of
   `Bulls` / `Bears` / `Hawks` / `Doves` (case-insensitive), treat as a
   sentiment-camp split. Otherwise, treat as named A-vs-B comparison.
2. Retrieval:
   - **Camp mode**: internal `topic-quotes` with `groupBy: 'bull-bear'`
     (or equivalent classifier); split candidates by side.
   - **Named mode**: parallel `person-quotes` calls for `personA` and
     `personB`, each with `[topic]` as themes; merge.
3. Apply Split window policy: ~6-month half-life recency.
4. Call internal `synthesize { kind: 'split' }`.
5. Parse `## PERSON: <A>` + `## PERSON: <B>` + optional `## CONTRAST`
   markers.
6. Resolve citations per side. Each side's `citations[]` should be the
   quotes attributed to THAT side, not a global pool.
7. Compute `tickers` based on the **topic**, not the side labels.
8. Compute confidence tier — `partial` when one side is significantly
   thinner than the other.

### Notes

- Camp keywords like `Bulls` should NOT be passed to `person-quotes` as
  names. The camp-mode dispatch is the backend's job per the rules above.

---

## Endpoint 4: `POST /api/tape/narrative`

### Request

```ts
interface NarrativeRequest {
  topic: string;
  group?: string;                  // 'Bulls' | 'Bears' | <named person> | omitted (= all)
  refresh?: boolean;
  model?: 'quality' | 'fast';
}
```

### Response

```ts
interface NarrativeResponse {
  topic: string;
  group?: string;                  // echoed back
  thesis: string;                  // current consensus / group's current view, NO clip tokens
  buckets: NarrativeBucket[];      // chronological, variable widths
  inflections: NarrativeInflection[];
  forwardCall?: string;
  generatedAt: string;
  tickers: string[];
  _meta: TapeResponseMeta;
}

interface NarrativeBucket {
  start: string;                   // ISO date
  end: string;                     // ISO date
  stance: string;                  // 2-3 sentences, NO clip tokens
  citations: TapeCitation[];
  sentiment: number;               // REQUIRED. -5..+5 signed integer.
}

interface NarrativeInflection {
  date: string;                    // ISO date OR 'YYYY-Qn'
  description: string;
}
```

### Internal flow

1. Resolve `group`:
   - `Bulls` / `Bears` → `topic-quotes` with `groupBy: 'bull-bear'`,
     keep matching side.
   - Named person → `person-quotes` with `[topic]` as themes.
   - omitted / `all` → `topic-quotes` with no groupBy.
2. Apply Narrative window policy: 24-36 months default, recency
   weighting DISABLED (the time dimension IS the point).
3. Call internal `synthesize { kind: 'narrative' }`.
4. Parse the narrative marker contract:
   ```
   ## THESIS: <line>
   ## BUCKET | <ISO start> | <ISO end> | <sentiment -5..+5>
   <stance>
   {{clip:id}}
   ...
   ## INFLECTION
   - <date>: <desc>
   ## FORWARD: <line>
   ```
5. Resolve citations per bucket. Sentiment values are REQUIRED on every
   bucket (signed integer -5..+5).
6. **Variable-width buckets** allowed and expected per the cadence memo.
7. Compute `tickers` (topic-relevant, not group-filtered).
8. Compute confidence tier per Narrative criteria.

### Notes

- 1-bucket result is acceptable when data is genuinely thin. Drop the
  old "≥3 buckets" floor.
- Sign-flip across zero between adjacent buckets = client renders a
  REVERSAL marker automatically.

---

## Endpoint 5: `POST /api/tape/readin`

### Request

```ts
interface ReadInRequest {
  ticker: string;
  depth?: 'quick' | 'brief' | 'deep';
  refresh?: boolean;
  model?: 'quality' | 'fast';
}
```

### Response

```ts
interface ReadInResponse {
  ticker: string;                  // echoed back
  name: string;                    // resolved company name, or the ticker if unknown
  sectorTag: string;               // e.g. "SOFTWARE · ADTECH"
  yahoo: string;                   // URL slug for the live-price proxy
  whatTheyDo: string;              // 2-3 paragraph primer. MAY contain {{clip:id}} tokens (inline pills)
  whatTheyDoCitations: TapeCitation[];   // resolved tokens from whatTheyDo
  pulse: ReadInPulse;
  uvp?: ReadInThesisSection;       // Brief depth and below
  strategy?: ReadInThesisSection;
  leadership?: ReadInLeadership;
  financials?: ReadInFinancials;
  smartMoney: { bulls: TapeCitation[]; bears: TapeCitation[] };
  catalysts: ReadInCatalyst[];
  peers: string[];                 // peer tickers (NOT including this ticker). Backend's tickers field.
  risks: string[];
  generatedAt: string;
  tickers: string[];               // same as peers for readin (backend can populate both or just peers)
  _meta: TapeResponseMeta;
}

interface ReadInPulse {
  bullLine: string;
  bearLine: string;
  priceAction: string;             // optional; client also fetches live ticker
  marqueeCitation: TapeCitation;
}

interface ReadInThesisSection {
  summary: string;
  citations?: TapeCitation[];
}

interface ReadInLeadership extends ReadInThesisSection {
  facts: ReadInFact[];
}

interface ReadInFinancials {
  headline: ReadInFact[];
  note?: string;
}

interface ReadInFact { label: string; value: string; }
interface ReadInCatalyst { date: string; label: string; }
```

### Internal flow

1. Retrieve via `topic-quotes` with `query: ticker`, themes including the
   ticker AND a resolved company name when available.
2. Apply Read-in window policy: 6-12 month half-life recency.
3. Call internal `synthesize { kind: 'readin' }`.
4. Parse the readin marker contract (WHAT_THEY_DO / PULSE / SMART_MONEY /
   RISKS / etc., per the conform-to-contract spec).
5. **Keep `{{clip:id}}` tokens in `whatTheyDo`** — the client renders them
   as inline playable pills. Populate `whatTheyDoCitations` by resolving
   those tokens. (Same pattern as the current readInService parser.)
6. Compute `peers` (and `tickers`) as ticker-relevance — the company's
   peers, NOT the queried ticker. Per the tickers spec.
7. Compute confidence tier — per Read-in criteria.

### Notes

- Sections in `uvp` / `strategy` / `leadership` / `financials` are optional
  per the readin marker contract — omit entirely if the candidates don't
  support them (don't return empty objects).
- `whatTheyDo` keeping tokens is intentional. Other prose fields
  (`positionSummary` on Split sides, `stance` on Narrative buckets, etc.)
  should have tokens stripped — they don't render inline pills.

---

## Migration plan

1. **Backend ships these five endpoints additively.** `topic-quotes` /
   `person-quotes` / `synthesize` stay live as internal primitives — the
   new endpoints use them under the hood. Nothing currently using them
   breaks.
2. **Client services collapse to thin wrappers** once the new endpoints are
   live (~10 lines per `*Service.ts`):
   ```ts
   export async function getBrief(input: BriefInput): Promise<BriefResult> {
     const canned = mockBrief(input.topic, input.asOfDate);
     if (canned.sections.length > 0) return canned;
     return tapeFetch<BriefResult>('/api/tape/brief', { method: 'POST', json: input });
   }
   ```
3. **Marker parsers move backend-side.** Once the new endpoints return
   fully-parsed Result shapes, the client deletes its per-kind parsers
   entirely.
4. **Composite primitives are out-of-spec to call from the client** going
   forward. Internal use by the new endpoints only.

## Per-endpoint acceptance tests

Run after each endpoint ships; paste raw response back so we can validate
end-to-end.

| Endpoint | Test request | Expected response highlights |
| -------- | ------------ | ----------------------------- |
| `dossier` | `{ "person": "Mohamed El-Erian" }` | `confidence: 'strong'`, 3+ topics, appearances populated, tickers ≈ `["^TNX", "DX-Y.NYB", "GLD"]` |
| `brief` | `{ "topic": "gold prognosis", "asOfDate": "<today>" }` | `confidence: 'partial'`, `windowExpanded: true`, `windowDays: 30+`, all citations literally mention gold |
| `brief` | `{ "topic": "oil & the Strait of Hormuz", "asOfDate": "<today>" }` | `confidence: 'strong'`, `windowDays: 7`, `windowExpanded: false` |
| `split` | `{ "personA": "Bulls", "personB": "Bears", "topic": "AAPL" }` | Camp-mode routing; both sides non-empty; tickers around AAPL |
| `narrative` | `{ "topic": "the AI bubble" }` | `confidence: 'partial'`, 4-6 mixed-width buckets, recent monthly windows, every bucket has `sentiment` |
| `readin` | `{ "ticker": "CRWV" }` | `confidence: 'partial'` or `'strong'`, `whatTheyDo` contains inline clip tokens, `whatTheyDoCitations` resolved, `peers` = `["NVDA", "ORCL", "MSFT", "GOOGL"]` |

## What we'll do on our side

The moment a new endpoint is confirmed working, we:

1. Replace the corresponding `*Service.ts` body with a single `tapeFetch`
   call returning the typed Result.
2. Delete the per-kind marker parser (it lives in your endpoint now).
3. Delete the per-kind retrieval routing (window selection, group filter
   dispatch, candidate management).
4. Run the corresponding acceptance test against live.

That's a ~50-80 line deletion per service. Net architectural improvement.

## Out of scope this round

- Streaming responses — non-stream is fine, matches current behavior.
- A single mega-endpoint covering all kinds — five thin endpoints is the
  right granularity.
- Per-section confidence within a kind (Read-in WHAT_THEY_DO vs
  SMART_MONEY).
- Cross-kind composition (e.g. "give me a Brief and a Narrative for the
  same topic in one call"). Separate spec if it ever matters.

## What we'd like back

1. Confirmation the five endpoints will ship with the request/response
   shapes above.
2. Per-endpoint acceptance test responses pasted back so we can validate
   before swapping client services over.
3. Estimated timeline so we can sequence the client-side wrappers
   (we'll deliver them one at a time as each endpoint lands, not all-or-
   nothing).

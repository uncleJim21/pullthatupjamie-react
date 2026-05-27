# Tape — API & service contract

**Status:** mock-backed first build (command surface + four action views). This doc is the contract the real backend must satisfy so the swap from mock to live is invisible to the UI.

Tape is the finance-intelligence "skin" over the existing podcast corpus. It reuses the corpus + the existing NL agent endpoint and adds exactly **one** new backend endpoint.

---

## 0. Potemkin demo (current state)

This build is a **cached demo**: every action is backed by real data captured from the live `/api/pull` + `/api/get-hierarchy` and baked into `src/data/mockTapeData.ts` (`USE_MOCK_TAPE = true`). Quotes, audio URLs, timestamps, shows and dates are all genuine, so audio plays and the content reads true without a live round-trip.

**Capture method** (the right way, not the NL agent): clips come from the structured corpus endpoints, which fixes attribution, freshness, and timestamps at once:
1. `GET /api/corpus/people?search=NAME&guestsOnly=true` + `POST /api/corpus/people/episodes` → the episodes where a person is the actual **guest** (not just mentioned). This is the attribution fix.
2. `POST /api/search-quotes` with `guid` set to those episodes (or `feedIds`) → the person's quotes, each with its own `timeContext{start_time,end_time}` where the returned `quote` IS the matched paragraph, so playback lands on the quote (the timestamp fix). `minDate` pulls fresh coverage (the freshness fix; e.g. the Hormuz Brief is post-escalation 2026 war coverage, not stale).
   - Auth: `search-quotes` is L402 but honors `X-Free-Tier: true` (heavily rate-limited) or a `Bearer` JWT (jamie-pro, no limit). The capture script used a session-only pro token; **it is not stored in the repo**.
3. Each `search-quotes` result maps directly to a `TapeCitation` (`shareLink` → pineconeId, `quote` → text, `timeContext` → start/end, `creator`/`date`/`audioUrl`/`episodeImage`), so no separate hydration step.

Curation still weights **mainstream** shows (Bloomberg Surveillance, Macro Voices, Forward Guidance, Odd Lots, Prof G Markets, The Daily) over crypto pods, and prefers tighter paragraphs. Timestamps are paragraph-level (the floor the corpus exposes) but now land on the quote's first words.

### Attribution confidence (the diarization problem)

The corpus has **no speaker diarization**: `search-quotes` returns the most relevant *paragraph* in an episode, but it cannot tell you *who* spoke it. So a quote from an episode where a person is a guest may actually be the host or another panelist. This burned us twice: "Druckenmiller" quotes from the All-In **panel** were really David Sacks; "El-Erian" quotes from **Bloomberg Surveillance TV** (a fast rotating-anchor desk) were the anchors.

Until diarization exists, the demo maximizes confidence with three rules, in order:
1. **Source only from guest-dominant formats** — 1-on-1 interviews, fireside keynotes, or the person's own show. Never panels (All-In) or rotating anchor desks (Bloomberg Surveillance TV). In practice: use `corpus/people/episodes?guestsOnly=true`, then keep only episodes whose **title contains the person's name** (a dedicated sit-down).
2. **Bias to long paragraphs** — a sustained 30s+ monologue is almost always the guest answering; short paragraphs are usually the host's question.
3. **Read every candidate** and drop anything that is a question, addresses someone by name, or is a host aside.
This is why the canon is El-Erian (Forward Guidance 1-on-1s), Mike Green (MacroVoices interviews), Luke Gromen (MacroVoices 1-on-1) — all guest-dominant. Druckenmiller was dropped: his only corpus appearance is the All-In panel, which is unattributable.

### How to make this genuinely better (data/API roadmap)

- **Add diarization.** Speaker-segment each transcript (e.g. pyannote / WhisperX) and tag every paragraph with a `speaker` cluster, then map clusters to the episode's `guests`/host. This is the real fix and unlocks everything below.
- **`personId`/`speakerId` filter on `search-quotes`.** Once paragraphs carry a speaker, let the query return only segments *spoken by* that person, not just *in an episode featuring* them.
- **Episode `format` tag** (`solo` | `interview` | `panel` | `news-desk`) and a per-paragraph `speakerConfidence`, so clients can prefer high-confidence attribution automatically instead of hand-curating.
- **A `dominantSpeaker` flag** per episode (who holds >60% of speaking time) for quick "is this basically one person" filtering.
- **Interim, no-ML heuristic the API could expose now:** rank paragraphs by length and position within a speaker turn; surface the longest contiguous monologues as "likely guest."
- For the demo specifically, the highest-fidelity path is a small **hand-verified quote set** (a human confirms the speaker) — which is what the current canon is.

Current canon: Dossier = El-Erian / Druckenmiller / Mike Green; Split = the AI bubble (bulls vs bears); Brief = oil & the Strait of Hormuz. Coverage note: Bloomberg Surveillance is deep in the corpus; Odd Lots is not transcribed yet (don't name it in copy).

Deep-links (for demo + verification): `/tape?a=dossier&p=Mohamed%20El-Erian`, `/tape?a=brief&t=oil`, `/tape?a=split&p=The%20bears&b=The%20bulls&t=the%20AI%20bubble`.

To refresh the canon: run new `/api/pull` queries, hydrate ids, and re-bake (`/tmp/tape_gen2.py` is the current generator).

### Parked: Timeline → longitudinal study (not mention-counts)

The original Timeline (quantitative weekly mention counts) is **removed from the UI** for now. The reimagined version is a **longitudinal study**: "how has *person X* evolved on a view" or "how has the street changed its tune on *topic Y* over N years", rendered as a time axis with **pointillist real quotes** at each inflection, not a bar/area count chart. This needs the same `/pull` + citation primitives plus date-ordered retrieval; revisit after Dossier / Brief / Split are nailed. `TimelineView` + `timelineService` remain in the tree (dormant) and the `/api/tape/timeline` count endpoint in §5 is deferred with it.

---

## 1. Overview — the four actions (JTBD)

| Action | Input | Output | Job |
|---|---|---|---|
| **Dossier** | person | stated positions grouped by topic + cross-show appearance map, each claim cited | "Show me Druckenmiller's positioning over the last N quarters" |
| **Timeline** | topic + date range | weekly mention-count chart; click a week → underlying paragraph hits | "Show me discussion of yield-curve inversion since 2022" |
| **Brief** | topic + as-of date | "what was said this week", grouped by publisher, with cites | "What was macro consensus on Fed policy this week?" |
| **Split** | two people + topic | side-by-side stated positions with cites | "Where did X and Y diverge on rate cuts?" |

---

## 2. Routing — what rides `/pull` vs the one new endpoint

The hard rule: **prefer the existing `/api/pull` NL agent** for anything that is retrieval + synthesis. Only Timeline's quantitative counts need a dedicated endpoint.

| Action | Transport | Why |
|---|---|---|
| Dossier | `POST /api/pull` (`dossierPrompt`) | retrieval + synthesis grouped by topic |
| **Timeline (counts)** | **`GET /api/tape/timeline`** (NEW) | an NL/LLM agent can't be trusted to produce quantitative weekly aggregations; counts must be computed deterministically |
| Timeline (week drill-down) | `POST /api/pull` (`timelineDrilldownPrompt`) | retrieval + synthesis scoped to a date window |
| Brief | `POST /api/pull` (`briefPrompt`) | retrieval + synthesis grouped by publisher |
| Split | `POST /api/pull` (`splitPrompt`) | two-person stance comparison |

**Exactly one** new backend endpoint is required: `GET /api/tape/timeline`. Everything else reuses `/api/pull` + `/api/get-hierarchy`.

---

## 3. Shared primitive — `TapeCitation`

Every cited claim is a `TapeCitation` (`src/services/tape/tapeTypes.ts`), a near-superset of `ClipMeta` so the app's existing audio / share / time utilities work unchanged.

```ts
interface TapeCitation {
  pineconeId: string;   // AudioTrack.id; createClipShareUrl(pineconeId)
  text: string;         // the quoted paragraph
  speaker?: string;     // resolved attribution (may be empty)
  episodeTitle: string;
  creator: string;      // publisher / show
  episodeImage: string;
  audioUrl: string;     // getTimestampedUrl(audioUrl, startTime)
  startTime: number;    // seconds; formatTime()
  endTime: number;
  publishedDate?: string; // ISO; formatShortDate()
}
```

**Citation convention (critical):** the `/api/pull` agent does NOT return clip payloads in `tool_result` SSE events (those carry only `{tool, resultCount, latencyMs, round}`). Instead it embeds citations **inline in the streamed text** as `{{clip:<pineconeId>}}` tokens. Tape assembles results by:

1. accumulating the final synthesized text from `text_delta` / `text` / `text_done` events,
2. extracting tokens with `/\{\{clip:([^}]+)\}\}/g`,
3. hydrating each id via `GET /api/get-hierarchy?paragraphId=<id>` into a `TapeCitation`,
4. attaching each citation to the section it appeared under (sections delimited by markers, below).

This is implemented once in `src/services/tape/tapeClient.ts` (`runPull`, `hydrateCitations`, `getHierarchy`).

---

## 4. Per-action contracts

Prompt templates live in `src/services/tape/tapePrompts.ts`; result types in `tapeTypes.ts`. Each prompt instructs the agent to emit **section markers** so the client can split text deterministically.

### Dossier — `getDossier({ person })` → `DossierResult`
- Transport: `POST /api/pull`, message = `dossierPrompt(person)`.
- Markers: `## TOPIC: <name>` per topic; final `## APPEARANCES` section with lines `- <show> | <episode> | <YYYY-MM-DD>`.
- Result: `{ person, topics: [{ topic, positionSummary, citations[] }], appearances: [{ show, episodeTitle, publishedDate, citationCount }], generatedAt }`.

### Timeline — `getTimeline({ topic, startDate, endDate })` → `TimelineResult`
- Transport: `GET /api/tape/timeline` (see §5).
- Result: `{ topic, startDate, endDate, buckets: [{ weekStart, count }], totalMentions }`.
- Drill-down: `getTimelineDrilldown({ topic, weekStart, weekEnd })` → `POST /api/pull`, message = `timelineDrilldownPrompt(...)`; returns `{ weekStart, summary, citations[] }`.

### Brief — `getBrief({ topic, asOfDate })` → `BriefResult`
- Transport: `POST /api/pull`, message = `briefPrompt(topic, asOfDate)`.
- Markers: leading `# HEADLINE: <text>`, then `## PUBLISHER: <name>` per show.
- Result: `{ topic, asOfDate, headline, sections: [{ publisher, summary, citations[] }], generatedAt }`.

### Split — `getSplit({ personA, personB, topic })` → `SplitResult`
- Transport: `POST /api/pull`, message = `splitPrompt(personA, personB, topic)`.
- Markers: `## PERSON: <name>` per side, optional `## CONTRAST`.
- Result: `{ topic, sideA: { person, positionSummary, citations[] }, sideB: {...}, contrastSummary?, generatedAt }`.

---

## 5. New backend endpoint — `GET /api/tape/timeline`

The only piece `/api/pull` cannot deliver: deterministic weekly mention counts.

**Request**
```
GET /api/tape/timeline?topic=<str>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>&interval=week
Headers: X-Pulse-Session, X-Free-Tier (same as /api/pull); Authorization optional
```

**200 response**
```json
{
  "topic": "yield-curve inversion",
  "startDate": "2025-01-06",
  "endDate": "2025-03-31",
  "interval": "week",
  "buckets": [ { "weekStart": "2025-01-06", "count": 4 }, { "weekStart": "2025-01-13", "count": 9 } ],
  "totalMentions": 57
}
```

- `weekStart` is the ISO Monday of each bucket.
- **429** returns the same `QuotaExceededData` shape as `/api/pull` (reuse `parseQuotaExceededResponse`).
- Semantics: count corpus paragraphs matching `topic` (semantic + keyword), bucketed by `published` week.

---

## 6. `/api/pull` recap (existing, reused as-is)

```
POST ${API_URL}/api/pull
Headers: Content-Type: application/json, Accept: text/event-stream, X-Pulse-Session, X-Free-Tier, Authorization?
Body: { message: string, model: "quality" | "fast", stream: true }
```
SSE events: `status`, `tool_call`, `tool_result` (counts only), `suggested_action`, `text_delta`, `text`/`text_done`, `done`, `error`. Tape consumes only text events (+ error/429). Citations arrive as `{{clip:id}}` tokens in the text, hydrated via `GET /api/get-hierarchy?paragraphId=<id>` (existing endpoint, shape: `data.hierarchy.{paragraph.metadata, episode.metadata}`).

---

## 7. Mock ↔ real

- Single switch: `USE_MOCK_TAPE` in `src/config/tapeConfig.ts` (currently `true`).
- Each action service (`src/services/tape/*Service.ts`) has a one-line `if (USE_MOCK_TAPE) return mockX(...)` guard at the top, delegating to `src/data/mockTapeData.ts`. The real path below the guard calls `tapeClient.ts`.
- **Go-live checklist:** (1) implement `GET /api/tape/timeline`; (2) confirm the agent honors the section markers in `tapePrompts.ts`; (3) flip `USE_MOCK_TAPE = false`; (4) delete the mock guards + `mockTapeData.ts` once stable.
- Mock audio URLs are placeholders and won't produce sound; live citations resolve real `audioUrl`s via `get-hierarchy`.

---

## 8. File map

```
src/config/tapeConfig.ts            USE_MOCK_TAPE flag + brand strings
src/services/tape/
  tapeTypes.ts                      all input/result types + TapeCitation
  tapeClient.ts                     runPull / getHierarchy / hydrateCitations / fetchTimeline (the real transport seam)
  tapePrompts.ts                    /pull message templates + section markers
  dossierService.ts                 getDossier
  timelineService.ts                getTimeline + getTimelineDrilldown
  briefService.ts                   getBrief
  splitService.ts                   getSplit
  index.ts                          barrel
src/data/mockTapeData.ts            fixtures + mock builders
src/components/tape/
  TapePage.tsx                      route shell (/tape): Helmet + AudioControllerProvider + launcher/active-view switch
  TapeCommandSurface.tsx            launcher + command parser (parseCommand)
  TapeActionScaffold.tsx            shared field / run-button / status / section primitives
  TapeCitationRow.tsx               dense verbatim citation row (playback + copy-link)
  TapeChart.tsx                     hand-built SVG area chart (no dependency)
  actions/{Dossier,Timeline,Brief,Split}View.tsx
src/styles/tape.css                 scoped institutional theme (.tape-root)
```

# Jamie Pull Agent — Client Developer Guide

> A reference implementation guide for building rich clients on top of `POST /api/pull`, the Jamie Pull orchestration layer. This document covers the logic that lives **outside** the raw API call — SSE handling, clip-ID resolution, next-step dispatch, markdown rendering, session continuity, auth/quota — and leaves the request/response wire schema to the [OpenAPI spec](https://www.pullthatupjamie.ai/api/openapi.json).

## Overview

`POST /api/pull` is a multi-tool agent that plans and calls Jamie's public endpoints (semantic search, chapter search, podcast discovery, on-demand transcription, research sessions, clip creation, person/episode/feed lookups, adjacent-paragraph expansion) on the caller's behalf. You send a plain-English task and get back a final markdown answer that embeds `{{clip:<pineconeId>}}` tokens pointing at concrete podcast moments, plus a list of suggested next-step actions.

The endpoint has two response modes: a **default single-JSON response** (buffered, good for scripts and batch callers) and a **live SSE event stream** you opt into by sending `stream: true` in the POST body (or `Accept: text/event-stream`). This guide focuses on the streaming path because that's what powers the rich real-time UI — see [Opting into streaming](#opting-into-streaming) for the switch.

This guide describes the client patterns that turn that stream into a useful UI. For request/response schemas, see the [OpenAPI Specification](https://www.pullthatupjamie.ai/api/openapi.json).

**Authoritative reference implementation** (this repo):

- `src/hooks/useJamiePullAgent.ts` — SSE parser, session + history, quota handling
- `src/components/jamiePullAgent/JamiePullAgentMessage.tsx` — markdown rendering, clip-token resolution, suggested-action chips
- `src/components/jamiePullAgent/JamiePullAgentResultCards.tsx` — activity timeline, tool catalog, response metadata footer
- `src/types/jamiePullAgent.ts` — shared TypeScript shapes
- `src/services/contextService.ts` — hierarchy lookups used for clip resolution

### Status & roadmap

The `/api/pull` surface ships behind a skill model. What's live today vs. planned, as of this writing:

**Live today — Research skill.** Plain-English task → streaming multi-tool response covering:
- Semantic quote search, chapter search, podcast discovery
- Person / episode / feed lookups + adjacent-paragraph expansion
- Research session assembly (link-out), on-demand transcription hand-off
- Inline `{{clip:<pineconeId>}}` token references resolvable to real podcast moments
- Two `suggested_action` variants: `submit-on-demand`, `follow-up-message`

**Planned — Create, Publish, Worker skills.** The same endpoint and event stream will grow to cover clip rendering (Create), Nostr / X / podcasting 2.0 cross-posting (Publish), and long-running background jobs with async notifications (Worker). Expect new `tool_call` identifiers, new `suggested_action.type` variants, and possibly new inline reference token shapes beyond `{{clip:...}}` (e.g. rendered-clip URLs, publish receipts, job handles).

**Build defensively** so your client keeps working as the surface grows:
- Humanize unknown `tool` names (`tool.replace(/_/g, ' ')`) — don't hard-fail on new identifiers.
- Ignore unknown `suggested_action.type` values rather than crashing the chip renderer; switch over known types with a `default: null` branch.
- Treat unknown `{{<type>:<id>}}`-shaped tokens as plain text until you explicitly support them.
- Treat unknown `event:` lines in the SSE stream as no-ops and keep reading.

## Opting into streaming

`/api/pull` has **two response modes**, and clients pick at request time:

- **Default — single JSON response** (no opt-in). The server buffers the entire agent run and responds with:
  ```json
  { "sessionId": "…", "text": "…", "suggestedActions": [ … ], "session": { … } }
  ```
  This is the right choice for batch jobs, serverless callers, or any integrator that just wants the final answer and doesn't need a live activity timeline.
- **Live SSE stream** — opt in by sending **`stream: true` in the POST body** (or by sending `Accept: text/event-stream`; send both for belt-and-suspenders). The response switches to `Content-Type: text/event-stream` and emits the typed events documented below.

This guide — and the reference implementation in `src/hooks/useJamiePullAgent.ts` — is built around the **streaming** mode because that's what powers the real-time "activity timeline + streaming markdown + inline suggested-action chips" UX. If you're writing a non-streaming client, skip to [Rendering text responses](#rendering-text-responses) and [Hydrating referenced entities](#hydrating-referenced-entities) — those patterns apply identically to the `text` / `suggestedActions` fields in the JSON response.

Minimal streaming request body:

```json
{
  "message": "Find recent podcast clips about Bitcoin self-custody",
  "stream": true,
  "sessionId": "<optional — for multi-turn>",
  "history": [ /* optional rolling window */ ],
  "context": { /* optional passthrough from a suggested_action */ }
}
```

## SSE event lifecycle

When `stream: true` is set (or `Accept: text/event-stream` is sent), `/api/pull` responds with `Content-Type: text/event-stream`. A single request produces a sequence of typed events; a correct client must handle all of them, even when it only renders a subset.

| Event | Client semantics |
| --- | --- |
| `status` | Short human-readable progress string (`"Searching quotes…"`). Append to a status list; render in an activity timeline. |
| `tool_call` | `{ tool, input, round }`. Open a new timeline row; leave a spinner until a matching `tool_result` with the same `(tool, round)` key arrives. |
| `tool_result` | `{ tool, resultCount, latencyMs, round }`. Closes the matching timeline row. `resultCount` may be omitted by the backend — guard with an `isFinite` check before rendering it, otherwise you'll show `"undefined results"`. |
| `suggested_action` | A discriminated-union payload describing a proactive next step. Buffer into a list; render as dispatchable chips (see "Next-step hints" below). These can fire before, during, or after text streaming — don't couple them to the text pipeline. |
| `text_delta` | A streaming chunk of the final answer. Append to a buffer and flush on a ~40 ms interval to avoid re-render churn. |
| `text` / `text_done` | The authoritative final text. If the payload carries non-empty `text`, replace the accumulated buffer with it. If it's empty, keep what you accumulated from deltas (the server already streamed everything). |
| `done` | Final envelope: `{ sessionId, model, rounds, toolCalls[], tokens, cost, latencyMs }`. Persist `sessionId` for multi-turn. |
| `error` | Render inline in the message. May arrive with `rounds: 0` if the request failed before any tool ran. |

UX tip: if `text_delta` events stop arriving for ~3 s but `streamComplete` is still false, mark the message as "paused / still working". Our implementation does this with a `textPaused` flag so the UI can show a spinner ("Still working…") instead of letting the user conclude the stream stalled. See the `startPauseTimer` pattern in `useJamiePullAgent.ts`.

### Minimal parser shape

```
let currentEventType = 'message';
let buffer = '';
for await (const chunk of stream) {
  buffer += decode(chunk);
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (line.startsWith('event: ')) currentEventType = line.slice(7).trim();
    else if (line.startsWith('data: ')) {
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      handle(currentEventType, JSON.parse(raw));
      currentEventType = 'message';
    }
  }
}
```

## Rendering text responses (markdown + clip tokens)

Render the streamed text with a GitHub-Flavored-Markdown renderer that preserves soft line breaks. Our React client uses `react-markdown` + `remark-gfm` + `remark-breaks`. Any renderer works — the important part is what you do with the embedded clip tokens.

### Clip token protocol

The agent emits clip references inline as literal strings of the form:

```
{{clip:<pineconeId>}}
```

The `<pineconeId>` is a stable opaque identifier for a transcript paragraph in Jamie's corpus. You resolve it to real metadata via `GET /api/get-hierarchy` (next section).

Regex: `/\{\{clip:([^}]+)\}\}/g`. See `extractClipIds` and `CLIP_TOKEN_RE` in `JamiePullAgentMessage.tsx`.

### Recommended two-pass render

Most markdown renderers won't tolerate arbitrary custom tokens inside formatting. Use a two-pass approach:

1. **Pre-pass**: replace every `{{clip:<pineconeId>}}` with a neutral placeholder like ` [[CLIP:0]] ` (stable, index-keyed, padded with spaces). Stash the `pineconeId` in a dictionary keyed by the index. This gets your markdown safely through the parser.
2. **Post-pass**: walk the rendered tree (React elements, DOM nodes, whatever your renderer produces), find the `[[CLIP:<n>]]` placeholders inside text nodes, and swap in your hydrated clip pill component. See `buildMarkdownWithClipPlaceholders` and `injectClipCards` in `JamiePullAgentMessage.tsx`.

### Research-session link detection

The agent also emits regular markdown links for research sessions, e.g.:

```
[Bitcoin and the Dollar Endgame](https://pullthatupjamie.ai/app?researchSessionId=abc123)
```

Detect these in your link renderer — if the `href` contains `researchSessionId=`, render the link as a richer card (thumbnail + title + "Research Session" subline) rather than a plain link. The agent keeps them as ordinary links so older/minimal clients still work. See the `a` renderer override in `JamiePullAgentMessage.tsx`.

### Paragraph-of-just-a-pill

When a `<p>` contains only a clip pill after placeholder substitution, tighten its vertical margin so the pill reads as a standalone block rather than an inline fragment awkwardly spaced as a paragraph. The `isCardOnlyParagraph` helper in the same file shows the pattern.

## Hydrating referenced entities

The agent's text response references real entities by opaque ID; clients are responsible for fetching the full metadata behind those references whenever they want richer UI than plain text. Today there is one inline reference shape (`{{clip:<pineconeId>}}`) plus regular markdown links for research sessions. The same `/api/get-hierarchy` endpoint is the primary hydration entry point — it returns an entire `{ paragraph, episode, feed }` block in a single call, so you rarely need a second round-trip for clip UIs.

### Clip references (`{{clip:<pineconeId>}}`)

Endpoint: `GET /api/get-hierarchy?paragraphId=<pineconeId>` — no auth required. Returns a nested `{ hierarchy: { paragraph, episode, feed } }` shape. See `src/services/contextService.ts` for the canonical wrapper.

Useful fields for a clip pill:

- From `hierarchy.paragraph.metadata`: `text`, `start_time`, `end_time`, `audioUrl`
- From `hierarchy.episode.metadata`: `title`, `imageUrl`, `creator`, `publishedDate`, `audioUrl`

Fall back across both objects — some older paragraphs only carry fields on one or the other (e.g. `para.episode` title, `para.episodeImage`).

#### Recommended cache pattern

Because a single agent response can reference dozens of clips, pounding `/api/get-hierarchy` from a freshly mounted UI is a bad idea. Mirror our client's strategy (`clipMetaCache`, `fetchClipMeta`, and the pending queue in `JamiePullAgentMessage.tsx`):

- **In-memory Map** keyed by `pineconeId`. Dedupe lookups; a single paragraph may be mentioned multiple times in one response.
- **`sessionStorage` mirror** with a 30-minute TTL so page reloads don't re-fetch everything. Gracefully tolerate corrupt / quota-full storage — wrap in try/catch and move on.
- **Serialized fetch queue** — 1 concurrent request with a 500 ms gap between requests. Keeps the hierarchy API well under its rate limits even for large responses.
- **Linear-backoff retries** — up to 2 retries at 1 s and 2 s. Above that, record the `pineconeId` in a "failed" set and stop retrying on every re-render.
- **Optimistic rendering** — show a `"Loading…"` pill immediately using just the `pineconeId` so the surrounding text doesn't reflow when the metadata arrives; upgrade to `"<mm:ss> — <episodeTitle>"` on hydration.

#### Deeper link: "explore in galaxy"

Once you have `paragraph.metadata.text` hydrated, you can construct an "explore neighbors" link like:

```
https://pullthatupjamie.ai/app?view=galaxy&q=<encodeURIComponent(quote)>
```

so users can jump from a pill in the agent response into the 3D semantic view of Jamie and see adjacent quotes. This is the `ArrowUpRight` affordance on each pill in our client — see the `InlineCardMention` handoff in `src/components/UnifiedSidePanel.tsx`.

### Episode + feed context (free with every clip lookup)

Because `/api/get-hierarchy` returns the full ancestry of a paragraph in one response, a single hydration call is enough to drive much richer UIs than a lone clip pill. If you want an "episode header", "feed strip", or a "published on" line alongside a pill, pull it out of the same response you're already using — don't issue extra calls:

- **Episode panel**: `hierarchy.episode.metadata.title`, `imageUrl`, `creator`, `publishedDate`, `audioUrl`
- **Feed strip**: `hierarchy.feed.metadata` (feed title, art, creator) for grouping clips by show
- **Published date**: gives you the timestamp used in the galaxy view's date filtering; handy for "X said this last March" affordances.

Keep the same cache — key by `pineconeId` as before, and read episode/feed fields off the cached entry. No second cache tier is needed for the happy path.

### Chapters — same endpoint, sibling query

`GET /api/get-hierarchy?chapterId=<chapterId>` is the sibling form of the same endpoint — it returns a chapter-rooted hierarchy instead of a paragraph-rooted one (see `src/services/contextService.ts`). The agent does **not** currently emit chapter tokens inline in the response text, so you shouldn't need this for today's Research skill. It's documented here because future skills (or a future `{{chapter:...}}` token) will reuse the exact same endpoint — treat it as pre-wired.

### Research-session links

The agent references research sessions as ordinary markdown links with a `researchSessionId=<id>` query param (see the Rendering section for detection and card styling). Minimal clients can simply let users click through in a browser.

If you want to **deeply hydrate** a session — list its clips, fetch a generated analysis, or re-share it — call the `/api/research-sessions/{id}` family documented in the [OpenAPI spec](https://www.pullthatupjamie.ai/api/openapi.json) (`GET` for metadata, `POST /analyze` for streaming AI synthesis, `POST /share` for a shareable preview). These are the same endpoints used by the "Canonical Workflows" in `llms.txt`, not a bespoke agent API.

### Forward-compat note

As future skills ship (Create → rendered clip URLs, Publish → post receipts, Worker → job handles), expect new inline tokens to follow the same shape: `{{<type>:<id>}}`. Treat any unknown token shape as plain text today — don't blow up — and wire in a new resolver for each as it's announced. The hierarchy-style "one call returns the full ancestry" pattern is likely to be mirrored for those new entity types too.

## Activity timeline (tool calls + statuses)

To show users what the agent is doing while it's working, interleave the `statusMessages` and `toolCalls` in arrival order and match each `tool_call` to its later `tool_result` using a `(tool, round)` composite key. See `buildTimeline` in `JamiePullAgentResultCards.tsx` (lines 69–121).

### Tool catalog

The agent's `tool_call` events use these `tool` identifiers today. Map each to a label + icon for a native UI:

| `tool` | Suggested label |
| --- | --- |
| `search_quotes` | Searching quotes |
| `search_chapters` | Searching chapters |
| `discover_podcasts` | Discovering podcasts |
| `find_person` | Finding person |
| `get_person_episodes` | Getting episodes |
| `list_episode_chapters` | Listing chapters |
| `get_episode` | Getting episode |
| `get_feed` | Getting feed |
| `get_feed_episodes` | Getting feed episodes |
| `get_adjacent_paragraphs` | Getting context |
| `suggest_action` | Suggesting action |

Unknown tools? The conservative fallback is to humanize the identifier (`tool.replace(/_/g, ' ')`) so future additions render sensibly without a client update.

### UX pattern

Keep the timeline expanded while `text` is still empty so the user can watch the agent reason. Auto-collapse once `text_delta` events start arriving so the final answer gets the focus — keep the most recent step visible in the collapsed state as a summary. See the `expanded` / `visibleSteps` logic in `ActivityTimeline`.

## Next-step hints (suggested actions)

`suggested_action` events are how the agent nominates concrete follow-up moves. The payload is a discriminated union on `type`. Two variants ship today:

### a) `submit-on-demand` — "this episode isn't indexed yet, want to transcribe it?"

Fields: `reason`, `feedId`, `guid`, `feedGuid`, `episodeTitle`, `image`, `enclosureUrl`, `link`.

Client flow:

1. Render a chip with the episode image, title, and `reason`.
2. On click, `POST /api/on-demand/submitOnDemandRun` with `{ episodes: [{ guid, feedGuid, feedId }] }`. The response carries a `jobId`.
3. Poll `POST /api/on-demand/getOnDemandJobStatus` with that `jobId` every 5 s. The response's `stats` block (`episodesProcessed` / `totalEpisodes`) gives you progress copy.
4. When `status === "complete"`, offer a one-click "re-ask my original query" button that wraps the user's original task with a short hint and re-posts to `/api/pull`, e.g.:

   ```
   I just transcribed episode <guid> (feedId: <feedId>). <original query>
   ```

Optional UX sugar: our chip also fetches a Fountain preview link via `https://rss-extractor-app-yufbq.ondigitalocean.app/getFountainLink` with `{ guid }` so the user can listen right away.

### b) `follow-up-message` — one-click refinement

Fields: `reason`, `label`, `message`, optional `context: { guids?, feedIds?, persons?, hint? }`.

Client flow: render a chip labeled with `label`; on click, call your `sendMessage` wrapper with `(action.message, action.context)`. Pass the `context` straight through into the next `/api/pull` request body as `context` — it hints the agent (e.g. "stay within these guids", "focus on this person").

### Placement

Render suggested actions below the final text block, above the `done` metadata footer, so users see them after reading the answer rather than competing with it mid-stream.

## Session continuity (multi-turn)

To have a coherent conversation, the client needs to thread two things between turns:

- **`sessionId`** — returned on the `done` event of each turn. Persist it for the life of the chat.
- **`history`** — a rolling window of the last N `{ role, content }` exchanges (user + assistant pairs). Our reference client uses N = 4 entries (so ~2 turns back).

On every follow-up `POST /api/pull`, include `sessionId` and `history` in the request body:

```
{
  "message": "...new user task...",
  "model": "fast",
  "sessionId": "abc-123",
  "history": [
    { "role": "user",      "content": "previous user turn" },
    { "role": "assistant", "content": "previous assistant final text" }
  ]
}
```

See the `historyRef` / `sessionIdRef` handling in `useJamiePullAgent.ts` (lines 20, 118–127, 314–321).

On "new chat" / `clearMessages`, drop both the cached `sessionId` and `history` so the next turn starts fresh.

## Auth, quota, and errors

`/api/pull` supports three caller identities on the same endpoint. Pick one per request:

### Anonymous free tier (browser / webapp usage)

- Send `X-Free-Tier: true`
- Send `X-Pulse-Session: <uuid>` — a client-generated, stable-per-browser-session identifier used for quota accounting
- **No `Authorization` header**

This path gets a small free-tier quota and returns 429 (not 402) when exceeded. See `getPulseHeader` in `src/services/pulseService.ts` for how our client builds these headers.

### Authenticated user (Plus / Pro)

- Send `Authorization: Bearer <jwt>` from your account system
- The backend maps the JWT to the user's tier and applies higher limits

### Machine / L402 agent

- Send `Authorization: L402 <macaroon>:<preimage>` — the same credential format as the other paid endpoints (`/api/search-chapters`, `/api/make-clip`, on-demand transcription, etc.)
- Mint the credential by hitting any paid endpoint unauthenticated, paying the Lightning invoice in the 402 challenge, and combining the returned macaroon with your preimage

### 402 handling

If a caller omits the `X-Free-Tier` header and sends no `Authorization`, the endpoint returns a standard L402 challenge identical to the other paid endpoints. Parse the `WWW-Authenticate: L402 ...` header, pay the invoice, and retry with the full credential.

### 429 handling

When a caller exceeds their tier quota, the endpoint returns `429` with a JSON body shaped like:

```
{
  "tier": "anonymous" | "registered" | "subscriber" | "admin",
  "used": 10,
  "max": 10,
  "resetDate": "2026-04-18T00:00:00Z",
  "daysUntilReset": 1,
  "entitlementType": "jamie-pull",
  "message": "optional friendly string"
}
```

Surface it however fits your UI. Our webapp shows a "You're on a roll — sign up / upgrade" modal. The shared parser lives in `src/types/errors.ts` (`parseQuotaExceededResponse`, `QuotaExceededError`).

### Stream errors

If an `error` SSE event arrives mid-stream, render it inline on the assistant message and stop consuming. Abort any in-flight fetch on unmount so aborted streams don't leak (our client uses `AbortController` for this — see `abortControllerRef` in the hook).

## Response metadata (`done` event)

Every completed turn ends with a `done` event carrying:

```
{
  "sessionId": "abc-123",
  "model": "fast",
  "rounds": 3,
  "toolCalls": [{ "name": "search_quotes", "resultCount": 12, "latencyMs": 812 }],
  "tokens": { "input": 4120, "output": 880 },
  "cost":   { "claude": 0.0081, "tools": 0.0012, "total": 0.0093 },
  "latencyMs": 5240
}
```

Useful UX treatments:

- Show `rounds` and `latencyMs` as a depth/speed signal (`"3 rounds · 5.2s"`).
- Show `cost.total` and total `tokens` in a faint footer for transparency.
- Our UI intentionally hides `model` — if you want to surface which model answered, just read `done.model`. See `ResponseMetadata` in `JamiePullAgentResultCards.tsx`.

## Gotchas cheat sheet

- **Streaming is opt-in.** `/api/pull` defaults to a single JSON response `{ sessionId, text, suggestedActions, session? }`. Send `stream: true` in the POST body (or `Accept: text/event-stream`) to get the SSE event stream this guide is built around. If your parser is hanging waiting for `event: status`, check the request body first.
- **Always flush the text buffer on `text` / `text_done`** even when the payload is empty. An empty payload means "I already streamed it via deltas"; a non-empty payload is authoritative and should replace whatever you accumulated.
- **`tool_result.resultCount` can be omitted.** Use an `isFinite` check before rendering it, otherwise you'll ship `"undefined results"` in your timeline.
- **`sessionId` isn't returned until the `done` event.** Don't try to thread one into the first request of a session; just send without it.
- **`suggested_action` can fire at any time.** Buffer events into a list keyed on the assistant message. Don't tie them to the text pipeline or you'll drop ones that arrive after `text_done`.
- **Dedupe clip-token lookups.** The same `pineconeId` can appear many times in a single response; resolve it once and reuse the cached meta.
- **`get-hierarchy` is public but rate-limited.** Keep concurrency low (1 at a time) and inter-request gaps around 500 ms, especially for responses that reference dozens of clips.
- **Abort on unmount.** Long agent turns can run 30–60 s. If the user navigates away, cancel the fetch so you don't keep appending to a stale message.
- **Minimum happy client:** markdown renderer + clip-token resolution + `sessionId` echo. Everything else (timeline, suggested-action chips, research-session cards, cost metadata) is progressive enhancement.

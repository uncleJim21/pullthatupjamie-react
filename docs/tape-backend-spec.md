# Tape backend — implementation spec

Status: spec for the next round. Target reader is whoever implements these endpoints (engineer or LLM).

## Why this exists

The Tape skin (Dossier, Brief, Split, Arc, Read in) currently runs on a hand-curated mock layer (`USE_MOCK_TAPE = true`). Real data flows by composing existing primitives (`/api/pull`, `/api/search-quotes`, `/api/corpus/people`, `/api/corpus/people/episodes`, `/api/get-hierarchy`), but the *editorial recipes* that make the demo content good (mainstream allowlist, dedicated-episode filter, paragraph-span sort, themed-query fan-out, freshness floors) currently live in offline Python bake scripts and would otherwise have to be duplicated in every client. This spec moves those recipes into a small set of composite backend endpoints so the editorial DNA lives once, every client inherits it, and the heavy `/pull` calls are cached cross-user.

Goal: a backend engineer can build this in a focused sprint and the frontend can swap from mock to real with a one-line change per service.

## 1. Auth model

One shared password for the demo, exchanged for a scoped JWT. Globally revocable by rotating a server-side `kid` (key id).

### `POST /api/tape/auth`

Request:
```json
{ "password": "<shared-secret>" }
```

Response 200:
```json
{
  "token": "<jwt>",
  "expiresAt": "2026-06-12T00:00:00.000Z",
  "scope": "tape-demo"
}
```

JWT payload:
```json
{
  "sub": "tape-demo",
  "scope": "tape-demo",
  "kid": "v3",
  "iat": 1748540000,
  "exp": 1751132000
}
```
- Sign HS256 with a backend secret.
- `kid` is read from server config (env var `TAPE_AUTH_KID`). To revoke every outstanding token, bump it.
- Expiry: 30 days. Frontend stores in `sessionStorage` and re-auths on 401.

Response 401:
```json
{ "type": "https://pullthatupjamie.ai/tape/auth-failed",
  "title": "Wrong password", "status": 401 }
```

### How endpoints check it

All `/api/tape/*` endpoints (except `/auth`) require `Authorization: Bearer <jwt>`. Reject if:
- Header missing or malformed → 401.
- Signature invalid → 401.
- `kid` does not match current server `TAPE_AUTH_KID` → 401 (this is the revocation path).
- `exp` past → 401.

Optionally also gate by `scope === "tape-demo"`. Future scopes (`tape-prod`, etc.) can coexist.

### Env vars
- `TAPE_AUTH_PASSWORD` — the shared secret (string).
- `TAPE_AUTH_SECRET` — HS256 signing key (32+ random bytes).
- `TAPE_AUTH_KID` — current key id (string, e.g. `"v3"`). Bump to revoke.

---

## 2. `POST /api/tape/person-quotes`

The "high-confidence person attribution" recipe, codified. Powers **Dossier**, **Arc**, and the **person side of Split**.

What it does, in order:
1. `corpus/people?search={name}&guestsOnly=true` to resolve the person and get their feed list.
2. `corpus/people/episodes {name, guestsOnly: true, limit}` to get appearances.
3. Filter to **dedicated episodes** by default (title contains the person's last name OR `dedicatedOnly=false` overrides).
4. Filter to **mainstream** episodes by default using the taste config (§5).
5. `search-quotes` fan-out across the chosen guids × themes, in parallel.
6. Dedup by `pineconeId`, sort by paragraph span (longer = higher), apply `minSpan` floor.
7. Tag each candidate with `confidenceTier` (`high` | `medium` | `low`) based on: dedicated episode (+), mainstream feed (+), long span (+), first-person heuristic (+).

### Request
```json
{
  "name": "Mohamed El-Erian",
  "themes": [
    "Federal Reserve interest rates inflation policy",
    "recession risk dollar Treasury yields"
  ],
  "filters": {
    "guestsOnly": true,
    "dedicatedOnly": true,
    "mainstream": true,
    "minSpan": 15,
    "maxSpan": 120,
    "minDate": "2024-01-01",
    "maxDate": null,
    "episodesLimit": 6,
    "quotesPerEpisode": 3,
    "candidatesLimit": 25
  }
}
```
Defaults (apply when caller omits): `themes: [name]`, `guestsOnly: true`, `dedicatedOnly: true`, `mainstream: true`, `minSpan: 15`, `episodesLimit: 6`, `quotesPerEpisode: 3`, `candidatesLimit: 25`.

### Response 200
```json
{
  "person": "Mohamed El-Erian",
  "appearances": [
    { "guid": "8f08fc3e-...", "title": "The U.S. Debt Crisis | Mohamed El-Erian",
      "feedTitle": "Forward Guidance", "publishedDate": "2025-03-20T08:00:00Z",
      "role": "guest", "imageUrl": "..." }
  ],
  "candidates": [
    {
      "pineconeId": "971334dc-...-p63",
      "text": "The Fed is not going to look through the inflation problem because last time...",
      "episodeTitle": "The US is Risking Stagflation | Mohamed El-Erian",
      "creator": "Forward Guidance",
      "episodeImage": "...",
      "audioUrl": "...",
      "startTime": 1843.5,
      "endTime": 1884.2,
      "publishedDate": "2025-03-07T...",
      "spanSec": 41,
      "confidenceTier": "high",
      "_signals": { "dedicated": true, "mainstream": true, "spanRank": 0.92 }
    }
  ],
  "_meta": {
    "cached": false,
    "underlying": { "peopleEpisodes": 1, "searchQuotes": 6, "ms": 1420 }
  }
}
```

### Errors
- 400 invalid request (missing `name`, bad date format).
- 401 missing/invalid JWT.
- 404 person not found in corpus (`corpus/people` empty result).
- 429 rate-limited (see §7); body is the `QuotaExceededData` shape already used by `/api/pull`.
- 502 upstream failure (one of the corpus calls 5xx'd).

### Caching
Redis key: `tape:pq:v1:{sha256(canonicalized-body)}`. TTL: **30 minutes**. Cache the full response. Skip cache if request includes `_nocache: true` (debugging only, gated by an internal flag).

---

## 3. `POST /api/tape/topic-quotes`

The "topic-first retrieval" recipe. Powers **Brief**, **Split (camp side)**, **Read-in's quote layer**.

What it does:
1. For each `theme` in the request (a list of phrasings of the same topic), call `search-quotes` with the theme + `minDate`/`maxDate` + `feedIds` filter, in parallel.
2. Dedup by `pineconeId`, apply `minSpan`, apply mainstream allowlist by default.
3. Optionally group by `creator` (Brief) or by hand-tagged camp (Split). Camp grouping uses a small set of bull/bear keyword heuristics on the quote text; can be disabled.

### Request
```json
{
  "query": "Strait of Hormuz oil supply shock Iran",
  "themes": ["Strait of Hormuz closed Iran war",
             "oil price spike supply chain Middle East"],
  "filters": {
    "mainstream": true,
    "minDate": "2026-04-15",
    "maxDate": null,
    "feedIds": [],
    "minSpan": 10,
    "candidatesLimit": 25
  },
  "groupBy": null
}
```
- `query` is fallback if `themes` is omitted.
- `groupBy: "creator"` returns a `groups` array keyed by creator. `groupBy: "bull-bear"` runs a keyword classifier on each quote and tags `side: "bull" | "bear" | "neutral"`.

### Response 200
```json
{
  "query": "Strait of Hormuz oil supply shock Iran",
  "candidates": [ /* same TapeCitation-ish shape as above */ ],
  "groups": [
    { "key": "Bloomberg Surveillance", "candidates": [/*...*/] },
    { "key": "Odd Lots", "candidates": [/*...*/] }
  ],
  "_meta": { "cached": false, "underlying": { "searchQuotes": 2, "ms": 980 } }
}
```
`groups` is only present when `groupBy` is set.

### Caching
Redis key: `tape:tq:v1:{sha256(body)}`. TTL: **15 minutes** (more time-sensitive than person-quotes).

---

## 4. `POST /api/tape/synthesize`

The thin `/pull` wrapper. Takes pre-filtered candidates from `person-quotes` or `topic-quotes`, runs ONE `/pull` call with a synthesis prompt of the right `kind`, returns the agent's text output (with `{{clip:id}}` tokens) and token usage. This is where you'd add per-model routing, prompt versioning, daily cost guards, etc.

### Request
```json
{
  "kind": "dossier",
  "input": {
    "person": "Mohamed El-Erian",
    "topic": null,
    "personB": null,
    "ticker": null
  },
  "candidates": [
    { "pineconeId": "971334dc-...-p63", "text": "...", "creator": "Forward Guidance",
      "episodeTitle": "...", "publishedDate": "2025-03-07T..." }
  ],
  "model": "fast",
  "stream": false
}
```
- `kind` ∈ `"dossier" | "brief" | "split" | "arc" | "readin"`. Backend has one prompt template per kind; same section markers (`## TOPIC:`, `## PUBLISHER:`, `## PERSON:`, etc.) the client already parses.
- `input` carries action-specific extras: which person/topic/ticker.
- `candidates` is the pre-filtered set to ground the synthesis on. Pass fewer (5–15) for quality.
- `model: "fast"` is default. `"quality"` upgrades to a larger model.
- `stream: false` returns the full result in one body. `stream: true` returns SSE in the same event shape `/api/pull` already streams.

### Response 200 (non-stream)
```json
{
  "kind": "dossier",
  "text": "## TOPIC: Inflation and the Fed\nEl-Erian's read... {{clip:971334dc-...-p63}}\n...",
  "tokens": { "input": 4120, "output": 1830 },
  "model": "claude-sonnet-4-6",
  "elapsedMs": 24300,
  "_meta": { "cached": false }
}
```
The text contains `{{clip:id}}` tokens that the client already knows how to render (the existing `extractClipIds` regex + `getHierarchy` hydration). Candidates passed in were already hydrated, so the client doesn't need a second `get-hierarchy` round trip — it just renders the existing `TapeCitation` from its candidate pool.

### Response 200 (stream)
Same SSE shape as `/api/pull`: `status` / `text_delta` / `text` / `done` / `error` events.

### Errors
- 400 invalid `kind` or empty `candidates`.
- 401 auth.
- 429 quota — backend hard-caps `/pull` spend (see §7).
- 502 upstream `/pull` failure.

### Caching
Redis key: `tape:syn:v1:{kind}:{sha256(candidates + input + model)}`. TTL: **2 hours**. Synthesis is deterministic for a fixed input + model + prompt-version; cache aggressively. Bump cache key prefix (`v1` → `v2`) when prompts change.

---

## 5. `GET /api/tape/quote/:slug`

Server-side Yahoo Finance proxy. Resolves the CORS block that prevents direct browser fetches. Used for the Read-in header card and every `TapeTickerStrip`.

### Request
- `GET /api/tape/quote/APP`
- `GET /api/tape/quote/%5ETNX` (URL-encoded `^TNX`)
- `GET /api/tape/quote/DX-Y.NYB`
- `GET /api/tape/quote/CL%3DF` (URL-encoded `CL=F`)

Auth: still required (Bearer JWT). We could open this up to free-tier later, but for now gate it like the others.

### Response 200
```json
{
  "symbol": "APP",
  "name": "AppLovin Corp",
  "price": 613.09,
  "currency": "USD",
  "dayChangePct": 2.20,
  "spark": [600.12, 605.34, 607.10, 609.85, 611.40, 614.20, 608.95, 610.30, 609.50, 613.09],
  "marketState": "REGULAR",
  "_meta": { "cached": false, "source": "yahoo", "fetchedAt": "2026-05-29T18:32:00Z" }
}
```

Backend fetches `https://query1.finance.yahoo.com/v8/finance/chart/{slug}?range=1mo&interval=1d` with a desktop `User-Agent`, parses out `meta.regularMarketPrice`, the last 10 daily closes (filtering nulls), computes `dayChangePct` from the last two valid closes (not `chartPreviousClose` — see §10 gotchas).

### Caching
Redis key: `tape:q:{slug}`. TTL: **60s** when market is open (US: 9:30–16:00 ET, Mon–Fri), **5 minutes** otherwise. The `_meta.fetchedAt` field tells the client how stale the data is.

### Errors
- 401 auth.
- 404 unknown slug (Yahoo returned no result).
- 429 from Yahoo upstream → forward as 429 with a generous backoff hint.

---

## 6. Editorial taste config

These shape the recipes in `person-quotes` and `topic-quotes`. Live as backend config (a JSON or YAML file in the repo), not hard-coded in handler logic. Reloadable without restart.

```yaml
# config/tape-taste.yaml
mainstream_allow:
  - bloomberg
  - bloomberg surveillance
  - bloomberg intelligence
  - macro voices
  - macrovoices
  - forward guidance
  - real vision
  - the compound
  - the compound and friends
  - odd lots
  - prof g markets
  - all-in
  - capital allocators
  - decoder
  - hidden forces
  - investor's podcast
  - tim ferriss
  - grant williams
  - masters in business
  - animal spirits
  - the daily
  - goalhanger

mainstream_deny:
  - simply bitcoin
  - bankless
  - tftc
  - what bitcoin did
  - guy swann
  - bitcoin audible
  - no agenda
  - empire
  - hivemind

# 1 substring match against `creator` (case-insensitive).
# A clip is "mainstream" if it matches an allow entry AND no deny entry.

dedicated_match: "last-name"
# Options: 'last-name' (default, current heuristic), 'full-name', 'exact-title'.

confidence_signals:
  dedicated_weight: 0.4
  mainstream_weight: 0.3
  span_weight: 0.3
  # Tier thresholds:
  high_min: 0.7
  medium_min: 0.4
```

The handler reads this at startup (and on SIGHUP if you want hot reload). All filtering uses this config; tweaking editorial taste = edit one file, redeploy/reload.

---

## 7. Cost guards, rate limits, kill switches

`/api/pull` is the only expensive primitive. Everything else is rounding error.

### Per-JWT rate limits
- `synthesize`: **30 calls / hour** per JWT (the expensive one).
- `person-quotes`, `topic-quotes`: **120 calls / hour** per JWT.
- `/api/tape/quote/*`: **600 calls / hour** per JWT.

Implementation: Redis sorted-set counter keyed by `(jwt-sub, endpoint, hour-bucket)`. Exceed → 429 with `QuotaExceededData` body.

### Global daily kill switch
- `synthesize` enforces a **global daily token cap** (env: `TAPE_DAILY_OUTPUT_TOKEN_CAP`, default e.g. `5_000_000`). Once exceeded, all `synthesize` calls 429 until the next UTC day. Logged loudly.
- A simpler **dollar cap** env (`TAPE_DAILY_USD_CAP`) computes from `tokens × per-model-rate` and short-circuits the same way.

### Kid bump kill switch
Set `TAPE_AUTH_KID` to a new value → every existing JWT 401s. Quickest way to stop the bleeding if a token leaks or a bot finds the password.

### Defaults that cap normal-case spend
- `synthesize.model` defaults to `"fast"` (Sonnet-tier).
- `person-quotes` / `topic-quotes` cache hard (30 / 15 min) → popular queries pay once.
- `synthesize` cache 2h → identical inputs are free after the first.

---

## 8. Observability

Each `/api/tape/*` handler logs (structured JSON, single line per request):
```
{
  "ts": "2026-05-29T18:32:01.234Z",
  "endpoint": "synthesize",
  "kind": "dossier",
  "jwt_sub": "tape-demo",
  "cache": "miss",
  "upstream_calls": { "pull": 1 },
  "tokens": { "input": 4120, "output": 1830 },
  "model": "claude-sonnet-4-6",
  "cost_usd_est": 0.0436,
  "elapsed_ms": 24300,
  "status": 200
}
```

Daily aggregates:
- Total `synthesize` calls + total tokens + total estimated $.
- Cache hit rate per endpoint.
- 429 count.
- Per-`kind` synthesis count and avg latency.

Alerts:
- `> $10` synth spend in a day → warn.
- `> $50` synth spend in a day → page + auto-flip kill switch.
- 429 rate > 5% → page (suggests bot / leak).

---

## 9. Error model (consistent across endpoints)

All errors return:
```json
{
  "type": "https://pullthatupjamie.ai/tape/<error-slug>",
  "title": "...",
  "status": 4xx | 5xx,
  "detail": "...",
  "creditInfo": { /* same shape as existing 429 from /api/pull, when applicable */ }
}
```

Frontend already handles this shape (`parseQuotaExceededResponse` in `src/types/errors.ts`). Reuse.

---

## 10. Implementation gotchas

- **`chartPreviousClose` is the close BEFORE the requested range**, not yesterday. To compute *daily* change %, use `closes[-1]` vs `closes[-2]` from the `quote.close` series, not `meta.chartPreviousClose`. (We learned this the hard way.)
- **`search-quotes` requires `X-Free-Tier: true` OR a Bearer token** to bypass L402. Our backend should call it with our own service credentials, not pass the client's JWT through.
- **`/api/pull` is SSE-only when `stream: true` is set**. When `synthesize.stream=false`, we still call `/pull` with `stream: true` upstream, collect the text, return a single body. The client doesn't see SSE in that mode.
- **Yahoo proxies fail under rate pressure**. Add a short-circuit: if Yahoo returns 429 / 5xx, return the last cached value with `_meta.stale: true` rather than failing the request. Stale prices are better than no prices.
- **Don't pass the demo JWT to `/api/pull`**. The demo JWT is scoped to Tape; backend uses its own service auth to call internal primitives.

---

## 11. Frontend contract (what changes when this lands)

After backend ships, frontend changes are mechanical:

1. [src/services/tape/tapeClient.ts](../src/services/tape/tapeClient.ts) — add four helper methods: `personQuotes(input)`, `topicQuotes(input)`, `synthesize(input)`, `tickerQuote(slug)`. Each attaches `Authorization: Bearer ${jwt}` from sessionStorage.
2. Each `*Service.ts` real path becomes ~3 lines: call `personQuotes` or `topicQuotes` → call `synthesize` → parse markers + map candidates to `TapeCitation`. The marker parsers and the result-assembly helpers stay where they are.
3. New file: `src/components/tape/TapeAuthGate.tsx` — wraps `TapePage`, shows a password input if no JWT in `sessionStorage`, posts to `/api/tape/auth`, stores the JWT, renders children. On 401 from any endpoint, clears storage and re-shows the gate.
4. `src/config/tapeConfig.ts` — flip `USE_MOCK_TAPE = false` when backend is up. Mock data stays in the tree as fallback / for cold local dev.

---

## 12. Build sequence (suggested)

1. **Auth + Yahoo proxy** first (smallest pieces, unblocks ticker strips and gates everything else).
2. **`person-quotes`** next. Easiest composite to validate (Dossier on El-Erian → recognizable output). After this, `dossierService.ts` and `arcService.ts` can swap.
3. **`topic-quotes`**. Hardest filter tuning (mainstream allowlist + groupBy). Validate against the existing Hormuz Brief and AI-bubble Split.
4. **`synthesize`** last. By the time this ships, the upstream filtering is solid, so the `/pull` prompts already work on pre-filtered candidate sets.

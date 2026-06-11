# Tape backend — persistent users + persona-biased retrieval

## TL;DR

Tape v1 gates behind a shared-password JWT (`scope: "tape-demo"`). v2 swaps to **real user accounts** (the main app already has email/password + Nostr + Twitter OAuth) and adds a **free-text persona field** stored in `UserPreferences`. Every Tape API call carries the authenticated user's identity in the JWT; backend reads the user's persona from `UserPreferences.tapePersona` and uses it to bias retrieval scoring on every kind-level endpoint. Per-user cache isolation is a hard requirement — different personas MUST yield different cached results.

This is **auth + persona only** for v2. Saved/pinned items, alerts, and activity logs are explicit non-goals this round.

## Why this matters

Today Tape is a great-but-generic research surface — every user sees the same synthesis for the same query. The persona unlocks the difference between "give me what mainstream macro said about NVDA" and "given that I trade NVDA and listen to Macro Voices and I'm skeptical of AI capex, give me what mainstream macro said about NVDA." Same corpus, same retrieval primitive — but a small bias on theme expansion + candidate scoring turns a generic Read-in into something that feels written for the reader. That's the entire value prop of persistent users for this product.

The reason the persona is **free-text** rather than a structured profile builder is: traders don't think in structured forms. They think in sentences. "I'm long NVDA / MSFT / GOOG, short TLT, watching credit spreads, bearish on commercial RE, listen to Forward Guidance and Macro Voices, ignore CNBC" — that paragraph carries more bias signal than fifty checkboxes would.

## Change 1 — `POST /api/tape/auth` accepts the main-app token

### Today

```
POST /api/tape/auth
{ "password": "<shared-secret>" }
→ 200 { "token": "<JWT>", "expiresAt": "...", "scope": "tape-demo" }
JWT.sub = "tape-demo" (everyone)
```

### After

The endpoint accepts EITHER the legacy `password` (kept for the demo gate during transition) OR `authToken` (the main app's `auth_token` from `localStorage.getItem("auth_token")`). When `authToken` is provided, backend validates it against the main-app auth server and returns a Tape JWT whose `sub` is the authenticated user's identifier.

```
POST /api/tape/auth
Option A (legacy, transitional):
  { "password": "<shared-secret>" }
  → JWT.sub = "tape-demo", scope = "tape-demo"

Option B (new, preferred):
  { "authToken": "<main-app-jwt>" }
  → JWT.sub = "<userId>", scope = "tape-user"
```

### Pseudo-code

```js
// POST /api/tape/auth handler
async function handleTapeAuth(req, res) {
  const { password, authToken } = req.body;

  // Option B: real user account
  if (authToken) {
    const user = await validateMainAppAuthToken(authToken);
    if (!user) return res.status(401).json(authError("Invalid auth token"));

    const tapeJwt = signTapeJwt({
      sub: user.id,                  // real user id, not "tape-demo"
      scope: "tape-user",
      kid: process.env.TAPE_AUTH_KID,
      iat: now(),
      exp: now() + DAYS_30,
    });
    return res.json({
      token: tapeJwt,
      expiresAt: isoFromUnix(now() + DAYS_30),
      scope: "tape-user",
      userId: user.id,                // helpful for client to confirm
    });
  }

  // Option A: legacy shared-password (kept for the demo gate)
  if (password === process.env.TAPE_AUTH_PASSWORD) {
    return res.json({
      token: signTapeJwt({ sub: "tape-demo", scope: "tape-demo", ... }),
      expiresAt: ...,
      scope: "tape-demo",
    });
  }

  return res.status(401).json(authError("Wrong password"));
}
```

### Backwards compatibility

Existing demo JWTs (`scope: "tape-demo"`, `sub: "tape-demo"`) continue working until they expire. No forced re-auth. Bump `TAPE_AUTH_KID` to invalidate all outstanding tokens at any time (existing behavior, unchanged).

## Change 2 — Persona storage + sanitization

### Where it lives

`UserPreferences` is the existing schema-versioned preference store (`GET/PUT /api/preferences`). Add one field:

```ts
interface UserPreferences {
  // existing fields ...
  tapePersona?: string;            // NEW: max 2000 chars after sanitization
  schemaVersion: "20260608001";    // bump from current
}
```

### Sanitization

When writing `tapePersona`, backend MUST:

1. **Strip obvious PII** — email regex, phone regex, SSN-shaped strings. Replace with `[redacted]`. The persona is sent to an LLM as part of theme expansion; we should not be passing emails into prompts.
2. **Trim to 2000 chars** post-sanitization. Reject (400) if pre-sanitization length > 8000 chars (anti-abuse).
3. **Reject markup attempts** — strip HTML tags, control characters. Plain text only.

### Pseudo-code

```js
// PUT /api/preferences handler (extending existing logic)
async function updatePreferences(req, res) {
  const { tapePersona, ...rest } = req.body;

  let cleanedPersona;
  if (tapePersona !== undefined) {
    if (typeof tapePersona !== "string") {
      return res.status(400).json({ error: "tapePersona must be a string" });
    }
    if (tapePersona.length > 8000) {
      return res.status(400).json({ error: "tapePersona exceeds max length" });
    }
    cleanedPersona = tapePersona
      .replace(/[\x00-\x1F\x7F]/g, " ")                      // control chars
      .replace(/<[^>]*>/g, "")                                // HTML tags
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[redacted-email]")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-id]")
      .trim()
      .slice(0, 2000);
  }

  await savePreferences(req.userId, {
    ...rest,
    ...(cleanedPersona !== undefined && { tapePersona: cleanedPersona }),
    schemaVersion: "20260608001",
  });

  return res.json({ ok: true });
}
```

### Reading it for Tape requests

Two options, both fine:

**(a) Lookup per request** — every `/api/tape/*` kind handler calls `getPreferences(userId)` and reads `tapePersona`. Simple, always fresh. Adds a DB read per request.

**(b) Bake into JWT claims at auth time** — `tapePersona` becomes a JWT claim returned by `POST /api/tape/auth`. Zero DB reads on subsequent calls. Stale until next token refresh.

**Recommended: (a).** The lookup is cheap (preferences should be cached at the read layer), and persona changes take effect immediately. (b) creates a confusing "I updated my persona but my results haven't changed" gap.

## Change 3 — Persona-biased retrieval scoring

This is the load-bearing change. Every kind endpoint (`/api/tape/readin`, `/brief`, `/split`, `/narrative`, `/dossier`) needs to consume the persona during retrieval.

### Where the bias applies

Two surfaces, in order of impact:

1. **Theme expansion** — the existing LLM rewrite step that turns the user's query into 4-6 podcast-shaped variants. The persona biases what variants get generated.
2. **Candidate scoring** — after retrieval returns candidates, candidates that touch the persona's tickers/themes/preferred shows get a tiebreak boost in ranking.

The bias should be **subtle and bounded**. Persona is a thumb-on-the-scale, not an override. A user whose persona says "I trade NVDA" running a Brief on Hormuz should still get the Hormuz brief — not an NVDA brief. The persona only kicks in when there's ambiguity.

### Pseudo-code: theme expansion with persona

```js
// Inside the existing theme expansion step
async function expandThemes({ topic, kind, persona }) {
  const prompt = `
Generate 4-6 ways a macro podcaster would phrase discussion of "${topic}"
for a ${kind} action.

${persona ? `
The reader has the following context:
"""
${persona}
"""

When generating phrasings, prefer angles that align with the reader's
known interests (tickers they trade, theses they hold, shows they
listen to). Do NOT skew the topic itself — if the reader trades NVDA
and the topic is "Hormuz oil disruption," do not generate NVDA-themed
phrasings. The persona is a tiebreaker for borderline angles, not a
topic override.
` : ""}

Return as a JSON array of strings.
`;
  return llm.json(prompt);  // existing pattern
}
```

### Pseudo-code: candidate scoring with persona

```js
// After the candidate pool is assembled (post topic-quotes / person-quotes)
function rerankWithPersonaBias(candidates, persona) {
  if (!persona) return candidates;

  const tickers = extractTickerSymbols(persona);          // "I trade NVDA, MSFT" → ["NVDA", "MSFT"]
  const shows = extractMentionedShows(persona);           // "watch Macro Voices, Forward Guidance" → ["macro voices", "forward guidance"]
  const themes = extractKeyPhrases(persona);              // "bearish on AI capex" → ["ai capex", "ai bubble", ...]

  return candidates
    .map(c => {
      let bonus = 0;
      const textLower = c.text.toLowerCase();
      const creatorLower = (c.creator || "").toLowerCase();

      for (const t of tickers) {
        if (textLower.includes(t.toLowerCase())) bonus += 0.05;
      }
      for (const s of shows) {
        if (creatorLower.includes(s)) bonus += 0.03;
      }
      for (const th of themes) {
        if (textLower.includes(th)) bonus += 0.02;
      }

      // Bounded: persona can shift score by at most ~0.15 absolute. Topical
      // relevance still dominates. Persona only matters at the margin.
      return { ...c, score: c.score + Math.min(bonus, 0.15) };
    })
    .sort((a, b) => b.score - a.score);
}
```

`extractTickerSymbols`, `extractMentionedShows`, `extractKeyPhrases` can be either small LLM calls (cached per persona) OR regex/dictionary based. Either is fine; the LLM version is more robust to phrasing ("long NVDA" / "I'm in NVDA" / "NVIDIA bull" all map to NVDA) but requires caching to avoid running the extraction on every request. Recommend: **LLM extraction at persona-write time, store the structured signals alongside `tapePersona` in preferences**:

```ts
interface UserPreferences {
  tapePersona?: string;
  tapePersonaSignals?: {                  // cached extraction
    tickers: string[];                    // ["NVDA", "MSFT"]
    shows: string[];                      // ["macro voices", "forward guidance"]
    themes: string[];                     // ["ai capex", "credit spreads"]
    extractedAt: string;                  // ISO
  };
  schemaVersion: "20260608001";
}
```

Then candidate scoring is a pure-code reranker — fast, deterministic, no LLM on hot path.

## Change 4 — Cache key extension (per-user isolation)

If user A runs `Read-in NVDA` and user B runs `Read-in NVDA`, they MUST get different cached results when their personas differ. Otherwise A's persona contaminates B's request and vice versa.

### Today

```
cacheKey = `tape:kind:readin:v1:${sha256(canonicalize({
  ticker: "NVDA",
  depth: "quick",
  model: "quality",
}))}`
```

### After

```js
function tapeCacheKey(kind, requestBody, persona) {
  // Hash a per-user dimension into the key. Either the userId directly
  // (simplest, isolates per user) or a hash of the persona text itself
  // (sharing cache between users with identical personas — more efficient
  // but harder to reason about).
  //
  // Recommended: per-user. The query volume per user is too low to make
  // persona-text hashing worth the complexity.
  const userBucket = persona ? sha256(`${userId}|${persona}`).slice(0, 12) : "anon";
  return `tape:kind:${kind}:v2:${userBucket}:${sha256(canonicalize(requestBody))}`;
}
```

The `v2` prefix forces a cache-wide eviction at deploy time so we don't serve pre-persona cached responses to authenticated users.

### Anonymous bucket

For the legacy `scope: "tape-demo"` JWTs (no userId), use a shared `anon` bucket — same as today's behavior. Cache hit rates for the demo gate stay the same.

## Acceptance tests

Backend ships when:

1. **Auth options both work.** Posting `{ password: "<demo-secret>" }` returns a `tape-demo` JWT. Posting `{ authToken: "<main-app-jwt>" }` returns a `tape-user` JWT with the right `sub`.
2. **Persona persists.** PUT `/api/preferences` with `{ tapePersona: "I trade NVDA, watch Macro Voices, bearish on AI capex" }` succeeds. GET `/api/preferences` returns it. Email/phone in the persona text get redacted before storage.
3. **Persona biases retrieval.** Cold-run `Read-in NVDA` for user A with the above persona and user B with empty persona. User A's `whatTheyDoCitations` / `smartMoney.bulls` should include at least one Macro Voices / Forward Guidance quote; user B's response should not be biased toward those shows.
4. **Cache isolation.** Re-run the same query for both users back-to-back. Verify in logs that user A and user B hit DIFFERENT cache keys.
5. **Borderline test.** User A (NVDA trader) runs `Brief: "oil & the Strait of Hormuz"`. Result is STILL about Hormuz, not NVDA. Persona only nudges within-topic ambiguity.

Paste the raw JSON from one of these test responses back so we can confirm the wiring end-to-end.

## Migration

- Existing `tape-demo` JWTs in users' sessionStorage continue working until their `exp`. No forced re-auth at deploy time.
- Bump `TAPE_AUTH_KID` if you want to evict everyone (existing kill switch).
- `tapePersona` is optional throughout. Empty persona → backend behaves identically to today (no bias, anon cache bucket).
- Frontend will ship the persona drawer behind a feature-flag-equivalent check on `scope: "tape-user"`. Users on legacy `tape-demo` JWTs won't see the drawer until they sign in with real credentials.

## What we'll do client-side once you ship

1. `POST /api/tape/auth` body switches to `{ authToken }` when the user has a main-app `auth_token` in `localStorage`. Falls back to the legacy password when not.
2. Persona drawer in the Tape top bar with one textarea, save button, "what's this for?" explainer.
3. Drawer opens automatically on first sign-in (`scope === "tape-user"` AND `tapePersona` empty in preferences).
4. Show a small "Persona active" indicator on result headers when the response was personalized (we can detect via a new `_meta.personaApplied: boolean` field if you add it — optional, nice-to-have).

## Out of scope this round

- **Saved / pinned individual clips, quotes, or result snapshots.** The user explicitly chose "auth + persona only" for v2. Saved items is the natural next ask once this lands.
- **Alerts / notifications when persona-matching topics surface in the corpus.** Same — natural follow-up but not v2.
- **Activity log of past searches.** Same.
- **Multi-persona / context switching** ("personal" vs "work" personas). Not v2.
- **Persona inference from search history.** v2 takes the persona literally from the textarea; no implicit inference.
- **Sharing personas between users / persona templates.** Not v2.

## What we'd like back

1. Confirmation the four changes above will ship together (auth body, persona storage + sanitization, persona-biased retrieval, cache key extension).
2. Pushback on the recommended design where you disagree — particularly on (a) lookup-per-request vs JWT-bake, (b) LLM extraction at write time vs regex/dictionary, (c) per-user vs per-persona-hash cache buckets.
3. Estimated timeline so we can sequence the client side.
4. After ship: a raw JSON response from one of the acceptance tests so we can validate end-to-end before users hit it.

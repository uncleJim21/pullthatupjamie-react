# Tape: persona normalizer endpoint

**Status:** Draft / FE asking
**Owner:** backend
**Companion to:** `docs/tape-backend-persona-contract.md`

## TL;DR

The persona drawer ships today as a plain textarea: the user writes raw
prose ("I trade NVDA, watch Macro Voices, bearish on AI capex"), we
PUT it onto `UserPreferences.tapePersona`, and the next `/api/tape/feed`
call uses it server-side. That works, but it's a one-shot — the user has
no way to confirm the Tape understood them before saving.

The ask: an LLM normalizer endpoint that takes the user's raw prose and
returns a structured interpretation the FE can preview *before* the
user commits the save. Two payoffs:

1. **Trust.** User sees "we read this as: tickers NVDA/AMD/COIN, shows
   Macro Voices + Odd Lots, theses bearish AI capex, Fed cuts watcher"
   and can correct it. Persona save is no longer a black box.
2. **Better retrieval.** Backend already wants structure for biasing —
   the normalized fields can flow straight into theme expansion and
   candidate scoring instead of re-parsing the raw text every time.

## Endpoint

```
POST /api/tape/persona/normalize
Authorization: Bearer <main-app token>
Content-Type: application/json

{ "raw": "<free-text persona, ≤2000 chars>" }
```

### Response (200)

```json
{
  "interpreted": {
    "tickers":  ["NVDA", "AMD", "COIN"],
    "shows":    ["Macro Voices", "Odd Lots", "The Compound"],
    "theses":   ["bearish AI capex into '26", "watching Fed cuts"],
    "themes":   ["semis", "oil", "rates"],
    "people":   ["Luke Gromen", "Lyn Alden"]
  },
  "summary": "Trader focused on AI / semis with a bearish AI-capex bias, listens to macro-leaning shows, watches the Fed cycle.",
  "normalizedText": "I trade NVDA, AMD, COIN. Bearish AI capex into '26. Listen to Macro Voices, Odd Lots, The Compound. Care about Fed cuts, oil, semis.",
  "confidence": "high" | "medium" | "low",
  "warnings": [
    "Couldn't identify the ticker 'XYZ' — left out of tickers list."
  ]
}
```

Field semantics:

- **`interpreted`**: structured fields the FE renders as preview chips.
  All arrays may be empty. No field is required to be populated.
- **`summary`**: ≤200 chars, plain-English recap of how the system reads
  the user. Rendered above the chips so users can sanity-check tone at a
  glance.
- **`normalizedText`**: optional cleanup of the raw text — fixed casing,
  expanded shorthand, deduped phrasing. The FE shows this as the
  "we'll save this" preview. If backend doesn't want to alter user
  prose, return the raw text verbatim — same behavior.
- **`confidence`**: signals how much we trust the extraction. The FE
  uses it to set the tone on the preview ("ready to save" vs "we
  weren't sure about these — review before saving").
- **`warnings`**: optional human-readable strings rendered as
  notes. Use for things like unknown tickers, ambiguous show names,
  PII stripped, etc.

### Errors

- **400**: `raw` missing / over 2000 chars / non-string.
- **401**: missing or invalid token (gate-level redirect handled by
  existing `tape:unauthorized` event).
- **429**: rate limit (suggest: 1 call per 5s per user — this is a
  preview, not a hot path).
- **502/504**: upstream LLM failure. FE falls back to raw save in this
  case — see "Fallback" below.

## What the FE does with the response

The drawer gains a two-step flow:

1. User types prose, clicks **Preview** (renamed save button).
2. FE calls `/api/tape/persona/normalize`. Spinner. ~2–5s.
3. Drawer shows the `summary` + chip groups (tickers, shows, theses,
   themes, people) above the textarea, marked editable individually
   if we want post-MVP. Below, the `normalizedText` (or raw) as a
   final-confirmation block.
4. **Save** button writes either the raw text or normalizedText to
   `UserPreferences.tapePersona` (per backend's preference — see
   "Storage" below) and dispatches the existing feed-invalidate event.

If the user edits the textarea after previewing, the preview state
resets — they have to re-preview to save (so the chips don't lie about
what they're saving).

## Storage

Two options. Backend picks:

- **(a) Raw only.** FE saves the user's prose (or normalizedText if
  backend prefers cleanup). Retrieval bias parses persona on each
  feed call, same as today. Normalizer is a *preview* surface only.
- **(b) Structured side-channel.** FE saves raw text AND the
  `interpreted` structure (`UserPreferences.tapePersona` stays a
  string; new `UserPreferences.tapePersonaStructured` holds the
  arrays). Retrieval bias reads structured fields directly — cheaper
  + more deterministic at request time.

(b) is the bigger win long-term but adds schema surface. (a) is the
minimal-risk path that gets the preview UX with no other plumbing
changes. Recommend (a) for v1, (b) when biasing quality justifies it.

## Fallback

If `/api/tape/persona/normalize` 5xx's or times out, the drawer
silently falls back to plain-save: the textarea-with-no-preview path
we have today. User loses the chip preview for that save but doesn't
lose the persona. This means **the normalizer endpoint is not
load-bearing** for the persona feature — it's an enhancement that
gracefully degrades.

Same applies if backend turns the endpoint off (FE feature-flags it
locally; missing endpoint = preview hidden).

## Sanitization

Same rules as the persona-contract memo:

- ≤2000 chars after trimming. FE clips client-side too.
- Strip emails, phone numbers, URLs from the raw text *before*
  feeding into the LLM (don't want to leak in summary echo).
- Reject obvious prompt-injection patterns (e.g. lines starting with
  "ignore previous instructions" — drop or escape).
- LLM system prompt should constrain output to the schema above
  (no free-form prose outside `summary` / `warnings`).

## Acceptance test

1. Brand-new signed-in user, empty persona, drawer auto-opens.
2. User types: `"I trade NVDA, AMD, COIN. Bearish AI capex into 2026.
   Listen to Macro Voices and Odd Lots."`
3. Clicks **Preview**. Within ~5s, the drawer shows:
   - Summary one-liner.
   - Tickers chips: NVDA, AMD, COIN.
   - Shows chips: Macro Voices, Odd Lots.
   - Theses: "bearish AI capex into 2026".
4. Clicks **Save**. Drawer closes, feed refetches, NVDA appears in
   the personalized ticker strip with a `reason: 'persona'` flag.
5. Repeat with a deliberately ambiguous input ("I'm bullish on
   stuff"). Confidence comes back `low`, `warnings` populated, FE
   still allows save.
6. Simulate normalizer 5xx. Verify the drawer falls back to plain
   save (no preview, save button enabled, normal save path runs).

## Open questions for backend

1. Which option for storage — (a) raw only, or (b) raw + structured?
2. Acceptable response time (p95) for the normalizer? We'll add a
   spinner; anything <5s is fine UX-wise. Beyond that, we should
   consider streaming.
3. Should the FE pass the *previous* `tapePersona` (if any) so the
   normalizer can do delta-style updates ("user is adding shows but
   keeping the existing theses")? Or always treat the input as the
   complete replacement?
4. Is there a non-LLM path for the simple cases (e.g. extracting
   ticker symbols via regex) so we can ship the chip preview even
   when the LLM tier is degraded?

# Tape backend — conform synthesize prompts to the client contract

## The ask in one paragraph

The frontend parses every `synthesize` response against a strict, per-kind marker contract. We hit our first real test (CRWV / Read-in) and the synth came back with dossier-style markers (`## TOPIC:`, `## CONTEXT:`) instead of readin markers (`## WHAT_THEY_DO`, `## PULSE | BULL/BEAR`, `## SMART_MONEY: …`, `## RISKS`). The client correctly rendered nothing for the missing sections. **The frontend will not loosen its parser** — those markers are the typed shape the UI is built around, and accepting dossier markers in a readin slot would render misleading content (a "CRWV topic stance" presented as a company primer). Please update the per-kind `synthesize` prompts to emit the contract verbatim, and handle optional sections by **omitting** them when the candidates don't support them (never render an empty header).

A second, smaller ask at the bottom on ticker-shaped retrieval noise.

---

## 1. The marker contract — one prompt template per kind

For each `kind`, the prompt must instruct the model to emit ONLY these markers, in this order, using EXACTLY these spellings (parser is case-insensitive on the marker name itself; structural punctuation like `|` is literal). Citations are `{{clip:<pineconeId>}}` and must come from the supplied candidate pool — never invent ids.

### `kind: 'readin'`

```
## WHAT_THEY_DO
<2-3 paragraph plain-English primer on the company. Required.>

## PULSE | BULL: <one-sentence bull case> | BEAR: <one-sentence bear case>
{{clip:<id>}}   # the single strongest marquee quote

## SMART_MONEY: BULL
{{clip:<id>}}
{{clip:<id>}}

## SMART_MONEY: BEAR
{{clip:<id>}}

## RISKS
- <one-line risk>
- <one-line risk>
```

- `## WHAT_THEY_DO` is REQUIRED if any candidate mentions the company. If the pool is so noisy that you cannot produce a primer, return empty text (see §3).
- `## PULSE`, `## SMART_MONEY: BULL`, `## SMART_MONEY: BEAR`, `## RISKS` are OPTIONAL. **Omit the entire section** (header + body) when the candidates don't support that synthesis. Do NOT emit `## SMART_MONEY: BULL` with no clips beneath it.
- Do NOT emit `## TOPIC:`, `## CONTEXT:`, `## PUBLISHER:`, or any other marker. Those belong to other kinds.

### `kind: 'brief'`

```
# HEADLINE: <one-sentence newsroom-style takeaway>

## PUBLISHER: <show name>
<2-3 sentence summary of what this publisher said>
{{clip:<id>}}
{{clip:<id>}}

## PUBLISHER: <next show>
...
```

- `# HEADLINE:` REQUIRED.
- At least one `## PUBLISHER:` REQUIRED if any candidates exist. Group candidates by their `creator` field.

### `kind: 'dossier'`

```
## TOPIC: <topic name>
<2-3 sentence stance summary>
{{clip:<id>}}

## TOPIC: <next>
...

## APPEARANCES
- <show> | <episode title> | <YYYY-MM-DD>
```

- One or more `## TOPIC:` blocks REQUIRED.
- `## APPEARANCES` OPTIONAL — the backend's `person-quotes.appearances` is the source of truth; the client backfills if synth omits this.

### `kind: 'split'`

```
## PERSON: <name A>
<2-3 sentence stance summary>
{{clip:<id>}}

## PERSON: <name B>
<2-3 sentence stance summary>
{{clip:<id>}}

## CONTRAST
<1-2 sentence contrast>
```

- Both `## PERSON:` blocks REQUIRED.
- `## CONTRAST` OPTIONAL but encouraged.

### `kind: 'arc'`

```
## THESIS: <one-line summary of the thesis being tracked>
## VERDICT: <one-line verdict, e.g. "Conviction rising — calls landing">
## CALL | <ISO date> | <short label> | <conviction 1-5> | <optional outcome>
{{clip:<id>}}
## CALL | <ISO date> | <short label> | <conviction 1-5> |
{{clip:<id>}}
## FORWARD: <one-line forward prediction>
```

- `## THESIS:` and `## VERDICT:` REQUIRED.
- At least 3 `## CALL` entries REQUIRED for a usable arc; each MUST be followed by a `{{clip:id}}` line.
- `## FORWARD:` OPTIONAL.

---

## 2. Suggested prompt skeleton (drop into every kind)

Lead every per-kind prompt with text along these lines, swapping the marker block per kind:

```
You are producing a structured `<KIND>` result for the Tape UI. Your output
is parsed by a strict client-side parser that splits the response on exact
marker lines. You MUST follow the marker contract below verbatim — use ONLY
these markers, in this order, with these exact names. Do NOT use markers
from other Tape result types (e.g. ## TOPIC, ## CONTEXT, ## PUBLISHER) unless
listed below.

Markers for this kind:
<paste the kind's block here>

Citations: every `{{clip:<id>}}` token must reference an id from the
candidate pool I supplied. Never invent ids. Never cite ids not in the pool.

Optional sections: if the candidate pool does not confidently support a
section listed as OPTIONAL, OMIT that section entirely (do not render the
header with an empty body). It is better to return less than to render
empty scaffolding.
```

---

## 3. Graceful empty handling

If the candidates are too sparse / off-topic to produce even the REQUIRED sections, return:

```json
{
  "kind": "readin",
  "text": "",
  "_meta": { "synthesizedEmpty": true, "reason": "candidates did not contain enough on-topic material" }
}
```

The frontend already routes empty text to the action's "no results" empty state. This is preferable to a fabricated stub.

---

## 4. Side ask: tighten `topic-quotes` ticker retrieval

Separate from the prompt fix, the same CRWV run surfaced a retrieval problem. `topic-quotes` returned 4 candidates for `query: "CRWV"`:

1. ✅ CoreWeave (CRWV) — real hit
2. ❌ Crimson Wine Group (CWGL) — wine company
3. ❌ Direxion leveraged ETF (RWGV) — vector-similar letters
4. ❌ CATUSA Resource Opportunities (KRO) — gold miners newsletter

Suggested guardrails for ticker-shaped queries (regex `^[A-Z]{1,5}$` on `query`):

- Post-filter candidates: keep only those where `text.toLowerCase()` contains the ticker OR a company name resolved from the ticker (e.g. via a ticker→name map, or the Yahoo proxy's `name` field which already returns "CoreWeave Inc").
- Alternatively: when `themes` is just `[ticker, "<ticker> stock company business"]`, the second theme is too generic and pulls in unrelated companies. Replace generic phrases with company-name-derived themes server-side once the ticker resolves.

This is a tightening, not a rewrite — the underlying search-quotes call is doing its job; the issue is one level up.

---

## 5. Evidence (the run that prompted this ask)

### Request

```
POST /api/tape/synthesize
{
  "stream": false,
  "kind": "readin",
  "input": { "ticker": "CRWV", "depth": "quick" },
  "candidates": [
    { "pineconeId": "10a49c94-...-p150", "text": "I think this would be the case for every single company going forward... this is NASDAQ CRWV. The origin story is this started as a company called Atlantic Crypto...", "creator": "The Compound and Friends", ... },
    { "pineconeId": "gid___...-p59", "text": "It's called Crimson Wine Group, the symbol CWGL...", ... },
    { "pineconeId": "0c2b71c7-...-p41", "text": "...RWGV was up 40% over the last year...", ... },
    { "pineconeId": "gid___...-p97", "text": "...the KRO, we call it CATUSA Resource Opportunities...", ... }
  ],
  "model": "fast"
}
```

### Response (what we got)

```
{
  "kind": "readin",
  "text": "## TOPIC: CRWV\nCoreWeave (NASDAQ: CRWV) has emerged...\n\n## CONTEXT:\nCoreWeave began as Atlantic Crypto, {{clip:10a49c94-...-p150}}...",
  "model": "claude-haiku-4-5-20251001",
  "tokens": { "input": 1068, "output": 242 },
  ...
}
```

- Wrong markers: `## TOPIC`, `## CONTEXT` (these are dossier markers; readin uses `## WHAT_THEY_DO`, `## PULSE`, `## SMART_MONEY`, `## RISKS`).
- Side observation: `model: "claude-haiku-4-5-20251001"`. The spec assumed DeepSeek V4 Flash as the "fast" default — please confirm or correct the cost model.

### Response (what we expected)

```
{
  "kind": "readin",
  "text": "## WHAT_THEY_DO\nCoreWeave (NASDAQ: CRWV) operates AI compute infrastructure at scale. It began life as Atlantic Crypto, providing Ethereum mining infrastructure, before pivoting to GPU compute for AI training and inference workloads.\n\n## PULSE | BULL: First-mover scale in AI-compute as a service. | BEAR: Customer concentration and capex-heavy model invite scrutiny.\n{{clip:10a49c94-...-p150}}",
  ...
}
```

(Plus optional `## SMART_MONEY: …` and `## RISKS` blocks if the candidates supported them — in this pool, they don't, so omitting both is the right call.)

---

## What we'd like back

1. Confirmation the per-kind prompts will be updated to emit this contract verbatim, with the optional-section omission semantics in §1 and §3.
2. Confirmation (or pushback) on the ticker-retrieval tightening in §4.
3. Clarification on the default `fast` model and its cost profile (DeepSeek V4 Flash vs. Haiku 4.5).
4. After the prompt fix lands, a re-run of the CRWV curl above with the new output pasted back so we can confirm the parser path end-to-end before testing more inputs.

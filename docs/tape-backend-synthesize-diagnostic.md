# Tape backend — synthesize diagnostic spec

Status: outbound ask to the backend team. We're seeing thin / empty output on real-input runs of Read-in and Brief, and we need ground truth on what `synthesize` is actually emitting before we know whether to fix the client parser or the backend prompt.

## What we observed

Two real runs, both authenticated, both hit the live pipeline:

### A) Read-in on `ORCL` (Quick depth)

- `POST /api/tape/topic-quotes` returned candidates (the marquee citation rendered).
- `POST /api/tape/synthesize { kind: 'readin' }` returned text.
- Client rendered ONLY: an empty PULSE block (`BULL:` / `BEAR:` labels with no copy), the empty TAPE line, and the marquee citation. No `WHAT_THEY_DO` paragraph, no `SMART_MONEY: BULL` / `SMART_MONEY: BEAR` clip lists, no `RISKS` bullets.

### B) Brief on `gold prognosis` (asOfDate = 2026-06-02)

- `POST /api/tape/topic-quotes { groupBy: 'creator', themes: ['gold prognosis'] }` returned zero candidates → client short-circuited without calling synthesize.
- The literal phrase "gold prognosis" doesn't match how anyone talks about gold on a podcast. Plausible podcast phrasings: "gold rally," "gold price target," "gold breakout," "gold safe haven," "gold $X handle."

## What we need from you

For each of the two inputs above, ideally:

1. **Echo the raw `synthesize.text`** in the response (or in logs we can grep). This is already produced; we just want to see it verbatim before client parsing. A `_meta.rawText: true` debug toggle on the request — or a permanent inclusion of raw text in non-prod environments — would unblock all future diagnostics.
2. **The exact prompt template you ship for `kind: 'readin'` and `kind: 'brief'`** (just the system + user prompt text, with placeholders). This is the single highest-leverage artifact for closing the loop.
3. **For Brief on "gold prognosis": do `topic-quotes` themes get expanded server-side?** i.e. when the client sends `themes: ['gold prognosis']`, does the backend (a) use that one phrase verbatim against search-quotes, (b) auto-expand to plausible variants, or (c) something else? If no expansion happens, who owns it?

## Marker contract the client parsers expect

We invented these markers client-side to give the View a deterministic shape to render. If your prompt emits something different, the parser silently drops everything that doesn't match — which is what we're seeing.

### `kind: 'readin'`

```
## WHAT_THEY_DO
<2-3 paragraph plain-English primer on the company>

## PULSE | BULL: <one-sentence bull case> | BEAR: <one-sentence bear case>
{{clip:<pineconeId>}}     # marquee — the single strongest quote

## SMART_MONEY: BULL
{{clip:<pineconeId>}}
{{clip:<pineconeId>}}

## SMART_MONEY: BEAR
{{clip:<pineconeId>}}

## RISKS
- <one-line risk>
- <one-line risk>
```

Parser is case-insensitive on markers; pipes (`|`) in PULSE are literal.

### `kind: 'brief'`

```
# HEADLINE: <one-sentence newsroom-style takeaway>

## PUBLISHER: <show / network name>
<2-3 sentence summary of what this publisher said>
{{clip:<pineconeId>}}
{{clip:<pineconeId>}}

## PUBLISHER: <next show>
...
```

### `kind: 'dossier'`

```
## TOPIC: <topic name>
<2-3 sentence stance summary>
{{clip:<pineconeId>}}

## TOPIC: <next>
...

## APPEARANCES
- <show> | <episode title> | <YYYY-MM-DD>
```

### `kind: 'split'`

```
## PERSON: <name A>
<stance summary>
{{clip:id}}

## PERSON: <name B>
<stance summary>
{{clip:id}}

## CONTRAST
<1-2 sentence contrast>
```

### `kind: 'arc'`

```
## THESIS: <one-line summary of the thesis being tracked>
## VERDICT: <one-line verdict, e.g. "Conviction rising — calls landing">
## CALL | <ISO date> | <short label> | <conviction 1-5> | <optional outcome>
{{clip:<pineconeId>}}
## CALL | <ISO date> | <short label> | <conviction 1-5> |
{{clip:<pineconeId>}}
...
## FORWARD: <one-line forward prediction>
```

## What we'd like back

A short reply (or PR comment) covering:

1. Sample raw `synthesize.text` for **ORCL** (kind=readin) and **gold prognosis** (kind=brief, asOfDate=2026-06-02). Even just stdout/log paste is fine.
2. Whether the prompts you ship today produce the markers above. If not — your call: update prompts to match this spec, or tell us what markers you DO emit and we'll update the client parsers to match. Either is fine; we just need them aligned.
3. Whether `topic-quotes` does theme expansion. If not, and if you think it belongs there, what would a v1 implementation look like (LLM rewrite, hand-written synonym map, embedding-based expansion)?
4. Any other places where the prompt currently produces real text but the client is dropping it on the floor — easier to fix systemically than one-by-one.

## Out of scope for this round

- Streaming `synthesize` (still fine to ship non-stream).
- Confidence-tier badges in the citation row.
- New `kind` values.

## Why this matters

The hand-curated canon (El-Erian, Hormuz, AI-bubble, APP, Gromen) is bulletproof. The first novel-input we tried — ORCL Read-in and "gold prognosis" Brief — produced thin or empty output. The whole point of the live pipeline is that the demo feels just as solid when you type the name YOU care about. We're one log-the-raw-text away from knowing where the breakdown is.

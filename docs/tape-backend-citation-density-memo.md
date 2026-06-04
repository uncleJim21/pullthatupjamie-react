# Tape backend — denser citation grounding (memo)

## TL;DR

Live results are surfacing too few ground-truth quotes per section. The
demo's whole pitch is "real quotes, timestamped and sourced" — when a Brief
publisher section has 1 quote or a Read-in SMART_MONEY: BULL block has 2
quotes, it undercuts the value prop. Raise the minimums per kind. Backend
already has the candidates; the synth prompt is just citing conservatively.

## Why

Tape canon results (hand-curated) have ~3-5 clips per topical section and
they feel substantive. Live results often have 1-2 — feel anemic.
Side-by-side, the live results read like "an LLM summary with a clip
attached," not "here are the receipts." Receipts are the product.

## Asks — per-kind citation minimums

Raise the synth prompt's minimum citation counts per section. Backend keeps
the candidate pool already; this is purely a prompt-instruction tuning.

| Kind | Section | Current (observed) | Ask |
| ---- | ------- | ------------------ | --- |
| Dossier | per `## TOPIC:` block | 1-2 clips | **3-5 clips** |
| Brief | per `## PUBLISHER:` block | 1-2 clips | **2-4 clips** |
| Brief | total across publishers | ~5 clips | **8-12 clips** |
| Read-in | `## SMART_MONEY: BULL` | 1-2 clips | **2-4 clips** |
| Read-in | `## SMART_MONEY: BEAR` | 1-2 clips | **2-4 clips** |
| Read-in | `## WHAT_THEY_DO` inline | 2-3 inline tokens | **4-6 inline tokens** |
| Split | per `## PERSON:` side | 1-2 clips | **3-5 clips** |
| Narrative | per `## BUCKET` block | 1-2 clips | **2-4 clips** |

These are RECEIPT counts. The synth should be willing to cite the same
event twice if two candidates corroborate it — corroboration IS the
product.

## Prompt-language suggestions

Wherever the per-kind synth prompt says something like *"cite each claim
with a {{clip:id}} token"*, strengthen to:

> Cite **generously**. Every claim — even minor framings — must have at
> least one supporting `{{clip:id}}` token. Prefer 3+ clips per section over
> 1-2; corroborating quotes from different sources STRENGTHEN the section,
> not weaken it. If the candidate pool has more on-topic clips than you've
> used, use more.

Combined with raising the per-section floor in the marker contract
documentation, this should pull live output toward the canon's density.

## Why this isn't "just cite all candidates"

We don't want every candidate dumped in — the synth's editorial judgment
on which 4-5 best support each section still matters. We're asking it to
err HIGH within the available pool, not low. If candidate pool has 25
quotes and synth uses 6, raise to 10-12. If pool has 8, use most of them.

## Side observation: surface unused candidates?

OUT OF SCOPE for this round but worth a note: the synth currently drops any
candidate it doesn't cite. We could surface those as a tail section
("More on this topic from the corpus") — 5-10 additional clips below the
synthesized stance. Adds receipts without bloating the synthesis. Separate
spec if you want to explore.

## Acceptance

Re-run the canon-equivalent test queries after the prompt tweak; eyeball
citation density. The bar: a live Dossier on a real person (not canon)
should *look like* the El-Erian canon in citation count — not 1 quote per
topic, but several.

## What we won't do client-side

Nothing on this fix — it's a synth-prompt change. Once you ship, density
will improve without any client work.

# Tape backend — kind-compliance regression watch

Status: not a current blocker — the symptom subsided after the marker-contract update. This report ensures it does not regress and gives you a server-side defense that would have caught it.

## What we saw

During testing on 2026-06-02, we observed at least one case where a `synthesize` call with `kind: "brief"` returned a response whose marker shape matched Read-in (`## WHAT_THEY_DO`, `## PULSE | BULL/BEAR`, `## SMART_MONEY: …`, `## RISKS`) instead of Brief (`# HEADLINE:`, `## PUBLISHER: …`). The frontend parser correctly produced an empty Brief result because no `# HEADLINE` / `## PUBLISHER` markers were present.

Re-running similar inputs after the marker-contract update no longer reproduces it. We can't isolate which input triggered it; likely a low-rate model drift rather than a deterministic prompt bug.

## Why this still matters

The hand-off between client and synthesize is **trust-based** — the client sends `kind` and trusts the response will be shaped to match. There's no server-side check today that validates the response markers against the requested kind. Any future prompt regression, model swap, or temperature drift could silently re-introduce the bleed and the client UI would render an empty action result with no error visible.

## Ask: add a server-side kind validator

A tiny post-synthesize check, before the response leaves the backend:

```python
REQUIRED_MARKERS = {
    "readin":  ["## WHAT_THEY_DO"],
    "brief":   ["# HEADLINE", "## PUBLISHER"],
    "dossier": ["## TOPIC"],
    "split":   ["## PERSON"],
    "arc":     ["## THESIS", "## VERDICT", "## CALL"],
}

FORBIDDEN_CROSS_KIND = {
    "readin":  ["## PUBLISHER", "## TOPIC:", "## THESIS"],
    "brief":   ["## WHAT_THEY_DO", "## PULSE |", "## SMART_MONEY", "## THESIS"],
    "dossier": ["## WHAT_THEY_DO", "## PULSE |", "## HEADLINE", "## PUBLISHER", "## THESIS"],
    "split":   ["## WHAT_THEY_DO", "## PULSE |", "## HEADLINE", "## TOPIC:"],
    "arc":     ["## WHAT_THEY_DO", "## PULSE |", "## HEADLINE", "## PUBLISHER"],
}

def validate_kind_compliance(kind: str, text: str) -> tuple[bool, str | None]:
    required = REQUIRED_MARKERS[kind]
    if not all(m.lower() in text.lower() for m in required):
        return False, f"missing required markers for {kind}: {required}"
    forbidden = FORBIDDEN_CROSS_KIND[kind]
    hit = [m for m in forbidden if m.lower() in text.lower()]
    if hit:
        return False, f"cross-kind markers leaked into {kind}: {hit}"
    return True, None
```

On failure, do ONE auto-retry of the synthesize call with the same inputs plus an explicit "your previous output used the wrong markers; produce ONLY the markers for `kind: {kind}`" reflection appended. If retry also fails, return 502 with `{ type: "kind-compliance", title: "Synthesizer output violated kind contract" }` rather than serving the malformed text.

This is also the natural place to **log every compliance failure** with the input that triggered it — gives you a reproducible test set to harden prompts against later (and a free data stream into a future GEPA evaluation harness).

## Cost

One validator function, two regex-style passes per response, near-zero compute. Retries add latency on rare failures; the alternative is silently wrong frontend renders.

## What we'd like back

1. Confirmation a validator like this can land in the `synthesize` handler before the response returns.
2. Logging of all compliance failures (input + response) — even if retry succeeds, we want the dataset for prompt hardening.
3. If/when you log a failure, share the offending input with us so we can add it to the eval fixture set we're building.

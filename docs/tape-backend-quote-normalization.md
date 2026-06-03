# Tape backend — `/api/tape/quote/:slug` shape normalization

## Issue

When the backend falls back from Yahoo to Finnhub, the response shape diverges from the Yahoo path on the `spark` field:

```json
{
  "symbol": "USO",
  "name": "USO",
  "price": 140.85,
  "currency": "USD",
  "dayChangePct": 2.61,
  "spark": [140.85],           // <-- single point, breaks the sparkline
  "marketState": null,
  "_meta": { "source": "finnhub", ... }
}
```

The Yahoo path returns ~10 daily closes (the contract per §5 of the original tape-backend-spec). Finnhub is returning a single price point.

## Why this matters on the client

The sparkline component renders nothing when `data.length < 2`. So Finnhub-served tickers show price + change but a blank chart slot. The strip looks visually broken — a Yahoo card next to a Finnhub card looks like the Finnhub card failed even though price + change are present.

Also: `name: "USO"` (just the symbol) on the Finnhub path vs `name: "US Oil Fund"` on the Yahoo path. Same normalization issue.

## Ask

Normalize the Finnhub response to match the Yahoo contract before returning:

1. **`spark`: array of at least 2 points, ideally 10.** Finnhub has a `/stock/candle` (or equivalent) endpoint that returns historical OHLC. Pull the last ~10 daily closes once when falling back, populate `spark` with the close series, then attach the live `price` as the final element.
2. **`name`: resolved company name** (not just the symbol). Finnhub has `/stock/profile2` that returns `name`. Cache the name-by-symbol mapping aggressively; it doesn't change.
3. **`marketState`: `'REGULAR' | 'PRE' | 'POST' | 'CLOSED'`** (or null if Finnhub truly can't provide). Yahoo returns this; Finnhub fallback should fill it best-effort or omit, but the field type should be consistent (currently `null` — fine).

## Acceptance

A Yahoo-served and a Finnhub-served quote should be **visually indistinguishable** on the frontend. Same fields, same shapes, same array lengths.

## Cost

One extra Finnhub call per cold cache miss (historical candles). Hot cache hits unchanged. Cache the historical candles for the same TTL as the quote itself (60s open / 5min closed).

## Side observation

Falling back to Finnhub at all suggests Yahoo hit a rate limit or 5xx. Worth confirming the fallback chain (`Yahoo → Finnhub → ???`) is intentional and not a config quirk. If Yahoo is failing more than ~1% of requests, that's worth its own investigation.

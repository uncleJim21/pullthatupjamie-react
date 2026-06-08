// Tape skin — live ticker hook.
//
// Fetches GET /api/tape/quote/:slug for each symbol, dedups across components
// via a module-level cache (5-minute TTL), and exposes a `refresh` that
// bypasses cache. Used by TapeTickerStrip in live mode and by the Read-in
// header card.

import { useEffect, useState, useCallback } from 'react';
import { tickerQuote, type LiveTapeQuote } from './tapeClient.ts';
import type { TapeTicker } from '../../data/mockTapeTickers.ts';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: LiveTapeQuote; expires: number }>();
const inflight = new Map<string, Promise<LiveTapeQuote>>();

async function fetchOne(slug: string, force = false): Promise<LiveTapeQuote> {
  if (!force) {
    const hit = cache.get(slug);
    if (hit && hit.expires > Date.now()) return hit.value;
    const pending = inflight.get(slug);
    if (pending) return pending;
  }
  const p = tickerQuote(slug).then(value => {
    cache.set(slug, { value, expires: Date.now() + CACHE_TTL_MS });
    inflight.delete(slug);
    return value;
  }).catch(e => {
    inflight.delete(slug);
    throw e;
  });
  inflight.set(slug, p);
  return p;
}

function toTapeTicker(q: LiveTapeQuote, slug: string): TapeTicker {
  return {
    symbol: q.symbol || slug,
    name: q.name || q.symbol || slug,
    price: typeof q.price === 'number' ? q.price.toFixed(2) : String(q.price ?? ''),
    change: typeof q.dayChangePct === 'number' ? q.dayChangePct : 0,
    spark: Array.isArray(q.spark) ? q.spark : [],
    yahoo: slug,
  };
}

export interface UseLiveTickersResult {
  tickers: TapeTicker[];
  metas: Map<string, LiveTapeQuote['_meta']>;
  isStale: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useLiveTickers(symbols: string[]): UseLiveTickersResult {
  const [data, setData] = useState<Map<string, LiveTapeQuote>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  // Key on the joined symbol list so the effect re-runs when the set changes.
  const key = symbols.join(',');

  useEffect(() => {
    if (symbols.length === 0) {
      setData(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      symbols.map(s => fetchOne(s).then(q => [s, q] as const).catch(err => {
        // Per-symbol failures are silent — fall back to baked data downstream.
        if (typeof console !== 'undefined') console.warn(`[tape ticker] ${s}:`, err?.message || err);
        return null;
      }))
    ).then(results => {
      if (cancelled) return;
      const next = new Map<string, LiveTapeQuote>();
      for (const r of results) if (r) next.set(r[0], r[1]);
      setData(next);
      setLoading(false);
    }).catch(err => {
      if (cancelled) return;
      setError(err?.message || 'Ticker fetch failed');
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, generation]);

  const refresh = useCallback(() => {
    for (const s of symbols) cache.delete(s);
    setGeneration(g => g + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tickers = symbols
    .map(s => {
      const q = data.get(s);
      return q ? toTapeTicker(q, s) : null;
    })
    .filter((t): t is TapeTicker => t !== null);

  const metas = new Map<string, LiveTapeQuote['_meta']>();
  for (const [s, q] of data) metas.set(s, q._meta);

  const isStale = Array.from(data.values()).some(q => q._meta?.stale === true);

  return { tickers, metas, isStale, loading, error, refresh };
}

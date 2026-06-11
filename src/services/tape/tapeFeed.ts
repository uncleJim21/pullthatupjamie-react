// Personalized feed for the Tape landing surface.
//
// Wraps GET /api/tape/feed — the same endpoint TapeAccessGate uses as its
// entitlement probe. Backend reads the signed-in user's persona from
// app_preferences (server-side, 60s TTL cache) and returns a personalized
// ticker strip + brief recommendations. Reason flag on each ticker tells the
// UI whether the suggestion came from the user's persona or the generic
// fallback — useful for subtle attribution copy.

import { useCallback, useEffect, useState } from 'react';
import { tapeFetch } from './tapeClient.ts';

/** Window event that triggers a refetch of /api/tape/feed. Dispatched by
 *  TapePersonaDrawer after a successful save so the launcher reflects the
 *  new persona without a reload. Listened to by useTapeFeed. */
export const TAPE_FEED_INVALIDATE_EVENT = 'tape:feed-invalidate';

export interface TapeFeedTicker {
  ticker: string;
  name?: string;
  /** "persona": pulled from the signed-in user's persona.
   *  "generic": fallback when persona is empty or didn't yield enough. */
  reason: 'persona' | 'generic';
  /** True when backend has a warm cache for this Read-in (launching is
   *  near-instant). False = the click will trigger a live 60–90s synth. */
  ready: boolean;
}

export interface TapeFeedBrief {
  title: string;
  /** The topic string passed to BriefView (used as the input/topic). */
  query: string;
  /** True when this brief surfaced from the user's persona. */
  personalized: boolean;
}

export interface TapeFeed {
  /** Whether backend actually applied a persona to compute this feed.
   *  When false, the feed is generic (no persona on file). */
  personaApplied: boolean;
  tickers: TapeFeedTicker[];
  briefs: TapeFeedBrief[];
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; feed: TapeFeed }
  | { kind: 'error'; message: string };

/** Hook for the landing surface. Fetches once on mount; refetch on demand
 *  via the returned `refresh` callback (used after persona save in Module
 *  4). Errors are surfaced — caller renders a fallback strip on failure. */
export function useTapeFeed(): { state: FetchState; refresh: () => void } {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const feed = await tapeFetch<TapeFeed>('/api/tape/feed');
      setState({ kind: 'ready', feed });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load feed' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Refetch on persona save (or any other invalidation source) so the
  // launcher reflects the user's new bias immediately.
  useEffect(() => {
    const onInvalidate = () => { void load(); };
    window.addEventListener(TAPE_FEED_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(TAPE_FEED_INVALIDATE_EVENT, onInvalidate);
  }, [load]);

  return { state, refresh: load };
}

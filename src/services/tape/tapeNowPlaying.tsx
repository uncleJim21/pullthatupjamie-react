// Tape global player — "now playing" citation tracker.
//
// Sits alongside AudioControllerContext (which owns the actual <audio>
// element + transport state). This context owns the *metadata* for the
// clip currently surfaced in the global mini-player at the bottom of
// /tape — the full TapeCitation, not just an id + url. Every per-row
// play button writes the citation here on click; the mini-player reads.
//
// Why a second context: AudioControllerContext is shared with the JPA
// stack and intentionally keeps its `AudioTrack` type minimal (id, url,
// start, end). Tape's mini-player needs episode title, creator, image,
// quote — extending the shared type would leak Tape concerns into JPA
// land. A thin Tape-only context keeps the data flow clean.

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { TapeCitation } from './tapeTypes.ts';

interface TapeNowPlayingState {
  active: TapeCitation | null;
  setActive: (c: TapeCitation | null) => void;
  /** Convenience helper — clears the active citation (mini-player hides). */
  clear: () => void;
}

const Ctx = createContext<TapeNowPlayingState | null>(null);

export const TapeNowPlayingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<TapeCitation | null>(null);
  const clear = useCallback(() => setActive(null), []);
  return <Ctx.Provider value={{ active, setActive, clear }}>{children}</Ctx.Provider>;
};

export function useTapeNowPlaying(): TapeNowPlayingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTapeNowPlaying must be used inside TapeNowPlayingProvider');
  return ctx;
}

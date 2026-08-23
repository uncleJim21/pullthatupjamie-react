import { T } from '../landingTokens.ts';

// The share surface inherits the established landing palette (warm-tinted
// near-black, single amber accent) so a link that lands here feels like the
// same product. See landingTokens.ts and PRODUCT.md.
export { T };

// Canvas has no access to CSS custom properties and OKLCH support in 2D
// contexts is still uneven across the browsers this app targets, so the ring's
// colors are pinned here as sRGB equivalents of the same tokens. Keep these in
// sync with landingTokens.ts by eye; they are the only duplicated values.
export const DISC = {
  // Geometry, all as fractions of the disc's half-size.
  artwork: 0.70,      // artwork diameter
  barBase: 0.815,     // inner end of the waveform bars
  barMax: 0.165,      // maximum bar length
  ringHitInner: 0.72, // annulus that accepts a scrub gesture
  ringHitOuter: 1.02,

  barPlayed: 'rgba(248, 246, 242, 0.92)',
  barAhead: 'rgba(248, 246, 242, 0.28)',
  hairline: 'rgba(248, 246, 242, 0.10)',
  accent: 'rgba(222, 196, 157, 0.95)',
  accentBright: 'rgba(238, 216, 182, 1)',

  textHi: '#f8f6f2',
  artworkBed: 'rgba(255, 255, 255, 0.04)',
  artworkShadow: '0 24px 70px -20px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(248, 246, 242, 0.08)',
  fallbackA: 'rgba(248, 246, 242, 0.10)',
  fallbackB: 'rgba(248, 246, 242, 0.02)',
  transportScrim: 'rgba(12, 11, 9, 0.34)',
  transportFill: 'rgba(12, 11, 9, 0.55)',
  transportEdge: 'rgba(248, 246, 242, 0.28)',
};

/** The API returns `date` in whatever shape the feed had: usually an ISO
 *  timestamp, sometimes an already-human string, sometimes the literal
 *  "Date not provided". Only reformat what actually parses as a date. */
export function formatPublished(raw?: string | null): string | null {
  if (!raw || raw === 'Date not provided') return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Transcript length varies by two orders of magnitude across clips: a
 *  six-word aside and a 900-character monologue both arrive in `quote`. One
 *  fixed type size cannot serve both, so the quote picks its own register.
 *  Short text becomes a display pull-quote; long text becomes readable prose
 *  at a proper measure instead of a wall of 2rem headline. */
export function quoteType(text: string) {
  const len = text.length;
  if (len <= 130) {
    return { fontSize: 'clamp(1.625rem, 1.1rem + 2vw, 2.375rem)', lineHeight: 1.24, measure: '20ch', weight: 500, tracking: '-0.02em' };
  }
  if (len <= 340) {
    return { fontSize: 'clamp(1.25rem, 1rem + 1vw, 1.625rem)', lineHeight: 1.36, measure: '32ch', weight: 500, tracking: '-0.015em' };
  }
  return { fontSize: 'clamp(1rem, 0.95rem + 0.3vw, 1.125rem)', lineHeight: 1.62, measure: '56ch', weight: 400, tracking: '0' };
}

/** m:ss, or h:mm:ss past an hour. Returns a stable width placeholder for
 *  unknown durations so the metadata row doesn't reflow when it resolves. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

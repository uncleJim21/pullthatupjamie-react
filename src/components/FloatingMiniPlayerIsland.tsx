// Floating mini-player "island" — the rounded, backdrop-blurred panel
// that JPA hangs at the bottom of its conversation view. Pulled out of
// JamiePullAgent.tsx so /tape and any future surface can reuse the
// exact same visual treatment without duplicating the wrapper math.
//
// Why this is its own component:
// - Gutters on either side of the centered pill MUST stay fully
//   transparent so message/content text can scroll *behind* them.
//   Both JPA and Tape were burning cycles getting that right; centralizing
//   it kills the foot-gun.
// - Positioning is `absolute bottom-0 inset-x-0` (NOT `fixed`) so it
//   docks to the parent app-shell's bottom edge. The parent supplies
//   `position: relative` and a fixed viewport height; content scrolls
//   in a `flex-1 overflow-y-auto` sibling.
//
// The inner card surface (border + bg + blur) is variant-themed so JPA
// keeps its `border-white/15 bg-black/85` and Tape can swap in
// tape-hairline-strong + a similarly-dark surface without forking the
// component.

import React from 'react';

export type FloatingMiniPlayerVariant = 'jamie' | 'tape';

const VARIANT_STYLES: Record<FloatingMiniPlayerVariant, { borderColor: string; background: string }> = {
  jamie: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.85)',
  },
  tape: {
    // Warm-neutral charcoal that matches `--tape-bg-raised` (oklch
    // 0.21 0.005 160) instead of pure black — so the floating island
    // reads as Tape surface, not a JPA graft.
    borderColor: 'var(--tape-hairline-strong)',
    background: 'oklch(0.2 0.005 160 / 0.92)',
  },
};

interface Props {
  /** Visual theme; default `jamie` keeps the JPA look. */
  variant?: FloatingMiniPlayerVariant;
  /** Whether to render the island at all. Pass `false` when nothing's
   *  active so the gutters don't even mount. */
  visible: boolean;
  /** Positioning mode:
   *  - `absolute` (default): JPA-style — docks to bottom of the nearest
   *    positioned ancestor. Use inside an app-shell that owns the
   *    viewport height.
   *  - `fixed`: viewport-relative; use when there's no app-shell parent
   *    and you want viewport-bottom anchoring. */
  position?: 'absolute' | 'fixed';
  /** z-index for the gutter wrapper. Default 20. */
  zIndex?: number;
  children: React.ReactNode;
}

const FloatingMiniPlayerIsland: React.FC<Props> = ({
  variant = 'jamie',
  visible,
  position = 'absolute',
  zIndex = 20,
  children,
}) => {
  if (!visible) return null;
  const tone = VARIANT_STYLES[variant];

  return (
    <div
      className={`${position} bottom-0 inset-x-0 px-3 sm:px-6 pb-3 pointer-events-none`}
      style={{ zIndex, background: 'transparent' }}
    >
      <div
        className="mx-auto w-full max-w-4xl rounded-3xl border-2 backdrop-blur-lg overflow-hidden shadow-2xl shadow-black/50 pointer-events-auto"
        style={{
          borderColor: tone.borderColor,
          background: tone.background,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default FloatingMiniPlayerIsland;

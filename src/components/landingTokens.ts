// ============================================================
// SHARED LANDING DESIGN TOKENS
// Restrained strategy: warm-tinted near-black neutrals + a single
// amber accent (the established identity color, ~rgb(200,180,140)),
// expressed in OKLCH. Used by the landing page and /for-agents so
// the two surfaces stay visually in lockstep. See PRODUCT.md.
// ============================================================
export const T = {
  surface0: 'oklch(0.16 0.006 80)',          // page background, warm near-black
  surface1: 'oklch(0.20 0.007 80)',          // raised panels
  surfaceInput: 'oklch(0.22 0.008 80)',      // input / interactive fill / code
  textHi: 'oklch(0.97 0.004 80)',            // headlines, primary
  textMid: 'oklch(0.82 0.004 80)',           // body
  textLo: 'oklch(0.68 0.004 80)',            // captions, metadata (AA on surface0)
  accent: 'oklch(0.83 0.068 78)',            // amber accent
  accentBright: 'oklch(0.89 0.075 80)',
  hairline: 'oklch(0.97 0.004 80 / 0.12)',
  hairlineSoft: 'oklch(0.97 0.004 80 / 0.07)',
  accentTint: 'oklch(0.83 0.068 78 / 0.10)',
  sans: "'Schibsted Grotesk', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};

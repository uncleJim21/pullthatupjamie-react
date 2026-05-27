// Tape skin — runtime config.
//
// `USE_MOCK_TAPE` is the single switch that flips the whole skin between
// mock fixtures and the real backend. Only `services/tape/tapeClient.ts`
// reads it; every action service is identical in both modes. To go live:
// flip this to `false`, implement `GET /api/tape/timeline`, and confirm the
// agent honors the section markers in `tapePrompts.ts` (see docs/tape-api.md).
export const USE_MOCK_TAPE = true;

// Working brand name + route for the finance-intelligence skin.
export const TAPE_NAME = 'The Tape';
export const TAPE_TAGLINE = 'Read The Tape. Skip the noise.';

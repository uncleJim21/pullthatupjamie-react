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

/**
 * Base URL the Tape skin points at for ALL of its backend traffic
 * (`/api/tape/*`, plus the `/api/pull` and `/api/get-hierarchy` calls the
 * Tape services share with the agent stack).
 *
 * Kept separate from the app's main `API_URL` so the rest of the app can
 * continue talking to its normal backend while Tape targets a different
 * environment (alpha / staging / a separate cluster). Trailing slash is
 * trimmed at use sites — callers concatenate paths starting with `/`.
 */
export const TAPE_API_URL = 'https://pullthatupjamie-explore-alpha-xns9k.ondigitalocean.app';

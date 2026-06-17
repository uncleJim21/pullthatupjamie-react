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
 *
 * To flip back to alpha (or any remote env), set `TAPE_API_URL_OVERRIDE`
 * to `null` and the production URL below takes effect.
 */
const TAPE_API_URL_OVERRIDE: string | null = null; // TEMP: local dev — set to 'http://localhost:<port>' to point at a local Tape backend
const TAPE_API_URL_DEFAULT = 'https://pullthatupjamie-explore-alpha-xns9k.ondigitalocean.app';
export const TAPE_API_URL = TAPE_API_URL_OVERRIDE ?? TAPE_API_URL_DEFAULT;

/**
 * True whenever Tape traffic is pointed at a local-dev backend via
 * `TAPE_API_URL_OVERRIDE`. Tape callers use this to opt persona
 * preferences (PUT/GET /api/preferences) into the same local backend
 * so saves and reads close the loop without round-tripping through
 * prod. Main-app preferences consumers ignore this flag entirely.
 */
export const TAPE_USING_LOCAL_BACKEND: boolean = TAPE_API_URL_OVERRIDE !== null;

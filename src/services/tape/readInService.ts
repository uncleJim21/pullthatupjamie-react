// Tape skin — Read-in service.
//
// Thin wrapper over POST /api/tape/readin. Backend owns: retrieval (ticker
// + resolved company name themes), synthesis, marker parsing (WHAT_THEY_DO
// with inline clip tokens / PULSE / SMART_MONEY / RISKS / etc.), citation
// hydration including whatTheyDoCitations, peers + tickers assignment,
// confidence tier.
//
// Note: APP / other canon tickers used to short-circuit to mockReadIn for
// instant zero-cost demo content. Removed — backend is reliable enough now
// and the canon path hid the Refresh affordance + made cache state look
// weird. Every ticker now goes live; backend cache handles speed.

import { tapeFetch } from './tapeClient.ts';
import type { ReadInInput, ReadInResult } from './tapeTypes.ts';

export async function getReadIn(input: ReadInInput): Promise<ReadInResult> {
  return tapeFetch<ReadInResult>('/api/tape/readin', { method: 'POST', json: input });
}

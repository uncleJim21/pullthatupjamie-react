// Tape skin — Read-in service.
//
// Thin wrapper over POST /api/tape/readin. Backend owns: retrieval (ticker
// + resolved company name themes), synthesis, marker parsing (WHAT_THEY_DO
// with inline clip tokens / PULSE / SMART_MONEY / RISKS / etc.), citation
// hydration including whatTheyDoCitations, peers + tickers assignment,
// confidence tier.

import { mockReadIn } from '../../data/mockTapeCompanies.ts';
import { tapeFetch } from './tapeClient.ts';
import type { ReadInInput, ReadInResult } from './tapeTypes.ts';

export async function getReadIn(input: ReadInInput): Promise<ReadInResult> {
  const canned = mockReadIn(input.ticker);
  if (canned.name) return canned;
  return tapeFetch<ReadInResult>('/api/tape/readin', { method: 'POST', json: input });
}

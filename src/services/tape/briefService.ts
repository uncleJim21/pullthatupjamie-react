// Tape skin — Brief service.
//
// Thin wrapper over POST /api/tape/brief. Backend owns the full pipeline
// (retrieval with 7d→30d→90d auto-expand, synthesis, marker parsing,
// citation hydration, ticker assignment, confidence tier). Client just
// checks canon and forwards on a miss.

import { mockBrief } from '../../data/mockTapeData.ts';
import { tapeFetch } from './tapeClient.ts';
import type { BriefInput, BriefResult } from './tapeTypes.ts';

export async function getBrief(input: BriefInput): Promise<BriefResult> {
  const canned = mockBrief(input.topic, input.asOfDate);
  if (canned.sections.length > 0) return canned;
  return tapeFetch<BriefResult>('/api/tape/brief', { method: 'POST', json: input });
}

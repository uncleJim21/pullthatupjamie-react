// Tape skin — Split service.
//
// Thin wrapper over POST /api/tape/split. Backend handles camp-mode
// detection ('Bulls'/'Bears' shorthand) vs named A-vs-B routing, retrieval,
// synthesis, marker parsing, citation hydration, ticker assignment, and
// confidence tier (including the asymmetric-coverage case).

import { mockSplit } from '../../data/mockTapeData.ts';
import { tapeFetch } from './tapeClient.ts';
import type { SplitInput, SplitResult } from './tapeTypes.ts';

export async function getSplit(input: SplitInput): Promise<SplitResult> {
  const canned = mockSplit(input.personA, input.personB, input.topic);
  if (canned.sideA.citations.length > 0 || canned.sideB.citations.length > 0) return canned;
  return tapeFetch<SplitResult>('/api/tape/split', { method: 'POST', json: input });
}

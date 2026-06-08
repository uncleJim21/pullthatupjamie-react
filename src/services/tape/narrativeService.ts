// Tape skin — Narrative service.
//
// Thin wrapper over POST /api/tape/narrative. Backend owns: group filter
// routing (bulls/bears/named-person/all), wide-window retrieval, synthesis,
// marker parsing (THESIS / BUCKET | start | end | sentiment / INFLECTION /
// FORWARD), variable-width buckets, citation hydration, ticker assignment,
// confidence tier.

import { mockNarrative } from '../../data/mockTapeData.ts';
import { tapeFetch } from './tapeClient.ts';
import type { NarrativeInput, NarrativeResult } from './tapeTypes.ts';

export async function getNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  const canned = mockNarrative(input);
  if (canned.buckets.length > 0) return canned;
  return tapeFetch<NarrativeResult>('/api/tape/narrative', { method: 'POST', json: input });
}

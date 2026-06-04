// Tape skin — Dossier service.
//
// Thin wrapper over POST /api/tape/dossier (kind-level endpoint). Backend
// owns retrieval + synthesis + parsing + citation hydration + ticker
// assignment. Client just checks the canon (hand-curated wins on quality +
// cost + latency) and falls through to the live endpoint on a miss.
//
// Pre-migration: client orchestrated person-quotes → synthesize → parse
// markers → resolve citations. All that lives backend-side now per
// docs/tape-backend-kind-endpoints-spec.md.

import { mockDossier } from '../../data/mockTapeData.ts';
import { tapeFetch } from './tapeClient.ts';
import type { DossierInput, DossierResult } from './tapeTypes.ts';

export async function getDossier(input: DossierInput): Promise<DossierResult> {
  const canned = mockDossier(input.person);
  if (canned.topics.length > 0) return canned;
  return tapeFetch<DossierResult>('/api/tape/dossier', { method: 'POST', json: input });
}

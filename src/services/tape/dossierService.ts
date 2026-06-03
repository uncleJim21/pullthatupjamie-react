// Tape skin — Dossier service.
//
// Hybrid model: hand-curated canon (mockDossier) is checked first — if the
// person has baked topics, we return them instantly ($0, perfect). For any
// other name, fall through to the live backend pipeline:
//   POST /api/tape/person-quotes → POST /api/tape/synthesize → parse markers.

import { mockDossier } from '../../data/mockTapeData.ts';
import {
  personQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type {
  DossierInput,
  DossierResult,
  DossierTopicGroup,
  DossierAppearance,
} from './tapeTypes.ts';

/** Default theme set fed to person-quotes when the caller didn't supply one.
 *  Generic macro-finance prompts that the search-quotes fan-out can match
 *  against. Backend's `defaults` already cover the no-themes case; we send
 *  these to widen the recall a bit for cold names. */
const DEFAULT_DOSSIER_THEMES = [
  'Federal Reserve interest rates inflation policy',
  'recession risk dollar Treasury yields',
  'stock market valuations earnings',
  'geopolitics oil energy supply',
];

/** Parse the synthesized text into typed topic groups + appearances, looking
 *  citations up in the candidate pool (no get-hierarchy round trip needed —
 *  the candidates already carry the playable fields). */
function parseDossierMarkers(
  person: string,
  text: string,
  candidates: TapeCandidate[]
): DossierResult {
  const topics: DossierTopicGroup[] = [];
  const appearances: DossierAppearance[] = [];

  const sections = text.split(/\n(?=##\s)/);
  for (const section of sections) {
    const topicMatch = section.match(/^##\s*TOPIC:\s*(.+)/i);
    const appsMatch = section.match(/^##\s*APPEARANCES/i);
    if (topicMatch) {
      const body = section.replace(/^##.*\n?/, '');
      topics.push({
        topic: topicMatch[1].trim(),
        positionSummary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: resolveCitationsFromCandidates(section, candidates),
      });
    } else if (appsMatch) {
      for (const line of section.split('\n')) {
        const m = line.match(/^-\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);
        if (m) appearances.push({ show: m[1].trim(), episodeTitle: m[2].trim(), publishedDate: m[3].trim(), citationCount: 0 });
      }
    }
  }

  return { person, topics, appearances, generatedAt: new Date().toISOString() };
}

export async function getDossier(input: DossierInput): Promise<DossierResult> {
  // 1) Canon: hand-curated wins on quality, cost, and latency.
  const canned = mockDossier(input.person);
  if (canned.topics.length > 0) return canned;

  // 2) Novel input: live pipeline.
  const pq = await personQuotes({
    name: input.person,
    themes: DEFAULT_DOSSIER_THEMES,
    refresh: input.refresh,
  });
  if (pq.candidates.length === 0) {
    return canned;
  }

  const syn = await synthesize({
    kind: 'dossier',
    input: { person: input.person },
    candidates: pq.candidates,
    model: input.model || 'quality',
    refresh: input.refresh,
  });

  const result = parseDossierMarkers(input.person, syn.text, pq.candidates);
  result._meta = syn._meta;
  result.tickers = syn.tickers;

  // Backfill appearances from person-quotes when synthesis omitted any (more
  // reliable than the model emitting "## APPEARANCES" with consistent format).
  if (result.appearances.length === 0 && pq.appearances.length > 0) {
    result.appearances = pq.appearances.map(a => ({
      show: a.feedTitle,
      episodeTitle: a.title,
      publishedDate: a.publishedDate,
      citationCount: 0,
    }));
  }

  return result;
}

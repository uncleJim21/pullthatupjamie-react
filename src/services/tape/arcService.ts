// Tape skin — Arc service.
//
// Arc traces how one person's view on their core macro thesis has evolved
// over time. The hand-curated canon (Luke Gromen) is bulletproof; for any
// other name we fall through to the live pipeline:
//   POST /api/tape/person-quotes (chronological) → /api/tape/synthesize → parse.

import { mockArc } from '../../data/mockTapeData.ts';
import {
  personQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type { ArcInput, ArcResult, ArcCall } from './tapeTypes.ts';

/** Themes that pull together a typical macro-investor longitudinal view. */
const DEFAULT_ARC_THEMES = [
  'core thesis stance prediction',
  'inflation Federal Reserve rates',
  'recession dollar gold Treasury yields',
  'fiscal dominance debt deficits',
];

/**
 * Arc markers (defined freshly for the live path):
 *   ## THESIS: <one-line summary of the thesis being tracked>
 *   ## VERDICT: <one-line verdict, e.g. "Conviction rising — calls landing">
 *   ## CALL | <ISO date> | <short label> | <conviction 1-5> | <optional outcome>
 *   {{clip:id}}
 *   ## CALL | ...
 *   ## FORWARD: <one-line forward prediction>
 */
function parseArcMarkers(person: string, text: string, candidates: TapeCandidate[]): ArcResult {
  let thesis = '';
  let verdict = '';
  let forwardCall: string | undefined;
  const calls: ArcCall[] = [];

  for (const block of text.split(/\n(?=##\s)/)) {
    const thesisM = block.match(/^##\s*THESIS:\s*(.+)/i);
    const verdictM = block.match(/^##\s*VERDICT:\s*(.+)/i);
    const forwardM = block.match(/^##\s*FORWARD:\s*(.+)/i);
    const callM = block.match(/^##\s*CALL\s*\|\s*(.+)/i);
    if (thesisM) thesis = thesisM[1].trim();
    else if (verdictM) verdict = verdictM[1].trim();
    else if (forwardM) forwardCall = forwardM[1].trim();
    else if (callM) {
      // Pipe-delimited: date | label | conviction | optional outcome
      const parts = callM[1].split('|').map(s => s.trim());
      const date = parts[0] || '';
      const label = parts[1] || '';
      const convictionRaw = parseInt(parts[2] || '3', 10);
      const conviction = Math.max(1, Math.min(5, isNaN(convictionRaw) ? 3 : convictionRaw));
      const outcome = parts[3] || undefined;
      // First citation found anywhere in this block is the call's evidence.
      const cits = resolveCitationsFromCandidates(block, candidates);
      if (cits.length > 0) {
        calls.push({ date, label, conviction, outcome, citation: cits[0] });
      }
    }
  }

  // Chronological order — defensive sort even if model emitted them already in order.
  calls.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return { person, thesis, verdict, calls, forwardCall, generatedAt: new Date().toISOString() };
}

export async function getArc(input: ArcInput): Promise<ArcResult> {
  const canned = mockArc(input.person);
  if (canned.calls.length > 0) return canned;

  const pq = await personQuotes({
    name: input.person,
    themes: DEFAULT_ARC_THEMES,
    filters: { episodesLimit: 10, quotesPerEpisode: 4, candidatesLimit: 30 },
    refresh: input.refresh,
  });
  if (pq.candidates.length === 0) return canned;

  const syn = await synthesize({
    kind: 'arc',
    input: { person: input.person },
    candidates: pq.candidates,
    model: 'fast',
    refresh: input.refresh,
  });

  const result = parseArcMarkers(input.person, syn.text, pq.candidates);
  result._meta = syn._meta;
  return result;
}

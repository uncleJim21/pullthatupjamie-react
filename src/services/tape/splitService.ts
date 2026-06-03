// Tape skin — Split service.
//
// Split contrasts two stated positions on a topic. Two real-path modes:
//   - "named": A vs B by name (e.g. El-Erian vs Druckenmiller) → person-quotes × 2.
//   - "camp":  bulls vs bears on a topic (e.g. AI bubble) → topic-quotes with
//              groupBy=bull-bear.
// Canon (AI-bubble bulls vs bears) is checked first; otherwise live pipeline.

import { mockSplit } from '../../data/mockTapeData.ts';
import {
  personQuotes,
  topicQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type { SplitInput, SplitResult, SplitSide } from './tapeTypes.ts';

function parseSplitMarkers(
  topic: string,
  personA: string,
  personB: string,
  text: string,
  candidates: TapeCandidate[]
): SplitResult {
  const sides: SplitSide[] = [];
  let contrastSummary: string | undefined;

  for (const block of text.split(/\n(?=##\s)/)) {
    const personM = block.match(/^##\s*PERSON:\s*(.+)/i);
    const contrastM = block.match(/^##\s*CONTRAST/i);
    if (personM) {
      const body = block.replace(/^##.*\n?/, '');
      sides.push({
        person: personM[1].trim(),
        positionSummary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: resolveCitationsFromCandidates(block, candidates),
      });
    } else if (contrastM) {
      contrastSummary = block.replace(/^##.*\n?/, '').replace(/\{\{clip:[^}]+\}\}/g, '').trim();
    }
  }

  const blank: SplitSide = { person: '', positionSummary: '', citations: [] };
  return {
    topic,
    sideA: sides[0] || { ...blank, person: personA },
    sideB: sides[1] || { ...blank, person: personB },
    contrastSummary,
    generatedAt: new Date().toISOString(),
  };
}

/** Heuristic: "camp" mode means both sides look like generic stances (Bulls /
 *  Bears / "The optimists" / "Skeptics") rather than real names. We trigger on
 *  the common bull/bear keywords; everything else routes through the named
 *  two-person path. */
function isCampMode(personA: string, personB: string): boolean {
  const blob = `${personA} ${personB}`.toLowerCase();
  return /\b(bull|bear|optimist|skeptic|hawk|dove|long|short)/.test(blob);
}

export async function getSplit(input: SplitInput): Promise<SplitResult> {
  const canned = mockSplit(input.personA, input.personB, input.topic);
  if (canned.sideA.citations.length > 0 || canned.sideB.citations.length > 0) return canned;

  let candidates: TapeCandidate[];

  if (isCampMode(input.personA, input.personB)) {
    const tq = await topicQuotes({
      query: input.topic,
      themes: [input.topic],
      groupBy: 'bull-bear',
      filters: { mainstream: true, candidatesLimit: 30 },
      refresh: input.refresh,
    });
    candidates = tq.candidates;
  } else {
    const [a, b] = await Promise.all([
      personQuotes({ name: input.personA, themes: [input.topic], refresh: input.refresh }),
      personQuotes({ name: input.personB, themes: [input.topic], refresh: input.refresh }),
    ]);
    candidates = [...a.candidates, ...b.candidates];
  }
  if (candidates.length === 0) return canned;

  const syn = await synthesize({
    kind: 'split',
    input: { person: input.personA, personB: input.personB, topic: input.topic },
    candidates,
    model: input.model || 'quality',
    refresh: input.refresh,
  });

  const result = parseSplitMarkers(input.topic, input.personA, input.personB, syn.text, candidates);
  result._meta = syn._meta;
  result.tickers = syn.tickers;
  return result;
}

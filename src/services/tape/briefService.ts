// Tape skin — Brief service.
//
// Brief summarizes what was said across publishers on a topic in the trailing
// 7 days. Hybrid: hand-curated canon (Hormuz / oil) first, then live pipeline:
//   POST /api/tape/topic-quotes (groupBy=creator) → /api/tape/synthesize → parse.

import { mockBrief } from '../../data/mockTapeData.ts';
import {
  topicQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type { BriefInput, BriefResult, BriefPublisherSection } from './tapeTypes.ts';

/** Compute the week window the Brief covers (asOfDate minus 7 days). */
function weekWindow(asOfDate: string): { minDate: string; maxDate: string } {
  const end = new Date(asOfDate + (asOfDate.length === 10 ? 'T00:00:00Z' : ''));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10) };
}

function parseBriefMarkers(
  topic: string,
  asOfDate: string,
  text: string,
  candidates: TapeCandidate[]
): BriefResult {
  let headline = '';
  const sections: BriefPublisherSection[] = [];

  for (const block of text.split(/\n(?=#{1,2}\s)/)) {
    const headlineM = block.match(/^#\s*HEADLINE:\s*(.+)/i);
    const pubM = block.match(/^##\s*PUBLISHER:\s*(.+)/i);
    if (headlineM) headline = headlineM[1].trim();
    else if (pubM) {
      const body = block.replace(/^##.*\n?/, '');
      sections.push({
        publisher: pubM[1].trim(),
        summary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: resolveCitationsFromCandidates(block, candidates),
      });
    }
  }

  return { topic, asOfDate, headline, sections, generatedAt: new Date().toISOString() };
}

export async function getBrief(input: BriefInput): Promise<BriefResult> {
  const canned = mockBrief(input.topic, input.asOfDate);
  if (canned.sections.length > 0) return canned;

  const { minDate, maxDate } = weekWindow(input.asOfDate);
  const tq = await topicQuotes({
    query: input.topic,
    themes: [input.topic],
    groupBy: 'creator',
    filters: { mainstream: true, minDate, maxDate, candidatesLimit: 30 },
    refresh: input.refresh,
  });
  if (tq.candidates.length === 0) return canned;

  const syn = await synthesize({
    kind: 'brief',
    input: { topic: input.topic },
    candidates: tq.candidates,
    model: 'fast',
    refresh: input.refresh,
  });

  const result = parseBriefMarkers(input.topic, input.asOfDate, syn.text, tq.candidates);
  result._meta = syn._meta;
  return result;
}

// Tape skin — Narrative service.
//
// Hybrid model matching every other live action: hand-curated canon (the
// Gromen "sovereign debt endgame" narrative) wins first. Novel topics and
// non-canon groups route through the live pipeline:
//
//   1. topic-quotes  (or person-quotes when group=<named person>)
//      with recency weighting disabled — the time dimension IS the point
//   2. synthesize { kind: 'narrative' }  — backend emits THESIS / BUCKET / ...
//   3. parse markers → NarrativeResult
//
// Contract reference: docs/tape-backend-narrative-spec.md.

import { mockNarrative } from '../../data/mockTapeData.ts';
import {
  topicQuotes,
  personQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type {
  NarrativeInput,
  NarrativeResult,
  NarrativeBucket,
  NarrativeInflection,
} from './tapeTypes.ts';

/** ISO date for N months ago. Used as the retrieval window floor. */
function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Map the optional group string to the right retrieval path. */
function groupKind(group?: string): 'all' | 'bull' | 'bear' | 'person' {
  const g = (group || '').trim().toLowerCase();
  if (!g || g === 'all' || g === 'all voices') return 'all';
  if (g === 'bulls' || g === 'bull') return 'bull';
  if (g === 'bears' || g === 'bear') return 'bear';
  return 'person';
}

/**
 * Narrative marker parser. Backend output per the spec at
 * docs/tape-backend-narrative-spec.md:
 *
 *   ## THESIS: <one-line current consensus>
 *
 *   ## BUCKET | <ISO start> | <ISO end> | <signed sentiment -5..+5>
 *   <2-3 sentence stance summary>
 *   {{clip:id}}
 *   {{clip:id}}
 *
 *   ## INFLECTION
 *   - <YYYY-Qn or ISO>: <one-sentence what changed and why>
 *
 *   ## FORWARD: <one-line where this is heading>
 */
function parseNarrativeMarkers(
  text: string,
  candidates: TapeCandidate[],
): {
  thesis: string;
  buckets: NarrativeBucket[];
  inflections: NarrativeInflection[];
  forwardCall?: string;
} {
  let thesis = '';
  let forwardCall: string | undefined;
  const buckets: NarrativeBucket[] = [];
  const inflections: NarrativeInflection[] = [];

  for (const block of text.split(/\n(?=##\s)/)) {
    const thesisM = block.match(/^##\s*THESIS:\s*(.+)/i);
    const bucketM = block.match(/^##\s*BUCKET\s*\|\s*(.+)/i);
    const inflectionM = block.match(/^##\s*INFLECTION/i);
    const forwardM = block.match(/^##\s*FORWARD:\s*(.+)/i);

    if (thesisM) {
      thesis = thesisM[1].trim();
    } else if (bucketM) {
      // pipe-delimited: start | end | sentiment
      const parts = bucketM[1].split('|').map(s => s.trim());
      const start = parts[0] || '';
      const end = parts[1] || '';
      const raw = parseInt(parts[2] || '', 10);
      const sentiment = isNaN(raw) ? undefined : Math.max(-5, Math.min(5, raw));
      const body = block.replace(/^##.*\n?/, '');
      const stance = body.replace(/\{\{clip:[^}]+\}\}/g, '').trim();
      buckets.push({
        start,
        end,
        stance,
        citations: resolveCitationsFromCandidates(block, candidates),
        sentiment,
      });
    } else if (inflectionM) {
      // bullet lines: "- <date>: <description>"
      for (const line of block.split('\n')) {
        const m = line.match(/^-\s*([^:]+?)\s*:\s*(.+)$/);
        if (m) inflections.push({ date: m[1].trim(), description: m[2].trim() });
      }
    } else if (forwardM) {
      forwardCall = forwardM[1].trim();
    }
  }

  return { thesis, buckets, inflections, forwardCall };
}

/** Retrieve the candidate pool the synthesizer will work over. Routes to
 *  topic-quotes or person-quotes based on the group filter; passes
 *  `disableRecencyWeighting: true` so the full multi-year spread comes back
 *  unweighted (Narrative's whole point is the time dimension). */
async function retrieveCandidates(input: NarrativeInput): Promise<TapeCandidate[]> {
  const kind = groupKind(input.group);
  const minDate = monthsAgoIso(36);

  if (kind === 'person') {
    const pq = await personQuotes({
      name: input.group!,
      themes: [input.topic],
      filters: {
        guestsOnly: true,
        dedicatedOnly: false,
        mainstream: true,
        minDate,
        episodesLimit: 15,
        quotesPerEpisode: 4,
        candidatesLimit: 60,
        disableRecencyWeighting: true,
      },
      refresh: input.refresh,
    });
    return pq.candidates;
  }

  const tqFilters = {
    mainstream: true,
    minDate,
    candidatesLimit: 60,
    disableRecencyWeighting: true,
  };

  if (kind === 'bull' || kind === 'bear') {
    const tq = await topicQuotes({
      query: input.topic,
      themes: [input.topic],
      groupBy: 'bull-bear',
      filters: tqFilters,
      refresh: input.refresh,
    });
    const matchRe = kind === 'bull' ? /bull/i : /bear/i;
    return tq.groups?.find(g => matchRe.test(g.key))?.candidates ?? tq.candidates;
  }

  // 'all' / consensus
  const tq = await topicQuotes({
    query: input.topic,
    themes: [input.topic],
    filters: tqFilters,
    refresh: input.refresh,
  });
  return tq.candidates;
}

export async function getNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  // 1) Canon first — hand-curated wins on quality, cost, and latency.
  const canned = mockNarrative(input);
  if (canned.buckets.length > 0) return canned;

  // 2) Live pipeline.
  const candidates = await retrieveCandidates(input);
  if (candidates.length === 0) {
    // No candidates → return the empty canon shape, which the View routes
    // to its "no narrative drift assembled" empty state.
    return canned;
  }

  const syn = await synthesize({
    kind: 'narrative',
    input: { topic: input.topic, group: input.group ?? null },
    candidates,
    model: input.model || 'quality',
    refresh: input.refresh,
  });

  const parsed = parseNarrativeMarkers(syn.text, candidates);
  return {
    topic: input.topic,
    group: input.group,
    thesis: parsed.thesis,
    buckets: parsed.buckets,
    inflections: parsed.inflections,
    forwardCall: parsed.forwardCall,
    generatedAt: new Date().toISOString(),
    _meta: syn._meta,
    tickers: syn.tickers,
  };
}

// Tape skin — Read-in service.
//
// Hand-curated canon (APP + peers) is the demo's A+ content. Novel tickers
// fall through to a minimal live pipeline that fills the Quick depth surface:
//   POST /api/tape/topic-quotes (ticker + name) → /api/tape/synthesize → parse.
// UVP / Strategy / Leadership / Financials / Catalysts remain canon-only —
// those are hand-written analyst sections and would feel wrong if hallucinated
// for a novel ticker.

import { mockReadIn } from '../../data/mockTapeCompanies.ts';
import {
  topicQuotes,
  synthesize,
  resolveCitationsFromCandidates,
  type TapeCandidate,
} from './tapeClient.ts';
import type { ReadInInput, ReadInResult, TapeCitation } from './tapeTypes.ts';

/**
 * Read-in markers (v1):
 *   ## WHAT_THEY_DO
 *   <plain-English primer paragraphs>
 *   ## PULSE | BULL: <bullLine> | BEAR: <bearLine>
 *   {{clip:id}}                  # marquee
 *   ## SMART_MONEY: BULL
 *   {{clip:id}} ... (any order)
 *   ## SMART_MONEY: BEAR
 *   {{clip:id}} ...
 *   ## RISKS
 *   - risk one
 *   - risk two
 */
function parseReadInMarkers(
  ticker: string,
  text: string,
  candidates: TapeCandidate[]
): ReadInResult {
  let whatTheyDo = '';
  let bullLine = '';
  let bearLine = '';
  let marqueeCitation: TapeCitation | null = null;
  const bulls: TapeCitation[] = [];
  const bears: TapeCitation[] = [];
  const risks: string[] = [];

  for (const block of text.split(/\n(?=##\s)/)) {
    if (/^##\s*WHAT_THEY_DO/i.test(block)) {
      whatTheyDo = block.replace(/^##.*\n?/, '').trim();
    } else if (/^##\s*PULSE/i.test(block)) {
      const m = block.match(/BULL:\s*(.+?)(?:\s*\|\s*BEAR:\s*(.+))?$/im);
      if (m) {
        bullLine = (m[1] || '').trim();
        bearLine = (m[2] || '').trim();
      }
      const cits = resolveCitationsFromCandidates(block, candidates);
      if (cits[0]) marqueeCitation = cits[0];
    } else if (/^##\s*SMART_MONEY:\s*BULL/i.test(block)) {
      bulls.push(...resolveCitationsFromCandidates(block, candidates));
    } else if (/^##\s*SMART_MONEY:\s*BEAR/i.test(block)) {
      bears.push(...resolveCitationsFromCandidates(block, candidates));
    } else if (/^##\s*RISKS/i.test(block)) {
      for (const line of block.split('\n')) {
        const r = line.match(/^-\s*(.+)$/);
        if (r) risks.push(r[1].trim());
      }
    }
  }

  // Marquee fallback: first available candidate if synthesizer didn't pick one.
  if (!marqueeCitation && candidates.length > 0) {
    marqueeCitation = candidates[0];
  }

  return {
    ticker,
    name: ticker, // novel tickers — we don't know the company name; the View shows ticker
    sectorTag: '',
    yahoo: ticker,
    whatTheyDo,
    pulse: {
      bullLine,
      bearLine,
      priceAction: '', // filled live via useLiveTickers in the View
      marqueeCitation: marqueeCitation || {
        pineconeId: '', text: '', episodeTitle: '', creator: '',
        episodeImage: '', audioUrl: '', startTime: 0, endTime: 0, publishedDate: '',
      },
    },
    smartMoney: { bulls, bears },
    catalysts: [],
    peers: [],
    risks,
    generatedAt: new Date().toISOString(),
  };
}

export async function getReadIn(input: ReadInInput): Promise<ReadInResult> {
  const canned = mockReadIn(input.ticker);
  if (canned.name) return canned;

  const tq = await topicQuotes({
    query: input.ticker,
    themes: [input.ticker, `${input.ticker} stock company business`],
    filters: { mainstream: true, candidatesLimit: 20 },
    refresh: input.refresh,
  });
  if (tq.candidates.length === 0) return canned;

  const syn = await synthesize({
    kind: 'readin',
    input: { ticker: input.ticker, depth: input.depth || 'quick' },
    candidates: tq.candidates,
    model: 'fast',
    refresh: input.refresh,
  });

  const result = parseReadInMarkers(input.ticker, syn.text, tq.candidates);
  result._meta = syn._meta;
  // Backend `tickers` for readin are peers per the spec; populate the existing
  // peers slot the View already renders.
  if (syn.tickers && syn.tickers.length > 0) result.peers = syn.tickers;
  return result;
}

// Tape skin — mock fixtures.
//
// Mirrors the literal-fixture style of src/data/mockGalaxyData.ts. These power
// the skin while USE_MOCK_TAPE === true (src/config/tapeConfig.ts) and are
// shaped to match exactly what the real /pull-backed services will assemble,
// so the swap to live data is invisible to the views.
//
// NOTE: audioUrl values are placeholders — playback wiring is real, but these
// URLs won't produce sound. Real citations resolve via get-hierarchy.

import type {
  TapeCitation,
  DossierResult,
  TimelineResult,
  TimelineBucket,
  TimelineDrilldownResult,
  BriefResult,
  SplitResult,
} from '../services/tape/tapeTypes.ts';

interface RawQuote {
  text: string;
  show: string;
  episode: string;
  date: string; // ISO
  start: number; // seconds
}

const slug = (s: string) => s.trim().toLowerCase();

// person|topic → quotes. Deliberately small but believable.
const QUOTE_BANK: Record<string, RawQuote[]> = {
  'stanley druckenmiller|fed policy': [
    {
      text: "I've never seen a situation where the Fed is this far behind the curve and still talking about being data dependent. They should have moved six months ago.",
      show: 'Forward Guidance',
      episode: 'Druckenmiller on the Fed’s Credibility Problem',
      date: '2025-02-18',
      start: 872,
    },
    {
      text: 'When the cost of capital goes from zero to five in eighteen months, you are going to break something. The only question is what and when.',
      show: 'Macro Voices',
      episode: 'The Lag Effect',
      date: '2024-11-05',
      start: 1455,
    },
  ],
  'stanley druckenmiller|rate cuts': [
    {
      text: "I'm skeptical of the soft-landing narrative. Cutting into a re-accelerating economy is how you get the second wave of inflation.",
      show: 'The Market Huddle',
      episode: 'Positioning for 2025',
      date: '2025-01-14',
      start: 2103,
    },
  ],
  'stanley druckenmiller|yield-curve inversion': [
    {
      text: 'The inversion has been the most reliable recession signal in history. The fact that it un-inverted does not mean we are clear, it usually means we are close.',
      show: 'Odd Lots',
      episode: 'Reading the Curve',
      date: '2025-03-03',
      start: 640,
    },
  ],
  'lyn alden|fed policy': [
    {
      text: 'This is a fiscally dominant environment. The deficits are so large that monetary policy is pushing on a string, and people keep modeling it like it is 2010.',
      show: 'Forward Guidance',
      episode: 'Fiscal Dominance, Explained',
      date: '2025-02-25',
      start: 980,
    },
  ],
  'lyn alden|bitcoin': [
    {
      text: 'Bitcoin is the cleanest expression of the debasement trade. You do not need a price target, you need a denominator that keeps shrinking.',
      show: 'We Study Billionaires',
      episode: 'The Debasement Decade',
      date: '2025-01-29',
      start: 1820,
    },
    {
      text: 'I treat it as a high-beta liquidity asset over short windows and a monetary hedge over long ones. Both can be true.',
      show: 'Macro Voices',
      episode: 'Liquidity and the Cycle',
      date: '2024-12-10',
      start: 2440,
    },
  ],
  'lyn alden|the dollar': [
    {
      text: 'The dollar wrecking ball is real but it is cyclical. Structural diversification away from Treasuries by central banks is the slower, more important story.',
      show: 'Odd Lots',
      episode: 'Dollar Plumbing',
      date: '2025-02-04',
      start: 705,
    },
  ],
  'mike green|fed policy': [
    {
      text: 'The passive flows dominate price discovery now. The Fed can set the rate, but the marginal buyer is a 401k contribution that does not care about valuation.',
      show: 'The Market Huddle',
      episode: 'The Passive Problem',
      date: '2025-02-11',
      start: 1330,
    },
  ],
  'mike green|commercial real estate': [
    {
      text: 'Regional banks are sitting on commercial real estate marks they have not taken. The maturity wall in 2025 and 2026 is where the denial meets the cash flow.',
      show: 'Forward Guidance',
      episode: 'The CRE Maturity Wall',
      date: '2025-01-21',
      start: 2010,
    },
  ],
  'mike green|rate cuts': [
    {
      text: 'If they cut, it is not because things are fine. It is because something in the plumbing forced their hand. Do not celebrate the pivot.',
      show: 'Macro Voices',
      episode: 'Plumbing Risk',
      date: '2025-03-10',
      start: 1190,
    },
  ],
};

let idCounter = 0;
const toCitation = (q: RawQuote, speaker: string): TapeCitation => ({
  pineconeId: `tape_mock_${(idCounter += 1)}_${slug(speaker).replace(/\s+/g, '_')}`,
  text: q.text,
  speaker,
  episodeTitle: q.episode,
  creator: q.show,
  episodeImage: '',
  audioUrl: `https://example.com/tape/${slug(q.show).replace(/\s+/g, '-')}.mp3`,
  startTime: q.start,
  endTime: q.start + 38,
  publishedDate: q.date,
});

const KNOWN_TOPICS = ['fed policy', 'rate cuts', 'yield-curve inversion', 'bitcoin', 'the dollar', 'commercial real estate'];

const quotesFor = (person: string, topic: string): RawQuote[] =>
  QUOTE_BANK[`${slug(person)}|${slug(topic)}`] || [];

const allQuotesForPerson = (person: string): { topic: string; quotes: RawQuote[] }[] =>
  KNOWN_TOPICS.map(topic => ({ topic, quotes: quotesFor(person, topic) })).filter(t => t.quotes.length > 0);

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

// ─── Dossier ─────────────────────────────────────────────────────────────────
export function mockDossier(person: string): DossierResult {
  const grouped = allQuotesForPerson(person);
  const topics = grouped.map(({ topic, quotes }) => ({
    topic,
    positionSummary: `${titleCase(person)} returns to ${topic} repeatedly, framing it through a top-down macro lens with a consistent, skeptical read on consensus positioning.`,
    citations: quotes.map(q => toCitation(q, titleCase(person))),
  }));

  const appearanceMap = new Map<string, { episode: string; date: string; count: number }>();
  for (const { quotes } of grouped) {
    for (const q of quotes) {
      const prev = appearanceMap.get(q.show);
      if (prev) prev.count += 1;
      else appearanceMap.set(q.show, { episode: q.episode, date: q.date, count: 1 });
    }
  }
  const appearances = [...appearanceMap.entries()].map(([show, v]) => ({
    show,
    episodeTitle: v.episode,
    publishedDate: v.date,
    citationCount: v.count,
  }));

  return { person: titleCase(person), topics, appearances, generatedAt: new Date().toISOString() };
}

// ─── Timeline ────────────────────────────────────────────────────────────────
const mondayOf = (d: Date): Date => {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // 0 = Monday
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
};
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export function mockTimeline(topic: string, startDate: string, endDate: string): TimelineResult {
  const start = mondayOf(new Date(startDate));
  const end = new Date(endDate);
  const buckets: TimelineBucket[] = [];
  // Deterministic-ish pseudo-random from topic + week so the chart is stable per query.
  const seedBase = [...slug(topic)].reduce((a, c) => a + c.charCodeAt(0), 0);
  let week = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7), week += 1) {
    const wave = Math.sin((week + seedBase) / 3.3) + Math.sin((week + seedBase) / 1.7);
    const spike = week % 9 === 4 ? 7 : 0; // periodic "event week" spike
    const count = Math.max(0, Math.round(5 + wave * 3 + spike + ((seedBase + week) % 3)));
    buckets.push({ weekStart: isoDate(new Date(d)), count });
  }
  const totalMentions = buckets.reduce((a, b) => a + b.count, 0);
  return { topic, startDate, endDate, buckets, totalMentions };
}

export function mockTimelineDrilldown(topic: string, weekStart: string, weekEnd: string): TimelineDrilldownResult {
  // Pull any quotes on this topic from the bank, regardless of person, as stand-ins.
  const speakers = ['Stanley Druckenmiller', 'Lyn Alden', 'Mike Green'];
  const citations: TapeCitation[] = [];
  for (const sp of speakers) {
    for (const q of quotesFor(sp, topic)) citations.push(toCitation({ ...q, date: weekStart }, sp));
  }
  return {
    weekStart,
    summary: citations.length
      ? `Discussion of ${topic} clustered around the week of ${weekStart}, with the most pointed takes coming from ${speakers.filter(s => quotesFor(s, topic).length).join(', ')}.`
      : `No corpus mentions of ${topic} resolved for the week of ${weekStart} in this mock dataset.`,
    citations,
  };
}

// ─── Brief ───────────────────────────────────────────────────────────────────
export function mockBrief(topic: string, asOfDate: string): BriefResult {
  const speakers = ['Stanley Druckenmiller', 'Lyn Alden', 'Mike Green'];
  const byPublisher = new Map<string, TapeCitation[]>();
  for (const sp of speakers) {
    for (const q of quotesFor(sp, topic)) {
      const c = toCitation(q, sp);
      const arr = byPublisher.get(c.creator) || [];
      arr.push(c);
      byPublisher.set(c.creator, arr);
    }
  }
  const sections = [...byPublisher.entries()].map(([publisher, citations]) => ({
    publisher,
    summary: `On ${publisher}, the week's ${topic} commentary leaned skeptical of consensus, with hosts pressing guests on positioning rather than narrative.`,
    citations,
  }));
  return {
    topic,
    asOfDate,
    headline: sections.length
      ? `Macro desks converged on a cautious read of ${topic} this week, diverging mainly on timing.`
      : `No ${topic} commentary surfaced across the corpus for the week ending ${asOfDate}.`,
    sections,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Split ───────────────────────────────────────────────────────────────────
export function mockSplit(personA: string, personB: string, topic: string): SplitResult {
  const side = (person: string) => {
    const quotes = quotesFor(person, topic);
    return {
      person: titleCase(person),
      positionSummary: quotes.length
        ? `${titleCase(person)} frames ${topic} through their characteristic lens, anchoring the view to mechanism over narrative.`
        : `No stated position on ${topic} from ${titleCase(person)} in this mock dataset.`,
      citations: quotes.map(q => toCitation(q, titleCase(person))),
    };
  };
  const sideA = side(personA);
  const sideB = side(personB);
  return {
    topic,
    sideA,
    sideB,
    contrastSummary:
      sideA.citations.length && sideB.citations.length
        ? `Both treat ${topic} as a mechanism question, but ${sideA.person} emphasizes the policy lag while ${sideB.person} emphasizes structural and flow dynamics.`
        : undefined,
    generatedAt: new Date().toISOString(),
  };
}

/** Sample commands surfaced on the launcher. */
export const TAPE_SAMPLES: string[] = [
  'dossier Stanley Druckenmiller',
  'timeline Fed policy',
  'brief yield-curve inversion',
  'split Druckenmiller / Mike Green on rate cuts',
];

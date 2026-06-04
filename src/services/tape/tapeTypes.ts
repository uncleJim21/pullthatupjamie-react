// Tape skin — all input/result types for the four actions.
//
// The shared primitive is `TapeCitation`: the hydrated form of a
// `{{clip:<pineconeId>}}` token that the /api/pull agent embeds in its
// streamed text. It is intentionally a near-superset of `ClipMeta`
// (src/components/jamiePullAgent/JamiePullAgentMessage.tsx) so the existing
// audio / share / time utilities work on it unchanged.

import type { ClipMeta } from '../../components/jamiePullAgent/JamiePullAgentMessage.tsx';
import type { TapeResponseMeta } from './tapeClient.ts';

/** Synthesis tier the user picked. `quality` is the recommended default (Deep
 *  mode in the UI — most capable model, ~60-90s, materially more depth).
 *  `fast` is the lighter tier (~30-45s) for when speed matters. */
export type TapeModel = 'quality' | 'fast';

/** Atomic cited evidence unit. One quoted paragraph + everything the UI needs
 *  to play it, time-link it, and attribute it. */
export interface TapeCitation {
  pineconeId: string;
  text: string;
  /** Resolved person attribution. May be empty when the corpus can't resolve a speaker. */
  speaker?: string;
  episodeTitle: string;
  creator: string; // publisher / show name
  episodeImage: string;
  audioUrl: string;
  startTime: number; // seconds
  endTime: number;
  publishedDate?: string; // ISO
}

/** A ClipMeta (from get-hierarchy) maps cleanly into a TapeCitation. */
export const clipMetaToCitation = (m: ClipMeta, speaker?: string): TapeCitation => ({
  pineconeId: m.pineconeId,
  text: m.text,
  speaker,
  episodeTitle: m.episodeTitle,
  creator: m.creator,
  episodeImage: m.episodeImage,
  audioUrl: m.audioUrl,
  startTime: m.startTime,
  endTime: m.endTime,
  publishedDate: m.publishedDate,
});

// ─── 1. Dossier ──────────────────────────────────────────────────────────────
export interface DossierInput {
  person: string;
  /** Force re-synthesis on the backend (bypass cache). Set when the user
   *  hits the Refresh affordance under a result. */
  refresh?: boolean;
  /** Synthesis tier override. Defaults to the user's persisted preference
   *  (`quality` if unset). Plumbed through to `SynthesizeRequest.model`. */
  model?: TapeModel;
}
export interface DossierTopicGroup {
  topic: string;
  positionSummary: string;
  citations: TapeCitation[];
}
export interface DossierAppearance {
  show: string;
  episodeTitle: string;
  publishedDate?: string;
  citationCount: number;
}
export interface DossierResult {
  person: string;
  topics: DossierTopicGroup[];
  appearances: DossierAppearance[];
  generatedAt: string; // ISO
  /** Backend `_meta` from the synthesize call. Absent on canon-only results. */
  _meta?: TapeResponseMeta;
  /** Backend-curated relevant tickers for the "On the tape" strip. Canon
   *  results populate this from hand-curated constants; live results inherit
   *  from `SynthesizeResponse.tickers`. Empty/undefined → hide the strip. */
  tickers?: string[];
}

// ─── 2. Timeline ─────────────────────────────────────────────────────────────
export interface TimelineInput {
  topic: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
}
export interface TimelineBucket {
  weekStart: string; // ISO Monday
  count: number;
}
export interface TimelineResult {
  topic: string;
  startDate: string;
  endDate: string;
  buckets: TimelineBucket[];
  totalMentions: number;
}
export interface TimelineDrilldownInput {
  topic: string;
  weekStart: string; // ISO Monday
  weekEnd: string; // ISO Sunday
}
export interface TimelineDrilldownResult {
  weekStart: string;
  summary: string;
  citations: TapeCitation[];
}

// ─── 3. Brief ────────────────────────────────────────────────────────────────
export interface BriefInput {
  topic: string;
  asOfDate: string; // ISO; "this week" = the 7 days ending asOfDate
  refresh?: boolean;
  /** Synthesis tier override. Defaults to the user's persisted preference
   *  (`quality` if unset). Plumbed through to `SynthesizeRequest.model`. */
  model?: TapeModel;
}
export interface BriefPublisherSection {
  publisher: string;
  summary: string;
  citations: TapeCitation[];
}
export interface BriefResult {
  topic: string;
  asOfDate: string;
  headline: string;
  sections: BriefPublisherSection[];
  generatedAt: string;
  _meta?: TapeResponseMeta;
  tickers?: string[];
}

// ─── 4. Split ────────────────────────────────────────────────────────────────
export interface SplitInput {
  personA: string;
  personB: string;
  topic: string;
  refresh?: boolean;
  /** Synthesis tier override. Defaults to the user's persisted preference
   *  (`quality` if unset). Plumbed through to `SynthesizeRequest.model`. */
  model?: TapeModel;
}
export interface SplitSide {
  person: string;
  positionSummary: string;
  citations: TapeCitation[];
}
export interface SplitResult {
  topic: string;
  sideA: SplitSide;
  sideB: SplitSide;
  contrastSummary?: string;
  generatedAt: string;
  _meta?: TapeResponseMeta;
  tickers?: string[];
}

// ─── 5. Narrative — how consensus (or a group's view) on a topic drifted ────
//
// Reshape of the old Arc action. Topic-first instead of person-first;
// `group` optional filter lets the same UI cover "the bulls' narrative on
// AAPL," "central banks' narrative on Treasuries," or — preserving the old
// canon use — "Luke Gromen's narrative on the debt-spiral thesis."
export interface NarrativeInput {
  topic: string;
  /** Optional group filter. Recognized shorthands: 'bulls' / 'bears' /
   *  'hawks' / 'doves' (sentiment camps); 'all' or empty = consensus across
   *  mainstream; any other string is treated as a named-person filter. */
  group?: string;
  refresh?: boolean;
  /** Synthesis tier override. Defaults to the user's persisted preference
   *  (`quality` if unset). Plumbed through to `SynthesizeRequest.model`. */
  model?: TapeModel;
}
/** One chronological window. Cadence (monthly / quarterly / yearly) is chosen
 *  by the backend based on the date range available. */
export interface NarrativeBucket {
  start: string; // ISO date — bucket start inclusive
  end: string;   // ISO date — bucket end inclusive
  /** 2-3 sentence prevailing stance summary for this window. */
  stance: string;
  /** 1-4 supporting clips from this bucket. */
  citations: TapeCitation[];
  /** Signed conviction-on-the-thesis score, -5 (strongly against) to +5
   *  (strongly for). Drives the trajectory chart. Sign-flip across the zero
   *  line IS a reversal. Magnitude reflects how forcefully the prevailing
   *  voices in this window were stating the position. */
  sentiment?: number;
}
/** A point in time where the narrative materially shifted. */
export interface NarrativeInflection {
  date: string;        // ISO date or 'YYYY-Qn' for quarter labels
  description: string; // one-sentence what changed and (briefly) why
}
export interface NarrativeResult {
  topic: string;
  /** Echoed back so the View can show "Filter: Luke Gromen" etc. */
  group?: string;
  /** Current consensus position on the topic (or the group's current view). */
  thesis: string;
  buckets: NarrativeBucket[];     // chronological, oldest → newest
  inflections: NarrativeInflection[];
  /** Optional forward-looking gloss — "where this trajectory is heading." */
  forwardCall?: string;
  generatedAt: string;
  _meta?: TapeResponseMeta;
  tickers?: string[];
}

// ─── 6. Read in — fast company research scaling Quick / Brief / Deep ─────────
export type TapeDepth = 'quick' | 'brief' | 'deep';

export interface ReadInInput {
  ticker: string;
  depth?: TapeDepth;
  refresh?: boolean;
  /** Synthesis tier override. Defaults to the user's persisted preference
   *  (`quality` if unset). Plumbed through to `SynthesizeRequest.model`. */
  model?: TapeModel;
}
/** Dated catalyst bullet (S&P inclusion, short-report release, earnings, etc.). */
export interface ReadInCatalyst {
  date: string; // ISO or 'YYYY-MM' for soft dates
  label: string;
}
/** The 30-second answer surfaced at Quick depth. */
export interface ReadInPulse {
  bullLine: string;
  bearLine: string;
  /** One line about the recent price action (uses live Yahoo data on render). */
  priceAction: string;
  /** Strongest single quote to lead with. */
  marqueeCitation: TapeCitation;
}
/** Hybrid pattern shared by UVP / Strategy / Leadership: analyst synthesis + optional supporting clips. */
export interface ReadInThesisSection {
  /** 2-3 sentence analyst-style synthesis (hand-written, defensible). */
  summary: string;
  /** 0-2 supporting clips from the corpus. */
  citations?: TapeCitation[];
}
/** Generic label/value pair used by Leadership facts strip and Financials grid. */
export interface ReadInFact { label: string; value: string }
/** Leadership extends ThesisSection with a structured facts strip (CEO, tenure, ownership, etc.). */
export interface ReadInLeadership extends ReadInThesisSection {
  facts: ReadInFact[];
}
/** Headline numbers block; deliberately small (not a financials terminal). */
export interface ReadInFinancials {
  headline: ReadInFact[];
  /** One-line analyst gloss. */
  note?: string;
}

export interface ReadInResult {
  ticker: string;             // e.g. 'APP'
  name: string;               // 'AppLovin Corp'
  sectorTag: string;          // 'SOFTWARE · ADTECH'
  /** Yahoo URL slug for the live-price fetch + click-through. */
  yahoo: string;              // 'APP'
  /** 2-3 paragraph plain-English primer. Rendered at Brief depth and below.
   *  May contain `{{clip:id}}` tokens; resolve them against
   *  `whatTheyDoCitations` below to render inline playable pills. */
  whatTheyDo: string;
  /** Citations referenced inline in `whatTheyDo` prose. Populated from the
   *  candidate pool by the parser. Empty for canon results that don't
   *  inline-cite. */
  whatTheyDoCitations?: TapeCitation[];
  pulse: ReadInPulse;
  /** v2: investment-thesis pillars at Brief depth. Optional so non-baked tickers still type-check. */
  uvp?: ReadInThesisSection;
  strategy?: ReadInThesisSection;
  leadership?: ReadInLeadership;
  financials?: ReadInFinancials;
  smartMoney: { bulls: TapeCitation[]; bears: TapeCitation[] };
  catalysts: ReadInCatalyst[];
  /** Peer ticker symbols for the Deep peer strip. */
  peers: string[];
  risks: string[];
  generatedAt: string;
  _meta?: TapeResponseMeta;
}

/** The action verbs, used by the command parser + launcher. */
export type TapeActionId = 'dossier' | 'timeline' | 'brief' | 'split' | 'narrative' | 'readin';

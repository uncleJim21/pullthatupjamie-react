// Tape skin — all input/result types for the four actions.
//
// The shared primitive is `TapeCitation`: the hydrated form of a
// `{{clip:<pineconeId>}}` token that the /api/pull agent embeds in its
// streamed text. It is intentionally a near-superset of `ClipMeta`
// (src/components/jamiePullAgent/JamiePullAgentMessage.tsx) so the existing
// audio / share / time utilities work on it unchanged.

import type { ClipMeta } from '../../components/jamiePullAgent/JamiePullAgentMessage.tsx';

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
}

// ─── 4. Split ────────────────────────────────────────────────────────────────
export interface SplitInput {
  personA: string;
  personB: string;
  topic: string;
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
}

// ─── 5. Arc — how one person's view on a thesis evolved over time ────────────
export interface ArcInput {
  person: string;
}
export interface ArcCall {
  date: string; // ISO of the clip
  /** Short claim/stance for this beat, e.g. "Recession AND rising yields". */
  label: string;
  /** Conviction read from the LANGUAGE of the quote, 1 (hedged) .. 5 (absolute).
   *  Not a market-sentiment score; a defensible read of how forcefully it's stated. */
  conviction: number;
  /** What happened after, if this call landed. Optional. */
  outcome?: string;
  citation: TapeCitation;
}
export interface ArcResult {
  person: string;
  thesis: string;
  /** One-line verdict chip, e.g. "Conviction: rising — and the calls are landing". */
  verdict: string;
  calls: ArcCall[]; // chronological
  /** "What he's calling for next" — the live forward prediction. */
  forwardCall?: string;
  generatedAt: string;
}

/** The action verbs, used by the command parser + launcher. */
export type TapeActionId = 'dossier' | 'timeline' | 'brief' | 'split' | 'arc';

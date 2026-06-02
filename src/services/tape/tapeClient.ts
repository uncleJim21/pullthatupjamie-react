// Tape skin — low-level transport.
//
// This is the seam between the four action services and the backend. The
// services own the MOCK vs REAL branch (a one-line `USE_MOCK_TAPE` guard at the
// top of each); when real, they call into here. Logic is lifted from
// src/hooks/useJamiePullAgent.ts (SSE consumption + headers) and
// src/components/jamiePullAgent/JamiePullAgentMessage.tsx (get-hierarchy
// hydration), kept self-contained so Tape has no runtime dep on the agent UI.

import { API_URL, printLog } from '../../constants/constants.ts';
import { getPulseHeader } from '../pulseService.ts';
import { QuotaExceededError, parseQuotaExceededResponse } from '../../types/errors.ts';
import { attachAuthHeader, emitAuthEvent } from './tapeAuth.ts';
import type { TapeCitation } from './tapeTypes.ts';

const PULL_ENTITLEMENT = 'jamie-pull';
const TAPE_ENTITLEMENT = 'tape';

const getAuthToken = (): string | null => localStorage.getItem('auth_token');

export const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/**
 * Single fetch helper for every /api/tape/* call. Attaches the Tape demo
 * Bearer JWT, surfaces 401 via `emitAuthEvent('unauthorized')` (the
 * TapeAuthGate listens), and converts 429 into the project-standard
 * QuotaExceededError so existing handling reuses.
 *
 * Pass `json` to send a JSON body; otherwise use `body` for raw streams.
 */
export async function tapeFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body' | 'headers'> & { json?: unknown; body?: BodyInit | null; headers?: Record<string, string> } = {}
): Promise<T> {
  const { json, headers: extraHeaders, body, ...rest } = init;
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: attachAuthHeader(headers),
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  if (res.status === 401) {
    emitAuthEvent('unauthorized');
    throw new Error('Unauthorized');
  }
  if (res.status === 429) {
    throw new QuotaExceededError(await parseQuotaExceededResponse(res, TAPE_ENTITLEMENT));
  }
  if (!res.ok) {
    throw new Error(`${path}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Uniform _meta block the backend attaches to most /api/tape/* responses. */
export interface TapeResponseMeta {
  cached?: boolean;
  revalidated?: boolean;
  tier?: 'quantitative' | 'qualitative';
  fetchedAt?: string;
  cachedAt?: string;
  ageSec?: number;
  freshUntil?: string;
  stale?: boolean;
  staleReason?: string;
  source?: string;
  forced?: boolean;
}

/** Normalized response from GET /api/tape/quote/:slug (Yahoo / Finnhub proxy). */
export interface LiveTapeQuote {
  symbol: string;
  name?: string;
  price: number;
  currency?: string;
  dayChangePct: number;
  spark: number[];
  marketState?: string;
  _meta?: TapeResponseMeta;
}

/** Ticker price + sparkline for one symbol. Slug values match Yahoo (e.g. `APP`,
 *  `%5ETNX`, `DX-Y.NYB`, `CL%3DF`). */
export async function tickerQuote(slug: string): Promise<LiveTapeQuote> {
  return tapeFetch<LiveTapeQuote>(`/api/tape/quote/${slug.replace(/^\//, '')}`);
}

// ─── Composite endpoints — person-quotes / topic-quotes / synthesize ──────────
// The backend's candidate shape is a near-superset of TapeCitation: the same
// playable fields plus `spanSec`, `confidenceTier`, `_signals`. We extend
// TapeCitation rather than redefine — the extras are optional and pass through
// any UI that doesn't yet care about them.

export interface TapeCandidate extends TapeCitation {
  spanSec?: number;
  confidenceTier?: 'high' | 'medium' | 'low';
  _signals?: { dedicated?: boolean; mainstream?: boolean; spanRank?: number };
}

export interface PersonQuotesFilters {
  guestsOnly?: boolean;
  dedicatedOnly?: boolean;
  mainstream?: boolean;
  minSpan?: number;
  maxSpan?: number;
  minDate?: string | null;
  maxDate?: string | null;
  episodesLimit?: number;
  quotesPerEpisode?: number;
  candidatesLimit?: number;
}

export interface PersonQuotesRequest {
  name: string;
  themes?: string[];
  filters?: PersonQuotesFilters;
  refresh?: boolean;
}

export interface PersonAppearance {
  guid: string;
  title: string;
  feedTitle: string;
  publishedDate?: string;
  role?: 'guest' | 'host';
  imageUrl?: string;
}

export interface PersonQuotesResponse {
  person: string;
  appearances: PersonAppearance[];
  candidates: TapeCandidate[];
  _meta?: TapeResponseMeta & { underlying?: Record<string, number> };
}

export async function personQuotes(req: PersonQuotesRequest): Promise<PersonQuotesResponse> {
  return tapeFetch<PersonQuotesResponse>('/api/tape/person-quotes', { method: 'POST', json: req });
}

export interface TopicQuotesFilters {
  mainstream?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  feedIds?: string[];
  minSpan?: number;
  candidatesLimit?: number;
}

export interface TopicQuotesRequest {
  query?: string;
  themes?: string[];
  filters?: TopicQuotesFilters;
  groupBy?: 'creator' | 'bull-bear' | null;
  refresh?: boolean;
}

export interface TopicQuotesGroup {
  key: string;
  candidates: TapeCandidate[];
}

export interface TopicQuotesResponse {
  query: string;
  candidates: TapeCandidate[];
  groups?: TopicQuotesGroup[];
  _meta?: TapeResponseMeta & { underlying?: Record<string, number> };
}

export async function topicQuotes(req: TopicQuotesRequest): Promise<TopicQuotesResponse> {
  return tapeFetch<TopicQuotesResponse>('/api/tape/topic-quotes', { method: 'POST', json: req });
}

export type SynthesizeKind = 'dossier' | 'brief' | 'split' | 'arc' | 'readin';

export interface SynthesizeRequest {
  kind: SynthesizeKind;
  input: {
    person?: string | null;
    personB?: string | null;
    topic?: string | null;
    ticker?: string | null;
    depth?: 'quick' | 'brief' | 'deep';
  };
  candidates: TapeCandidate[];
  model?: 'fast' | 'quality';
  stream?: false;
  refresh?: boolean;
}

export interface SynthesizeResponse {
  kind: SynthesizeKind;
  text: string;
  tokens?: { input: number; output: number };
  model?: string;
  elapsedMs?: number;
  _meta?: TapeResponseMeta;
}

export async function synthesize(req: SynthesizeRequest): Promise<SynthesizeResponse> {
  if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // Dev token-usage logger; tightened to one line per call after the response.
  }
  const res = await tapeFetch<SynthesizeResponse>('/api/tape/synthesize', { method: 'POST', json: { stream: false, ...req } });
  if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production' && res.tokens) {
    // eslint-disable-next-line no-console
    console.info(`[tape synth/${req.kind}] in=${res.tokens.input} out=${res.tokens.output} model=${res.model || '?'} ms=${res.elapsedMs || '?'}`);
  }
  return res;
}

/**
 * Map `{{clip:id}}` tokens found inside `text` back to their TapeCitation
 * forms, using the candidate pool returned by person-quotes / topic-quotes.
 * Preserves first-seen order; skips ids not present in the pool.
 */
export function resolveCitationsFromCandidates(text: string, candidates: TapeCandidate[]): TapeCitation[] {
  const byId = new Map<string, TapeCandidate>();
  for (const c of candidates) byId.set(c.pineconeId, c);
  const seen = new Set<string>();
  const out: TapeCitation[] = [];
  for (const id of extractCitationIds(text)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const c = byId.get(id);
    if (c) out.push(c);
  }
  return out;
}

/** Citation token convention shared with the agent UI. */
const CLIP_TOKEN_RE = /\{\{clip:([^}]+)\}\}/g;
export const extractCitationIds = (text: string): string[] => {
  const ids: string[] = [];
  for (const m of text.matchAll(CLIP_TOKEN_RE)) ids.push(m[1]);
  return [...new Set(ids)];
};
export const stripCitationTokens = (text: string): string => text.replace(CLIP_TOKEN_RE, '').trim();

/**
 * Run a single /api/pull turn and return the full synthesized text.
 * Tape only needs the final text (citations are embedded as tokens); tool_result
 * events carry only counts, so they're ignored. Throws QuotaExceededError on 429.
 */
export async function runPull(
  message: string,
  opts: { model?: 'quality' | 'fast'; signal?: AbortSignal } = {}
): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...getPulseHeader(),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/pull`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, model: opts.model || 'quality', stream: true }),
    signal: opts.signal,
  });

  if (res.status === 429) {
    throw new QuotaExceededError(await parseQuotaExceededResponse(res, PULL_ENTITLEMENT));
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (!res.body) throw new Error('Response body is null');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = 'message';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const payload = JSON.parse(raw);
        if (eventType === 'text_delta') text += payload.text || '';
        else if (eventType === 'text' || eventType === 'text_done') {
          if (payload.text) text = payload.text;
        } else if (eventType === 'error') {
          throw new Error(payload.error || 'Agent error');
        }
      } catch (e) {
        printLog(`[tape] failed to parse SSE data: ${raw}`);
      }
      eventType = 'message';
    }
  }
  return text;
}

/** Hydrate a single citation id into a TapeCitation via get-hierarchy. */
export async function getHierarchy(pineconeId: string, speaker?: string): Promise<TapeCitation | null> {
  try {
    const res = await fetch(`${API_URL}/api/get-hierarchy?paragraphId=${encodeURIComponent(pineconeId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const h = data.hierarchy;
    const para = h?.paragraph?.metadata;
    const ep = h?.episode?.metadata;
    return {
      pineconeId,
      text: para?.text || '',
      speaker,
      episodeTitle: ep?.title || para?.episode || 'Unknown episode',
      creator: ep?.creator || para?.creator || '',
      episodeImage: ep?.imageUrl || para?.episodeImage || '',
      audioUrl: para?.audioUrl || ep?.audioUrl || '',
      startTime: para?.start_time ?? 0,
      endTime: para?.end_time ?? 0,
      publishedDate: ep?.publishedDate || para?.publishedDate || undefined,
    };
  } catch {
    return null;
  }
}

/** Hydrate every citation token found in `text`, preserving first-seen order. */
export async function hydrateCitations(text: string): Promise<TapeCitation[]> {
  const ids = extractCitationIds(text);
  const settled = await Promise.all(ids.map(id => getHierarchy(id)));
  return settled.filter((c): c is TapeCitation => c !== null);
}

/** The one genuinely-new backend endpoint: deterministic weekly mention counts. */
export async function fetchTimeline(params: {
  topic: string;
  startDate: string;
  endDate: string;
}): Promise<{ topic: string; startDate: string; endDate: string; buckets: { weekStart: string; count: number }[]; totalMentions: number }> {
  const qs = new URLSearchParams({
    topic: params.topic,
    startDate: params.startDate,
    endDate: params.endDate,
    interval: 'week',
  });
  const res = await fetch(`${API_URL}/api/tape/timeline?${qs.toString()}`, {
    headers: { ...getPulseHeader() },
  });
  if (res.status === 429) {
    throw new QuotaExceededError(await parseQuotaExceededResponse(res, PULL_ENTITLEMENT));
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

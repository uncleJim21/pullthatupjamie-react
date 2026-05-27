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
import type { TapeCitation } from './tapeTypes.ts';

const PULL_ENTITLEMENT = 'jamie-pull';

const getAuthToken = (): string | null => localStorage.getItem('auth_token');

export const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

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

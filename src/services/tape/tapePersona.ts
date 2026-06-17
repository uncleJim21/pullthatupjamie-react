// Tape persona — read/write the user's free-text "what I'd want pulled
// out of the noise" preference.
//
// Stored as `UserPreferences.tapePersona` on the main app's preferences
// document (the same one that holds crosspost defaults, scheduled slots,
// etc.). The Tape backend reads it server-side from app_preferences with a
// 60s TTL — the FE never sends persona on per-request bodies. Writes go
// through PreferencesService.updatePreferences, which PUTs the whole
// preferences object, so we always read → merge → write to avoid clobbering
// non-Tape prefs (slots, signatures, etc.).

import { useCallback, useEffect, useState } from 'react';
import PreferencesService from '../preferencesService.ts';
import { TAPE_USING_LOCAL_BACKEND } from '../../config/tapeConfig.ts';
import { tapeFetch } from './tapeClient.ts';

const TAPE_PERSONA_FIELD = 'tapePersona';
/** Structured side-channel for the persona — the normalizer's `interpreted`
 *  groups minus whatever the user pruned via chip-X. Backend may read this
 *  directly in lieu of re-parsing the raw text on every feed call (see
 *  docs/tape-backend-persona-normalizer-memo.md, Storage option (b)). FE
 *  always writes it; backend treats it as optional. */
const TAPE_PERSONA_STRUCTURED_FIELD = 'tapePersonaStructured';
export const PERSONA_MAX_CHARS = 2000;

// ─── Normalizer (preview-only) ───────────────────────────────────────────
// Shape mirrors the backend memo. All `interpreted` arrays may be empty;
// warnings is optional; confidence is the trust signal. The endpoint does
// NOT persist — saving is still a separate PUT /api/preferences write.

export interface TapePersonaInterpreted {
  tickers: string[];
  shows: string[];
  theses: string[];
  themes: string[];
  people: string[];
}

export interface TapePersonaNormalized {
  interpreted: TapePersonaInterpreted;
  summary: string;
  normalizedText: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
}

/** Returns the normalized preview, or `null` if the endpoint failed in a
 *  way the FE should fall back from (502/504/network). Other errors
 *  (400/401/429) throw so the caller can surface them. The contract: a
 *  null return means "endpoint is degraded — save raw without preview." */
export async function normalizeTapePersona(raw: string): Promise<TapePersonaNormalized | null> {
  try {
    return await tapeFetch<TapePersonaNormalized>('/api/tape/persona/normalize', {
      method: 'POST',
      json: { raw },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/\b50[24]\b/.test(msg) || /Failed to fetch|NetworkError/i.test(msg)) {
      return null;
    }
    throw err;
  }
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; value: string; updatedAt: number }
  | { kind: 'error'; message: string };

const getAuthToken = (): string | null => localStorage.getItem('auth_token');

export interface UseTapePersonaResult {
  state: LoadState;
  /** Save a new persona string + optional structured side-channel. Returns
   *  the saved string on success; throws on failure (caller surfaces the
   *  error). The whole prefs object is round-tripped so other preference
   *  keys are preserved. Pass `structured: null` to clear the side-channel
   *  field; omit to leave it unchanged. */
  save: (next: string, structured?: TapePersonaInterpreted | null) => Promise<string>;
  /** Re-fetch from the server. Used by the drawer's "discard changes" flow
   *  and after auth state changes. */
  refresh: () => void;
  saving: boolean;
}

export function useTapePersona(): UseTapePersonaResult {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setState({ kind: 'error', message: 'Not signed in' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      // Route persona preferences traffic to the same backend Tape is
      // talking to whenever we're on a local-dev override — closes the
      // write/read loop without prod. Prod / merge: TAPE_USING_LOCAL_BACKEND
      // is false and these calls fall through to the main-app API_URL.
      const res = await PreferencesService.getPreferences(token, TAPE_USING_LOCAL_BACKEND);
      const value = (res.preferences?.[TAPE_PERSONA_FIELD] as string | undefined) || '';
      setState({ kind: 'ready', value, updatedAt: Date.now() });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load persona' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (next: string, structured?: TapePersonaInterpreted | null): Promise<string> => {
    const token = getAuthToken();
    if (!token) throw new Error('Not signed in');
    const trimmed = next.trim().slice(0, PERSONA_MAX_CHARS);
    setSaving(true);
    try {
      // Read-modify-write: PreferencesService PUTs the entire preferences
      // object, so we must merge into the current snapshot or non-Tape
      // keys (scheduled slots, signatures, etc.) get clobbered.
      const current = await PreferencesService.getPreferences(token, TAPE_USING_LOCAL_BACKEND);
      const merged: Record<string, any> = { ...current.preferences, [TAPE_PERSONA_FIELD]: trimmed };
      if (structured !== undefined) {
        merged[TAPE_PERSONA_STRUCTURED_FIELD] = structured;
      }
      const updated = await PreferencesService.updatePreferences(token, merged, TAPE_USING_LOCAL_BACKEND);
      const saved = (updated.preferences?.[TAPE_PERSONA_FIELD] as string | undefined) || trimmed;
      setState({ kind: 'ready', value: saved, updatedAt: Date.now() });
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  return { state, save, refresh: load, saving };
}

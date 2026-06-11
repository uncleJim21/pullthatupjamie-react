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

const TAPE_PERSONA_FIELD = 'tapePersona';
export const PERSONA_MAX_CHARS = 2000;

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; value: string; updatedAt: number }
  | { kind: 'error'; message: string };

const getAuthToken = (): string | null => localStorage.getItem('auth_token');

export interface UseTapePersonaResult {
  state: LoadState;
  /** Save a new persona string. Returns the saved string on success;
   *  throws on failure (caller surfaces the error). The whole prefs object
   *  is round-tripped so other preference keys are preserved. */
  save: (next: string) => Promise<string>;
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
      const res = await PreferencesService.getPreferences(token);
      const value = (res.preferences?.[TAPE_PERSONA_FIELD] as string | undefined) || '';
      setState({ kind: 'ready', value, updatedAt: Date.now() });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load persona' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (next: string): Promise<string> => {
    const token = getAuthToken();
    if (!token) throw new Error('Not signed in');
    const trimmed = next.trim().slice(0, PERSONA_MAX_CHARS);
    setSaving(true);
    try {
      // Read-modify-write: PreferencesService PUTs the entire preferences
      // object, so we must merge into the current snapshot or non-Tape
      // keys (scheduled slots, signatures, etc.) get clobbered.
      const current = await PreferencesService.getPreferences(token);
      const merged = { ...current.preferences, [TAPE_PERSONA_FIELD]: trimmed };
      const updated = await PreferencesService.updatePreferences(token, merged);
      const saved = (updated.preferences?.[TAPE_PERSONA_FIELD] as string | undefined) || trimmed;
      setState({ kind: 'ready', value: saved, updatedAt: Date.now() });
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  return { state, save, refresh: load, saving };
}

// Tape demo auth lifecycle.
//
// One shared password for the demo, exchanged via POST /api/tape/auth for a
// 30-day scoped JWT. Token lives in sessionStorage (tab-scoped, no XSS-bait
// persistence). Any /api/tape/* 401 emits an `unauthorized` event; the
// TapeAuthGate listens and re-shows the password card without a page reload.

import { API_URL } from '../../constants/constants.ts';

const STORAGE_KEY = 'tape.jwt';
const STORAGE_EXP_KEY = 'tape.jwt.exp';

export type AuthEvent = 'unauthorized';
const listeners = new Set<(e: AuthEvent) => void>();

export function getStoredToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (!token) return null;
    const exp = sessionStorage.getItem(STORAGE_EXP_KEY);
    if (exp && Date.parse(exp) < Date.now()) {
      clearStoredToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string, expiresAt: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(STORAGE_EXP_KEY, expiresAt);
  } catch {
    /* sessionStorage may be unavailable in some private-browsing modes */
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_EXP_KEY);
  } catch {
    /* noop */
  }
}

/** Attach Bearer header onto an existing headers object (immutable). */
export function attachAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  const t = getStoredToken();
  return t ? { ...headers, Authorization: `Bearer ${t}` } : headers;
}

/** Subscribe to auth events. Returns an unsubscribe fn. */
export function onAuthEvent(handler: (e: AuthEvent) => void): () => void {
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

/** Fire an auth event to all subscribers (used by tapeClient on 401). */
export function emitAuthEvent(e: AuthEvent): void {
  listeners.forEach(fn => {
    try { fn(e); } catch { /* swallow listener errors */ }
  });
}

/** Manual sign-out: clear storage + re-gate. */
export function signOut(): void {
  clearStoredToken();
  emitAuthEvent('unauthorized');
}

/** Exchange the shared password for a JWT. Throws on wrong-password / network. */
export async function requestAuth(password: string): Promise<{ token: string; expiresAt: string; scope: string }> {
  const res = await fetch(`${API_URL}/api/tape/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status === 401) {
    throw new Error('Wrong password');
  }
  if (!res.ok) {
    throw new Error(`Sign-in failed (${res.status})`);
  }
  const data = await res.json() as { token: string; expiresAt: string; scope: string };
  setStoredToken(data.token, data.expiresAt);
  return data;
}

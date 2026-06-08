import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import { getStoredToken, requestAuth, clearStoredToken, onAuthEvent } from '../../services/tape/tapeAuth.ts';

/**
 * Wraps the Tape app. Shows a centered password card unless a valid JWT lives
 * in sessionStorage. Listens for `unauthorized` events from `tapeClient` and
 * re-gates without a page reload (so 401s mid-session don't lose state).
 */
const TapeAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasToken, setHasToken] = useState<boolean>(() => !!getStoredToken());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthEvent(e => {
    if (e === 'unauthorized') {
      clearStoredToken();
      setHasToken(false);
      // Don't overwrite a fresh wrong-password error with the stale message
      setError(prev => prev || 'Your session expired. Sign in again.');
    }
  }), []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await requestAuth(password);
      setHasToken(true);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }, [password, busy]);

  if (hasToken) return <>{children}</>;

  return (
    <div className="tape-root tape-scrollbar flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="tape-fade mx-auto w-full max-w-sm">
        <h1 className="tape-serif text-center text-5xl tracking-tight" style={{ color: 'var(--tape-fg)' }}>
          {TAPE_NAME}
        </h1>
        <p className="mb-8 mt-3 text-center text-[13px]" style={{ color: 'var(--tape-fg-dim)' }}>
          Demo access. One password, shared.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="tape-search w-full px-4 py-3"
          spellCheck={false}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={!password.trim() || busy}
          className="tape-btn tape-btn--go mt-3 flex w-full items-center justify-center gap-2 px-4 py-2.5"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? 'Signing in…' : 'Enter'}
        </button>
        {error && (
          <div className="mt-3 text-center text-[12px]" style={{ color: 'var(--tape-danger)' }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default TapeAuthGate;

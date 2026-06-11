// Tape access gate.
//
// Replaces the old shared-password card (TapeAuthGate). Three branches:
//   - unauthenticated → inline Tape-skinned email/password form
//   - not-entitled    → placeholder card (Module 2 fills in request-access)
//   - entitled        → render children
//
// The gate rides the main-app session: it reuses `auth_token` from
// localStorage (written by AuthService) and listens for `tape:unauthorized`
// window events dispatched by tapeClient on any /api/tape/* 401, so token
// expiry mid-session bounces the user back to sign-in without a reload.

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import AuthService from '../../services/authService.ts';
import { notifyAuthStateChanged } from '../../hooks/useSubscriptionStatus.ts';
import {
  probeTapeEntitlement,
  requestTapeAccess,
  type TapeProblem,
  TAPE_UNAUTHORIZED_EVENT,
} from '../../services/tape/tapeClient.ts';

type GateState =
  | { kind: 'probing' }
  | { kind: 'unauthenticated'; resumeError?: string }
  | { kind: 'not-entitled'; problem: TapeProblem }
  | { kind: 'entitled' }
  | { kind: 'error'; message: string };

const initialState = (): GateState =>
  localStorage.getItem('auth_token') ? { kind: 'probing' } : { kind: 'unauthenticated' };

const TapeAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>(initialState);

  const runProbe = useCallback(async () => {
    if (!localStorage.getItem('auth_token')) {
      setState({ kind: 'unauthenticated' });
      return;
    }
    setState({ kind: 'probing' });
    const result = await probeTapeEntitlement();
    if (result.state === 'entitled') setState({ kind: 'entitled' });
    else if (result.state === 'unauthenticated') setState({ kind: 'unauthenticated' });
    else if (result.state === 'not-entitled') setState({ kind: 'not-entitled', problem: result.problem });
    else setState({ kind: 'error', message: result.error.message || 'Failed to check Tape access' });
  }, []);

  useEffect(() => { void runProbe(); }, [runProbe]);

  // Mid-session 401: token expired or revoked. tapeClient dispatches this on
  // any failed /api/tape/* call; we clear the stale token and re-gate without
  // losing the URL the user was on.
  useEffect(() => {
    const onUnauth = () => {
      try { localStorage.removeItem('auth_token'); } catch { /* noop */ }
      setState(prev =>
        prev.kind === 'unauthenticated'
          ? prev
          : { kind: 'unauthenticated', resumeError: 'Your session expired. Sign in again.' }
      );
    };
    window.addEventListener(TAPE_UNAUTHORIZED_EVENT, onUnauth);
    return () => window.removeEventListener(TAPE_UNAUTHORIZED_EVENT, onUnauth);
  }, []);

  if (state.kind === 'entitled') return <>{children}</>;
  if (state.kind === 'probing') return <ProbingScreen />;
  if (state.kind === 'unauthenticated') {
    return <SignInScreen resumeError={state.resumeError} onSuccess={runProbe} />;
  }
  if (state.kind === 'not-entitled') return <NotEntitledScreen problem={state.problem} />;
  return <ErrorScreen message={state.message} onRetry={runProbe} />;
};

export default TapeAccessGate;

// ─── Branches ────────────────────────────────────────────────────────────

const ProbingScreen: React.FC = () => (
  <div className="tape-root tape-scrollbar flex min-h-screen items-center justify-center px-5">
    <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--tape-fg-faint)' }} />
  </div>
);

type Mode = 'signin' | 'signup';

const SignInScreen: React.FC<{ resumeError?: string; onSuccess: () => void }> = ({ resumeError, onSuccess }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>(resumeError);
  const [busy, setBusy] = useState(false);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError(undefined);
    setConfirm('');
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = mode === 'signin'
        ? await AuthService.signIn(trimmedEmail, password)
        : await AuthService.signUp(trimmedEmail, password);
      // Mirror SignInModal's writes verbatim so anything in the app reading
      // squareId / authProvider / isSubscribed / subscriptionType sees the
      // same state regardless of which surface the user signed in through.
      try {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('squareId', trimmedEmail);
        localStorage.setItem('authProvider', 'email');
        if (res.subscriptionValid || res.subscriptionType) {
          localStorage.setItem('isSubscribed', 'true');
          if (res.subscriptionType) localStorage.setItem('subscriptionType', res.subscriptionType);
        } else {
          localStorage.removeItem('isSubscribed');
          localStorage.removeItem('subscriptionType');
        }
      } catch { /* private-browsing storage refusal */ }
      notifyAuthStateChanged();
      setPassword('');
      setConfirm('');
      onSuccess();
    } catch (err: any) {
      setError(err?.message || (mode === 'signin' ? 'Sign-in failed' : 'Sign-up failed'));
    } finally {
      setBusy(false);
    }
  }, [busy, email, password, confirm, mode, onSuccess]);

  const submitLabel = mode === 'signin' ? 'Enter' : 'Create account';

  return (
    <div className="tape-root tape-scrollbar flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="tape-fade mx-auto w-full max-w-sm">
        <h1 className="tape-serif text-center text-5xl tracking-tight" style={{ color: 'var(--tape-fg)' }}>
          {TAPE_NAME}
        </h1>
        <p className="mb-8 mt-3 text-center text-[13px]" style={{ color: 'var(--tape-fg-dim)' }}>
          {mode === 'signin' ? 'Sign in to read the tape.' : 'Create an account to read the tape.'}
        </p>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="tape-search mb-2 w-full px-4 py-3"
          spellCheck={false}
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="tape-search w-full px-4 py-3"
          spellCheck={false}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />
        {mode === 'signup' && (
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="tape-search mt-2 w-full px-4 py-3"
            spellCheck={false}
            autoComplete="new-password"
          />
        )}
        <button
          type="submit"
          disabled={!email.trim() || !password || busy}
          className="tape-btn tape-btn--go mt-3 flex w-full items-center justify-center gap-2 px-4 py-2.5"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating…') : submitLabel}
        </button>
        {error && (
          <div className="mt-3 text-center text-[12px]" style={{ color: 'var(--tape-danger)' }}>
            {error}
          </div>
        )}
        <div className="mt-5 text-center text-[12px]" style={{ color: 'var(--tape-fg-faint)' }}>
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="underline transition-colors hover:opacity-80"
                style={{ color: 'var(--tape-fg-dim)' }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="underline transition-colors hover:opacity-80"
                style={{ color: 'var(--tape-fg-dim)' }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

/** Not-entitled card. Renders the server-supplied RFC-7807 fields verbatim
 *  (title + detail) on top of a free-text intent textarea. Submission posts
 *  to POST /api/tape/request-access; on success the form swaps to a quiet
 *  confirmation state. If the server provides an explicit `requestAccessUrl`
 *  (e.g. a self-serve form), it surfaces as a secondary link beneath the
 *  form for users who'd rather go that route. */
const MIN_INTENT_CHARS = 12;
const MAX_INTENT_CHARS = 1000;

const NotEntitledScreen: React.FC<{ problem: TapeProblem }> = ({ problem }) => {
  const [intent, setIntent] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | undefined>();

  const handleSignOut = useCallback(() => {
    try { localStorage.removeItem('auth_token'); } catch { /* noop */ }
    window.dispatchEvent(new Event(TAPE_UNAUTHORIZED_EVENT));
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = intent.trim();
    if (trimmed.length < MIN_INTENT_CHARS || submitState === 'busy') return;
    setSubmitState('busy');
    setError(undefined);
    try {
      await requestTapeAccess(trimmed);
      setSubmitState('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit request');
      setSubmitState('idle');
    }
  }, [intent, submitState]);

  const remaining = MAX_INTENT_CHARS - intent.length;
  const canSubmit = intent.trim().length >= MIN_INTENT_CHARS && submitState !== 'busy';

  return (
    <div className="tape-root tape-scrollbar flex min-h-screen items-center justify-center px-5 py-10">
      <div className="tape-fade mx-auto w-full max-w-md">
        <h1 className="tape-serif text-center text-4xl tracking-tight" style={{ color: 'var(--tape-fg)' }}>
          {TAPE_NAME}
        </h1>
        <p className="mt-4 text-center text-[14px]" style={{ color: 'var(--tape-fg)' }}>
          {problem.title || 'Access pending'}
        </p>
        {problem.detail && (
          <p className="mt-2 text-center text-[13px]" style={{ color: 'var(--tape-fg-dim)' }}>
            {problem.detail}
          </p>
        )}

        {submitState === 'done' ? (
          <div className="mt-6 rounded border p-5 text-center" style={{ borderColor: 'var(--tape-hairline)' }}>
            <p className="text-[14px]" style={{ color: 'var(--tape-fg)' }}>
              Request received.
            </p>
            <p className="mt-2 text-[12px]" style={{ color: 'var(--tape-fg-dim)' }}>
              We'll be in touch by email once your access is granted.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6">
            <label htmlFor="tape-intent" className="block text-[12px]" style={{ color: 'var(--tape-fg-dim)' }}>
              Tell us how you'd use The Tape.
            </label>
            <textarea
              id="tape-intent"
              value={intent}
              onChange={e => setIntent(e.target.value.slice(0, MAX_INTENT_CHARS))}
              placeholder="What you trade, who you listen to, what you'd want pulled out of the noise…"
              rows={5}
              className="tape-search mt-2 w-full resize-y px-4 py-3"
              spellCheck
              autoFocus
              disabled={submitState === 'busy'}
            />
            <div className="mt-1 text-right text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
              {intent.trim().length < MIN_INTENT_CHARS
                ? `${MIN_INTENT_CHARS - intent.trim().length} more chars`
                : `${remaining} left`}
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="tape-btn tape-btn--go mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5"
            >
              {submitState === 'busy' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitState === 'busy' ? 'Sending…' : 'Request access'}
            </button>
            {error && (
              <div className="mt-3 text-center text-[12px]" style={{ color: 'var(--tape-danger)' }}>
                {error}
              </div>
            )}
          </form>
        )}

        {problem.requestAccessUrl && submitState !== 'done' && (
          <div className="mt-5 text-center">
            <a
              href={problem.requestAccessUrl}
              className="text-[12px] underline transition-colors hover:opacity-80"
              style={{ color: 'var(--tape-fg-faint)' }}
            >
              or request access another way ↗
            </a>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[12px] transition-colors hover:opacity-80"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const ErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="tape-root tape-scrollbar flex min-h-screen items-center justify-center px-5">
    <div className="tape-fade mx-auto w-full max-w-sm text-center">
      <h1 className="tape-serif text-3xl tracking-tight" style={{ color: 'var(--tape-fg)' }}>
        {TAPE_NAME}
      </h1>
      <p className="mt-5 text-[13px]" style={{ color: 'var(--tape-fg-dim)' }}>
        Couldn't reach the tape. {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="tape-btn tape-btn--go mt-5 inline-flex items-center justify-center gap-2 px-4 py-2"
      >
        retry
      </button>
    </div>
  </div>
);

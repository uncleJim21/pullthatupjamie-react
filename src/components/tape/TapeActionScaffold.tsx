import React from 'react';
import { Loader2, SearchX, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import type { TapeResponseMeta } from '../../services/tape/tapeClient.ts';

/** Labelled field wrapper — mono uppercase micro-label above a control. */
export const TapeField: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className = '',
  children,
}) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="tape-label">{label}</span>
    {children}
  </label>
);

/** Primary run control. */
export const RunButton: React.FC<{ disabled?: boolean; loading?: boolean; label?: string }> = ({
  disabled,
  loading,
  label = 'Run',
}) => (
  <button type="submit" disabled={disabled || loading} className="tape-btn tape-btn--go flex items-center gap-2 px-4 py-2">
    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
    {loading ? 'Pulling…' : label}
  </button>
);

/** Loading / empty / error states, consistent across actions. */
export const TapeStatus: React.FC<{ kind: 'loading' | 'empty' | 'error'; message: string }> = ({ kind, message }) => {
  const Icon = kind === 'loading' ? Loader2 : kind === 'empty' ? SearchX : AlertTriangle;
  return (
    <div className="flex items-center justify-center gap-2.5 px-4 py-16 text-[13px]" style={{ color: kind === 'error' ? 'var(--tape-danger)' : 'var(--tape-fg-faint)' }}>
      <Icon className={`h-4 w-4 ${kind === 'loading' ? 'animate-spin' : ''}`} />
      <span>{message}</span>
    </div>
  );
};

/** Section header used inside result views (mono uppercase tag + serif heading). */
export const SectionHead: React.FC<{ tag?: string; title: string; right?: React.ReactNode }> = ({ tag, title, right }) => (
  <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
    <div className="flex items-baseline gap-2.5">
      {tag && <span className="tape-tag px-1.5 py-0.5">{tag}</span>}
      <h3 className="tape-serif text-lg" style={{ color: 'var(--tape-fg)' }}>{title}</h3>
    </div>
    {right}
  </div>
);

/** Convert an ISO timestamp into a "12 min ago" / "3h ago" / "2d ago" label.
 *  Returns "just now" for sub-minute deltas, falls back to the raw ISO for
 *  unparseable input. */
function relativeAge(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 45) return 'just now';
  if (sec < 90) return '1 min ago';
  const min = Math.round(sec / 60);
  if (min < 45) return `${min} min ago`;
  if (min < 90) return '1h ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/**
 * Footer rendered under every action result. Surfaces backend `_meta`
 * (freshness, cache state, stale flag). Refresh affordance lives in the
 * top-right of TapeActionBar so it stays accessible without scrolling to
 * the bottom of long results.
 */
export const TapeResultFooter: React.FC<{ meta?: TapeResponseMeta }> = ({ meta }) => {
  if (!meta) return null;
  const ts = meta.fetchedAt || meta.cachedAt;
  const stale = meta.stale === true;
  return (
    <div className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px]" style={{ borderColor: 'var(--tape-hairline)', color: stale ? 'var(--tape-danger)' : 'var(--tape-fg-faint)' }}>
      {ts && <span>Updated {relativeAge(ts)}</span>}
      {meta.cached && !stale && <span>· cached</span>}
      {stale && <span>· stale{meta.staleReason ? ` (${meta.staleReason})` : ''}</span>}
    </div>
  );
};

/**
 * Action panel header bar. Back on the left (returns to the launcher),
 * Refresh on the right (re-fires the current input with `{ refresh: true }`).
 * Refresh hides when there's nothing to refresh — canon results have no
 * `_meta` so no `onRefresh` callback is wired, and idle/loading states
 * pass `undefined`.
 */
export const TapeActionBar: React.FC<{
  onBack: () => void;
  onRefresh?: () => void;
  refreshLoading?: boolean;
}> = ({ onBack, onRefresh, refreshLoading }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <button
      type="button"
      onClick={onBack}
      className="tape-btn flex items-center gap-1.5 px-2 py-1 text-[11px]"
      title="Back to launcher (Esc)"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      New search
    </button>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshLoading}
        className="tape-btn flex items-center gap-1.5 px-2 py-1 text-[11px]"
        title="Re-synthesize this result (bypass cache)"
      >
        <RefreshCw className={`h-3 w-3 ${refreshLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    )}
  </div>
);

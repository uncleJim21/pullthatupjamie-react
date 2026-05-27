import React from 'react';
import { Loader2, SearchX, AlertTriangle } from 'lucide-react';

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

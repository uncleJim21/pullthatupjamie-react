import React, { useState } from 'react';
import { Loader2, SearchX, AlertTriangle, RefreshCw, ArrowLeft, Play, Pause, Info } from 'lucide-react';
// Loader2 doubles as the audio-loading spinner for TapeInlineClip — already
// imported for TapeStatus.
import type { TapeResponseMeta } from '../../services/tape/tapeClient.ts';
import type { TapeCitation } from '../../services/tape/tapeTypes.ts';
import { useAudioController } from '../../context/AudioControllerContext.tsx';

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
 * Confidence pill — uniform across all action result headers. Renders a
 * color-coded pill matching the backend's editorial judgment of the
 * result quality:
 *   - `strong`  → green pill, positive quality signal (no popover needed
 *                 when confidenceReason is absent)
 *   - `partial` → yellow pill, click reveals confidenceReason
 *   - `thin`    → red pill, click reveals confidenceReason
 *   - `empty`   → no pill (the View's empty state handles it instead)
 *
 * Renders nothing when the backend hasn't shipped confidence yet (older
 * responses without `_meta.confidence`).
 */
export const ConfidencePill: React.FC<{ meta?: TapeResponseMeta }> = ({ meta }) => {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const c = meta?.confidence;
  if (!c || c === 'empty') return null;
  // Quiet hierarchy: strong is the only celebrated tier (accent green);
  // partial and thin step down through the foreground greyscale. Avoids the
  // red/yellow alarm semantic — these results are still informative, just
  // less data-grounded.
  const tone =
    c === 'strong' ? { border: 'var(--tape-accent)', text: 'var(--tape-accent)' }
    : c === 'partial' ? { border: 'var(--tape-fg-dim)', text: 'var(--tape-fg-dim)' }
    : { border: 'var(--tape-fg-faint)', text: 'var(--tape-fg-faint)' }; // thin
  const hasReason = !!meta?.confidenceReason;
  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => hasReason && setReasonOpen(v => !v)}
        className="tape-mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide"
        style={{
          borderColor: tone.border,
          color: tone.text,
          background: 'transparent',
          cursor: hasReason ? 'pointer' : 'default',
        }}
        title={meta?.confidenceReason || c.toUpperCase()}
        aria-label={`Confidence: ${c}`}
      >
        {c}
      </button>
      <button
        type="button"
        onClick={() => setLegendOpen(v => !v)}
        aria-label="What does this depth score mean?"
        className="rounded-full p-0.5 transition-opacity hover:opacity-100"
        style={{ color: 'var(--tape-fg-faint)', opacity: legendOpen ? 1 : 0.7 }}
      >
        <Info className="h-3 w-3" />
      </button>
      {reasonOpen && hasReason && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded border p-2.5 text-[11px] leading-relaxed shadow-lg"
          style={{ background: 'var(--tape-bg)', borderColor: 'var(--tape-hairline-strong)', color: 'var(--tape-fg-dim)' }}
        >
          <p>{meta.confidenceReason}</p>
          <button
            type="button"
            onClick={() => setReasonOpen(false)}
            className="mt-2 text-[10px] uppercase tracking-wide opacity-60 hover:opacity-100"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            close
          </button>
        </div>
      )}
      {legendOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 w-80 rounded border p-3.5 text-[12px] leading-relaxed shadow-lg"
          style={{ background: 'var(--tape-bg)', borderColor: 'var(--tape-hairline-strong)', color: 'var(--tape-fg-dim)' }}
        >
          <p className="tape-label mb-2">How we score result depth</p>
          <p>Backend's editorial read of how well-supported this result is by the underlying corpus. Surfaced so you can read quality at a glance.</p>
          <ul className="mt-3 space-y-1.5">
            <li>
              <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-accent)' }}>Strong</span>
              <span> — well-grounded in plentiful, well-distributed material.</span>
            </li>
            <li>
              <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-fg-dim)' }}>Partial</span>
              <span> — succeeded but coverage is uneven or limited.</span>
            </li>
            <li>
              <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-fg-faint)' }}>Thin</span>
              <span> — output rendered but claims are weakly supported.</span>
            </li>
            <li>
              <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-fg-faint)' }}>Empty</span>
              <span> — below threshold for meaningful synthesis (no pill — the empty state replaces the result).</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setLegendOpen(false)}
            className="mt-3 text-[10px] uppercase tracking-wide opacity-60 hover:opacity-100"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            close
          </button>
        </div>
      )}
    </span>
  );
};

/**
 * Inline playable clip pill — Tape-aesthetic counterpart to JamiePullAgent's
 * InlineCardMention. Sits inline in prose, replacing a `{{clip:id}}` token.
 * Click toggles play via the shared AudioController; visually shifts to the
 * accent color when this clip is the active track.
 */
export const TapeInlineClip: React.FC<{ citation: TapeCitation }> = ({ citation }) => {
  const { playTrack, togglePlay, currentTrack, isPlaying, isBuffering } = useAudioController();
  const isActive = currentTrack?.id === citation.pineconeId;
  const isThisPlaying = isActive && isPlaying;
  const isThisLoading = isActive && isBuffering && !isPlaying;

  const onClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isThisLoading) return;
    if (isActive) { void togglePlay(); return; }
    void playTrack({
      id: citation.pineconeId,
      audioUrl: citation.audioUrl,
      startTime: citation.startTime,
      endTime: citation.endTime,
    });
  };

  // Short label for inline density. Prefer the publisher (most users
  // recognize "Bloomberg" / "Macro Voices"); fall back to a clipped episode
  // title; final fallback is just "clip".
  const label = citation.creator || citation.episodeTitle?.slice(0, 28) || 'clip';
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(e);
      }}
      disabled={isThisLoading}
      className="tape-mono mx-0.5 inline-flex items-baseline gap-1 rounded-full border px-1.5 py-px text-[10px] align-baseline transition-colors"
      style={{
        borderColor: isActive ? 'var(--tape-accent)' : 'var(--tape-hairline-strong)',
        color: isActive ? 'var(--tape-accent)' : 'var(--tape-fg-dim)',
        background: 'transparent',
        verticalAlign: 'baseline',
      }}
      title={
        isThisLoading
          ? 'Loading…'
          : `${citation.episodeTitle || ''}${citation.creator ? ` · ${citation.creator}` : ''}`.trim()
      }
      aria-label={isThisLoading ? `Loading clip: ${label}` : `Play clip: ${label}`}
    >
      {isThisLoading
        ? <Loader2 className="h-2.5 w-2.5 translate-y-[1px] animate-spin" aria-hidden />
        : isThisPlaying
          ? <Pause className="h-2.5 w-2.5 translate-y-[1px]" aria-hidden />
          : <Play className="h-2.5 w-2.5 translate-y-[1px]" aria-hidden />}
      <span>{label}</span>
    </button>
  );
};

/**
 * Render a prose string with clip tokens replaced by inline playable pills.
 *
 * Tolerates several backend token shapes seen in the wild:
 *   - `{{clip:<pineconeId>}}`   — canonical
 *   - `{{clip=<pineconeId>}}`   — equals-sign variant (some synths emit this)
 *   - `{{clip=<integer>}}`      — short integer index, 1-based into citations
 *
 * Tokens whose id can't be resolved are dropped silently (better than
 * showing raw `{{clip=…}}` text). Returns a flat array of strings + React
 * elements suitable for a `<p>` body.
 */
export function renderProseWithClips(
  text: string,
  citations?: TapeCitation[],
): React.ReactNode[] {
  if (!text) return [];
  const lookup = new Map<string, TapeCitation>();
  if (citations) for (const c of citations) lookup.set(c.pineconeId, c);

  // Accept either `:` or `=` after `clip`. Trim the captured id since synth
  // output occasionally pads with whitespace.
  const re = /\{\{clip\s*[:=]\s*([^}]+)\}\}/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [full, rawId] = m;
    const id = rawId.trim();
    const start = m.index;
    if (start > last) out.push(text.slice(last, start));

    // 1) Direct pineconeId lookup (canonical shape).
    let cit = lookup.get(id);

    // 2) Integer-index fallback: backend sometimes emits `{{clip=11}}`,
    //    which we interpret as a 1-based index into the citations array.
    if (!cit && /^\d+$/.test(id) && citations && citations.length > 0) {
      const idx = parseInt(id, 10) - 1;
      if (idx >= 0 && idx < citations.length) cit = citations[idx];
    }

    if (cit) out.push(<TapeInlineClip key={`${id}-${start}`} citation={cit} />);
    // unresolved tokens silently drop — cleaner than raw `{{clip=…}}` visible
    last = start + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Persistent "PREVIEW" banner — shown across the whole lifetime of a
 * preview-gated action (Narrative, Dossier), including when the canon
 * result is rendered. Makes it unambiguous that the user is looking at
 * curated demo content, not the live feature.
 *
 * Optionally renders canon-example pills inline so the user can switch
 * between curated subjects at any time (before or after a result loads).
 */
export const PreviewBanner: React.FC<{
  note?: string;
  examples?: { label: string; onClick: () => void }[];
}> = ({ note = 'Curated canon only — live feature in progress.', examples }) => (
  <div
    className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded border px-3 py-2 text-[11px]"
    style={{
      borderColor: 'var(--tape-accent-dim)',
      background: 'var(--tape-accent-wash)',
      color: 'var(--tape-fg-dim)',
    }}
  >
    <span
      className="tape-mono inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider flex-shrink-0"
      style={{ borderColor: 'var(--tape-accent)', color: 'var(--tape-accent)' }}
    >
      Preview
    </span>
    <span className="flex-1 min-w-[12rem]">{note}</span>
    {examples && examples.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5">
        {examples.map(ex => (
          <button
            key={ex.label}
            type="button"
            onClick={ex.onClick}
            className="tape-pill px-2.5 py-1 text-[11px]"
          >
            {ex.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

/**
 * Preview-mode panel — shown on Narrative / Dossier when those actions are
 * gated to canon examples only. The user picks from a small list of
 * curated examples; clicking one fills inputs and triggers run() so the
 * full canon result renders normally. Free-text input is hidden until the
 * action graduates from preview.
 */
export const PreviewPanel: React.FC<{
  title: string;
  description: string;
  examples: { label: string; onClick: () => void }[];
}> = ({ title, description, examples }) => (
  <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
    <div className="tape-label mb-3" style={{ color: 'var(--tape-accent)' }}>
      Preview · coming soon
    </div>
    <h2 className="tape-serif text-4xl tracking-tight mb-4" style={{ color: 'var(--tape-fg)' }}>
      {title}
    </h2>
    <p className="mx-auto max-w-lg text-[14px] leading-relaxed mb-8" style={{ color: 'var(--tape-fg-dim)' }}>
      {description}
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="tape-label mr-1">Try</span>
      {examples.map(ex => (
        <button
          key={ex.label}
          type="button"
          onClick={ex.onClick}
          className="tape-pill px-3 py-1.5 text-[12px]"
        >
          {ex.label}
        </button>
      ))}
    </div>
  </div>
);

/** Brief-only: tiny pill that surfaces auto-widened window. Renders
 *  `30D` / `90D` next to the confidence pill when backend extended past
 *  the default 7-day brief window. */
export const WindowExpandedPill: React.FC<{ meta?: TapeResponseMeta }> = ({ meta }) => {
  if (!meta?.windowExpanded || !meta.windowDays || meta.windowDays <= 7) return null;
  return (
    <span
      className="tape-mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide"
      style={{ borderColor: 'var(--tape-accent-dim)', color: 'var(--tape-accent-dim)', background: 'transparent' }}
      title={`Default 7d window was too thin — widened to ${meta.windowDays} days.`}
    >
      {meta.windowDays}d
    </span>
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

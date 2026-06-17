// Tape persona drawer.
//
// Slide-in panel from the right with a single textarea where the user
// describes themselves — "I trade NVDA, watch Macro Voices, bearish on AI
// capex." Saved via useTapePersona (hits the main app's preferences API).
// The Tape backend reads this server-side on /api/tape/feed and uses it to
// personalize the feed + bias retrieval; the FE never re-sends it on
// per-request bodies.

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import {
  useTapePersona,
  PERSONA_MAX_CHARS,
  normalizeTapePersona,
  type TapePersonaNormalized,
} from '../../services/tape/tapePersona.ts';

const PLACEHOLDER = `e.g. I trade NVDA, AMD, COIN. Bearish AI capex into '26. Listen to Macro Voices, Odd Lots, The Compound. Care about Fed cuts, oil, semis.`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Fires after a successful save. Used by the launcher to refresh the
   *  personalized feed so the user sees the new bias take effect. */
  onSaved?: () => void;
}

const TapePersonaDrawer: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const { state, save, saving } = useTapePersona();
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [justSaved, setJustSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /** The most recent normalizer result. Tied to `previewSource` so that
   *  edits to the textarea invalidate the preview without us having to
   *  thread an extra "stale" flag. */
  const [preview, setPreview] = useState<TapePersonaNormalized | null>(null);
  /** The exact `draft` text the preview was generated against. Used to
   *  detect post-preview edits — if `draft !== previewSource`, the chips
   *  no longer represent what's in the textarea and we hide them. */
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  /** True when the last `Preview` attempt fell through the fallback (502 /
   *  network). UI explains the situation and offers a direct save. */
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  /** Chips the user has removed from the current preview. Keyed as
   *  `${group}:${item}` so re-running Preview resets them naturally (each
   *  fresh result starts with an empty removal set). */
  const [removedChips, setRemovedChips] = useState<Set<string>>(new Set());
  /** View mode for the body. `view`: show the on-file briefing as a
   *  canonical pull-quote (return-visitor default). `edit`: show the
   *  textarea. Fresh preview always overrides this and shows the preview
   *  panel. Set when the drawer opens — empty persona → straight to edit,
   *  filled persona → start in view. */
  const [mode, setMode] = useState<'view' | 'edit'>('edit');

  // Sync the textarea with the server state when the drawer opens, or when
  // the server value lands after open (e.g. opened pre-fetch). Also picks
  // the initial mode: filled briefing → start in view, empty → edit.
  useEffect(() => {
    if (!isOpen) return;
    if (state.kind === 'ready' && !dirty) {
      setDraft(state.value);
      setMode(state.value.trim().length > 0 ? 'view' : 'edit');
    }
  }, [isOpen, state, dirty]);

  // Reset transient UI on close.
  useEffect(() => {
    if (isOpen) return;
    setDirty(false);
    setError(undefined);
    setJustSaved(false);
    setPreviewing(false);
    setPreview(null);
    setPreviewSource(null);
    setPreviewUnavailable(false);
    setRemovedChips(new Set());
    setMode('edit');
  }, [isOpen]);

  // Esc closes (only when not actively saving).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !previewing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, saving, previewing, onClose]);

  const onChange = useCallback((value: string) => {
    setDraft(value.slice(0, PERSONA_MAX_CHARS));
    setDirty(true);
    setJustSaved(false);
    setError(undefined);
    setPreviewUnavailable(false);
  }, []);

  const handlePreview = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || previewing) return;
    setError(undefined);
    setPreviewUnavailable(false);
    setPreviewing(true);
    try {
      const result = await normalizeTapePersona(trimmed);
      if (result) {
        setPreview(result);
        setPreviewSource(draft);
        // Fresh preview → clear any removals tied to the previous one.
        setRemovedChips(new Set());
      } else {
        // 502 / network → memo says fall back to direct save UX.
        setPreviewUnavailable(true);
        setPreview(null);
        setPreviewSource(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to preview persona');
    } finally {
      setPreviewing(false);
    }
  }, [draft, previewing]);

  /** Strip removed items out of the preview's interpreted groups so the
   *  structured side-channel reflects what the user actually confirmed.
   *  Returns null when there's no fresh preview (drawer falls back to
   *  raw-only save). */
  const buildStructuredForSave = useCallback((): TapePersonaNormalized['interpreted'] | null => {
    if (!preview || previewSource !== draft) return null;
    const filter = (group: keyof TapePersonaNormalized['interpreted']) =>
      preview.interpreted[group].filter(item => !removedChips.has(`${group}:${item}`));
    return {
      tickers: filter('tickers'),
      shows: filter('shows'),
      people: filter('people'),
      themes: filter('themes'),
      theses: filter('theses'),
    };
  }, [preview, previewSource, draft, removedChips]);

  const handleSave = useCallback(async () => {
    setError(undefined);
    try {
      // When a fresh preview exists, the rewritten `normalizedText` IS the
      // canonical brief — that's what gets persisted. Without a preview
      // (skip path or 502 fallback), the raw draft is saved. Structured
      // side-channel goes along when present so chip removals stick.
      const structured = buildStructuredForSave();
      const textToSave = preview && previewSource === draft ? preview.normalizedText : draft;
      await save(textToSave, structured ?? undefined);
      setDirty(false);
      setJustSaved(true);
      setPreview(null);
      setPreviewSource(null);
      setPreviewUnavailable(false);
      setRemovedChips(new Set());
      setMode('view');
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to save persona');
    }
  }, [draft, preview, previewSource, save, onSaved, buildStructuredForSave]);

  /** Drop the preview and return to the textarea so the user can edit the
   *  briefing again. The textarea still holds the original raw draft, so
   *  no content is lost. */
  const handleEditAgain = useCallback(() => {
    setPreview(null);
    setPreviewSource(null);
    setRemovedChips(new Set());
    setPreviewUnavailable(false);
    setMode('edit');
  }, []);

  /** Switch from the on-file canonical view to the textarea. Used when a
   *  returning user wants to revise their saved briefing. */
  const handleStartEditing = useCallback(() => {
    setMode('edit');
  }, []);

  const toggleChipRemoved = useCallback((group: string, item: string) => {
    setRemovedChips(prev => {
      const next = new Set(prev);
      const key = `${group}:${item}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    if (saving || previewing) return;
    onClose();
  }, [saving, previewing, onClose]);

  const loading = state.kind === 'loading' || state.kind === 'idle';
  const loadError = state.kind === 'error' ? state.message : undefined;
  const remaining = PERSONA_MAX_CHARS - draft.length;
  const previewFresh = preview !== null && previewSource === draft;
  const trimmedLen = draft.trim().length;
  const canPreview = trimmedLen > 0 && !previewing && !saving && !loading && !previewFresh;
  const canSave = dirty && !saving && !loading && !previewing;

  // Portal the drawer to <body> so it lives outside any parent stacking
  // context (the tape-root + header z-20 chain was painting the backdrop on
  // top of the panel even with z-50 on the panel).
  if (typeof document === 'undefined') return null;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: isOpen ? 'auto' : 'none', background: 'transparent' }}>
      {/* backdrop */}
      <div
        onClick={handleClose}
        aria-hidden="true"
        className="absolute inset-0 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.55)', opacity: isOpen ? 1 : 0 }}
      />
      {/* panel — tape-root brings the CSS variables into scope for descendants
          (textarea, buttons, label colors all reference var(--tape-*)); inline
          styles cover the panel's own surface + border so they survive any
          load-order quirks with Tailwind. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your persona"
        className={`tape-root flex h-full w-full max-w-md flex-col transition-transform duration-200 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          background: 'var(--tape-bg)',
          color: 'var(--tape-fg)',
          borderLeft: '1px solid var(--tape-hairline-strong)',
        }}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--tape-hairline)' }}
        >
          <div>
            <div className="tape-serif text-[18px]" style={{ color: 'var(--tape-fg)' }}>
              Your briefing
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: 'var(--tape-fg-dim)' }}>
              Brief the tape. It'll work that read into every page.
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-full p-1.5 transition-opacity hover:opacity-100"
            style={{ color: 'var(--tape-fg-dim)', opacity: 0.7 }}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--tape-fg-faint)' }} />
            </div>
          )}

          {!loading && previewFresh && preview && (
            // Fresh-preview state: the preview IS the briefing the user is
            // about to commit. Textarea is tucked away. Prune chips, then
            // hand it off — or click edit to revise.
            <PreviewPanel
              preview={preview}
              removed={removedChips}
              onToggle={toggleChipRemoved}
              onEdit={handleEditAgain}
            />
          )}

          {!loading && !previewFresh && mode === 'view' && state.kind === 'ready' && state.value.trim().length > 0 && (
            // Return-visitor canonical view: the on-file briefing rendered
            // as a pull-quote with a single edit affordance. No textarea
            // until they click edit.
            <SavedBriefView text={state.value} onEdit={handleStartEditing} />
          )}

          {!loading && !previewFresh && mode === 'edit' && (
            <>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>
                Brief the tape on what you trade, who you listen to, and
                where you're skeptical. Plain language — no structure
                required. Click
                <span style={{ color: 'var(--tape-fg)' }}> Preview </span>
                to see what got written down; strike anything that isn't
                yours, then hand it off.
              </p>

              <textarea
                value={draft}
                onChange={e => onChange(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={8}
                disabled={saving || previewing}
                spellCheck
                className="tape-search mt-4 w-full resize-y px-4 py-3 text-[14px]"
              />

              <div className="mt-1 flex items-center justify-between">
                <div className="text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {preview
                    ? 'edits — preview again to update'
                    : dirty
                    ? 'unsaved changes'
                    : justSaved
                    ? 'handed off'
                    : ' '}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {remaining} left
                </div>
              </div>

              {previewUnavailable && (
                <div
                  className="mt-3 flex items-start gap-2 rounded border px-3 py-2 text-[12px]"
                  style={{ borderColor: 'var(--tape-hairline)', color: 'var(--tape-fg-dim)' }}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--tape-fg-faint)' }} />
                  <span>Preview is offline. Hand off will send your text directly.</span>
                </div>
              )}
            </>
          )}

          {!loading && (error || loadError) && (
            <div className="mt-3 text-[12px]" style={{ color: 'var(--tape-danger)' }}>
              {error || loadError}
            </div>
          )}
        </div>

        <footer
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--tape-hairline)' }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={saving || previewing}
            className="text-[12px] transition-opacity hover:opacity-80"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            {dirty ? 'discard' : 'close'}
          </button>
          {mode === 'view' && !previewFresh ? (
            // On-file canonical view — nothing to commit. The edit
            // affordance lives in the panel masthead; the footer just
            // offers a way out.
            <span aria-hidden="true" />
          ) : (
            <div className="flex items-center gap-3">
              {/* After a fresh preview, the user has already proof-read
                  what the tape took down — at that point Hand off is the
                  primary action. Before that, Preview is primary and the
                  skip-and-hand-off path is a quieter secondary. */}
              {previewFresh ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="tape-btn tape-btn--go inline-flex items-center justify-center gap-2 px-4 py-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? 'Handing off…' : 'Hand off'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="text-[12px] transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ color: 'var(--tape-fg-faint)' }}
                    title="Hand off the raw text without previewing"
                  >
                    {saving ? 'Handing off…' : 'Skip & hand off'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!canPreview}
                    className="tape-btn tape-btn--go inline-flex items-center justify-center gap-2 px-4 py-2"
                    title="Show what the tape picked up before handing it off"
                  >
                    {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {previewing ? 'Reading…' : 'Preview'}
                  </button>
                </>
              )}
            </div>
          )}
        </footer>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
};

export default TapePersonaDrawer;

// ─── On-file canonical view ─────────────────────────────────────────────
//
// Shown to a returning user when a briefing already exists. The saved text
// reads as a pull-quote — same surface treatment as the fresh PreviewPanel
// (one visual language for "the briefing the tape's working from") but
// without confidence / chips / warnings, which are properties of a live
// proof-read, not of a standing record. A single `edit` affordance in the
// masthead flips the body to the textarea.

const SavedBriefView: React.FC<{ text: string; onEdit: () => void }> = ({ text, onEdit }) => (
  <div
    className="tape-fade overflow-hidden rounded-md"
    style={{
      border: '1px solid var(--tape-hairline-strong)',
      background: 'linear-gradient(180deg, var(--tape-bg-raised) 0%, var(--tape-bg-inset) 100%)',
    }}
  >
    <div
      className="flex items-center justify-between px-5 py-3"
      style={{ borderBottom: '1px solid var(--tape-hairline)' }}
    >
      <span
        className="tape-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'var(--tape-fg-dim)' }}
      >
        On file
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="tape-mono text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-100"
        style={{ color: 'var(--tape-fg-faint)', opacity: 0.85 }}
        title="Revise the briefing"
      >
        edit
      </button>
    </div>
    <blockquote
      className="tape-serif px-5 py-5 text-[15px] italic leading-relaxed"
      style={{ color: 'var(--tape-fg)' }}
    >
      <span
        className="tape-serif mr-1 align-top text-[22px] leading-none"
        style={{ color: 'var(--tape-accent)', opacity: 0.8 }}
      >
        “
      </span>
      {text}
      <span
        className="tape-serif ml-1 align-top text-[22px] leading-none"
        style={{ color: 'var(--tape-accent)', opacity: 0.8 }}
      >
        ”
      </span>
    </blockquote>
  </div>
);

// ─── Preview panel ───────────────────────────────────────────────────────

const CONFIDENCE_COPY: Record<TapePersonaNormalized['confidence'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CONFIDENCE_TONE: Record<TapePersonaNormalized['confidence'], { color: string; bg: string }> = {
  high: { color: 'var(--tape-accent)', bg: 'var(--tape-accent-wash)' },
  medium: { color: 'var(--tape-fg-dim)', bg: 'transparent' },
  low: { color: 'var(--tape-fg-dim)', bg: 'transparent' },
};

type GroupKey = keyof TapePersonaNormalized['interpreted'];

const GROUP_ORDER: Array<{ key: GroupKey; label: string }> = [
  { key: 'tickers', label: 'Tickers' },
  { key: 'shows',   label: 'Shows' },
  { key: 'people',  label: 'People' },
  { key: 'themes',  label: 'Themes' },
  { key: 'theses',  label: 'Theses' },
];

const PreviewPanel: React.FC<{
  preview: TapePersonaNormalized;
  removed: Set<string>;
  onToggle: (group: string, item: string) => void;
  onEdit: () => void;
}> = ({ preview, removed, onToggle, onEdit }) => {
  const { interpreted, normalizedText, summary, confidence, warnings } = preview;
  const groups = GROUP_ORDER
    .map(g => ({ ...g, items: interpreted[g.key] || [] }))
    .filter(g => g.items.length > 0);
  const tone = CONFIDENCE_TONE[confidence];
  // Prefer the rewritten brief; fall back to summary if the normalizer
  // skipped the rewrite (older responses or trivial input).
  const headline = normalizedText?.trim() || summary?.trim() || '';

  return (
    <div
      className="tape-fade overflow-hidden rounded-md"
      style={{
        border: '1px solid var(--tape-hairline-strong)',
        background: 'linear-gradient(180deg, var(--tape-bg-raised) 0%, var(--tape-bg-inset) 100%)',
      }}
    >
      {/* masthead — typography + confidence + edit affordance */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--tape-hairline)' }}
      >
        <span
          className="tape-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--tape-fg-dim)' }}
        >
          What the tape took down
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="tape-mono text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-100"
            style={{ color: 'var(--tape-fg-faint)', opacity: 0.8 }}
            title="Revise the briefing"
          >
            edit
          </button>
          <span
            className="tape-mono inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
            style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.color === 'var(--tape-accent)' ? 'var(--tape-accent-line)' : 'var(--tape-hairline)'}` }}
          >
            {CONFIDENCE_COPY[confidence]}
          </span>
        </div>
      </div>

      {/* the rewrite — the canonical brief, as a pull quote */}
      {headline && (
        <blockquote
          className="tape-serif px-5 pt-4 text-[15px] italic leading-relaxed"
          style={{ color: 'var(--tape-fg)' }}
        >
          <span
            className="tape-serif mr-1 align-top text-[22px] leading-none"
            style={{ color: 'var(--tape-accent)', opacity: 0.8 }}
          >
            “
          </span>
          {headline}
          <span
            className="tape-serif ml-1 align-top text-[22px] leading-none"
            style={{ color: 'var(--tape-accent)', opacity: 0.8 }}
          >
            ”
          </span>
        </blockquote>
      )}

      {/* groups */}
      {groups.length > 0 && (
        <div className="px-5 pb-4 pt-4 space-y-3">
          {groups.map((g, idx) => (
            <div
              key={g.key}
              style={idx > 0 ? { paddingTop: 12, borderTop: '1px solid var(--tape-hairline)' } : undefined}
            >
              <div
                className="tape-mono mb-1.5 text-[9px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--tape-fg-faint)' }}
              >
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map(item => {
                  const key = `${g.key}:${item}`;
                  const isRemoved = removed.has(key);
                  return (
                    <RemovableChip
                      key={key}
                      label={item}
                      removed={isRemoved}
                      onToggle={() => onToggle(g.key, item)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* warnings */}
      {warnings && warnings.length > 0 && (
        <div
          className="px-5 py-3"
          style={{ borderTop: '1px solid var(--tape-hairline)', background: 'var(--tape-bg-inset)' }}
        >
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed"
                style={{ color: 'var(--tape-fg-dim)' }}
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: 'var(--tape-fg-faint)' }} />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const RemovableChip: React.FC<{ label: string; removed: boolean; onToggle: () => void }> = ({ label, removed, onToggle }) => {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-[11px] transition-all"
      style={{
        border: removed ? '1px dashed var(--tape-hairline)' : '1px solid var(--tape-hairline-strong)',
        color: removed ? 'var(--tape-fg-faint)' : 'var(--tape-fg)',
        background: removed ? 'transparent' : 'var(--tape-bg-raised)',
        textDecoration: removed ? 'line-through' : 'none',
        opacity: removed ? 0.55 : 1,
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={removed ? `Restore ${label}` : `Remove ${label}`}
        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors"
        style={{ color: 'var(--tape-fg-faint)' }}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
};

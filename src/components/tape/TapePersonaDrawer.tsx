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
import { Loader2, X } from 'lucide-react';
import { useTapePersona, PERSONA_MAX_CHARS } from '../../services/tape/tapePersona.ts';

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

  // Sync the textarea with the server state when the drawer opens, or when
  // the server value lands after open (e.g. opened pre-fetch).
  useEffect(() => {
    if (!isOpen) return;
    if (state.kind === 'ready' && !dirty) setDraft(state.value);
  }, [isOpen, state, dirty]);

  // Reset transient UI on close.
  useEffect(() => {
    if (isOpen) return;
    setDirty(false);
    setError(undefined);
    setJustSaved(false);
  }, [isOpen]);

  // Esc closes (only when not actively saving).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, saving, onClose]);

  const onChange = useCallback((value: string) => {
    setDraft(value.slice(0, PERSONA_MAX_CHARS));
    setDirty(true);
    setJustSaved(false);
    setError(undefined);
  }, []);

  const handleSave = useCallback(async () => {
    setError(undefined);
    try {
      await save(draft);
      setDirty(false);
      setJustSaved(true);
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to save persona');
    }
  }, [draft, save, onSaved]);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const loading = state.kind === 'loading' || state.kind === 'idle';
  const loadError = state.kind === 'error' ? state.message : undefined;
  const remaining = PERSONA_MAX_CHARS - draft.length;
  const canSave = dirty && !saving && !loading;

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
              Your persona
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: 'var(--tape-fg-dim)' }}>
              Tell the tape what matters to you.
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

          {!loading && (
            <>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>
                Sketch your trades, theses, and the voices you listen to. The Tape
                uses this to surface what's relevant and de-emphasize what isn't.
                Plain language — no structure required.
              </p>

              <textarea
                value={draft}
                onChange={e => onChange(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={10}
                disabled={saving}
                spellCheck
                className="tape-search mt-4 w-full resize-y px-4 py-3 text-[14px]"
              />

              <div className="mt-1 flex items-center justify-between">
                <div className="text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {dirty ? 'unsaved changes' : justSaved ? 'saved' : ' '}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {remaining} left
                </div>
              </div>

              {(error || loadError) && (
                <div className="mt-3 text-[12px]" style={{ color: 'var(--tape-danger)' }}>
                  {error || loadError}
                </div>
              )}
            </>
          )}
        </div>

        <footer
          className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--tape-hairline)' }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="text-[12px] transition-opacity hover:opacity-80"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            {dirty ? 'discard' : 'close'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="tape-btn tape-btn--go inline-flex items-center justify-center gap-2 px-4 py-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
};

export default TapePersonaDrawer;

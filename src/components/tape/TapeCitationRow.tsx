import React, { useEffect, useState } from 'react';
import { Play, Pause, Link2, Check, Loader2, Plus, Globe, ArrowUpRight } from 'lucide-react';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import { useTapeNowPlaying } from '../../services/tape/tapeNowPlaying.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import { formatTime, formatShortDate } from '../../utils/time.ts';
import type { TapeCitation } from '../../services/tape/tapeTypes.ts';

/**
 * Citation row — two kinds, one component:
 *   - Podcast (default): audio clip with play button, transcript quote,
 *     speaker / show / timestamp metadata.
 *   - Web (sourceType === 'web'): link card with favicon thumb that opens
 *     the source URL in a new tab, snippet quote, "Web" badge + domain +
 *     date metadata.
 * Same outer dimensions and copy/save affordances so the citation list
 * reads as one consistent component regardless of kind.
 */
const TapeCitationRow: React.FC<{ citation: TapeCitation }> = ({ citation }) => {
  const isWeb = citation.sourceType === 'web';
  const { playTrack, togglePlay, currentTrack, isPlaying, isBuffering } = useAudioController();
  const { setActive } = useTapeNowPlaying();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [saveHint, setSaveHint] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  const isActive = !isWeb && currentTrack?.id === citation.pineconeId;
  const isThisPlaying = isActive && isPlaying;
  // Show the spinner while the AudioController is between play-pressed and
  // first-byte-playing for THIS clip. Prevents "I clicked but nothing's
  // happening" confusion on slow networks / cold audio fetches.
  const isThisLoading = isActive && isBuffering && !isPlaying;

  const onPlay = () => {
    // Defensive: web citations don't have audio. The web branch renders a
    // different click target, but if anything ever wires this handler to a
    // web citation we short-circuit silently rather than feed an empty
    // audioUrl into the audio controller. Also short-circuit while
    // buffering this clip so a row-click during load doesn't restart.
    if (isWeb || !citation.audioUrl || isThisLoading) return;
    if (isActive) {
      void togglePlay();
      return;
    }
    setActive(citation);
    void playTrack({
      id: citation.pineconeId,
      audioUrl: citation.audioUrl,
      startTime: citation.startTime,
      endTime: citation.endTime,
    });
  };

  useEffect(() => {
    if (!copied && !copyError) return;
    const t = setTimeout(() => { setCopied(false); setCopyError(false); }, 1800);
    return () => clearTimeout(t);
  }, [copied, copyError]);

  useEffect(() => {
    if (!saveHint) return;
    const t = setTimeout(() => setSaveHint(false), 1800);
    return () => clearTimeout(t);
  }, [saveHint]);

  /** Podcast-only: copies a Tape internal share URL. Web rows don't show
   *  this button — the whole row is the click target instead, and a
   *  chevron at the right end advertises the affordance. */
  const onCopyLink = (e: React.MouseEvent) => {
    // Stop the click from bubbling to the row's onClick handler (which
    // toggles play). The copy-link button lives inside the row's tap
    // target on podcast rows, so without this guard a click here would
    // also start the clip.
    e.stopPropagation();
    setSaveHint(false);
    navigator.clipboard.writeText(createClipShareUrl(citation.pineconeId)).then(
      () => { setCopied(true); setCopyError(false); },
      () => { setCopyError(true); setCopied(false); }
    );
  };

  /** Web-only: open the source URL in a new tab. Hooked to the row's
   *  onClick / onKeyDown so the entire row is the click target. */
  const openWebUrl = () => {
    if (!citation.url) return;
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  };

  /** Placeholder for the future "save clip" feature. Renders the
   *  affordance now so the row layout is locked in; clicking surfaces
   *  a small inline callout pointing at what's coming. */
  const onSave = (e: React.MouseEvent) => {
    // On web rows the whole row is a click target — stop propagation
    // here so clicking save doesn't also open the URL. Cheap to call on
    // podcast rows too; no-op for them.
    e.stopPropagation();
    setCopied(false);
    setCopyError(false);
    setSaveHint(true);
  };

  // Episode title / page title moves to hover-only — it's reference
  // material, not primary read. The visible row keeps the things a reader
  // actually scans by.
  const hoverTitle = [citation.episodeTitle, citation.publishedDate ? formatShortDate(citation.publishedDate) : null]
    .filter(Boolean)
    .join(' · ');

  // Aria-label / tooltip text for the play button. Spinner / pause /
  // play states; falls back to the show name when present for context.
  const playLabel = isThisLoading
    ? 'Loading clip'
    : isThisPlaying
      ? `Pause ${citation.creator || 'clip'}`
      : `Play ${citation.creator || 'clip'} from timestamp`;
  const playTitle = isThisLoading ? 'Loading…' : isThisPlaying ? 'Pause' : 'Play from timestamp';

  // Shared row content (thumb + quote + metadata + right-side buttons).
  // Web wraps it in a clickable card; podcast renders it as a plain row.
  const rowInner = (
    <>
      {/* ─── LEFT THUMB ─────────────────────────────────────────────── */}
      {isWeb ? (
        // Web thumb — visual only. The favicon (or Globe fallback) sits
        // centered inside the same 40x40 footprint as the podcast play
        // button so the citation list stays visually aligned. No
        // overlay, no anchor — the *row* is the click target.
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{
            border: '1px solid var(--tape-hairline-strong)',
            background: 'var(--tape-bg-raised)',
            color: 'var(--tape-fg-dim)',
          }}
        >
          {citation.favicon && !faviconFailed ? (
            <img
              src={citation.favicon}
              alt=""
              loading="lazy"
              onError={() => setFaviconFailed(true)}
              className="h-5 w-5 object-contain"
            />
          ) : (
            <Globe className="h-4 w-4" />
          )}
        </div>
      ) : (
        // Podcast thumb — always-visible play button on the left. Sized
        // to be unambiguous as the primary affordance and styled with
        // the accent green when this clip is the active track.
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          disabled={isThisLoading}
          aria-label={playLabel}
          title={playTitle}
          className="tape-cite__play mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            border: `1px solid ${isActive ? 'var(--tape-accent-line)' : 'var(--tape-hairline-strong)'}`,
            background: isActive ? 'var(--tape-accent-wash)' : 'transparent',
            color: isActive ? 'var(--tape-accent)' : 'var(--tape-fg-dim)',
          }}
        >
          {isThisLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : isThisPlaying
              ? <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              : <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        {/* Quote leads the column — it's what the reader cares about
            most. 3 lines so the row stays compact. */}
        <p className="tape-quote line-clamp-3">{citation.text || '(no transcript text)'}</p>

        {/* Metadata strip below the quote. */}
        <div
          className="tape-num mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
          style={{ color: 'var(--tape-fg-faint)' }}
        >
          {isWeb ? (
            <>
              {/* "Web" badge — mono caps with accent-bordered pill so
                  users can tell curated-podcast from web at a glance.
                  Web is lower-trust by design (per backend memo). */}
              <span
                className="tape-mono inline-flex items-center rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wider"
                style={{ borderColor: 'var(--tape-accent-line)', color: 'var(--tape-accent)' }}
              >
                Web
              </span>
              <span>·</span>
              <span className="truncate max-w-[18rem]" style={{ color: 'var(--tape-fg-dim)' }}>
                {citation.creator || 'web source'}
              </span>
              {citation.publishedDate && <span>·</span>}
              {citation.publishedDate && (
                <span style={{ color: 'var(--tape-fg-faint)' }}>{formatShortDate(citation.publishedDate)}</span>
              )}
            </>
          ) : (
            <>
              {citation.speaker && (
                <span className="truncate max-w-[14rem]" style={{ color: 'var(--tape-fg-dim)' }}>{citation.speaker}</span>
              )}
              {citation.speaker && <span>·</span>}
              <span className="truncate max-w-[14rem]" style={{ color: 'var(--tape-fg-dim)' }}>{citation.creator || 'Unknown show'}</span>
              {citation.publishedDate && <span>·</span>}
              {citation.publishedDate && (
                <span style={{ color: 'var(--tape-fg-faint)' }}>{formatShortDate(citation.publishedDate)}</span>
              )}
              <span>·</span>
              <span style={{ color: 'var(--tape-accent-dim)' }}>[{formatTime(citation.startTime ?? 0)}]</span>
            </>
          )}

          {/* Podcast-only: inline copy-link button. Web rows drop this
              entirely — the whole row is the click target, advertised
              by the chevron on the right. */}
          {!isWeb && (
            <span className="relative ml-1 inline-flex">
              <button
                type="button"
                onClick={onCopyLink}
                className="inline-flex h-5 w-5 items-center justify-center transition-colors"
                style={{ color: copied ? 'var(--tape-accent)' : 'var(--tape-fg-faint)' }}
                aria-label="Copy timestamped link to quote"
                title="Copy timestamped link to quote"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              </button>
              {(copied || copyError) && (
                <ActionPill text={copyError ? "Couldn't copy — try again" : 'Link copied'} />
              )}
            </span>
          )}

          {/* Placeholder save-clip button — layout's locked in now,
              functionality lands later. The "coming soon" callout
              anchors below this button on click. Applies to both
              kinds so the row footprint is consistent. */}
          <span className="relative inline-flex">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex h-5 w-5 items-center justify-center transition-colors hover:opacity-100"
              style={{ color: 'var(--tape-fg-faint)', opacity: 0.7 }}
              aria-label="Save clip (coming soon)"
              title="Save clip (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {saveHint && <ActionPill text="Saving clips is coming soon" />}
          </span>
        </div>
      </div>

      {/* Web-only: external-link chevron on the far right. Pure visual
          affordance — the click is handled by the wrapping row. iOS
          Settings / Pocket-style row indicator: "this goes somewhere
          (external)." Picks up accent green + slides on row hover via
          the `.tape-cite__chevron` rule in tape.css. */}
      {isWeb && (
        <div className="ml-1 flex flex-shrink-0 items-center self-stretch" aria-hidden="true">
          <ArrowUpRight className="tape-cite__chevron h-4 w-4" style={{ color: 'var(--tape-fg-faint)' }} />
        </div>
      )}
    </>
  );

  // Web row: whole row is the click target. `role="link"` + keyboard
  // handler give screen-reader / keyboard users the same affordance as
  // mouse users without nesting <button>s inside an <a> (invalid HTML).
  // Inner buttons (`+`) stop propagation so they don't open the URL.
  if (isWeb) {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={openWebUrl}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openWebUrl();
          }
        }}
        aria-label={`Open ${citation.episodeTitle || citation.creator || 'source'} in a new tab`}
        title={hoverTitle || undefined}
        className="tape-cite tape-cite--web flex cursor-pointer gap-3 px-4 py-3 transition-colors"
      >
        {rowInner}
      </div>
    );
  }

  // Podcast row: whole row toggles play/pause. The visible play button
  // on the left stays as the primary visual anchor; clicking anywhere
  // not on copy-link or `+` produces the same effect. `role="button"`
  // (not link — playback isn't navigation) + Enter/Space keyboard
  // handler for a11y parity. Inner buttons stopPropagation so they
  // don't double-fire.
  const podcastRowLabel = isThisPlaying
    ? `Pause ${citation.creator || 'clip'}`
    : `Play ${citation.creator || 'clip'} from timestamp`;
  return (
    <div
      role="button"
      tabIndex={isThisLoading ? -1 : 0}
      aria-disabled={isThisLoading || undefined}
      aria-label={podcastRowLabel}
      onClick={onPlay}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isThisLoading) {
          e.preventDefault();
          onPlay();
        }
      }}
      className={`tape-cite tape-cite--podcast flex cursor-pointer gap-3 px-4 py-3 ${isActive ? 'tape-cite--active' : ''}`}
      title={hoverTitle || undefined}
    >
      {rowInner}
    </div>
  );
};

export default TapeCitationRow;

/** Tiny popover anchored directly beneath the button that triggered it.
 *  Parent must be `position: relative`. Renders as a small rounded
 *  pill, fades in via `tape-fade`. Auto-dismiss is the caller's job;
 *  this component only renders when mounted. */
const ActionPill: React.FC<{ text: string }> = ({ text }) => (
  <span
    role="status"
    aria-live="polite"
    className="tape-fade absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[10.5px] shadow-lg pointer-events-none"
    style={{
      background: 'rgba(20, 20, 20, 0.95)',
      borderColor: 'var(--tape-hairline-strong)',
      color: 'var(--tape-fg)',
    }}
  >
    {text}
  </span>
);

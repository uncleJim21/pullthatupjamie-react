import React, { useEffect, useState } from 'react';
import { Play, Pause, Link2, Check, Loader2, Plus } from 'lucide-react';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import { useTapeNowPlaying } from '../../services/tape/tapeNowPlaying.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import { formatTime, formatShortDate } from '../../utils/time.ts';
import type { TapeCitation } from '../../services/tape/tapeTypes.ts';

/**
 * Dense, verbatim citation row. The quote is monospace to signal exact
 * transcription; everything else is a tight metadata line. Plays through the
 * shared AudioControllerContext and exposes a copy-link affordance.
 */
const TapeCitationRow: React.FC<{ citation: TapeCitation }> = ({ citation }) => {
  const { playTrack, togglePlay, currentTrack, isPlaying, isBuffering } = useAudioController();
  const { setActive } = useTapeNowPlaying();
  const [copied, setCopied] = useState(false);

  const isActive = currentTrack?.id === citation.pineconeId;
  const isThisPlaying = isActive && isPlaying;
  // Show the spinner while the AudioController is between play-pressed and
  // first-byte-playing for THIS clip. Prevents "I clicked but nothing's
  // happening" confusion on slow networks / cold audio fetches.
  const isThisLoading = isActive && isBuffering && !isPlaying;

  const onPlay = () => {
    if (isActive) {
      void togglePlay();
      return;
    }
    // Surface this citation in the global mini-player at the bottom of
    // /tape. Audio playback itself is driven by AudioControllerContext;
    // this just tells the global player WHICH clip to render metadata
    // for.
    setActive(citation);
    void playTrack({
      id: citation.pineconeId,
      audioUrl: citation.audioUrl,
      startTime: citation.startTime,
      endTime: citation.endTime,
    });
  };

  // Each action button anchors its own tiny popover beneath itself when
  // recently activated. State is per-button so the link copy and the
  // save-coming-soon callouts can coexist briefly without stepping on
  // each other.
  const [copyError, setCopyError] = useState(false);
  const [saveHint, setSaveHint] = useState(false);

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

  const onCopy = () => {
    // Mutually exclusive with the save callout — clicking either
    // button immediately retires the other's pill so we never show
    // two anchored toasts on the same row at once.
    setSaveHint(false);
    navigator.clipboard.writeText(createClipShareUrl(citation.pineconeId)).then(
      () => { setCopied(true); setCopyError(false); },
      () => { setCopyError(true); setCopied(false); }
    );
  };

  /** Placeholder for the future "save clip" feature. Renders the
   *  affordance now so the row layout is locked in; clicking surfaces
   *  a small inline callout pointing at what's coming. */
  const onSave = () => {
    setCopied(false);
    setCopyError(false);
    setSaveHint(true);
  };

  // Episode title moves to hover-only — it's reference material, not
  // primary read. The visible row keeps the things a reader actually
  // scans by: speaker, show, timestamp.
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

  return (
    <div
      className={`tape-cite flex gap-3 px-4 py-3 ${isActive ? 'tape-cite--active' : ''}`}
      title={hoverTitle || undefined}
    >
      {/* Always-visible play button on the left. Sized to be unambiguous
          as the primary affordance and styled with the accent green
          when this clip is the active track (so the user can scan a
          long list and see which one's on the wire at a glance). */}
      <button
        type="button"
        onClick={onPlay}
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

      <div className="min-w-0 flex-1">
        {/* Quote leads the column — it's what the reader cares about
            most. 3 lines so the row stays compact. */}
        <p className="tape-quote line-clamp-3">{citation.text || '(no transcript text)'}</p>

        {/* Metadata strip below the quote: speaker · show · date ·
            [timestamp] [link] [+]. Buttons sit inline as the last
            tokens so they read as part of the citation line, not as a
            far-right orphan. Episode title is reachable via the row
            tooltip. Date is visible here — finance context demands
            "when was this said". */}
        <div className="tape-num mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
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
          <span style={{ color: 'var(--tape-accent-dim)' }}>[{formatTime(citation.startTime)}]</span>

          {/* Inline copy-link button — last item, attached to the
              citation line so it doesn't float at the row edge. The
              "copied" feedback is a small popover anchored directly
              beneath this button (not a global toast). */}
          <span className="relative ml-1 inline-flex">
            <button
              type="button"
              onClick={onCopy}
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

          {/* Placeholder save-clip button — layout's locked in now,
              functionality lands later. The "coming soon" callout
              anchors below this button on click. */}
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

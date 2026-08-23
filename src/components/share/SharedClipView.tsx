import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Check, Share2, Search, AlertCircle, FastForward, Radio } from 'lucide-react';
import { ClipPresentationStyle } from '../../constants/constants.ts';
import { fetchClipById } from '../../services/clipService.ts';
import { QuoteResult } from '../../types/quote.ts';
import WaveformDisc from './WaveformDisc.tsx';
import { useClipAudio } from './useClipAudio.ts';
import { T, formatClock, formatPublished, quoteType } from './shareTokens.ts';

// Standalone landing surface for one shared moment. The visitor is cold: they
// tapped a link from a chat or a social post and will decide in seconds
// whether this is worth their attention. So the clip is the whole page, the
// words are the payload, and there is exactly one way further in.

interface Props {
  clipId: string;
  /** Injected presentation style. This module renders its disc treatment for
   *  SHARE only; RESULT and EMBED keep their existing inline rendering and
   *  fall through to null here. */
  presentation: ClipPresentationStyle;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; clip: QuoteResult };

const EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';

export default function SharedClipView({ clipId, presentation }: Props) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [copied, setCopied] = useState(false);

  const isShare = presentation === ClipPresentationStyle.SHARE;

  useEffect(() => {
    if (!isShare || !clipId) return undefined;
    let cancelled = false;
    setState({ phase: 'loading' });
    fetchClipById(clipId)
      .then((clip) => {
        if (cancelled) return;
        if (!clip) {
          setState({ phase: 'error', message: 'This clip is no longer available.' });
          return;
        }
        setState({ phase: 'ready', clip });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          phase: 'error',
          message: 'This clip could not be loaded. The link may be wrong, or it may have expired.',
        });
      });
    return () => { cancelled = true; };
  }, [clipId, isShare]);

  const clip = state.phase === 'ready' ? state.clip : null;

  const audio = useClipAudio({
    audioUrl: clip?.audioUrl,
    startTime: clip?.timeContext?.start_time,
    endTime: clip?.timeContext?.end_time,
  });

  const { toggle } = audio;

  // Space and K are the transport, as in every media player, but only when the
  // visitor is not typing into or activating something else.
  useEffect(() => {
    if (!isShare) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key.toLowerCase() !== 'k') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // The center transport is a real button; let it handle its own Space.
      if (target && target.tagName === 'BUTTON' && e.key === ' ') return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isShare, toggle]);

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.href : ''),
    [],
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some embedded browsers; the native sheet below
      // is the fallback path and the URL bar always works.
    }
  }, [shareUrl]);

  const nativeShare = useCallback(() => {
    const title = clip?.episode || 'A moment from Pull That Up Jamie';
    if (navigator.share) {
      navigator.share({ title, text: clip?.quote?.slice(0, 180), url: shareUrl }).catch(() => {});
    } else {
      copyLink();
    }
  }, [clip, shareUrl, copyLink]);

  if (!isShare || !clipId) return null;

  const published = formatPublished(clip?.published || clip?.date);
  const quoteText = clip?.quote || clip?.headline || 'This moment has no transcript text.';
  const q = quoteType(quoteText);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: T.surface0,
        color: T.textMid,
        fontFamily: T.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes jamie-share-spin { to { transform: rotate(360deg); } }
        @keyframes jamie-share-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .jamie-share-rise { animation: jamie-share-rise 520ms ${EASE} both; }
        @keyframes jamie-share-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        /* Without this the skeleton is indistinguishable from an empty page
           that failed silently. */
        .jamie-share-skeleton { animation: jamie-share-pulse 1.9s ease-in-out infinite; }
        .jamie-share-stage {
          display: grid;
          gap: clamp(32px, 6vw, 72px);
          grid-template-columns: 1fr;
          align-items: center;
          /* Fill the space the header leaves and centre within it, so the
             composition sits on the optical middle instead of stacking at the
             top over a band of dead space. 'safe' keeps a tall clip from
             centring its overflow off the top edge. */
          flex: 1;
          align-content: center;
          align-content: safe center;
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: clamp(28px, 5vw, 64px) clamp(20px, 5vw, 56px) clamp(40px, 7vw, 88px);
        }
        .jamie-share-disc { width: min(78vw, 380px); justify-self: center; }
        /* Two desktop steps rather than one: at ~1024 a 440px disc starves the
           text column and breaks the action row onto a second line. */
        @media (min-width: 860px) {
          .jamie-share-stage { grid-template-columns: minmax(260px, 330px) 1fr; }
          .jamie-share-disc { width: 100%; justify-self: start; }
        }
        @media (min-width: 1200px) {
          .jamie-share-stage { grid-template-columns: minmax(300px, 440px) 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jamie-share-rise { animation: none; }
          .jamie-share-skeleton { animation: none; opacity: 0.8; }
        }
        .jamie-share-action:hover { background: rgba(248,246,242,0.07); color: ${T.textHi}; }
        .jamie-share-primary:hover { background: ${T.accentBright}; }
        .jamie-share-stage :focus-visible {
          outline: 2px solid ${T.accent};
          outline-offset: 4px;
          border-radius: 4px;
        }
      `}</style>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: 'clamp(16px, 3vw, 24px) clamp(20px, 5vw, 56px)',
          borderBottom: `1px solid ${T.hairlineSoft}`,
        }}
      >
        <a
          href="/app"
          style={{
            fontFamily: T.mono,
            fontSize: '0.6875rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.textLo,
            textDecoration: 'none',
          }}
        >
          Pull That Up Jamie
        </a>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: '0.625rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.textLo,
          }}
        >
          Shared clip
        </span>
      </header>

      {state.phase === 'error' ? (
        <ErrorState message={state.message} />
      ) : (
        <div className="jamie-share-stage">
          {state.phase === 'loading' && (
            <p role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              Loading clip
            </p>
          )}
          <div className="jamie-share-disc">
            {state.phase === 'loading' ? (
              <DiscSkeleton />
            ) : (
              <WaveformDisc
                seed={clipId}
                artworkUrl={clip?.episodeImage || clip?.tooltipImage}
                element={audio.element}
                audioUrl={clip?.audioUrl}
                isPlaying={audio.isPlaying}
                isBuffering={audio.isBuffering}
                hasEnded={audio.hasEnded}
                position={audio.position}
                duration={audio.duration}
                disabled={audio.status === 'error'}
                onToggle={audio.hasEnded ? audio.replay : audio.toggle}
                onSeek={audio.seek}
                onSeekBy={audio.seekBy}
              />
            )}
          </div>

          <div className={state.phase === 'ready' ? 'jamie-share-rise' : undefined}>
            {state.phase === 'loading' ? (
              <TextSkeleton />
            ) : (
              <>
                <p
                  style={{
                    fontFamily: T.mono,
                    fontSize: '0.6875rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: T.textLo,
                    margin: '0 0 14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0 10px',
                  }}
                >
                  <span style={{ color: T.accent }}>{clip?.creator || 'Unknown show'}</span>
                  {published && <span aria-hidden="true">/</span>}
                  {published && <span>{published}</span>}
                  {audio.duration > 0 && <span aria-hidden="true">/</span>}
                  {audio.duration > 0 && (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatClock(audio.duration)}
                    </span>
                  )}
                </p>

                <blockquote
                  style={{
                    margin: '0 0 20px',
                    fontSize: q.fontSize,
                    lineHeight: q.lineHeight,
                    letterSpacing: q.tracking,
                    fontWeight: q.weight,
                    color: T.textHi,
                    maxWidth: q.measure,
                    textWrap: 'pretty',
                  }}
                >
                  {quoteText}
                </blockquote>

                <p
                  style={{
                    margin: '0 0 clamp(28px, 4vw, 40px)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    color: T.textLo,
                    maxWidth: '56ch',
                  }}
                >
                  {clip?.episode || 'Episode title unavailable'}
                </p>

                {audio.status === 'error' && (
                  <p
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      margin: '0 0 24px',
                      fontSize: '0.875rem',
                      color: T.textMid,
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, color: T.accent }} />
                    This clip&apos;s audio would not load. The transcript above is the full moment.
                  </p>
                )}

                {audio.isExtended && (
                  <p
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      margin: '0 0 20px',
                      fontFamily: T.mono,
                      fontSize: '0.6875rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: T.accent,
                    }}
                  >
                    <Radio size={13} strokeWidth={2} />
                    Playing the full episode
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {/* Offered only once the excerpt has actually run out. Before
                      that it is an answer to a question the listener has not
                      asked yet, and it competes with the transport. */}
                  {audio.hasEnded && audio.canExtend && !audio.isExtended && audio.status !== 'error' && (
                    <button
                      type="button"
                      className="jamie-share-action"
                      onClick={audio.continueListening}
                      style={{ ...secondaryAction, borderColor: T.accent, color: T.textHi }}
                    >
                      <FastForward size={15} />
                      Keep listening
                    </button>
                  )}

                  <a
                    className="jamie-share-primary"
                    href="/app"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '11px 18px',
                      borderRadius: 999,
                      background: T.accent,
                      color: T.surface0,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: `background 180ms ${EASE}`,
                    }}
                  >
                    <Search size={15} strokeWidth={2.25} />
                    Search 1.9M moments
                  </a>

                  <button
                    type="button"
                    className="jamie-share-action"
                    onClick={copyLink}
                    style={secondaryAction}
                  >
                    {copied ? <Check size={15} /> : <Link2 size={15} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>

                  <button
                    type="button"
                    className="jamie-share-action"
                    onClick={nativeShare}
                    style={secondaryAction}
                  >
                    <Share2 size={15} />
                    Share
                  </button>
                </div>

                <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                  {copied ? 'Link copied to clipboard' : ''}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const secondaryAction: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 16px',
  borderRadius: 999,
  background: 'transparent',
  border: `1px solid ${T.hairline}`,
  color: T.textMid,
  fontSize: '0.875rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: `background 180ms ${EASE}, color 180ms ${EASE}`,
};

/** Disc-shaped skeleton rather than a spinner: the page loads into the shape
 *  it will settle into, so nothing jumps when the clip arrives. */
function DiscSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="jamie-share-skeleton"
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        border: `1px solid ${T.hairlineSoft}`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: '70%',
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          background: T.surface1,
        }}
      />
    </div>
  );
}

function TextSkeleton() {
  return (
    <div aria-hidden="true" className="jamie-share-skeleton" style={{ display: 'grid', gap: 14 }}>
      <SkeletonBar width="34%" height={11} />
      <SkeletonBar width="94%" height={26} />
      <SkeletonBar width="80%" height={26} />
      <SkeletonBar width="52%" height={26} />
      <SkeletonBar width="62%" height={13} />
    </div>
  );
}

function SkeletonBar({ width, height }: { width: string; height: number }) {
  return <div style={{ width, height, borderRadius: 4, background: T.surface1 }} />;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(40px, 10vw, 96px) 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '42ch' }}>
        <p
          style={{
            fontFamily: T.mono,
            fontSize: '0.6875rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.accent,
            margin: '0 0 14px',
          }}
        >
          Clip unavailable
        </p>
        <h1
          style={{
            fontSize: 'clamp(1.375rem, 1rem + 1.2vw, 1.75rem)',
            lineHeight: 1.3,
            fontWeight: 600,
            color: T.textHi,
            margin: '0 0 12px',
            textWrap: 'balance',
          }}
        >
          {message}
        </h1>
        <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: T.textLo, margin: '0 0 28px' }}>
          The corpus is still here: 1.9 million indexed paragraphs across 7,000 episodes.
        </p>
        <a
          className="jamie-share-primary"
          href="/app"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 18px',
            borderRadius: 999,
            background: T.accent,
            color: T.surface0,
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Search size={15} strokeWidth={2.25} />
          Search it yourself
        </a>
      </div>
    </div>
  );
}

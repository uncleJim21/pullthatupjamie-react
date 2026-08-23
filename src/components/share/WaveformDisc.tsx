import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useWaveformSource } from './useWaveformSource.ts';
import { DISC, formatClock } from './shareTokens.ts';

// The disc: episode artwork as a physical object, wrapped in a waveform ring
// that is simultaneously the visualizer, the progress readout, and the scrub
// control. Drawn on canvas because ~120 bars re-rendered at 60fps through the
// DOM would be a re-render storm; the bars never touch React state.

const BAR_COUNT = 120;

interface Props {
  seed: string;
  artworkUrl?: string;
  element: HTMLAudioElement | null;
  audioUrl?: string;
  isPlaying: boolean;
  isBuffering: boolean;
  hasEnded: boolean;
  position: number;
  duration: number;
  disabled: boolean;
  onToggle: () => void;
  onSeek: (position: number) => void;
  onSeekBy: (delta: number) => void;
}

export default function WaveformDisc({
  seed,
  artworkUrl,
  element,
  audioUrl,
  isPlaying,
  isBuffering,
  hasEnded,
  position,
  duration,
  disabled,
  onToggle,
  onSeek,
  onSeekBy,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const source = useWaveformSource({
    element,
    audioUrl,
    seed,
    barCount: BAR_COUNT,
    isPlaying,
    reducedMotion,
  });

  // The media element fires timeupdate only about four times a second, so
  // drawing `position` straight from React made the playhead visibly tick
  // between jumps. Each update is stamped instead, and the draw loop advances
  // the value by real elapsed time between stamps. The audio element stays the
  // source of truth; this only fills the gaps.
  const progressRef = useRef({ seconds: 0, stampedAt: 0 });
  progressRef.current = {
    seconds: position,
    // performance.now() shares an origin with the rAF timestamp, so the two
    // can be subtracted directly.
    stampedAt: typeof performance !== 'undefined' ? performance.now() : 0,
  };
  const readRef = useRef(source.read);
  readRef.current = source.read;
  const activeRef = useRef(isPlaying);
  activeRef.current = isPlaying;
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const amps = new Float32Array(BAR_COUNT);
    let frame = 0;
    let stopped = false;
    // When nothing is playing the bars ease to rest and then hold. Detecting
    // that lets the loop park itself instead of burning a frame budget on a
    // static image.
    let settleFrames = 0;
    let previous = new Float32Array(BAR_COUNT);

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    };

    let rect = sizeCanvas();
    const observer = new ResizeObserver(() => { rect = sizeCanvas(); });
    observer.observe(canvas);

    const draw = (time: number) => {
      if (stopped) return;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const s = Math.min(w, h) / 2;
      if (s <= 0) { frame = requestAnimationFrame(draw); return; }

      readRef.current(amps, time);
      const { seconds, stampedAt } = progressRef.current;
      // Only extrapolate while actually playing; a paused or scrubbing ring
      // must sit exactly where the audio element says it is.
      const elapsed = activeRef.current ? Math.max(0, (time - stampedAt) / 1000) : 0;
      const smoothed = Math.min(duration, seconds + elapsed);
      const progress = duration > 0 ? Math.min(1, Math.max(0, smoothed / duration)) : 0;

      ctx.clearRect(0, 0, w, h);

      const base = s * DISC.barBase;
      const maxLen = s * DISC.barMax;
      const lineWidth = Math.max(1, s * 0.012);
      ctx.lineCap = 'round';
      ctx.lineWidth = lineWidth;

      // Hairline track: gives the ring a defined outer edge so low-amplitude
      // passages still read as a machined bezel rather than a fading smudge.
      ctx.beginPath();
      ctx.strokeStyle = DISC.hairline;
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, base - s * 0.035, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = lineWidth;

      const playedBars = Math.round(progress * BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = -Math.PI / 2 + (i / BAR_COUNT) * Math.PI * 2;
        const len = maxLen * amps[i];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.beginPath();
        ctx.strokeStyle = i < playedBars ? DISC.barPlayed : DISC.barAhead;
        ctx.moveTo(cx + cos * base, cy + sin * base);
        ctx.lineTo(cx + cos * (base + len), cy + sin * (base + len));
        ctx.stroke();
      }

      // The single chromatic event on the page: the amber played arc and its
      // playhead tick.
      if (progress > 0) {
        const arcR = base - s * 0.035;
        ctx.beginPath();
        ctx.strokeStyle = DISC.accent;
        ctx.lineWidth = Math.max(1.5, s * 0.011);
        ctx.arc(cx, cy, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();

        const headAngle = -Math.PI / 2 + progress * Math.PI * 2;
        const hc = Math.cos(headAngle);
        const hs = Math.sin(headAngle);
        ctx.beginPath();
        ctx.strokeStyle = DISC.accentBright;
        ctx.lineWidth = Math.max(2, s * 0.016);
        ctx.moveTo(cx + hc * (arcR - s * 0.028), cy + hs * (arcR - s * 0.028));
        ctx.lineTo(cx + hc * (base + maxLen * 0.55), cy + hs * (base + maxLen * 0.55));
        ctx.stroke();
      }

      // Park the loop once a paused ring has finished settling.
      if (!activeRef.current) {
        let delta = 0;
        for (let i = 0; i < BAR_COUNT; i++) delta += Math.abs(amps[i] - previous[i]);
        settleFrames = delta < 0.002 ? settleFrames + 1 : 0;
      } else {
        settleFrames = 0;
      }
      previous.set(amps);
      if (settleFrames > 4) { frame = 0; return; }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    wakeRef.current = () => {
      if (!stopped && !frame) {
        settleFrames = 0;
        frame = requestAnimationFrame(draw);
      }
    };
    return () => {
      stopped = true;
      wakeRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // Restart the loop whenever a change could alter the drawing: playback
    // state, a new progress value while paused (scrubbing), or a tier change.
    // `position` is deliberately absent: it changes ~4x/sec and tearing the
    // loop down that often was itself a source of stutter. A paused seek wakes
    // the parked loop through wakeRef below instead.
  }, [isPlaying, source.tier, duration, reducedMotion]);

  // Repaint a parked (settled, paused) ring when the listener scrubs.
  useEffect(() => { wakeRef.current?.(); }, [position]);

  const seekFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // Angle measured clockwise from 12 o'clock, matching the arc's sweep.
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    onSeek((angle / (Math.PI * 2)) * duration);
  }, [duration, onSeek]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const r = Math.sqrt(dx * dx + dy * dy) / (Math.min(rect.width, rect.height) / 2);
    // Only the ring annulus scrubs. The artwork disc below it is covered by
    // the play button, and the corners outside the ring are dead space.
    if (r < DISC.ringHitInner || r > DISC.ringHitOuter) return;
    canvas.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    seekFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScrubbing) return;
    seekFromPointer(e.clientX, e.clientY);
  };

  const endScrub = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (disabled || duration <= 0) return;
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onSeekBy(step); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onSeekBy(-step); }
    else if (e.key === 'Home') { e.preventDefault(); onSeek(0); }
    else if (e.key === 'End') { e.preventDefault(); onSeek(duration); }
  };

  const showArtwork = artworkUrl && !artworkFailed;
  // A missing image becomes a generated monochrome face keyed to the clip, so
  // the composition never collapses to a hole where the artwork should be.
  const fallbackAngle = (parseInt(seed.slice(-4).replace(/\W/g, '') || '0', 36) % 360);
  const PlayIcon = hasEnded ? RotateCcw : (isPlaying ? Pause : Play);
  const iconVisible = !isPlaying || hovered || isBuffering;
  const atRest = !isPlaying && !isBuffering;

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Artwork face */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: `${(1 - DISC.artwork) * 50}%`,
          borderRadius: '50%',
          overflow: 'hidden',
          background: showArtwork
            ? DISC.artworkBed
            : `conic-gradient(from ${fallbackAngle}deg, ${DISC.fallbackA}, ${DISC.fallbackB}, ${DISC.fallbackA})`,
          boxShadow: DISC.artworkShadow,
        }}
      >
        {showArtwork && (
          <img
            src={artworkUrl}
            alt=""
            onError={() => setArtworkFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              // Playing lifts the artwork very slightly out of its resting
              // dimness: state, not decoration.
              filter: isPlaying ? 'saturate(1) brightness(1)' : 'saturate(0.9) brightness(0.86)',
              transition: 'filter 400ms cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          />
        )}
      </div>

      {/* Ring: visualizer, progress readout, and scrub control */}
      <canvas
        ref={canvasRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Clip position"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(position)}
        aria-valuetext={`${formatClock(position)} of ${formatClock(duration)}`}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={onKeyDown}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: disabled || duration <= 0 ? 'default' : (isScrubbing ? 'grabbing' : 'pointer'),
          borderRadius: '50%',
          outlineOffset: '6px',
        }}
      />

      {/* Center transport. A real button, stacked above the canvas so the
          artwork area toggles playback and the ring stays a scrubber. */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={hasEnded ? 'Replay clip' : (isPlaying ? 'Pause clip' : 'Play clip')}
        style={{
          position: 'absolute',
          inset: `${(1 - DISC.artwork) * 50}%`,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          background: iconVisible && !disabled ? DISC.transportScrim : 'transparent',
          display: 'grid',
          placeItems: 'center',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'background 220ms cubic-bezier(0.25, 1, 0.5, 1)',
          outlineOffset: '6px',
        }}
      >
        <span
          // The halo only runs before the first play, where the job is to pull
          // the eye to the one thing worth clicking.
          className={atRest && !disabled ? 'jamie-share-transport jamie-share-ping' : 'jamie-share-transport'}
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 'clamp(68px, 27%, 108px)',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            border: `1px solid ${atRest ? 'transparent' : DISC.transportEdge}`,
            background: atRest ? DISC.transportFill : DISC.transportFillPlaying,
            color: atRest ? DISC.transportGlyph : DISC.textHi,
            boxShadow: atRest ? DISC.transportShadow : 'none',
            backdropFilter: atRest ? 'none' : 'blur(6px)',
            opacity: iconVisible && !disabled ? 1 : 0,
            transform: iconVisible ? 'scale(1)' : 'scale(0.94)',
            transition: 'opacity 200ms cubic-bezier(0.25, 1, 0.5, 1), transform 200ms cubic-bezier(0.25, 1, 0.5, 1), background 220ms cubic-bezier(0.25, 1, 0.5, 1), color 220ms cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {isBuffering ? (
            <span
              style={{
                width: '32%',
                aspectRatio: '1 / 1',
                borderRadius: '50%',
                border: `2px solid ${atRest ? 'rgba(13, 12, 10, 0.25)' : DISC.transportEdge}`,
                borderTopColor: atRest ? DISC.transportGlyph : DISC.textHi,
                animation: 'jamie-share-spin 900ms linear infinite',
              }}
            />
          ) : (
            // The play glyph is optically centered, not geometrically: a
            // triangle's visual mass sits left of its bounding box.
            <PlayIcon size={26} strokeWidth={2} style={{ marginLeft: isPlaying || hasEnded ? 0 : '3px' }} />
          )}
        </span>
      </button>
    </div>
  );
}

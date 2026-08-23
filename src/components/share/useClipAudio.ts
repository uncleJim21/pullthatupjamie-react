import { useCallback, useEffect, useRef, useState } from 'react';
import { toCachedAudioUrl, isCachedAudioUrl, swapAudioExtension } from '../../utils/audioUrl.ts';

// The share surface deliberately owns a private <audio> element instead of
// going through AudioControllerContext.
//
// Reason: the circular waveform needs a Web Audio AnalyserNode, which means
// calling createMediaElementSource() on the element. That call is permanent
// (once per element, forever) and it reroutes the element's output through the
// audio graph. If the shared controller's element were ever handed a
// cross-origin URL without CORS headers afterwards — which happens, since
// audioUrl.ts passes original RSS enclosures through untouched — the graph
// would receive a tainted source and play *silence* app-wide with no way to
// undo it. Scoping the element to this standalone page keeps that hazard off
// every other playback surface.
//
// This page only ever plays one clip, so it needs far less than the shared
// controller: no track switching, no queue. It does reuse the controller's
// hard-won URL helpers (cached-host rewrite, .mp3/.m4a extension fallback).

export type ClipAudioStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ClipAudio {
  /** The private media element, or null before first render. Exposed so the
   *  analyser can attach; nothing else should write to it. */
  element: HTMLAudioElement | null;
  status: ClipAudioStatus;
  isPlaying: boolean;
  isBuffering: boolean;
  /** Seconds elapsed within the clip window, not the parent episode. */
  position: number;
  /** Length of the clip window in seconds; 0 until metadata resolves. */
  duration: number;
  hasEnded: boolean;
  /** True once the listener has released the clip boundary and is hearing the
   *  rest of the episode. */
  isExtended: boolean;
  /** Whether there is an episode beyond the clip window to continue into. */
  canExtend: boolean;
  /** Drop the clip's end boundary and keep playing into the full episode. */
  continueListening: () => void;
  toggle: () => void;
  /** Seek within the clip window, in seconds from the clip start. */
  seek: (positionInClip: number) => void;
  seekBy: (delta: number) => void;
  replay: () => void;
}

interface Options {
  audioUrl?: string;
  startTime?: number | null;
  endTime?: number | null;
}

export function useClipAudio({ audioUrl, startTime, endTime }: Options): ClipAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [element, setElement] = useState<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<ClipAudioStatus>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);
  // A share clip is a window into a much longer file. Extending releases the
  // window's end so playback runs on into the rest of the episode.
  const [isExtended, setIsExtended] = useState(false);

  // Clip window. A clip without timestamps plays the whole episode, so the
  // window start is 0 and the end is whatever metadata reports.
  const clipStart = typeof startTime === 'number' && startTime > 0 ? startTime : 0;
  const rawEnd = typeof endTime === 'number' && endTime > clipStart ? endTime : null;
  const clipEnd = isExtended ? null : rawEnd;
  const windowRef = useRef({ start: clipStart, end: clipEnd });
  windowRef.current = { start: clipStart, end: clipEnd };

  // Guards the one-shot extension retry, mirroring AudioControllerContext:
  // a genuinely-missing object fails after one alternate rather than
  // ping-ponging between .mp3 and .m4a forever.
  const triedExtensionSwapRef = useRef(false);

  useEffect(() => {
    if (!audioUrl) return undefined;

    const src = toCachedAudioUrl(audioUrl);
    const audio = new Audio();
    // Must be set before src to take effect. Only our cached host sends the
    // ACAO header the analyser needs; setting it on a third-party enclosure
    // would break playback outright, so gate on the host check.
    if (isCachedAudioUrl(src)) audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audio.src = src;

    audioRef.current = audio;
    triedExtensionSwapRef.current = false;
    setElement(audio);
    setStatus('loading');
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setHasEnded(false);
    setIsExtended(false);

    const onLoadedMetadata = () => {
      const { start, end } = windowRef.current;
      const stop = end ?? (Number.isFinite(audio.duration) ? audio.duration : 0);
      setDuration(Math.max(0, stop - start));
      if (start > 0 && Math.abs(audio.currentTime - start) > 0.25) {
        try { audio.currentTime = start; } catch { /* seek before seekable */ }
      }
      setStatus('ready');
    };

    const onTimeUpdate = () => {
      const { start, end } = windowRef.current;
      setPosition(Math.max(0, audio.currentTime - start));
      // Clips are a window into a longer file, so the element's own 'ended'
      // event usually never fires. Stop at the window edge ourselves.
      if (end !== null && audio.currentTime >= end) {
        audio.pause();
        setIsPlaying(false);
        setHasEnded(true);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setHasEnded(true);
    };

    const onError = () => {
      const alt = !triedExtensionSwapRef.current ? swapAudioExtension(audio.src) : null;
      if (alt) {
        triedExtensionSwapRef.current = true;
        audio.src = alt;
        try { audio.load(); } catch { /* ignore */ }
        return;
      }
      setStatus('error');
      setIsPlaying(false);
      setIsBuffering(false);
    };

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true); };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setElement(null);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const { start, end } = windowRef.current;
    const stop = end ?? audio.duration;
    setDuration(Math.max(0, stop - start));
  }, [isExtended]);

  const seek = useCallback((positionInClip: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const { start, end } = windowRef.current;
    const span = end !== null
      ? end - start
      : (Number.isFinite(audio.duration) ? audio.duration - start : 0);
    const clamped = Math.max(0, Math.min(positionInClip, span));
    try { audio.currentTime = start + clamped; } catch { return; }
    setPosition(clamped);
    if (clamped < span) setHasEnded(false);
  }, []);

  const seekBy = useCallback((delta: number) => {
    seek(position + delta);
  }, [position, seek]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const { start, end } = windowRef.current;
    // Restarting after the clip window finished should rewind, not resume
    // silently past the end of the excerpt.
    if (end !== null && audio.currentTime >= end - 0.05) {
      try { audio.currentTime = start; } catch { /* ignore */ }
      setPosition(0);
    }
    setHasEnded(false);
    setIsBuffering(true);
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
      .finally(() => setIsBuffering(false));
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  const replay = useCallback(() => {
    seek(0);
    play();
  }, [seek, play]);

  const continueListening = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsExtended(true);
    setHasEnded(false);
    // windowRef is rewritten on the next render, but playback has to resume
    // now, on the click, or the browser treats it as un-gestured autoplay.
    windowRef.current = { ...windowRef.current, end: null };
    if (Number.isFinite(audio.duration)) {
      setDuration(Math.max(0, audio.duration - windowRef.current.start));
    }
    setIsBuffering(true);
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
      .finally(() => setIsBuffering(false));
  }, []);

  return {
    element,
    status,
    isPlaying,
    isBuffering,
    position,
    duration,
    hasEnded,
    isExtended,
    canExtend: rawEnd !== null,
    continueListening,
    toggle,
    seek,
    seekBy,
    replay,
  };
}

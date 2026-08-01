import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toCachedAudioUrl, isCachedAudioUrl, swapAudioExtension } from '../utils/audioUrl.ts';

export interface AudioTrack {
  id: string;
  audioUrl: string;
  startTime?: number;
  endTime?: number;
}

interface AudioControllerState {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
}

interface AudioController extends AudioControllerState {
  playTrack: (track: AudioTrack) => Promise<void>;
  loadTrack: (track: AudioTrack) => void;
  togglePlay: () => Promise<void>;
  pause: () => void;
  seekTo: (time: number) => void;
  seekBy: (delta: number) => void;
  stop: () => void;
}

const AudioControllerContext = createContext<AudioController | null>(null);

export const AudioControllerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const pendingStartTimeRef = useRef<number | null>(null);
  // Monotonic counter to bail out of stale playTrack invocations if a newer
  // call supersedes them (e.g. user taps a second result while the first is
  // still waiting for metadata to load).
  const playSequenceRef = useRef(0);
  // Latest track (for its seek target on an error-fallback reload) and whether
  // the user intends playback (so a fallback resumes only when they were
  // playing, not on a passive loadTrack).
  const currentTrackRef = useRef<AudioTrack | null>(null);
  const wantsPlayRef = useRef(false);
  // Guards the one-shot .mp3/.m4a extension fallback: set true when we retry
  // the alternate extension, reset only when a new track src is set
  // deliberately — so a genuinely-missing object fails after one retry instead
  // of ping-ponging between extensions forever.
  const didExtFallbackRef = useRef(false);

  const loadTrack = useCallback((track: AudioTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);
    currentTrackRef.current = track;
    wantsPlayRef.current = false;
    setIsPlaying(false);
    setIsBuffering(false);
    pendingStartTimeRef.current =
      typeof track.startTime === 'number' ? track.startTime : null;

    // Route playback through the cached Cloudflare host (see toCachedAudioUrl).
    const src = toCachedAudioUrl(track.audioUrl);
    if (audio.src !== src) {
      didExtFallbackRef.current = false;
      audio.src = src;
    }

    // If metadata is already available, apply start time immediately
    if (
      pendingStartTimeRef.current !== null &&
      audio.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      try {
        audio.currentTime = pendingStartTimeRef.current;
        setCurrentTime(pendingStartTimeRef.current);
        pendingStartTimeRef.current = null;
      } catch {
        // Ignore seek errors; onLoadedMetadata will retry
      }
    }
  }, []);

  const playInternal = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      wantsPlayRef.current = true;
      setIsBuffering(true);
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Shared audio play error:', err);
      setIsPlaying(false);
    } finally {
      setIsBuffering(false);
    }
  }, []);

  const playTrack = useCallback(
    async (track: AudioTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      const sequence = ++playSequenceRef.current;

      setCurrentTrack(track);
      currentTrackRef.current = track;
      wantsPlayRef.current = true;
      setIsPlaying(false);
      setIsBuffering(true);

      const desiredStart =
        typeof track.startTime === 'number' ? track.startTime : null;
      pendingStartTimeRef.current = desiredStart;

      // Route playback through the cached Cloudflare host (see toCachedAudioUrl).
      const src = toCachedAudioUrl(track.audioUrl);
      const isNewSrc = audio.src !== src;
      if (isNewSrc) {
        didExtFallbackRef.current = false;
        audio.src = src;
        // Some mobile browsers won't begin loading until load() is called,
        // which delays the loadedmetadata event we need before seeking.
        try { audio.load(); } catch { /* ignore */ }
      }

      // Apply the seek BEFORE calling play() so playback always begins at the
      // requested timestamp. Without this, on slow/mobile networks audio.play()
      // resolves while readyState < HAVE_METADATA, so playback briefly starts
      // at currentTime=0 (the start of the podcast) before loadedmetadata fires
      // and the deferred seek snaps to the clip's start.
      if (desiredStart !== null) {
        if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
          await new Promise<void>((resolve) => {
            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', onLoaded);
              audio.removeEventListener('error', onError);
            };
            const onLoaded = () => { cleanup(); resolve(); };
            const onError = () => { cleanup(); resolve(); };
            audio.addEventListener('loadedmetadata', onLoaded);
            audio.addEventListener('error', onError);
          });
        }

        // Bail out if a newer playTrack call superseded this one while we
        // were awaiting metadata; otherwise we'd seek the wrong track.
        if (sequence !== playSequenceRef.current) return;

        try {
          audio.currentTime = desiredStart;
          setCurrentTime(desiredStart);
        } catch {
          // Ignore seek errors; the loadedmetadata handler still has the
          // pendingStartTimeRef as a backup.
        }
        pendingStartTimeRef.current = null;
      }

      if (sequence !== playSequenceRef.current) return;

      try {
        await audio.play();
        if (sequence !== playSequenceRef.current) return;
        setIsPlaying(true);
      } catch (err) {
        console.error('Shared audio play error:', err);
        if (sequence === playSequenceRef.current) {
          setIsPlaying(false);
        }
      } finally {
        if (sequence === playSequenceRef.current) {
          setIsBuffering(false);
        }
      }
    },
    []
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    await playInternal();
  }, [isPlaying, playInternal]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    wantsPlayRef.current = false;
    audio.pause();
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = Math.max(0, time);
      setCurrentTime(audio.currentTime);
    } catch {
      // Ignore seek errors
    }
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo(audio.currentTime + delta);
    },
    [seekTo]
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // ignore
    }
    pendingStartTimeRef.current = null;
    currentTrackRef.current = null;
    wantsPlayRef.current = false;
    didExtFallbackRef.current = false;
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Listen for global "stopAllAudio" events (e.g., when a new search starts)
  useEffect(() => {
    const handler = () => stop();
    window.addEventListener('stopAllAudio', handler);
    return () => window.removeEventListener('stopAllAudio', handler);
  }, [stop]);

  // Listen for global "playAudioTrack" events (so non-player UI can trigger playback)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AudioTrack>).detail;
      if (!detail?.id || !detail?.audioUrl) return;
      void playTrack({
        id: detail.id,
        audioUrl: detail.audioUrl,
        startTime: detail.startTime,
        endTime: detail.endTime,
      });
    };
    window.addEventListener('playAudioTrack', handler);
    return () => window.removeEventListener('playAudioTrack', handler);
  }, [playTrack]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);

    if (
      pendingStartTimeRef.current !== null &&
      audio.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      try {
        audio.currentTime = pendingStartTimeRef.current;
        setCurrentTime(pendingStartTimeRef.current);
      } catch {
        // Ignore
      } finally {
        pendingStartTimeRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  // Media failed to load (e.g. a transition-period extension mismatch: metadata
  // says .mp3 but the object was re-encoded to .m4a). Try the alternate audio
  // extension exactly once — only for our own cached host, so external
  // enclosures aren't touched. See swapAudioExtension / didExtFallbackRef.
  const handleError = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const failed = audio.src;
    if (didExtFallbackRef.current || !isCachedAudioUrl(failed)) return;
    const alt = swapAudioExtension(failed);
    if (!alt) return;

    didExtFallbackRef.current = true;
    // Restore the clip's seek target; playTrack may have cleared it after the
    // failed load. handleLoadedMetadata re-applies it once the alt src loads.
    const startTime = currentTrackRef.current?.startTime;
    if (typeof startTime === 'number') pendingStartTimeRef.current = startTime;

    audio.src = alt;
    try { audio.load(); } catch { /* ignore */ }
    if (wantsPlayRef.current) {
      setIsBuffering(true);
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
        .finally(() => setIsBuffering(false));
    }
  };

  const value: AudioController = {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playTrack,
    loadTrack,
    togglePlay,
    pause,
    seekTo,
    seekBy,
    stop,
  };

  return (
    <AudioControllerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />
    </AudioControllerContext.Provider>
  );
};

export const useAudioController = (): AudioController => {
  const ctx = useContext(AudioControllerContext);
  if (!ctx) {
    throw new Error('useAudioController must be used within AudioControllerProvider');
  }
  return ctx;
};



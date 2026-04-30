import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

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

  const loadTrack = useCallback((track: AudioTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTrack(track);
    setIsPlaying(false);
    setIsBuffering(false);
    pendingStartTimeRef.current =
      typeof track.startTime === 'number' ? track.startTime : null;

    if (audio.src !== track.audioUrl) {
      audio.src = track.audioUrl;
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
      setIsPlaying(false);
      setIsBuffering(true);

      const desiredStart =
        typeof track.startTime === 'number' ? track.startTime : null;
      pendingStartTimeRef.current = desiredStart;

      const isNewSrc = audio.src !== track.audioUrl;
      if (isNewSrc) {
        audio.src = track.audioUrl;
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



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
      loadTrack(track);
      await playInternal();
    },
    [loadTrack, playInternal]
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



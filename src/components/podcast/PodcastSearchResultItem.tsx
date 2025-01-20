import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Share2, Play, Pause, Loader, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { formatTime, getTimestampedUrl } from '../../utils/time.ts';

interface PodcastSearchResultItemProps {
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  similarity: {
      combined: number;
      vector: number;
  }
  timeContext: {
    start_time: number;
    end_time: number;
  };
  episodeImage?: string;
  listenLink?: string;
  id: string;
  isPlaying: boolean;
  onPlayPause: (id: string) => void;
  onEnded: (id: string) => void;
  shareUrl:string;
}

export const PodcastSearchResultItem = ({
  quote,
  episode,
  creator,
  audioUrl,
  date,
  similarity,
  timeContext,
  episodeImage = '/podcast-logo.png',
  listenLink,
  id,
  isPlaying,
  onPlayPause,
  onEnded,
  shareUrl
}: PodcastSearchResultItemProps) => {
  const [currentTime, setCurrentTime] = useState(timeContext.start_time);
  const [showCopied, setShowCopied] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false); // Image loading state
  const [hasEnded, setHasEnded] = useState(false);
  const [isContinuingBeyondClip, setIsContinuingBeyondClip] = useState(false);

  const audioRef = useRef(null as HTMLAudioElement | null);
  const progressRef = useRef(null as HTMLDivElement | null);

  const duration = timeContext.end_time - timeContext.start_time;
  const progress = isContinuingBeyondClip 
  ? 100  // Always show full progress when continuing beyond clip
  : Math.min(((currentTime - timeContext.start_time) / duration) * 100, 100);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (!isPlaying) {
          setIsBuffering(true);
          onPlayPause(id); // Notify parent component to handle playback state
          audioRef.current.currentTime = timeContext.start_time;
          await audioRef.current.play();
          setIsBuffering(false);
        } else {
          audioRef.current.pause();
          onPlayPause(id); // Notify parent component to handle pause state
        }
      } catch (error) {
        console.error('Playback error:', error);
        setIsBuffering(false);
      }
    }
  };


  const handleProgressClick = (e: { clientX: number }) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = timeContext.start_time + duration * clickPosition;
  
      if (newTime < timeContext.start_time) {
        audioRef.current.currentTime = timeContext.start_time;
        setCurrentTime(timeContext.start_time);
      } else if (newTime > timeContext.end_time) {
        audioRef.current.currentTime = timeContext.end_time;
        setCurrentTime(timeContext.end_time);
      } else {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleListen = () => {
    if (listenLink) {
      window.open(listenLink, '_blank');
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleRestart = async () => {
    if (audioRef.current) {
      setHasEnded(false);
      try {
        audioRef.current.currentTime = timeContext.start_time;
        setCurrentTime(timeContext.start_time);
        await audioRef.current.play();
        onPlayPause(id);
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };
  
  const handleContinuePlaying = async () => {
    if (audioRef.current) {
      setHasEnded(false);
      setIsContinuingBeyondClip(true); // Allow playback beyond the clip segment
      try {
        await audioRef.current.play();
        onPlayPause(id);
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentAudioTime = audioRef.current.currentTime;
      setCurrentTime(currentAudioTime);
  
      if (currentAudioTime < timeContext.start_time) {
        // Ensure progress bar reads 0 if playback is rewinded before the clip
        setCurrentTime(timeContext.start_time);
        audioRef.current.currentTime = timeContext.start_time;
      }
  
      if (currentAudioTime >= timeContext.end_time && !hasEnded && !isContinuingBeyondClip) {
        // Pause playback when clip segment ends and show rewind/continue options
        setHasEnded(true);
        audioRef.current.pause();
        onEnded(id);
      }
    }
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
      <div className="border-b border-gray-800 bg-[#0A0A0A] p-4">
        <div className="flex flex-col sm:flex-row">
          {/* Episode Artwork */}
          <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
            {!imageLoaded && (
              <div className="w-32 h-32 rounded-md mx-auto sm:mx-0 border border-gray-700 bg-gray-800 animate-pulse" />
            )}
            <img
              src={episodeImage}
              alt={episode}
              className={`w-32 h-32 rounded-md mx-auto sm:mx-0 border border-gray-700 ${
                imageLoaded ? 'block' : 'hidden'
              }`}
              onLoad={() => setImageLoaded(true)} // Set image loaded state
              onError={() => setImageLoaded(false)} // Handle image loading failure
            />
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex flex-col sm:flex-row justify-between">
              <div className="min-w-0 mb-2 sm:mb-0">
                <h3 className="text-lg font-medium text-white line-clamp-4">
                  {episode}
                </h3>
                <p className="text-sm text-gray-400">{creator}</p>
              </div>
              <div className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 sm:ml-4">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  <p>{!showCopied ? 'Share' : 'Copied!'}</p>
                </button>
                <button
                  onClick={handleListen}
                  disabled={!listenLink}
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm ${
                    listenLink
                      ? 'text-gray-300 hover:bg-gray-800 transition-colors'
                      : 'text-gray-600'
                  }`}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  <p>Listen</p>
                </button>
              </div>
            </div>

            {/* Mini Player */}
            <div className="mt-4 pl-0">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = timeContext.start_time;
                    setCurrentTime(timeContext.start_time);
                  }
                  onEnded(id);
                }}
              />
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {hasEnded && !isContinuingBeyondClip ? (
                  // Rewind and Continue buttons at clip end
                  <>
                    <button
                      onClick={handleRestart}
                      className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                      title="Restart from clip beginning"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={handleContinuePlaying}
                      className="p-2 rounded-full text-black transition-colors hover:bg-gray-200 bg-white"
                      title="Continue playing beyond clip"
                    >
                      <Play size={16} />
                    </button>
                  </>
                ) : (
                  // Regular playback controls
                  <>
                    <button
                      onClick={() => handleSkip(-15)}
                      className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                      title="Back 15 seconds"
                    >
                      <SkipBack size={16} />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className={`p-2 rounded-full text-black transition-colors ${
                        audioUrl === 'URL unavailable'
                          ? 'bg-gray-700'
                          : 'hover:bg-gray-200 bg-white'
                      }`}
                      disabled={audioUrl === 'URL unavailable'}
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isBuffering ? (
                        <Loader className="animate-spin" size={16} />
                      ) : isPlaying ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSkip(15)}
                      className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                      title="Forward 15 seconds"
                    >
                      <SkipForward size={16} />
                    </button>
                  </>
                )}
              </div>
              {/* Progress Bar */}
              <div
                ref={progressRef}
                className="flex-grow h-1 bg-gray-700 rounded cursor-pointer"
                onClick={handleProgressClick}
              >
                <div
                  className={`h-full ${
                    isContinuingBeyondClip ? 'bg-green-500' : 'bg-white'
                  } rounded transition-all`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Timestamps */}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatTime(currentTime)} /{' '}
                {isContinuingBeyondClip
                  ? formatTime(audioRef.current?.duration || timeContext.end_time)
                  : formatTime(timeContext.end_time)}
              </span>
            </div>

            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="text-sm text-gray-300 bg-[#0A0A0A] p-3 rounded-md">
          {quote}
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
                Similarity: {(similarity.combined).toFixed(3)}
                {similarity.vector !== similarity.combined && (
                    <span className="ml-2 text-gray-600">
                        (Vector: {(similarity.vector).toFixed(3)})
                    </span>
                )}
            </span>
          <span>
            {formatTime(timeContext.start_time)} - {formatTime(timeContext.end_time)}
          </span>
        </div>
      </div>
    </div>
  );
};

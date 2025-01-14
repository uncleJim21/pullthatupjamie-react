// components/podcast/PodcastSearchResultItem.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Share2, Play, Pause } from 'lucide-react';
import { formatTime,getTimestampedUrl } from '../../utils/time.ts';

interface PodcastSearchResultItemProps {
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  similarity: number;
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
}

export const PodcastSearchResultItem: React.FC<PodcastSearchResultItemProps> = ({
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
  onEnded
}) => {
  const [currentTime, setCurrentTime] = useState(timeContext.start_time);
  const [showCopied, setShowCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const duration = timeContext.end_time - timeContext.start_time;
  const progress = ((currentTime - timeContext.start_time) / duration) * 100;

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (!isPlaying) {
          onPlayPause(id);
          audioRef.current.currentTime = timeContext.start_time;
          await audioRef.current.play();
        } else {
          audioRef.current.pause();
          onPlayPause(id);
        }
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    
    const currentAudioTime = audioRef.current.currentTime;
    setCurrentTime(currentAudioTime);
    
    if (currentAudioTime >= timeContext.end_time) {
      audioRef.current.pause();
      setCurrentTime(timeContext.start_time);
      audioRef.current.currentTime = timeContext.start_time;
      onEnded(id);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = timeContext.start_time + (duration * clickPosition);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleShare = async () => {
    const shareUrl = getTimestampedUrl(audioUrl, timeContext.start_time);
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

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
      <div className="border-b border-gray-800 bg-[#0A0A0A] p-4">
        <div className="flex flex-col sm:flex-row">
          {/* Episode Artwork */}
          <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
            <img
              src={episodeImage}
              alt={episode}
              className="w-32 h-32 rounded-md mx-auto sm:mx-0 border border-gray-700"
            />
          </div>

          <div className="flex-grow min-w-0"> {/* Added min-w-0 to enable text truncation */}
            <div className="flex flex-col sm:flex-row justify-between">
              <div className="min-w-0 mb-2 sm:mb-0"> {/* Added min-w-0 container */}
                <h3 className="text-lg font-medium text-white line-clamp-4">
                  {episode}
                </h3>
                <p className="text-sm text-gray-400">
                  {creator}
                </p>
              </div>
              <div className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 sm:ml-4">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  <p>{!showCopied ? "Share" : "Copied!"}</p>
                </button>
                <button
                  onClick={handleListen}
                  disabled={!listenLink}
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm ${
                    listenLink ? "text-gray-300 hover:bg-gray-800 transition-colors" : "text-gray-600"
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
                <button
                  onClick={handlePlayPause}
                  className={`p-2 rounded-full text-black transition-colors ${
                    audioUrl === "URL unavailable" ? "bg-gray-700" : "hover:bg-gray-200 bg-white"
                  }`}
                  disabled={audioUrl === "URL unavailable"}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div 
                  ref={progressRef}
                  className="flex-grow h-1 bg-gray-700 rounded cursor-pointer"
                  onClick={handleProgressClick}
                >
                  <div 
                    className="h-full bg-white rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(timeContext.end_time)}
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
          <span>Similarity: {(similarity * 100).toFixed(1)}%</span>
          <span>
            {formatTime(timeContext.start_time)} - {formatTime(timeContext.end_time)}
          </span>
        </div>
      </div>
    </div>
  );
};
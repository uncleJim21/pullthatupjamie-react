// components/podcast/PodcastSearchResultItem.tsx
import React, { useState, useRef } from 'react';
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
  artworkUrl?: string; // New field for episode artwork
}

export const PodcastSearchResultItem: React.FC<PodcastSearchResultItemProps> = ({
  quote,
  episode,
  creator,
  audioUrl,
  date,
  similarity,
  timeContext,
  artworkUrl = '/podcast-logo.png' // Default placeholder
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(timeContext.start_time);
  const [showCopied, setShowCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const duration = timeContext.end_time - timeContext.start_time;
  const progress = ((currentTime - timeContext.start_time) / duration) * 100;

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.currentTime = timeContext.start_time;
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.currentTime >= timeContext.end_time) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentTime(timeContext.start_time);
      }
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
    const timestamp = Math.floor(timeContext.start_time);
    const shareUrl = getTimestampedUrl(audioUrl,timeContext.start_time);
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
      <div className="border-b border-gray-800 bg-[#0A0A0A] p-4">
        <div className="flex items-start">
          {/* Episode Artwork */}
          {/* <div className="flex-shrink-0 mr-4">
            <Image
              src={artworkUrl}
              alt={episode}
              width={64}
              height={64}
              className="rounded-md"
            />
          </div> */}

          <div className="flex-grow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-white">{episode}</h3>
                <p className="text-sm text-gray-400">
                  {creator} • {new Date(date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </button>
                {showCopied && (
                  <span className="text-sm text-green-400">Copied!</span>
                )}
              </div>
            </div>

            {/* Mini Player */}
            <div className="mt-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayPause}
                  className="p-2 rounded-full bg-white text-black hover:bg-gray-200 transition-colors"
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
                <span className="text-xs text-gray-400">
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
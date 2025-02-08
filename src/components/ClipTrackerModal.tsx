import React, { useState, useEffect } from 'react';
import { Check, Loader2, ChevronDown, ChevronUp, Clock, Scissors } from 'lucide-react';
interface ClipHistoryItem {
  creator: string;
  episode: string;
  timestamps: number[];
  cdnLink?: string;
  clipId: string;
  episodeImage: string;
  timestamp: number;
  id: string;
  lookupHash:string;
}

interface ClipTrackerModalProps {
  creator: string;
  episode: string;
  timestamps: number[];
  cdnLink?: string;
  clipId: string;
  episodeImage: string;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  lookupHash?: string;
}

export default function ClipTrackerModal({
  creator,
  episode,
  episodeImage,
  timestamps,
  cdnLink,
  clipId,
  isCollapsed,
  onCollapsedChange,
  lookupHash
}: ClipTrackerModalProps) {
  const [clipHistory, setClipHistory] = useState<ClipHistoryItem[]>([]);
  const [isHistoryShown, setIsHistoryShown] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('clipHistory');
    if (savedHistory) {
      setClipHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('clipHistory', JSON.stringify(clipHistory));
  }, [clipHistory]);

  // Update history when new clip arrives or existing clip updates
  useEffect(() => {
    // Only proceed if we have both clipId and lookupHash
    if (!clipId || !lookupHash) return;

    setClipHistory(prev => {
      // Find existing item by lookupHash
      const existingIndex = prev.findIndex(item => item.lookupHash === lookupHash);

      // Create new history item
      const updatedItem: ClipHistoryItem = {
        creator,
        episode,
        timestamps,
        cdnLink,
        clipId,
        episodeImage,
        timestamp: Date.now(),
        id: existingIndex >= 0 ? prev[existingIndex].id : Math.random().toString(36).substr(2, 9),
        lookupHash  // Now this is guaranteed to exist
      };

      // If item exists, update it and move to top
      if (existingIndex >= 0) {
        const newHistory = [...prev];
        newHistory.splice(existingIndex, 1);
        return [updatedItem, ...newHistory];
      }

      // If it's a new item, add it to the start
      return [updatedItem, ...prev];
    });
  }, [clipId, cdnLink, creator, episode, timestamps, episodeImage, lookupHash]);

  return (
    <div className={`fixed z-50 transition-all duration-300 ease-in-out
      xl:right-4 xl:bottom-24 xl:w-[22.5rem] xl:px-0 xl:left-auto xl:transform-none
      left-1/2 -translate-x-1/2 mx-auto w-full max-w-[40rem] px-4
      ${isCollapsed ? 'bottom-[12.0rem]' : 'bottom-[13.0rem]'}`}
    >
      {/* Current Clip */}
      <div className="bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow">
      <button
        onClick={() => onCollapsedChange(!isCollapsed)}
        className="w-full h-12 flex items-center justify-center hover:bg-gray-800/30 transition-colors"
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1">
            <ChevronUp className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-1 text-gray-200 text-sm">
              <Scissors className="h-4 w-4" />
              <span>Clips</span>
            </div>
          </div>
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
  
        <div className={`transition-all duration-300 ease-in-out overflow-hidden
          ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}
        >
          {/* Current clip content */}
          <div className="flex items-start space-x-4">
            <div className="ml-2 mb-2 mt-2 w-24 h-24 rounded-lg bg-zinc-800 flex-shrink-0 border border-gray-800 overflow-hidden">
              <img 
                src={episodeImage} 
                alt={creator}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0 mt-2">
              <h3 className="text-lg font-semibold text-white truncate">
                {creator}
              </h3>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {episode}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Timestamps: {timestamps.map(t => formatTime(t)).join(' - ')}
              </p>
            </div>
  
            <div className="flex-shrink-0">
              {cdnLink ? (
                <div 
                  onClick={() => cdnLink && window.open(cdnLink, '_blank')}
                  className="w-8 h-8 rounded-full flex items-center justify-center pt-10 mr-4 mt-4 cursor-pointer hover:opacity-80"
                >
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center pt-10 mr-4 mt-4">
                  <Loader2 className="w-12 h-12 text-white-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
  
          {cdnLink && (
            <div className="mt-4">
              <a
                href={cdnLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#111111] hover:bg-[#1A1A1A] text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
              >
                View Clip
              </a>
            </div>
          )}
        </div>
      </div>
  
      {/* History Toggle */}
      {clipHistory.length > 0 && !isCollapsed && (
        <button
          onClick={() => setIsHistoryShown(!isHistoryShown)}
          className="w-full mt-2 px-4 py-2 bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg 
                    text-gray-300 hover:bg-gray-800/30 transition-colors flex items-center justify-between shadow-white-glow"
        >
          <span>{isHistoryShown ? 'Hide History' : 'Show History'}</span>
          <Clock className="w-4 h-4" />
        </button>
      )}
  
      {/* History Items */}
      {isHistoryShown && !isCollapsed && (
        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
          {clipHistory.map(item => (
            <div
              key={item.id}
              onClick={() => item.cdnLink && window.open(item.cdnLink, '_blank')}
              className={`bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg p-3 
                        flex items-center space-x-3 ${
                          item.cdnLink ? 'cursor-pointer hover:border-gray-600 hover:bg-gray-800/30 relative group' : ''
                        }`}
            >
              <img
                src={item.episodeImage}
                alt={item.creator}
                className="w-12 h-12 rounded-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {item.creator}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {item.episode}
                </p>
                <p className="text-xs text-gray-500">
                  Timestamps: {item.timestamps.map(t => formatTime(t)).join(' - ')}
                </p>
              </div>
              {item.cdnLink ? (
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface ClipTrackerModalProps {
  creator: string;
  episode: string;
  timestamps: number[];
  cdnLink?: string;
  clipId: string;
  episodeImage: string;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function ClipTrackerModal({
  creator,
  episode,
  episodeImage,
  timestamps,
  cdnLink,
  clipId,
  isCollapsed,
  onCollapsedChange
}: ClipTrackerModalProps) {

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeDisplay = timestamps.length >= 2 
    ? `${formatTime(timestamps[0])} - ${formatTime(timestamps[1])}` 
    : '';

    return (
      <div className={`
        fixed z-50 transition-all duration-300 ease-in-out
        xl:right-4 xl:bottom-24 xl:w-[22.5rem] xl:px-0 xl:left-auto xl:transform-none
        left-1/2 -translate-x-1/2 mx-auto w-full max-w-[40rem] px-4
        ${isCollapsed ? 'bottom-[12.0rem]' : 'bottom-[13.0rem]'}
      `}>
        <div className="bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow">
          <button
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="w-full h-8 flex items-center justify-center hover:bg-gray-800/30 transition-colors"
          >
            {isCollapsed ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
    
          <div 
            className={`
              transition-all duration-300 ease-in-out
              ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}
              overflow-hidden
            `}
          >
          <div className="flex items-start space-x-4">
            <div className="ml-2 mb-2 mt-2 w-24 h-24 rounded-lg bg-zinc-800 flex-shrink-0 border border-gray-800 overflow-hidden">
              <img 
                src={`${episodeImage}`} 
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
                Timestamps: {timeDisplay}
              </p>
            </div>

            <div className="flex-shrink-0">
              {cdnLink ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center pt-10 mr-4 mt-4">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full  flex items-center justify-center pt-10 mr-4 mt-4">
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
    </div>
  );
}
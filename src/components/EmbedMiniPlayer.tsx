import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Play, Podcast, RotateCcw, RotateCw, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useAudioController } from '../context/AudioControllerContext.tsx';
import { HIERARCHY_COLORS } from '../constants/constants.ts';

interface EmbedMiniPlayerProps {
  // Rendering mode:
  // - embed: existing behavior (hover-gated, audio unlock prompt)
  // - app: narrow-screen player (always visible controls; optional expand/collapse)
  mode?: 'embed' | 'app';
  // Hover state for embed mode
  isHovered: boolean;
  // Audio unlock state (controlled from parent)
  audioUnlocked: boolean;
  brandImage?: string;
  // Audio context
  audioUrl?: string;
  episodeTitle?: string;
  episodeImage?: string;
  creator?: string;
  timeContext?: {
    start_time: number;
    end_time: number;
  };
  // Result context for display
  quote?: string;
  summary?: string;
  headline?: string;
  hierarchyLevel?: 'feed' | 'episode' | 'chapter' | 'paragraph';
  // Navigation callbacks
  onPrevious?: () => void;
  onNext?: () => void;
  // Unique track ID
  trackId: string;

  // Optional expand/collapse affordance (app mode)
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const EmbedMiniPlayer: React.FC<EmbedMiniPlayerProps> = ({
  mode = 'embed',
  isHovered,
  audioUnlocked,
  brandImage,
  audioUrl,
  episodeTitle,
  episodeImage,
  creator,
  timeContext,
  quote,
  summary,
  headline,
  hierarchyLevel = 'paragraph',
  onPrevious,
  onNext,
  trackId,
  isExpanded,
  onExpandChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    currentTrack,
    isPlaying: controllerIsPlaying,
    isBuffering: controllerIsBuffering,
    currentTime: controllerCurrentTime,
    duration: controllerDuration,
    playTrack,
    togglePlay,
    pause,
    seekBy,
  } = useAudioController();

  const isTrackActive = currentTrack?.id === trackId;
  const isPlaying = isTrackActive && controllerIsPlaying;
  const isBuffering = isTrackActive && controllerIsBuffering;
  const currentTime = isTrackActive && controllerCurrentTime ? controllerCurrentTime : (timeContext?.start_time || 0);
  
  // Track image errors per episode to prevent hiding on subsequent selections
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const lastEpisodeImageRef = useRef<string | undefined>(undefined);
  
  // Reset image error state when episode image changes
  useEffect(() => {
    if (episodeImage !== lastEpisodeImageRef.current) {
      setImageError(false);
      setImageLoaded(false);
      lastEpisodeImageRef.current = episodeImage;
    }
  }, [episodeImage]);

  // Auto-play when track changes AND user is hovering AND audio is unlocked (embed mode only)
  const autoPlayKeyRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (mode !== 'embed') return;
    if (!audioUrl || !timeContext || !isHovered || !audioUnlocked) {
      // Pause if user leaves
      if (!isHovered && isPlaying) {
        pause();
      }
      return;
    }
    
    const key = `${trackId}-${timeContext.start_time}-${timeContext.end_time}`;
    
    // Only auto-play if this is a new track (haven't played this exact clip yet)
    if (autoPlayKeyRef.current === key) return;
    
    console.log('[EmbedMiniPlayer] Auto-playing new track:', trackId);
    autoPlayKeyRef.current = key;
    
    void playTrack({
      id: trackId,
      audioUrl: audioUrl,
      startTime: timeContext.start_time,
      endTime: timeContext.end_time,
    });
  }, [mode, trackId, audioUrl, timeContext, playTrack, isHovered, isPlaying, pause, audioUnlocked]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const handlePlayPause = async () => {
    if (!audioUrl) return;
    
    try {
      if (!isTrackActive) {
        await playTrack({
          id: trackId,
          audioUrl: audioUrl,
          startTime: timeContext?.start_time || 0,
          endTime: timeContext?.end_time,
        });
      } else {
        await togglePlay();
      }
    } catch (err) {
      console.error('Embed mini player playback error:', err);
      pause();
    }
  };

  // Get hierarchy color
  const getHierarchyColor = () => {
    switch (hierarchyLevel) {
      case 'feed': return HIERARCHY_COLORS.FEED;
      case 'episode': return HIERARCHY_COLORS.EPISODE;
      case 'chapter': return HIERARCHY_COLORS.CHAPTER;
      case 'paragraph': return HIERARCHY_COLORS.PARAGRAPH;
      default: return HIERARCHY_COLORS.PARAGRAPH;
    }
  };

  // Determine what text to display
  const displayText = headline || summary || quote || 'No description available';

  // Expose the rendered player height as a CSS variable so other overlays (e.g. attribution pill)
  // can position themselves above it without overlapping.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setHeightVar = (height: number) => {
      // Clamp to a sane minimum to avoid 0 during initial layout.
      const safeHeight = Math.max(64, Math.round(height));
      // Legacy: embed attribution and other overlays depend on this.
      document.documentElement.style.setProperty('--embed-mini-player-height', `${safeHeight}px`);
      // General: used by the main app on narrow screens too.
      document.documentElement.style.setProperty('--mini-player-height', `${safeHeight}px`);
    };

    // Initial measurement
    setHeightVar(el.getBoundingClientRect().height);

    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const height = entry?.contentRect?.height ?? el.getBoundingClientRect().height;
      setHeightVar(height);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-gray-700 z-30"
    >
      <div className="max-w-screen-xl mx-auto px-4 py-3">
        {mode === 'embed' && (!isHovered || !audioUnlocked) ? (
          // Not hovering OR audio not unlocked - show brand logo and message
          <div className="flex items-center justify-center gap-4 py-2 cursor-pointer hover:bg-white/5 transition-colors rounded-lg">
            {brandImage && (
              <img
                src={brandImage}
                alt="Brand Logo"
                className="h-12 w-auto object-contain rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="text-center">
              <p className="text-lg font-medium text-white">
                {audioUnlocked ? 'Hover to play' : 'Click or tap to play'}
              </p>
              <p className="text-xs text-gray-400">
                {audioUnlocked ? 'Explore podcast moments' : 'Unlock audio playback'}
              </p>
            </div>
          </div>
        ) : (
          // Hovering - show full player
          <div className="flex items-center gap-4">
          {/* Episode Image - Simple responsive sizing focused on mobile */}
          <div className="flex-shrink-0">
            {episodeImage && !imageError ? (
              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded overflow-hidden relative bg-gray-800">
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gray-800 animate-pulse" />
                )}
                <img
                  src={episodeImage}
                  alt={episodeTitle || 'Episode'}
                  className={`w-full h-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
                  decoding="async"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    console.log('[EmbedMiniPlayer] Image failed to load:', episodeImage);
                    setImageError(true);
                  }}
                />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded bg-gray-800 flex items-center justify-center">
                <Podcast className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
              </div>
            )}
          </div>

          {/* Content Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Hierarchy indicator */}
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: getHierarchyColor(),
                  boxShadow: `0 0 4px 1px ${getHierarchyColor()}`,
                }}
              />
              <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider">
                {hierarchyLevel}
              </p>
            </div>
            
            <h3 className="text-xs md:text-sm font-medium text-white line-clamp-1 mb-0.5">
              {episodeTitle || 'Episode'}
            </h3>
            
            {creator && (
              <p className="text-[10px] md:text-xs text-gray-500 line-clamp-1">
                {creator}
              </p>
            )}
            
            <p className="text-[10px] md:text-xs text-gray-400 line-clamp-2 mt-1">
              {displayText}
            </p>
          </div>

          {/* Playback Controls - Responsive sizing */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {/* Expand/collapse (app mode) */}
            {mode === 'app' && typeof onExpandChange === 'function' && (
              <div className="flex justify-end">
                <button
                  onClick={() => onExpandChange(!isExpanded)}
                  className="h-8 w-14 md:h-10 md:w-[68px] mb-1 flex items-center justify-center rounded-md border border-gray-700 text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Info className="w-4 h-4" />
                      <ChevronUp className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>
            )}
            {/* Row 1: Play and Time */}
            <div className="flex gap-2 md:gap-3 items-center">
              <button
                onClick={handlePlayPause}
                disabled={!audioUrl}
                className={`h-8 w-8 md:h-11 md:w-11 flex items-center justify-center rounded-full text-black transition-colors ${
                  !audioUrl
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-200'
                }`}
              >
                {isBuffering ? (
                  <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-black" />
                ) : isPlaying ? (
                  <span className="text-xs md:text-sm font-semibold">||</span>
                ) : (
                  <Play className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              <span className="text-[10px] md:text-sm text-gray-400 min-w-[36px] md:min-w-[52px] text-right font-mono">
                {formatTime(currentTime)}
              </span>
            </div>
            
            {/* Row 2: Skip Back | Skip Forward */}
            <div className="flex gap-1 md:gap-1.5">
              <button
                onClick={() => isTrackActive && seekBy(-5)}
                disabled={!isTrackActive || !audioUrl}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="Back 5 seconds"
              >
                <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={() => isTrackActive && seekBy(5)}
                disabled={!isTrackActive || !audioUrl}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="Forward 5 seconds"
              >
                <RotateCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
            
            {/* Row 3: Previous Track | Next Track */}
            <div className="flex gap-1 md:gap-1.5">
              <button
                onClick={onPrevious}
                disabled={!onPrevious}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="Previous track"
              >
                <ChevronsLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={onNext}
                disabled={!onNext}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="Next track"
              >
                <ChevronsRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default EmbedMiniPlayer;

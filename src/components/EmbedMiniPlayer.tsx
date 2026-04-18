import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Play, Podcast, RotateCcw, RotateCw, Link as LinkIcon, Check } from 'lucide-react';
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
  /** Episode publish date — ISO string, timestamp, or any Date-parseable value.
   *  When provided, rendered as "<creator> | <Month D YYYY>" on the creator line. */
  publishedDate?: string | number;
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
  // Compact height mode: hide non-essential UI for very short viewports
  isCompactHeight?: boolean;
  // Optional: copy shareable link to clipboard
  onCopyLink?: () => void;
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
  publishedDate,
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
  isCompactHeight = false,
  onCopyLink,
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
  const [linkCopied, setLinkCopied] = useState(false);
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
  
  // Auto-play logic for embed mode
  // Once audio is unlocked (user clicked), we don't pause on mouse leave anymore.
  // The hover detection is only needed to work around browser autoplay policies.
  useEffect(() => {
    if (mode !== 'embed') return;
    
    // Need audio unlocked and track info to play
    if (!audioUrl || !timeContext || !audioUnlocked) {
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
  }, [mode, trackId, audioUrl, timeContext, playTrack, audioUnlocked]);

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

  // Format publish date as "Month D YYYY" (no comma) for the creator pipe.
  // Accepts ISO strings, unix seconds, or unix ms. Returns '' if the value
  // can't be parsed so we silently skip the pipe rather than show "Invalid Date".
  const formatPublishedDate = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return '';
    let d: Date;
    if (typeof value === 'number') {
      d = new Date(value < 1e12 ? value * 1000 : value);
    } else {
      const asNum = Number(value);
      if (!Number.isNaN(asNum) && /^\d+$/.test(value.trim())) {
        d = new Date(asNum < 1e12 ? asNum * 1000 : asNum);
      } else {
        d = new Date(value);
      }
    }
    if (Number.isNaN(d.getTime())) return '';
    return d
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      .replace(',', '');
  };
  const formattedDate = formatPublishedDate(publishedDate);

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

  const showHandle = mode === 'app' && typeof onExpandChange === 'function';

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-gray-700 z-30"
    >
      {/* Wide tap handle — full-width sheet-style expand/collapse */}
      {showHandle && (
        <button
          onClick={() => onExpandChange!(!isExpanded)}
          className="w-full flex items-center justify-center pt-2 pb-1 active:bg-white/5 transition-colors touch-manipulation"
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? (
            <ChevronDown className="w-8 h-5 text-gray-400" strokeWidth={2.5} />
          ) : (
            <ChevronUp className="w-8 h-5 text-gray-400" strokeWidth={2.5} />
          )}
        </button>
      )}

      <div className={`max-w-screen-xl mx-auto px-4 ${isCompactHeight ? 'py-1.5' : showHandle ? 'pt-0 pb-3' : 'py-3'}`}>
        {mode === 'embed' && !audioUnlocked ? (
          <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 cursor-pointer hover:bg-white/5 transition-colors rounded-lg">
            {brandImage && (
              <img
                src={brandImage}
                alt="Brand Logo"
                className="h-8 sm:h-12 w-auto max-w-[120px] sm:max-w-[180px] object-contain rounded flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="text-center flex-shrink-0">
              <p className="text-base sm:text-lg font-medium text-white">
                Click or tap to play
              </p>
              <p className="text-xs text-gray-400">
                Unlock audio playback
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Episode Image */}
            <div className="flex-shrink-0">
              {episodeImage && !imageError ? (
                <div className={`rounded overflow-hidden relative bg-gray-800 ${
                  isCompactHeight ? 'w-10 h-10' : 'w-12 h-12 sm:w-16 sm:h-16'
                }`}>
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
                <div className={`rounded bg-gray-800 flex items-center justify-center ${
                  isCompactHeight ? 'w-10 h-10' : 'w-12 h-12 sm:w-16 sm:h-16'
                }`}>
                  <Podcast className={isCompactHeight ? 'w-5 h-5 text-gray-600' : 'w-6 h-6 sm:w-8 sm:h-8 text-gray-600'} />
                </div>
              )}
            </div>

            {/* Content Info — takes the lion's share */}
            <div className="flex-1 min-w-0">
              {!isCompactHeight && mode !== 'embed' && (
                <div className="flex items-center gap-2 mb-0.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getHierarchyColor(),
                      boxShadow: `0 0 4px 1px ${getHierarchyColor()}`,
                    }}
                  />
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {hierarchyLevel}
                  </p>
                </div>
              )}
              
              <h3 className={`font-medium text-white line-clamp-1 ${isCompactHeight ? 'text-[10px]' : 'text-xs sm:text-sm mb-0.5'}`}>
                {episodeTitle || 'Episode'}
              </h3>
              
              {(creator || formattedDate) && (
                <p className={`text-gray-500 line-clamp-1 ${isCompactHeight ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}>
                  {creator}
                  {creator && formattedDate && <span className="text-gray-600"> | </span>}
                  {formattedDate}
                </p>
              )}
              
              {!isCompactHeight && (
                <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-2 mt-1">
                  {displayText}
                </p>
              )}
            </div>

            {/* Playback Controls — right-side column */}
            <div className={`flex flex-col items-center flex-shrink-0 ${isCompactHeight ? 'gap-0.5' : 'gap-1.5'}`}>
              {/* Play + Time */}
              <div className="flex items-center gap-2">
                {onCopyLink && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyLink();
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 1500);
                    }}
                    className={`flex items-center justify-center rounded-full transition-colors touch-manipulation ${
                      isCompactHeight ? 'h-6 w-6' : 'h-7 w-7'
                    } ${linkCopied ? 'text-green-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                    title={linkCopied ? 'Copied!' : 'Copy link'}
                  >
                    {linkCopied ? (
                      <Check className={isCompactHeight ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    ) : (
                      <LinkIcon className={isCompactHeight ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                  disabled={!audioUrl}
                  className={`flex items-center justify-center rounded-full text-black transition-colors touch-manipulation ${
                    isCompactHeight ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11'
                  } ${
                    !audioUrl
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-white hover:bg-gray-200'
                  }`}
                >
                  {isBuffering ? (
                    <div className={`animate-spin rounded-full border-b-2 border-black ${isCompactHeight ? 'h-3 w-3' : 'h-4 w-4'}`} />
                  ) : isPlaying ? (
                    <span className={`font-semibold ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>||</span>
                  ) : (
                    <Play className={isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} />
                  )}
                </button>
                <span className={`text-gray-400 text-right font-mono ${isCompactHeight ? 'text-[9px] min-w-[32px]' : 'text-[10px] sm:text-sm min-w-[36px] sm:min-w-[48px]'}`}>
                  {formatTime(currentTime)}
                </span>
              </div>

              {/* Seek -5s / +5s — always shown, smaller in compact mode */}
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); isTrackActive && seekBy(-5); }}
                  disabled={!isTrackActive || !audioUrl}
                  className={`rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation ${
                    isCompactHeight ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
                  }`}
                  title="Back 5 seconds"
                >
                  <RotateCcw className={isCompactHeight ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); isTrackActive && seekBy(5); }}
                  disabled={!isTrackActive || !audioUrl}
                  className={`rounded text-white transition-colors hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation ${
                    isCompactHeight ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
                  }`}
                  title="Forward 5 seconds"
                >
                  <RotateCw className={isCompactHeight ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
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

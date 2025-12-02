import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Podcast, ChevronDown, ChevronUp, Play, ScanSearch } from 'lucide-react';
import ContextService, { AdjacentParagraph, HierarchyResponse } from '../services/contextService.ts';
import ChapterService, { Chapter } from '../services/chapterService.ts';
import { printLog, HIERARCHY_COLORS } from '../constants/constants.ts';
import { KeywordTooltip } from './KeywordTooltip.tsx';
import { handleQuoteSearch } from '../services/podcastService.ts';
import { AuthConfig } from '../constants/constants.ts';

enum ViewMode {
  CONTEXT = 'context',
  CHAPTER = 'chapter'
}

interface ViewHistoryItem {
  mode: ViewMode;
  selectedChapter?: Chapter | null;
}

interface PodcastContextPanelProps {
  paragraphId: string | null;
  isOpen: boolean;
  onClose: () => void;
  smartInterpolation?: boolean;
  onTimestampClick?: (timestamp: number) => void;
  onKeywordSearch?: (keyword: string, feedId?: string, episodeName?: string, forceSearchAll?: boolean) => void;
  auth?: AuthConfig;
  // Optional audio context for standalone playback (e.g. Galaxy view)
  audioUrl?: string;
  episodeTitle?: string;
  episodeImage?: string;
  creator?: string;
  listenLink?: string;
  timeContext?: {
    start_time: number;
    end_time: number;
  };
  date?: string;
}

const PodcastContextPanel: React.FC<PodcastContextPanelProps> = ({
  paragraphId,
  isOpen,
  onClose,
  smartInterpolation = true,
  onTimestampClick,
  onKeywordSearch,
  auth,
  audioUrl,
  episodeTitle,
  episodeImage,
  creator,
  listenLink,
  timeContext,
  date
}) => {
  const [paragraphs, setParagraphs] = useState<AdjacentParagraph[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number>(0);
  const [imageError, setImageError] = useState(false);
  const [episodeChapters, setEpisodeChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CONTEXT);
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([{ mode: ViewMode.CONTEXT }]);
  const [openTooltipKeyword, setOpenTooltipKeyword] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Local audio player state for contexts like Galaxy view
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioBuffering, setIsAudioBuffering] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number | null>(null);

  // Navigation functions for view history
  const pushView = (mode: ViewMode, chapter?: Chapter | null) => {
    setViewMode(mode);
    setViewHistory(prev => [...prev, { mode, selectedChapter: chapter }]);
  };

  const popView = () => {
    if (viewHistory.length <= 1) return;
    
    const newHistory = [...viewHistory];
    newHistory.pop(); // Remove current view
    const previousView = newHistory[newHistory.length - 1];
    
    setViewHistory(newHistory);
    setViewMode(previousView.mode);
    setSelectedChapter(previousView.selectedChapter || null);
  };

  const canGoBack = viewHistory.length > 1;

  // Fetch data when paragraphId changes
  useEffect(() => {
    printLog(`PodcastContextPanel effect - paragraphId: ${paragraphId}, isOpen: ${isOpen}`);
    
    if (!paragraphId || !isOpen) {
      printLog(`Skipping fetch - paragraphId or isOpen is false`);
      return;
    }

    // Reset image error state when fetching new data
    setImageError(false);

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      printLog(`Starting fetch for paragraphId: ${paragraphId}`);

      try {
        // Fetch both adjacent paragraphs and hierarchy in parallel
        printLog(`Calling ContextService.fetchAdjacentParagraphs and fetchHierarchy...`);
        const [adjacentData, hierarchyData] = await Promise.all([
          ContextService.fetchAdjacentParagraphs(paragraphId, 3),
          ContextService.fetchHierarchy(paragraphId)
        ]);

        printLog(`Received ${adjacentData.paragraphs.length} paragraphs and hierarchy`);
        printLog(`Paragraph IDs received: ${adjacentData.paragraphs.map(p => p.id).join(', ')}`);
        printLog(`Looking for highlightedParagraphId: ${paragraphId}`);
        setParagraphs(adjacentData.paragraphs);
        setHierarchy(hierarchyData);
        setHighlightedParagraphId(paragraphId);
        setHighlightedChunkIndex(0); // Reset to first chunk when new paragraph is selected
        
        // Reset to context view when selecting a new paragraph
        setViewMode(ViewMode.CONTEXT);
        setViewHistory([{ mode: ViewMode.CONTEXT }]);

        // Scroll to the highlighted paragraph after a brief delay
        setTimeout(() => {
          scrollToHighlighted(paragraphId);
        }, 100);
      } catch (err) {
        console.error('Error fetching context data:', err);
        printLog(`Error fetching context data: ${err instanceof Error ? err.message : String(err)}`);
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [paragraphId, isOpen]);

  // Fetch chapters when hierarchy episode data is available
  useEffect(() => {
    const fetchChapters = async () => {
      if (!hierarchy?.hierarchy.episode?.metadata.guid) {
        return;
      }

      const episodeGuid = hierarchy.hierarchy.episode.metadata.guid;
      printLog(`Fetching chapters for episode: ${episodeGuid}`);

      setIsLoadingChapters(true);
      try {
        const response = await ChapterService.fetchEpisodeWithChapters(episodeGuid);
        setEpisodeChapters(response.chapters);
        printLog(`Loaded ${response.chapters.length} chapters`);
      } catch (error) {
        console.error('Error fetching chapters:', error);
        printLog(`Error fetching chapters: ${error}`);
      } finally {
        setIsLoadingChapters(false);
      }
    };

    fetchChapters();
  }, [hierarchy]);

  // Scroll to highlighted paragraph
  const scrollToHighlighted = (targetId: string) => {
    if (!contentRef.current) return;

    const element = contentRef.current.querySelector(`[data-paragraph-id="${targetId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Convert seconds to MM:SS format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Smart interpolation: break text into chunks on sentence boundaries with interpolated timestamps
  interface TextChunkWithTime {
    text: string;
    startTime: number;
  }

  const smartBreakText = (
    text: string, 
    startTime: number, 
    endTime: number, 
    maxChunkLength: number = 300
  ): TextChunkWithTime[] => {
    if (!smartInterpolation || text.length <= maxChunkLength) {
      return [{ text, startTime }];
    }

    const chunks: TextChunkWithTime[] = [];
    let currentChunk = '';
    let chunkStartPosition = 0;
    
    // Split on sentence boundaries (. or ?) followed by space
    const sentences = text.split(/([.?]\s+)/);
    
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      
      // If adding this part would exceed max length and we have content, start new chunk
      if (currentChunk.length > 0 && (currentChunk + part).length > maxChunkLength) {
        // Calculate interpolated timestamp based on character position
        const chunkEndPosition = chunkStartPosition + currentChunk.length;
        const progress = chunkStartPosition / text.length;
        const interpolatedTime = startTime + (endTime - startTime) * progress;
        
        chunks.push({
          text: currentChunk.trim(),
          startTime: interpolatedTime
        });
        
        chunkStartPosition = chunkEndPosition;
        currentChunk = part;
      } else {
        currentChunk += part;
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      const progress = chunkStartPosition / text.length;
      const interpolatedTime = startTime + (endTime - startTime) * progress;
      chunks.push({
        text: currentChunk.trim(),
        startTime: interpolatedTime
      });
    }
    
    return chunks.length > 0 ? chunks : [{ text, startTime }];
  };

  const effectiveStartTime = timeContext?.start_time ?? null;
  const effectiveEndTime = timeContext?.end_time ?? null;
  const effectiveDuration =
    effectiveStartTime !== null && effectiveEndTime !== null
      ? Math.max(effectiveEndTime - effectiveStartTime, 0)
      : null;

  const handleEpisodePlayPause = async () => {
    if (!audioUrl || !audioRef.current) return;
    try {
      if (!isAudioPlaying) {
        setIsAudioBuffering(true);
        // If we have a clip range, start at its beginning
        if (
          effectiveStartTime !== null &&
          Math.abs(audioRef.current.currentTime - effectiveStartTime) > 0.5
        ) {
          audioRef.current.currentTime = effectiveStartTime;
        }
        await audioRef.current.play();
        setIsAudioPlaying(true);
        setIsAudioBuffering(false);
      } else {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
    } catch (err) {
      console.error('Context panel playback error:', err);
      setIsAudioBuffering(false);
    }
  };

  const handleEpisodeTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setAudioCurrentTime(t);

    if (
      effectiveEndTime !== null &&
      t >= effectiveEndTime
    ) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  const handleEpisodeSeek = (targetTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = targetTime;
    setAudioCurrentTime(targetTime);
    if (!isAudioPlaying) {
      // Do not auto-play; user can hit play
      return;
    }
  };

  const handleParagraphOrChunkClick = (targetTime: number) => {
    // Existing external callback (list view players)
    if (onTimestampClick) {
      onTimestampClick(targetTime);
    }
    // Also sync local audio player if available (e.g. Galaxy view)
    if (audioRef.current && audioUrl) {
      handleEpisodeSeek(targetTime);
      // If not already playing, start playback from this paragraph
      if (!isAudioPlaying) {
        handleEpisodePlayPause();
      }
    }
  };

  const renderEpisodeMiniPlayer = () => {
    if (!audioUrl) return null;
    const current =
      audioCurrentTime !== null
        ? audioCurrentTime
        : effectiveStartTime ?? 0;
    const progressPercent =
      effectiveDuration && effectiveDuration > 0
        ? Math.max(
            0,
            Math.min(
              ((current - (effectiveStartTime ?? 0)) / effectiveDuration) *
                100,
              100
            )
          )
        : 0;

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!effectiveDuration) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const target =
        (effectiveStartTime ?? 0) + Math.max(0, Math.min(1, ratio)) * effectiveDuration;
      handleEpisodeSeek(target);
    };

    return (
      <div className="mt-3 space-y-2">
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleEpisodeTimeUpdate}
          onEnded={() => {
            setIsAudioPlaying(false);
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleEpisodePlayPause}
            className={`p-2 rounded-full text-black transition-colors ${
              audioUrl === 'URL unavailable'
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-white hover:bg-gray-200'
            }`}
            disabled={audioUrl === 'URL unavailable'}
          >
            {isAudioBuffering ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
            ) : isAudioPlaying ? (
              <span className="text-xs font-semibold">||</span>
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <div
            className="flex-1 h-1 bg-gray-700 rounded cursor-pointer relative"
            onClick={handleBarClick}
          >
            <div
              className="h-full bg-white rounded transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 min-w-[64px] text-right font-mono">
            {formatTime(current)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`sticky top-0 h-screen bg-black border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${
        isOpen ? 'w-[600px]' : 'w-0 border-l-0'
      } overflow-hidden flex-shrink-0`}
    >
      {/* Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Adjacent Paragraphs (Hidden in Chapter Mode) */}
        {viewMode !== ViewMode.CHAPTER && (
          <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
          <div className="p-3 border-b border-gray-800 bg-[#0A0A0A]">
            <h3 className="text-sm font-medium text-gray-400">Context</h3>
          </div>
          
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400 mb-2 text-sm">{error}</p>
                <button
                  onClick={() => paragraphId && ContextService.fetchAdjacentParagraphs(paragraphId, 3)}
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            ) : paragraphs.length > 0 ? (
              <div className="space-y-1">
                {paragraphs.map((paragraph, index) => {
                  const isHighlighted = paragraph.id === highlightedParagraphId;
                  const textChunks = smartBreakText(
                    paragraph.text, 
                    paragraph.start_time, 
                    paragraph.end_time
                  );
                  
                  return (
                    <React.Fragment key={paragraph.id}>
                      {textChunks.map((chunk, chunkIndex) => (
                        <div
                          key={`${paragraph.id}-${chunkIndex}`}
                          data-paragraph-id={chunkIndex === 0 ? paragraph.id : undefined}
                          className={`p-3 rounded-lg transition-all cursor-pointer ${
                            isHighlighted && highlightedChunkIndex === chunkIndex
                              ? 'bg-white/10 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                              : 'bg-gray-900/50 hover:bg-gray-800/50 border border-transparent'
                          }`}
                          onClick={() => {
                            setHighlightedParagraphId(paragraph.id);
                            setHighlightedChunkIndex(chunkIndex);
                            printLog(`Clicked paragraph: ${paragraph.id}, chunk: ${chunkIndex} at ${chunk.startTime}s`);
                            handleParagraphOrChunkClick(chunk.startTime);
                          }}
                        >
                          <div className="flex items-start space-x-2 min-w-0">
                            <span className="text-xs text-gray-500 font-mono min-w-[3rem] flex-shrink-0">
                              {formatTime(chunk.startTime)}
                            </span>
                            <p className="text-sm text-gray-300 leading-relaxed flex-1 min-w-0 break-words">
                              {chunk.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                <p>No context available</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Right Side - Hierarchy Details */}
        <div className={`flex flex-col bg-[#0A0A0A] ${viewMode === ViewMode.CHAPTER ? 'flex-1' : 'w-[320px]'}`}>
          <div className="p-3 border-b border-gray-800 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <button
                  onClick={popView}
                  className="text-gray-400 hover:text-white transition-colors text-lg"
                  aria-label="Back"
                >
                  ←
                </button>
              )}
              <h3 className="text-sm font-medium text-gray-400">Details</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close panel"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              </div>
            ) : viewMode === ViewMode.CHAPTER && selectedChapter ? (
              /* Chapter View Mode */
              <div className="space-y-6">
                {/* Hierarchy (same as before) */}
                <div className="space-y-0">
                  {/* Feed */}
                  {hierarchy?.hierarchy.feed && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-[rgb(245,161,66)] shadow-[0_0_16px_8px_rgba(245,161,66,0.4),0_0_8px_4px_rgba(245,161,66,0.6)] flex-shrink-0"></div>
                        <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-gray-500 mb-1">FEED</p>
                        <p className="text-sm text-white font-medium leading-tight">
                          {hierarchy.hierarchy.feed.metadata.title}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Episode */}
                  {hierarchy?.hierarchy.episode && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-[rgb(250,208,161)] shadow-[0_0_16px_8px_rgba(250,208,161,0.4),0_0_8px_4px_rgba(250,208,161,0.6)] flex-shrink-0"></div>
                        <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-gray-500 mb-1">EPISODE</p>
                        <div className="flex items-start space-x-2">
                          {hierarchy.hierarchy.episode.metadata.imageUrl ? (
                            !imageError ? (
                              <img
                                src={hierarchy.hierarchy.episode.metadata.imageUrl}
                                alt="Episode"
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                                onError={() => setImageError(true)}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                                <Podcast className="w-6 h-6 text-gray-600" />
                              </div>
                            )
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                              <Podcast className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium leading-tight line-clamp-2">
                              {hierarchy.hierarchy.episode.metadata.title}
                            </p>
                            {hierarchy.hierarchy.episode.metadata.duration && (
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTime(hierarchy.hierarchy.episode.metadata.duration)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Chapter */}
                  <div className="flex items-start space-x-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_16px_8px_rgba(255,255,255,0.4),0_0_8px_4px_rgba(255,255,255,0.6)] flex-shrink-0"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">
                        CHAPTER {selectedChapter.chapterNumber}
                      </p>
                      <p className="text-sm text-white font-medium leading-tight">
                        {selectedChapter.headline}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selected Chapter Details */}
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-2">CHAPTER DETAILS</p>
                  <div className="space-y-3">
                    {/* Time Range */}
                    <div>
                      <p className="text-xs text-gray-600">Time Range</p>
                      <p className="text-sm text-gray-300">
                        {formatTime(selectedChapter.startTime)} - {formatTime(selectedChapter.endTime)}
                        <span className="text-gray-500 ml-1">
                          ({formatTime(selectedChapter.metadata.duration)})
                        </span>
                      </p>
                    </div>

                    {selectedChapter.metadata.summary && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Summary</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {selectedChapter.metadata.summary}
                        </p>
                      </div>
                    )}
                    
                    {/* Keywords and Listen Button Side by Side */}
                    {selectedChapter.metadata.keywords && selectedChapter.metadata.keywords.length > 0 && (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 mb-1">Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedChapter.metadata.keywords.map((keyword, idx) => (
                              <KeywordTooltip
                                key={idx}
                                keyword={keyword}
                                isOpen={openTooltipKeyword === keyword}
                                onOpenChange={(isOpen) => setOpenTooltipKeyword(isOpen ? keyword : null)}
                                options={[
                                  {
                                    label: 'Search - All Pods',
                                    icon: <ScanSearch className="w-3.5 h-3.5" />,
                                    color: HIERARCHY_COLORS.ALL_PODS,
                                    onClick: () => {
                                      printLog(`Searching all pods for keyword: ${keyword}`);
                                      onKeywordSearch?.(keyword, undefined, undefined, true);
                                    }
                                  },
                                  {
                                    label: 'Search - This Feed',
                                    icon: <ScanSearch className="w-3.5 h-3.5" />,
                                    color: HIERARCHY_COLORS.FEED,
                                    onClick: () => {
                                      const feedId = hierarchy?.hierarchy.feed?.id;
                                      printLog(`Searching this feed (${feedId}) for keyword: ${keyword}`);
                                      onKeywordSearch?.(keyword, feedId);
                                    }
                                  },
                                  {
                                    label: 'Search - This Episode',
                                    icon: <ScanSearch className="w-3.5 h-3.5" />,
                                    color: HIERARCHY_COLORS.EPISODE,
                                    onClick: () => {
                                      const episodeName = hierarchy?.hierarchy.episode?.metadata.title;
                                      printLog(`Searching this episode (${episodeName}) for keyword: ${keyword}`);
                                      onKeywordSearch?.(keyword, undefined, episodeName);
                                    }
                                  }
                                ]}
                              />
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (onTimestampClick) {
                              onTimestampClick(selectedChapter.startTime);
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-black rounded hover:bg-gray-200 transition-colors text-xs font-medium flex-shrink-0 self-end"
                        >
                          <Play className="w-3 h-3" />
                          Listen
                        </button>
                      </div>
                    )}
                    
                    {/* Listen Button Alone (if no keywords) */}
                    {(!selectedChapter.metadata.keywords || selectedChapter.metadata.keywords.length === 0) && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            if (onTimestampClick) {
                              onTimestampClick(selectedChapter.startTime);
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-black rounded hover:bg-gray-200 transition-colors text-xs font-medium"
                        >
                          <Play className="w-3 h-3" />
                          Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Chapters List */}
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-3">ALL CHAPTERS ({episodeChapters.length})</p>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {episodeChapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        onClick={() => {
                          setSelectedChapter(chapter);
                        }}
                        className={`p-2 rounded cursor-pointer transition-colors ${
                          selectedChapter.id === chapter.id
                            ? 'bg-white/10 border border-white/20'
                            : 'bg-gray-900/50 hover:bg-gray-800/50 border border-transparent'
                        }`}
                      >
                        <p className="text-xs text-white font-medium line-clamp-1">
                          {chapter.chapterNumber}. {chapter.headline}
                        </p>
                        {chapter.metadata.summary && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            Summary: {chapter.metadata.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : hierarchy ? (
              /* Default Context View Mode */
              <div className="space-y-6">
                {/* Connected Hierarchy Visualization */}
                <div className="space-y-0">
                  {/* Feed */}
                  {hierarchy.hierarchy.feed && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-[rgb(245,161,66)] shadow-[0_0_16px_8px_rgba(245,161,66,0.4),0_0_8px_4px_rgba(245,161,66,0.6)] flex-shrink-0"></div>
                        <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-gray-500 mb-1">FEED</p>
                        <p className="text-sm text-white font-medium leading-tight">
                          {hierarchy.hierarchy.feed.metadata.title}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Episode with small thumbnail */}
                  {hierarchy.hierarchy.episode && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-[rgb(250,208,161)] shadow-[0_0_16px_8px_rgba(250,208,161,0.4),0_0_8px_4px_rgba(250,208,161,0.6)] flex-shrink-0"></div>
                        {hierarchy.hierarchy.chapter && (
                          <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-gray-500 mb-1">EPISODE</p>
                        <div className="flex items-start space-x-2">
                          {hierarchy.hierarchy.episode.metadata.imageUrl ? (
                            !imageError ? (
                              <img
                                src={hierarchy.hierarchy.episode.metadata.imageUrl}
                                alt="Episode"
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                                onError={() => setImageError(true)}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                                <Podcast className="w-6 h-6 text-gray-600" />
                              </div>
                            )
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                              <Podcast className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium line-clamp-2 leading-tight">
                              {hierarchy.hierarchy.episode.metadata.title}
                            </p>
                            {hierarchy.hierarchy.episode.metadata.duration && (
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTime(hierarchy.hierarchy.episode.metadata.duration)}
                              </p>
                            )}
                            {/* Mini player for Galaxy/standalone audio context */}
                            {renderEpisodeMiniPlayer()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chapter - Now Clickable */}
                  {hierarchy.hierarchy.chapter && (
                    <div 
                      className="flex items-start space-x-3 cursor-pointer hover:bg-gray-800/30 rounded p-2 -m-2 transition-colors"
                      onClick={() => {
                        // Find and set the current chapter from the loaded chapters
                        const currentChapter = episodeChapters.find(
                          ch => ch.metadata.chapterNumber === hierarchy.hierarchy.chapter?.metadata.chapterNumber
                        );
                        if (currentChapter) {
                          setSelectedChapter(currentChapter);
                          pushView(ViewMode.CHAPTER, currentChapter);
                        }
                      }}
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_16px_8px_rgba(255,255,255,0.4),0_0_8px_4px_rgba(255,255,255,0.6)] flex-shrink-0"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">
                          CHAPTER {hierarchy.hierarchy.chapter.metadata.chapterNumber}
                        </p>
                        <p className="text-sm text-white font-medium mb-2 leading-tight">
                          {hierarchy.hierarchy.chapter.metadata.headline}
                        </p>
                        
                        {/* Chapter Time */}
                        <p className="text-xs text-gray-500 mb-2">
                          {formatTime(hierarchy.hierarchy.chapter.metadata.startTime)} - {formatTime(hierarchy.hierarchy.chapter.metadata.endTime)}
                          <span className="text-gray-600 ml-1">
                            ({formatTime(hierarchy.hierarchy.chapter.metadata.duration)})
                          </span>
                        </p>
                        </div>
                      </div>
                  )}
                </div>

                {/* Chapter Summary - Separate Section */}
                {hierarchy.hierarchy.chapter?.metadata.summary && (
                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">SUMMARY</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {hierarchy.hierarchy.chapter.metadata.summary}
                    </p>
                  </div>
                )}

                {/* Keywords */}
                {hierarchy.hierarchy.chapter && hierarchy.hierarchy.chapter.metadata.keywords.length > 0 && (
                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">KEYWORDS</p>
                    <div className="flex flex-wrap gap-1">
                      {hierarchy.hierarchy.chapter.metadata.keywords.map((keyword, idx) => (
                        <KeywordTooltip
                          key={idx}
                          keyword={keyword}
                          isOpen={openTooltipKeyword === keyword}
                          onOpenChange={(isOpen) => setOpenTooltipKeyword(isOpen ? keyword : null)}
                          options={[
                            {
                              label: 'Search - All Pods',
                              icon: <ScanSearch className="w-3.5 h-3.5" />,
                              color: HIERARCHY_COLORS.ALL_PODS,
                              onClick: () => {
                                printLog(`Searching all pods for keyword: ${keyword}`);
                                onKeywordSearch?.(keyword, undefined, undefined, true);
                              }
                            },
                            {
                              label: 'Search - This Feed',
                              icon: <ScanSearch className="w-3.5 h-3.5" />,
                              color: HIERARCHY_COLORS.FEED,
                              onClick: () => {
                                const feedId = hierarchy.hierarchy.feed?.id;
                                printLog(`Searching this feed (${feedId}) for keyword: ${keyword}`);
                                onKeywordSearch?.(keyword, feedId);
                              }
                            },
                            {
                              label: 'Search - This Episode',
                              icon: <ScanSearch className="w-3.5 h-3.5" />,
                              color: HIERARCHY_COLORS.EPISODE,
                              onClick: () => {
                                const episodeName = hierarchy.hierarchy.episode?.metadata.title;
                                printLog(`Searching this episode (${episodeName}) for keyword: ${keyword}`);
                                onKeywordSearch?.(keyword, undefined, episodeName);
                              }
                            }
                          ]}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paragraph Details */}
                {hierarchy.hierarchy.paragraph && (
                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">PARAGRAPH</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-600">Sequence</p>
                        <p className="text-sm text-gray-300">{hierarchy.hierarchy.paragraph.metadata.sequence}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Words</p>
                        <p className="text-sm text-gray-300">{hierarchy.hierarchy.paragraph.metadata.num_words}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                <p>No details available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodcastContextPanel;


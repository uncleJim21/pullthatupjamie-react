import React, { useState, useEffect, useRef } from 'react';
import { BookText, ChevronRight, ChevronLeft, Info, Podcast, ChevronDown, ChevronUp, Play, ScanSearch, RotateCcw, RotateCw, Layers, Plus, Minus, ChevronsLeft, ChevronsRight } from 'lucide-react';
import ContextService, { AdjacentParagraph, HierarchyResponse } from '../services/contextService.ts';
import HierarchyCache from '../services/hierarchyCache.ts';
import ChapterService, { Chapter } from '../services/chapterService.ts';
import { printLog, HIERARCHY_COLORS } from '../constants/constants.ts';
import { KeywordTooltip } from './KeywordTooltip.tsx';
import { handleQuoteSearch } from '../services/podcastService.ts';
import { AuthConfig } from '../constants/constants.ts';
import { useAudioController } from '../context/AudioControllerContext.tsx';

enum ViewMode {
  CONTEXT = 'context',
  CHAPTER = 'chapter'
}

interface ViewHistoryItem {
  mode: ViewMode;
  selectedChapter?: Chapter | null;
}

interface PodcastContextPanelProps {
  layoutMode?: 'side' | 'bottom';
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
  // If true, auto-play the episode audio shortly after mounting (used for Galaxy star clicks)
  autoPlayOnOpen?: boolean;
  // Notify parent about current panel width so layout (e.g. floating search bar) can adjust
  onWidthChange?: (width: number) => void;
  // External collapse control (when part of UnifiedSidePanel)
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;

  // Research session controls (optional)
  researchSessionShareLinks?: string[];
  onAddToResearch?: (result: any) => void;
  onRemoveFromResearch?: (shareLink: string) => void;

  // Track navigation (optional): jump to previous/next clip in the current results list.
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

const PodcastContextPanel: React.FC<PodcastContextPanelProps> = ({
  layoutMode = 'side',
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
  date,
  autoPlayOnOpen,
  onWidthChange,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  researchSessionShareLinks = [],
  onAddToResearch,
  onRemoveFromResearch,
  onPreviousTrack,
  onNextTrack,
}) => {
  const [paragraphs, setParagraphs] = useState<AdjacentParagraph[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number>(0);
  const [imageError, setImageError] = useState(false);
  const [episodeImageLoaded, setEpisodeImageLoaded] = useState(false);
  const [episodeChapters, setEpisodeChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CONTEXT);
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([{ mode: ViewMode.CONTEXT }]);
  const [openTooltipKeyword, setOpenTooltipKeyword] = useState<string | null>(null);
  // Use external collapse state if provided, otherwise manage internally
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = onToggleCollapse || setInternalIsCollapsed;
  const isBottomLayout = layoutMode === 'bottom';
  const allowCollapse = !isBottomLayout;
  const [mobileView, setMobileView] = useState<'details' | 'context'>('details');
  const contentRef = useRef<HTMLDivElement>(null);
  const detailsScrollRef = useRef<HTMLDivElement>(null);
  const scrollLogRef = useRef<{ lastAt: number }>({ lastAt: 0 });
  const touchLogRef = useRef<{ lastAt: number }>({ lastAt: 0 });
  const {
    currentTrack,
    isPlaying: controllerIsPlaying,
    isBuffering: controllerIsBuffering,
    currentTime: controllerCurrentTime,
    duration: controllerDuration,
    playTrack,
    togglePlay,
    pause,
    seekTo,
    seekBy,
  } = useAudioController();
  const autoPlayKeyRef = useRef<string | null>(null);

  const logScrollMetrics = (label: string, el: HTMLDivElement) => {
    const now = Date.now();
    if (now - scrollLogRef.current.lastAt < 500) return; // throttle
    scrollLogRef.current.lastAt = now;
    printLog(
      `[ScrollDebug] ${label} scroll: top=${Math.round(el.scrollTop)} clientH=${Math.round(el.clientHeight)} scrollH=${Math.round(el.scrollHeight)} canScroll=${el.scrollHeight > el.clientHeight}`,
    );
  };

  const logTouch = (label: string) => {
    const now = Date.now();
    if (now - touchLogRef.current.lastAt < 500) return; // throttle
    touchLogRef.current.lastAt = now;
    printLog(`[ScrollDebug] ${label} touch`);
  };

  // Debug: log container dimensions whenever layout mode or loading state changes
  useEffect(() => {
    if (!isBottomLayout || isLoading) return;
    
    // Check Context pane scroll container
    const contextEl = contentRef.current;
    if (contextEl && mobileView === 'context') {
      const rect = contextEl.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(contextEl);
      printLog(
        `[ScrollDebug] ContextPane scroll: ` +
        `clientH=${contextEl.clientHeight} scrollH=${contextEl.scrollHeight} ` +
        `boundingH=${Math.round(rect.height)} ` +
        `overflow=${computedStyle.overflowY} ` +
        `canScroll=${contextEl.scrollHeight > contextEl.clientHeight}`
      );
    }
    
    // Check Details pane scroll container
    const detailsEl = detailsScrollRef.current;
    if (detailsEl && mobileView === 'details') {
      const rect = detailsEl.getBoundingClientRect();
      const parent = detailsEl.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(detailsEl);
      printLog(
        `[ScrollDebug] DetailsPane scroll: ` +
        `clientH=${detailsEl.clientHeight} scrollH=${detailsEl.scrollHeight} ` +
        `boundingH=${Math.round(rect.height)} ` +
        `parentH=${parentRect ? Math.round(parentRect.height) : 'n/a'} ` +
        `overflow=${computedStyle.overflowY} ` +
        `touchAction=${computedStyle.touchAction} ` +
        `canScroll=${detailsEl.scrollHeight > detailsEl.clientHeight}`
      );
    } else if (mobileView === 'details') {
      printLog(`[ScrollDebug] detailsScrollRef is NULL - Details scroll container not mounted`);
    }
    
    // Also log after a delay to catch post-render state AND trace parent chain
    const timer = setTimeout(() => {
      const el = detailsScrollRef.current;
      if (el && mobileView === 'details') {
        printLog(
          `[ScrollDebug] DetailsPane (delayed): ` +
          `clientH=${el.clientHeight} scrollH=${el.scrollHeight} ` +
          `canScroll=${el.scrollHeight > el.clientHeight}`
        );
        
        // Trace the parent chain to find where height constraint breaks
        let current: HTMLElement | null = el;
        let depth = 0;
        while (current && depth < 10) {
          const rect = current.getBoundingClientRect();
          const style = window.getComputedStyle(current);
          printLog(
            `[ScrollDebug] Parent[${depth}]: ` +
            `tag=${current.tagName} ` +
            `boundingH=${Math.round(rect.height)} ` +
            `overflow=${style.overflow} ` +
            `display=${style.display} ` +
            `flexDir=${style.flexDirection || 'n/a'} ` +
            `minH=${style.minHeight}`
          );
          current = current.parentElement;
          depth++;
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isBottomLayout, isLoading, viewMode, mobileView]);

  // Interpret paragraphId: if it matches the paragraph pattern guid_p{number}, treat as paragraph.
  // Otherwise, treat it as a chapterId for chapter-level hierarchy.
  const paragraphIdPattern = /_p\d+$/;
  const isParagraphId = !!paragraphId && paragraphIdPattern.test(paragraphId);
  const effectiveParagraphId = isParagraphId ? paragraphId : null;
  const effectiveChapterId = !isParagraphId ? paragraphId : null;

  const isInResearchSession = Boolean(
    effectiveParagraphId && researchSessionShareLinks.includes(effectiveParagraphId),
  );

  const handleToggleResearch = () => {
    if (!effectiveParagraphId) return;
    if (isInResearchSession) {
      onRemoveFromResearch?.(effectiveParagraphId);
      return;
    }

    // Build a minimal "result-like" shape compatible with SearchInterface's handleAddToResearchSession
    const paragraph = paragraphs.find(p => p.id === effectiveParagraphId);
    const quoteText = paragraph?.text || '';
    const episodeMeta = hierarchy?.hierarchy.episode?.metadata;

    onAddToResearch?.({
      shareLink: effectiveParagraphId,
      quote: quoteText,
      summary: undefined,
      headline: undefined,
      episode: episodeMeta?.title || paragraph?.episode || 'Unknown Episode',
      creator: episodeMeta?.creator || paragraph?.creator || 'Unknown Creator',
      episodeImage: episodeMeta?.imageUrl || undefined,
      date: episodeMeta?.publishedDate || new Date().toISOString(),
      hierarchyLevel: 'paragraph',
      coordinates3d: undefined,
    });
  };

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

  // Reset collapsed state when the panel is closed from the parent.
  useEffect(() => {
    if (!isOpen) {
      setIsCollapsed(false);
      // Reset auto-play key when panel closes so next open can auto-play
      autoPlayKeyRef.current = null;
    }
  }, [isOpen]);

  // Fetch data when paragraphId (or implicit chapterId) changes
  useEffect(() => {
    printLog(`PodcastContextPanel effect - paragraphId: ${paragraphId}, isOpen: ${isOpen}`);
    
    if (!paragraphId || !isOpen) {
      printLog(`Skipping fetch - paragraphId or isOpen is false`);
      return;
    }

    // Reset image states when fetching new data
    setImageError(false);
    setEpisodeImageLoaded(false);

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      printLog(
        `Starting fetch for ${
          effectiveParagraphId ? `paragraphId: ${effectiveParagraphId}` : `chapterId: ${effectiveChapterId}`
        }`
      );

      try {
        if (effectiveParagraphId) {
          // Paragraph-driven mode: fetch adjacent paragraphs + hierarchy from paragraph (using cache)
          printLog(`Calling HierarchyCache.getAdjacentParagraphs and getHierarchy...`);
          const [adjacentData, hierarchyData] = await Promise.all([
            HierarchyCache.getAdjacentParagraphs(effectiveParagraphId, 3),
            HierarchyCache.getHierarchy(effectiveParagraphId),
          ]);

          printLog(`Received ${adjacentData.paragraphs.length} paragraphs and hierarchy`);
          printLog(`Paragraph IDs received: ${adjacentData.paragraphs.map(p => p.id).join(', ')}`);
          printLog(`Looking for highlightedParagraphId: ${effectiveParagraphId}`);
          setParagraphs(adjacentData.paragraphs);
          setHierarchy(hierarchyData);
          setHighlightedParagraphId(effectiveParagraphId);
          setHighlightedChunkIndex(0); // Reset to first chunk when new paragraph is selected
          
          // Reset to context view when selecting a new paragraph
          setViewMode(ViewMode.CONTEXT);
          setViewHistory([{ mode: ViewMode.CONTEXT }]);

          // Scroll to the highlighted paragraph after a brief delay
          setTimeout(() => {
            scrollToHighlighted(effectiveParagraphId);
          }, 100);
        } else if (effectiveChapterId) {
          // Chapter-driven mode: no adjacent paragraphs, only hierarchy from chapterId
          printLog(`Calling ContextService.fetchHierarchyByChapter for chapterId: ${effectiveChapterId}`);
          const hierarchyData = await ContextService.fetchHierarchyByChapter(effectiveChapterId);

          setParagraphs([]); // No paragraph context in pure chapter mode
          setHierarchy(hierarchyData);
          setHighlightedParagraphId(null);
          setHighlightedChunkIndex(0);

          // Default into CHAPTER view when starting from a chapter
          setViewMode(ViewMode.CHAPTER);
          setViewHistory([{ mode: ViewMode.CHAPTER }]);
        }
      } catch (err) {
        console.error('Error fetching context data:', err);
        printLog(`Error fetching context data: ${err instanceof Error ? err.message : String(err)}`);
        setError(err instanceof Error ? err.message : 'Failed to load context');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [paragraphId, isOpen]);

  // Fetch chapters when hierarchy episode data is available.
  // IMPORTANT: this effect only runs when `hierarchy` changes so it
  // doesn't overwrite the user's manual chapter selection from the list.
  useEffect(() => {
    const fetchChapters = async () => {
      if (!hierarchy?.hierarchy.episode?.metadata.guid) {
        return;
      }

      const episodeGuid = hierarchy.hierarchy.episode.metadata.guid;
      const hierarchyChapterId = hierarchy.hierarchy.chapter?.id;
      printLog(`Fetching chapters for episode: ${episodeGuid}`);

      setIsLoadingChapters(true);
      try {
        const response = await ChapterService.fetchEpisodeWithChapters(episodeGuid);
        setEpisodeChapters(response.chapters);
        printLog(`Loaded ${response.chapters.length} chapters`);

        // When a new hierarchy arrives (e.g. new star/chapter click),
        // initialize selectedChapter from that hierarchy's chapter once.
        if (hierarchyChapterId) {
          const match = response.chapters.find(ch => ch.id === hierarchyChapterId);
          if (match) {
            setSelectedChapter(match);
          }
        }
      } catch (error) {
        console.error('Error fetching chapters:', error);
        printLog(`Error fetching chapters: ${error}`);
      } finally {
        setIsLoadingChapters(false);
      }
    };

    void fetchChapters();
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

  const hierarchyEpisodeAudioUrl = hierarchy?.hierarchy.episode?.metadata.audioUrl;
  const effectiveAudioUrl =
    audioUrl && audioUrl !== 'URL unavailable'
      ? audioUrl
      : hierarchyEpisodeAudioUrl || undefined;

  // Derive a sensible default clip window:
  // - prefer explicit timeContext (e.g. from a star / list item)
  // - otherwise fall back to selectedChapter range when in chapter mode
  const chapterStartTime = selectedChapter?.startTime;
  const chapterEndTime = selectedChapter?.endTime;
  const defaultClipStart = timeContext?.start_time ?? chapterStartTime ?? 0;
  const defaultClipEnd = timeContext?.end_time ?? chapterEndTime;

  const contextTrackId = paragraphId || audioUrl || 'context-default';
  const isContextTrackActive = currentTrack?.id === contextTrackId;
  const contextIsPlaying = isContextTrackActive && controllerIsPlaying;
  const contextIsBuffering = isContextTrackActive && controllerIsBuffering;
  const effectiveCurrentTime =
    isContextTrackActive && controllerCurrentTime
      ? controllerCurrentTime
      : defaultClipStart;

  // Auto-play for Galaxy star clicks / auto-select first result using shared controller.
  // This should work for any selected result that provides a timeContext (not just "guid_p123" ids),
  // so that "autoPlayOnStarClick" consistently starts playback immediately.
  useEffect(() => {
    printLog(`[AutoPlay Effect] Triggered - isOpen: ${isOpen}, autoPlayOnOpen: ${autoPlayOnOpen}`);
    printLog(`[AutoPlay Effect] effectiveAudioUrl: ${effectiveAudioUrl}`);
    printLog(`[AutoPlay Effect] timeContext: ${JSON.stringify(timeContext)}`);
    
    if (!effectiveAudioUrl || !autoPlayOnOpen || !timeContext) {
      printLog(`[AutoPlay Effect] Skipped - missing required values: audioUrl=${!!effectiveAudioUrl}, autoPlay=${autoPlayOnOpen}, timeContext=${!!timeContext}`);
      return;
    }
    if (!isOpen) {
      printLog('[AutoPlay Effect] Skipped - panel not open');
      return;
    }
    
    // Only proceed if we have valid timestamps
    if (timeContext.start_time === undefined || timeContext.start_time < 0) {
      printLog(`[AutoPlay Effect] Skipped - invalid start_time: ${timeContext.start_time}`);
      console.warn('Auto-play skipped: invalid start_time', timeContext);
      return;
    }
    
    const key = `${effectiveAudioUrl}-${timeContext.start_time}-${timeContext.end_time}`;
    if (autoPlayKeyRef.current === key) {
      printLog(`[AutoPlay Effect] Skipped - already played this key: ${key}`);
      return;
    }
    
    printLog(`[AutoPlay Effect] PLAYING - contextTrackId: ${contextTrackId}, startTime: ${timeContext.start_time}, endTime: ${timeContext.end_time}`);
    console.log('Auto-playing track:', { 
      contextTrackId, 
      audioUrl: effectiveAudioUrl, 
      startTime: timeContext.start_time, 
      endTime: timeContext.end_time 
    });
    
    autoPlayKeyRef.current = key;
    void playTrack({
      id: contextTrackId,
      audioUrl: effectiveAudioUrl,
      startTime: timeContext.start_time,
      endTime: timeContext.end_time,
    });
  }, [effectiveAudioUrl, autoPlayOnOpen, timeContext?.start_time, timeContext?.end_time, contextTrackId, playTrack, isOpen]);

  const handleEpisodePlayPause = async () => {
    if (!effectiveAudioUrl) return;
    try {
      if (!isContextTrackActive) {
        const start = defaultClipStart;
        const end = defaultClipEnd;
        await playTrack({
          id: contextTrackId,
          audioUrl: effectiveAudioUrl,
          startTime: start,
          endTime: end,
        });
      } else {
        await togglePlay();
      }
    } catch (err) {
      console.error('Context panel playback error:', err);
      pause();
    }
  };

  const handleParagraphOrChunkClick = (targetTime: number) => {
    // Existing external callback (list view players)
    if (onTimestampClick) {
      onTimestampClick(targetTime);
    }
    // Also sync shared audio player if available (e.g. Galaxy view)
    if (effectiveAudioUrl) {
      if (!isContextTrackActive) {
        void playTrack({
          id: contextTrackId,
          audioUrl: effectiveAudioUrl,
          startTime: targetTime,
          endTime: timeContext?.end_time,
        });
      } else {
        seekTo(targetTime);
        if (!contextIsPlaying) {
          void togglePlay();
        }
      }
    }
  };

  const handleChapterListenToggle = () => {
    if (!effectiveAudioUrl || !selectedChapter) return;
    const startTime = selectedChapter.startTime;
    const endTime = selectedChapter.endTime;

    // Notify external listeners (e.g., list view) just like paragraph clicks
    if (onTimestampClick) {
      onTimestampClick(startTime);
    }

    if (isContextTrackActive && contextIsPlaying) {
      pause();
      return;
    }

    if (!isContextTrackActive) {
      void playTrack({
        id: contextTrackId,
        audioUrl: effectiveAudioUrl,
        startTime,
        endTime,
      });
    } else {
      seekTo(startTime);
      if (!contextIsPlaying) {
        void togglePlay();
      }
    }
  };

  // When a user selects a chapter (especially from "All Chapters"), we expect it to jump and play.
  // This mirrors the existing paragraph click behavior (seek + ensure playback).
  const playSelectedChapter = (chapter: Chapter) => {
    if (!effectiveAudioUrl) return;
    const startTime = chapter.startTime;
    const endTime = chapter.endTime;

    // Notify external listeners (e.g., list view) just like paragraph clicks
    if (onTimestampClick) {
      onTimestampClick(startTime);
    }

    if (!isContextTrackActive) {
      void playTrack({
        id: contextTrackId,
        audioUrl: effectiveAudioUrl,
        startTime,
        endTime,
      });
      return;
    }

    seekTo(startTime);
    if (!contextIsPlaying) {
      void togglePlay();
    }
  };

  const renderEpisodeMiniPlayer = () => {
    if (!effectiveAudioUrl) return null;
    const current = effectiveCurrentTime;
    const progressPercent =
      controllerDuration && controllerDuration > 0
        ? Math.max(0, Math.min((current / controllerDuration) * 100, 100))
        : 0;

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isContextTrackActive) return;
      if (!controllerDuration || controllerDuration <= 0) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const target = clampedRatio * controllerDuration;
      seekTo(target);
    };

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Play/Pause and Skip buttons column */}
          <div className="flex flex-col gap-1">
            {/* Row 1: Play/Pause */}
            <button
              onClick={handleEpisodePlayPause}
              className={`h-8 w-8 ml-1 flex items-center justify-center rounded-full text-black transition-colors ${
                audioUrl === 'URL unavailable'
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-200'
              }`}
              disabled={audioUrl === 'URL unavailable'}
            >
              {contextIsBuffering ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
              ) : contextIsPlaying ? (
                <span className="text-xs font-semibold">||</span>
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            {/* Row 2: Skip buttons side by side */}
            <div className="flex gap-1">
              {/* Skip Back 5s */}
              <button
                onClick={() => isContextTrackActive && seekBy(-5)}
                className="p-1 rounded-full text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isContextTrackActive || audioUrl === 'URL unavailable'}
                title="Back 5 seconds"
              >
                <RotateCcw size={10} />
              </button>

              {/* Skip Forward 5s */}
              <button
                onClick={() => isContextTrackActive && seekBy(5)}
                className="p-1 rounded-full text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isContextTrackActive || audioUrl === 'URL unavailable'}
                title="Forward 5 seconds"
              >
                <RotateCw size={10} />
              </button>
            </div>

            {/* Row 3: Track navigation (prev/next) */}
            {(onPreviousTrack || onNextTrack) && (
              <div className="flex gap-1">
                <button
                  onClick={onPreviousTrack}
                  disabled={!onPreviousTrack}
                  className="p-1 rounded-full text-white transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Previous clip"
                  aria-label="Previous clip"
                >
                  <ChevronsLeft size={10} />
                </button>
                <button
                  onClick={onNextTrack}
                  disabled={!onNextTrack}
                  className="p-1 rounded-full text-white transition-colors hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next clip"
                  aria-label="Next clip"
                >
                  <ChevronsRight size={10} />
                </button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div
            className="flex-1 h-1 bg-gray-700 rounded cursor-pointer relative mb-4"
            onClick={handleBarClick}
          >
            <div
              className="h-full bg-white rounded transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Time Display + Research toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-400 min-w-[48px] text-right font-mono">
              {formatTime(current)}
            </span>

            {/* Research toggle (near time) */}
            {isParagraphId && effectiveParagraphId && (
              <button
                onClick={handleToggleResearch}
                title={isInResearchSession ? 'Remove from current research items' : 'Add to current research items'}
                aria-label={isInResearchSession ? 'Remove from current research items' : 'Add to current research items'}
                className={`h-7 px-2 rounded-md border transition-colors flex items-center gap-1.5 ${
                  isInResearchSession
                    ? 'bg-white text-black border-white'
                    : 'bg-black text-white border-gray-700 hover:bg-white hover:text-black hover:border-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                {isInResearchSession ? (
                  <Minus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const panelWidthClass = !isOpen
    ? (isBottomLayout ? 'w-full' : 'w-0 border-l-0')
    : isBottomLayout
      ? 'w-full'
      : isCollapsed
        ? 'w-[32px]'
        : 'w-[600px]';

  // Report current width to parent whenever open/collapsed state changes
  useEffect(() => {
    if (!onWidthChange) return;
    if (isBottomLayout) {
      onWidthChange(0);
      return;
    }
    if (!isOpen) {
      onWidthChange(0);
      return;
    }
    onWidthChange(isCollapsed ? 32 : 600);
  }, [isBottomLayout, isOpen, isCollapsed, onWidthChange]);

  return (
    <div
      className={`bg-black flex flex-col transition-all duration-300 ease-in-out ${panelWidthClass} overflow-hidden flex-shrink-0 min-h-0 ${
        isBottomLayout ? 'flex-1 min-h-0' : 'sticky top-0 h-screen border-l border-gray-800'
      }`}
    >
      {/* Split Content Area */}
      {(!allowCollapse || !isCollapsed) ? (
      <div className={`flex-1 min-h-0 overflow-hidden flex`}>
        <div className={`flex-1 min-h-0 overflow-hidden ${isBottomLayout ? 'flex flex-col' : 'flex'}`}>
        {/* Left Side - Adjacent Paragraphs (Hidden in Chapter Mode) */}
        {viewMode !== ViewMode.CHAPTER && (!isBottomLayout || mobileView === 'context') && (
          <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isBottomLayout ? '' : 'border-r border-gray-800'}`}>
          <div className="p-3 border-b border-gray-800 bg-[#0A0A0A]">
            <h3 className="text-sm font-medium text-gray-400">Context</h3>
          </div>
          
          <div
            ref={contentRef}
            className={`flex-1 overflow-y-auto p-4 ${isBottomLayout ? 'pb-24' : ''}`}
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
            }}
            onScroll={(e) => logScrollMetrics('ContextPane', e.currentTarget)}
            onTouchStart={() => logTouch('ContextPane')}
            onTouchMove={() => logTouch('ContextPane')}
          >
            {isLoading ? (
              <div className="space-y-4 py-4 px-1">
                {/* Shimmer skeleton: simulates transcript lines */}
                <div className="h-4 w-3/4 rounded shimmer-loading" />
                <div className="h-4 w-full rounded shimmer-loading" />
                <div className="h-4 w-5/6 rounded shimmer-loading" />
                <div className="h-4 w-2/3 rounded shimmer-loading" />
                <div className="h-4 w-full rounded shimmer-loading" />
                <div className="h-4 w-4/5 rounded shimmer-loading" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-400 mb-2 text-sm">{error}</p>
                <button
                  onClick={() => paragraphId && HierarchyCache.getAdjacentParagraphs(paragraphId, 3)}
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
        {(!isBottomLayout || mobileView === 'details' || viewMode === ViewMode.CHAPTER) && (
        <div className={`bg-[#0A0A0A] ${
          isBottomLayout ? 'flex-1 w-full relative' : (viewMode === ViewMode.CHAPTER ? 'flex-1 flex flex-col' : 'w-[320px] flex flex-col')
        }`}>
          <div className="p-3 border-b border-gray-800 flex items-center gap-2 justify-between flex-shrink-0">
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
            </div>
            <div className="flex items-center gap-2">
              {allowCollapse && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Collapse panel"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          <div
            ref={detailsScrollRef}
            className={`overflow-y-auto p-4 ${isBottomLayout ? 'absolute left-0 right-0 bottom-0 pb-24' : 'flex-1 min-h-0'}`}
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
              ...(isBottomLayout ? { top: '52px' } : {}),
            }}
            onScroll={(e) => logScrollMetrics('DetailsPane', e.currentTarget)}
            onTouchStart={() => logTouch('DetailsPane')}
            onTouchMove={() => logTouch('DetailsPane')}
          >
            {isLoading ? (
              <div className="space-y-5 py-4 px-1">
                {/* Shimmer skeleton: simulates episode details hierarchy */}
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded shimmer-loading flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-3/4 rounded shimmer-loading" />
                    <div className="h-3 w-1/2 rounded shimmer-loading" />
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded shimmer-loading flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-2/3 rounded shimmer-loading" />
                    <div className="h-3 w-1/3 rounded shimmer-loading" />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-3 w-full rounded shimmer-loading" />
                  <div className="h-3 w-5/6 rounded shimmer-loading" />
                  <div className="h-3 w-4/5 rounded shimmer-loading" />
                </div>
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
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: HIERARCHY_COLORS.FEED,
                          boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.FEED}`,
                          border: `1px solid ${HIERARCHY_COLORS.FEED}`,
                        }}
                      ></div>
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

                {/* Episode - Clickable to show chapter list */}
                {hierarchy?.hierarchy.episode && (
                  <div 
                    className="flex items-start space-x-3 cursor-pointer hover:bg-gray-800/30 rounded p-2 -m-2 transition-colors"
                    onClick={() => {
                      const first = episodeChapters[0] || selectedChapter;
                      if (first) {
                        setSelectedChapter(first);
                        pushView(ViewMode.CHAPTER, first);
                      }
                    }}
                  >
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: HIERARCHY_COLORS.EPISODE,
                          boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.EPISODE}`,
                          border: `1px solid ${HIERARCHY_COLORS.EPISODE}`,
                        }}
                      ></div>
                      <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-xs text-gray-500 mb-1">EPISODE</p>
                      <div className="flex items-start space-x-2">
                          <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 relative">
                            {hierarchy.hierarchy.episode.metadata.imageUrl && !imageError && !episodeImageLoaded && (
                              <div className="absolute inset-0 shimmer-loading rounded" />
                            )}
                            {hierarchy.hierarchy.episode.metadata.imageUrl ? (
                              !imageError ? (
                                <img
                                  src={hierarchy.hierarchy.episode.metadata.imageUrl}
                                  alt="Episode"
                                  className={`w-full h-full object-cover ${episodeImageLoaded ? 'block' : 'invisible'}`}
                                  onLoad={() => setEpisodeImageLoaded(true)}
                                  onError={() => setImageError(true)}
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                  <Podcast className="w-6 h-6 text-gray-600" />
                                </div>
                              )
                            ) : (
                              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <Podcast className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                          </div>
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
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: HIERARCHY_COLORS.CHAPTER,
                          boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.CHAPTER}`,
                          border: `1px solid ${HIERARCHY_COLORS.CHAPTER}`,
                        }}
                      ></div>
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
                                      // Prefer numeric/string feedId from metadata (API filter expects the raw feed id, not "feed_####")
                                      const feedId = hierarchy?.hierarchy.feed?.metadata.feedId || hierarchy?.hierarchy.feed?.id;
                                      printLog(`Searching this feed (${feedId}) for keyword: ${keyword}`);
                                      onKeywordSearch?.(keyword, feedId);
                                    }
                                  },
                                  {
                                    label: 'Search - This Episode',
                                    icon: <ScanSearch className="w-3.5 h-3.5" />,
                                    color: HIERARCHY_COLORS.EPISODE,
                                    onClick: () => {
                                      const episodeGuid = hierarchy?.hierarchy.episode?.metadata.guid;
                                      printLog(`Searching this episode (${episodeGuid}) for keyword: ${keyword}`);
                                      onKeywordSearch?.(keyword, undefined, episodeGuid);
                                    }
                                  }
                                ]}
                              />
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={handleChapterListenToggle}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-black rounded hover:bg-gray-200 transition-colors text-xs font-medium flex-shrink-0 self-end"
                        >
                          {isContextTrackActive && contextIsPlaying ? (
                            <>
                              <span className="text-[10px] font-semibold">||</span>
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Listen Button Alone (if no keywords) */}
                    {(!selectedChapter.metadata.keywords || selectedChapter.metadata.keywords.length === 0) && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleChapterListenToggle}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-black rounded hover:bg-gray-200 transition-colors text-xs font-medium"
                        >
                          {isContextTrackActive && contextIsPlaying ? (
                            <>
                              <span className="text-[10px] font-semibold">||</span>
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Chapters List */}
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-3">ALL CHAPTERS ({episodeChapters.length})</p>
                  <div className={`space-y-2 ${isBottomLayout ? '' : 'max-h-[400px] overflow-y-auto pr-2'}`}>
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
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: HIERARCHY_COLORS.FEED,
                            boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.FEED}`,
                            border: `1px solid ${HIERARCHY_COLORS.FEED}`,
                          }}
                        ></div>
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

                  {/* Episode with small thumbnail - Clickable to show chapter list */}
                  {hierarchy.hierarchy.episode && (
                    <div className="pb-2">
                      <div 
                        className="flex items-start space-x-3 cursor-pointer hover:bg-gray-800/30 rounded p-2 -m-2 transition-colors"
                        onClick={() => {
                          const first = episodeChapters[0] || selectedChapter;
                          if (first) {
                            setSelectedChapter(first);
                            pushView(ViewMode.CHAPTER, first);
                          }
                        }}
                      >
                        <div className="flex flex-col items-center pt-1">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: HIERARCHY_COLORS.EPISODE,
                              boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.EPISODE}`,
                              border: `1px solid ${HIERARCHY_COLORS.EPISODE}`,
                            }}
                          ></div>
                          {hierarchy.hierarchy.chapter && (
                            <div className="w-0.5 h-8 bg-gray-700 my-1"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">EPISODE</p>
                          <div className="flex items-start space-x-2">
                            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 relative">
                              {hierarchy.hierarchy.episode.metadata.imageUrl && !imageError && !episodeImageLoaded && (
                                <div className="absolute inset-0 shimmer-loading rounded" />
                              )}
                              {hierarchy.hierarchy.episode.metadata.imageUrl ? (
                                !imageError ? (
                                  <img
                                    src={hierarchy.hierarchy.episode.metadata.imageUrl}
                                    alt="Episode"
                                    className={`w-full h-full object-cover ${episodeImageLoaded ? 'block' : 'invisible'}`}
                                    onLoad={() => setEpisodeImageLoaded(true)}
                                    onError={() => setImageError(true)}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                    <Podcast className="w-6 h-6 text-gray-600" />
                                  </div>
                                )
                              ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                  <Podcast className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium line-clamp-2 leading-tight">
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
                      {/* Mini player for Galaxy/standalone audio context - full width under episode row */}
                      {renderEpisodeMiniPlayer()}
                    </div>
                  )}

                  {/* Fallback: Mini player when episode data is missing but we have direct audio props */}
                  {!hierarchy.hierarchy.episode && effectiveAudioUrl && (
                    <div className="pb-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 relative">
                          {episodeImage && !imageError && !episodeImageLoaded && (
                            <div className="absolute inset-0 shimmer-loading rounded" />
                          )}
                          {episodeImage && !imageError ? (
                            <img
                              src={episodeImage}
                              alt="Episode"
                              className={`w-full h-full object-cover ${episodeImageLoaded ? 'block' : 'invisible'}`}
                              onLoad={() => setEpisodeImageLoaded(true)}
                              onError={() => setImageError(true)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <Podcast className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {episodeTitle && (
                            <p className="text-sm text-white font-medium line-clamp-2 leading-tight">
                              {episodeTitle}
                            </p>
                          )}
                          {creator && (
                            <p className="text-xs text-gray-400 mt-1">{creator}</p>
                          )}
                        </div>
                      </div>
                      {renderEpisodeMiniPlayer()}
                    </div>
                  )}

                  {/* Chapter - Now Clickable */}
                  {hierarchy.hierarchy.chapter && (
                    <div 
                      className="flex items-start space-x-3 cursor-pointer hover:bg-gray-800/30 rounded p-2 -m-2 transition-colors"
                      onClick={() => {
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
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: HIERARCHY_COLORS.CHAPTER,
                            boxShadow: `0 0 6px 2px ${HIERARCHY_COLORS.CHAPTER}`,
                            border: `1px solid ${HIERARCHY_COLORS.CHAPTER}`,
                          }}
                        ></div>
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
                {hierarchy.hierarchy.chapter && hierarchy.hierarchy.chapter.metadata.keywords && hierarchy.hierarchy.chapter.metadata.keywords.length > 0 && (
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
                                // Prefer numeric/string feedId from metadata (API filter expects the raw feed id, not "feed_####")
                                const feedId = hierarchy.hierarchy.feed?.metadata.feedId || hierarchy.hierarchy.feed?.id;
                                printLog(`Searching this feed (${feedId}) for keyword: ${keyword}`);
                                onKeywordSearch?.(keyword, feedId);
                              }
                            },
                            {
                              label: 'Search - This Episode',
                              icon: <ScanSearch className="w-3.5 h-3.5" />,
                              color: HIERARCHY_COLORS.EPISODE,
                              onClick: () => {
                                const episodeGuid = hierarchy.hierarchy.episode?.metadata.guid;
                                printLog(`Searching this episode (${episodeGuid}) for keyword: ${keyword}`);
                                onKeywordSearch?.(keyword, undefined, episodeGuid);
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
            ) : effectiveAudioUrl ? (
              // Fallback: No hierarchy data but we have direct audio props (e.g. debug/mock mode)
              <div className="space-y-4">
                {/* Episode info from direct props */}
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 relative">
                    {episodeImage && !imageError && !episodeImageLoaded && (
                      <div className="absolute inset-0 shimmer-loading rounded" />
                    )}
                    {episodeImage && !imageError ? (
                      <img
                        src={episodeImage}
                        alt="Episode"
                        className={`w-full h-full object-cover ${episodeImageLoaded ? 'block' : 'invisible'}`}
                        onLoad={() => setEpisodeImageLoaded(true)}
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <Podcast className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {episodeTitle && (
                      <p className="text-sm text-white font-medium line-clamp-2 leading-tight">
                        {episodeTitle}
                      </p>
                    )}
                    {creator && (
                      <p className="text-xs text-gray-400 mt-1">{creator}</p>
                    )}
                  </div>
                </div>
                {/* Mini player with direct audio props */}
                {renderEpisodeMiniPlayer()}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">
                <p>No details available</p>
              </div>
            )}
          </div>
        </div>
        )}
        </div>

        {/* Bottom layout: Details/Context toggle lives on the right as vertical tabs (saves vertical space) */}
        {isBottomLayout && viewMode !== ViewMode.CHAPTER && (
          <div className="w-12 flex-shrink-0 border-l border-gray-800 bg-[#0A0A0A] flex flex-col items-center py-2 gap-2">
            <button
              onClick={() => setMobileView('details')}
              className={`w-9 h-9 rounded-md border transition-colors flex items-center justify-center ${
                mobileView === 'details'
                  ? 'bg-black text-white border-gray-700'
                  : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900/70'
              }`}
              aria-label="Details"
              title="Details"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileView('context')}
              className={`w-9 h-9 rounded-md border transition-colors flex items-center justify-center ${
                mobileView === 'context'
                  ? 'bg-black text-white border-gray-700'
                  : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900/70'
              }`}
              aria-label="Context"
              title="Context"
            >
              <BookText className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      ) : (
        // Collapsed tray: narrow vertical tab the user can click to re-expand
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setIsCollapsed(false)}
            className="h-32 w-full flex items-center justify-center bg-[#0A0A0A] hover:bg-gray-900 border-l border-gray-800 text-gray-300"
            aria-label="Expand details panel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PodcastContextPanel;


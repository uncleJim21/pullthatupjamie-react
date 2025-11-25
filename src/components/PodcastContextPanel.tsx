import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Podcast } from 'lucide-react';
import ContextService, { AdjacentParagraph, HierarchyResponse } from '../services/contextService.ts';
import { printLog } from '../constants/constants.ts';

interface PodcastContextPanelProps {
  paragraphId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const PodcastContextPanel: React.FC<PodcastContextPanelProps> = ({
  paragraphId,
  isOpen,
  onClose
}) => {
  const [paragraphs, setParagraphs] = useState<AdjacentParagraph[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
        setParagraphs(adjacentData.paragraphs);
        setHierarchy(hierarchyData);
        setHighlightedParagraphId(paragraphId);

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

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-black border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out z-40 ${
        isOpen ? 'w-[800px] translate-x-0' : 'w-[800px] translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-white text-lg font-semibold">Clip Context</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close panel"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Split Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Adjacent Paragraphs */}
        <div className="flex-1 flex flex-col border-r border-gray-800">
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
                  return (
                    <div
                      key={paragraph.id}
                      data-paragraph-id={paragraph.id}
                      className={`p-3 rounded-lg transition-all cursor-pointer ${
                        isHighlighted
                          ? 'bg-white/10 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                          : 'bg-gray-900/50 hover:bg-gray-800/50 border border-transparent'
                      }`}
                      onClick={() => {
                        setHighlightedParagraphId(paragraph.id);
                        printLog(`Clicked paragraph: ${paragraph.id} at ${paragraph.start_time}s`);
                      }}
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-xs text-gray-500 font-mono min-w-[3rem] flex-shrink-0">
                          {formatTime(paragraph.start_time)}
                        </span>
                        <p className="text-sm text-gray-300 leading-relaxed flex-1">
                          {paragraph.text}
                        </p>
                      </div>
                    </div>
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

        {/* Right Side - Hierarchy Details */}
        <div className="w-[320px] flex flex-col bg-[#0A0A0A]">
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">Details</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              </div>
            ) : hierarchy ? (
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
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chapter */}
                  {hierarchy.hierarchy.chapter && (
                    <div className="flex items-start space-x-3">
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
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded"
                        >
                          {keyword}
                        </span>
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


import React, { useState } from 'react';
import { Bookmark, ChevronUp, ChevronDown, X, Download, Share2 } from 'lucide-react';
import { formatShortDate } from '../utils/time.ts';

interface ResearchSessionItem {
  shareLink: string;
  quote?: string;
  summary?: string;
  headline?: string;
  episode: string;
  creator: string;
  episodeImage?: string;
  date: string;
  hierarchyLevel: 'feed' | 'episode' | 'chapter' | 'paragraph';
  addedAt: Date;
}

interface ResearchSessionCollectorProps {
  items: ResearchSessionItem[];
  onRemoveItem: (shareLink: string) => void;
  onClearAll: () => void;
  maxPreviewItems?: number;
}

export const ResearchSessionCollector: React.FC<ResearchSessionCollectorProps> = ({
  items,
  onRemoveItem,
  onClearAll,
  maxPreviewItems = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayItems = isExpanded ? items : items.slice(0, maxPreviewItems);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Header - Always visible */}
      <div className="bg-black/90 backdrop-blur-sm border border-gray-700 rounded-t-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">
            Research Session
          </span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400">({items.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content - Expandable */}
      {items.length > 0 ? (
        <div className="bg-black/90 backdrop-blur-sm border-x border-gray-700">
          <div className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? 'max-h-96' : 'max-h-60'
          }`}>
            <div className="overflow-y-auto max-h-full">
              {displayItems.map((item) => {
                // Determine display title and subtitle
                const title = item.headline || item.episode;
                const subtitle = item.summary || item.quote || '';

                return (
                  <div
                    key={item.shareLink}
                    className="border-b border-gray-800 p-3 hover:bg-gray-900/50 transition-colors group"
                  >
                    <div className="flex gap-2">
                      {item.episodeImage && (
                        <img
                          src={item.episodeImage}
                          alt={title}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-medium text-white line-clamp-1">
                            {title}
                          </h4>
                          <button
                            onClick={() => onRemoveItem(item.shareLink)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 flex-shrink-0"
                            aria-label="Remove from session"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                          {subtitle}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {item.creator}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">
                            {formatShortDate(item.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Show more indicator */}
          {!isExpanded && items.length > maxPreviewItems && (
            <div className="px-3 py-2 text-center">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                +{items.length - maxPreviewItems} more
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-black/90 backdrop-blur-sm border-x border-gray-700 px-4 py-6 text-center">
          <p className="text-sm text-gray-400">
            No items collected yet
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Hover over stars and click "Add to Research"
          </p>
        </div>
      )}

      {/* Footer - Action buttons */}
      <div className="bg-black/90 backdrop-blur-sm border border-gray-700 rounded-b-lg px-4 py-3">
        {items.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="flex-1 text-xs px-3 py-1.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Clear All
            </button>
            <button
              className="flex-1 text-xs px-3 py-1.5 bg-white hover:bg-gray-200 rounded text-black transition-colors flex items-center justify-center gap-1.5"
              disabled
              title="Coming soon"
            >
              <Download className="w-3 h-3" />
              Save
            </button>
            <button
              className="flex-1 text-xs px-3 py-1.5 bg-white hover:bg-gray-200 rounded text-black transition-colors flex items-center justify-center gap-1.5"
              disabled
              title="Coming soon"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center">
            Actions will appear once you add items
          </div>
        )}
      </div>
    </div>
  );
};

export type { ResearchSessionItem };

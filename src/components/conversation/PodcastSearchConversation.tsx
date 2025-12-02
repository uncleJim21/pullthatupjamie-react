// PodcastSearchConversation.tsx
import React from 'react';
import type { PodcastSearchItem } from '../../types/conversation';
import { PodcastSearchResultItem, PresentationContext } from '../podcast/PodcastSearchResultItem.tsx';
import { BaseConversationLayout } from './BaseConversationLayout.tsx';
import { ClipProgress } from '../../types/clips.ts';
import { AuthConfig, AIClipsViewStyle } from '../../constants/constants.ts';

interface PodcastSearchConversationProps {
  item: PodcastSearchItem;
  clipProgress?: ClipProgress | null;
  onClipProgress: (progress: ClipProgress) => void;
  authConfig?: AuthConfig | null | undefined;
  onShareModalOpen?: (isOpen: boolean) => void;
  onSocialShareModalOpen?: (isOpen: boolean) => void;
  isClipBatchPage?: boolean;
  clipBatchViewMode?: AIClipsViewStyle;
  selectedParagraphId?: string | null;
  onResultClick?: (paragraphId: string) => void;
}

// PodcastSearchConversation.tsx
export const PodcastSearchConversation: React.FC<PodcastSearchConversationProps> = ({ 
  item, 
  clipProgress,
  onClipProgress,
  authConfig,
  onShareModalOpen,
  onSocialShareModalOpen,
  isClipBatchPage,
  clipBatchViewMode,
  selectedParagraphId,
  onResultClick
}) => {
  // For clipBatch pages, render based on view mode
  if (isClipBatchPage && clipBatchViewMode === AIClipsViewStyle.GRID) {
    return (
      <BaseConversationLayout query={item.query}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-48">
          {item.data.quotes.map((quote, index) => {
            // Use shareLink as fallback if id is undefined
            const quoteId = quote.id || quote.shareLink;
            return (
              <PodcastSearchResultItem
                key={index}
                {...quote}
                id={`${item.id}-${index}`}
                onClipProgress={onClipProgress}
                authConfig={authConfig}
                onShareModalOpen={onShareModalOpen}
                onSocialShareModalOpen={onSocialShareModalOpen}
                presentationContext={PresentationContext.clipBatch}
                viewMode={AIClipsViewStyle.GRID}
                isHighlighted={selectedParagraphId === quoteId && index === 0}
                onResultClick={onResultClick}
              />
            );
          })}
        </div>
      </BaseConversationLayout>
    );
  }

  // Default list view
  return (
    <BaseConversationLayout query={item.query}>
      <div className="space-y-6 pb-48">
        {item.data.quotes.map((quote, index) => {
          // Use shareLink as fallback if id is undefined
          const quoteId = quote.id || quote.shareLink;
          return (
            <PodcastSearchResultItem
              key={index}
              {...quote}
              id={`${item.id}-${index}`}
              onClipProgress={onClipProgress}
              authConfig={authConfig}
              onShareModalOpen={onShareModalOpen}
              onSocialShareModalOpen={onSocialShareModalOpen}
              presentationContext={isClipBatchPage ? PresentationContext.clipBatch : PresentationContext.search}
              isHighlighted={selectedParagraphId === quoteId}
              onResultClick={onResultClick}
            />
          );
        })}
      </div>
    </BaseConversationLayout>
  );
};
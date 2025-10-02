// PodcastSearchConversation.tsx
import React, { useState, useRef } from 'react';
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
  clipBatchViewMode
}) => {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  const handlePlayPause = (id: string) => {
    if (currentlyPlayingId === id) {
      // If clicking the same audio, just toggle it
      setCurrentlyPlayingId(null);
    } else {
      // If clicking a different audio, update the playing id
      setCurrentlyPlayingId(id);
    }
  };

  const handleEnded = (id: string) => {
    // When a podcast ends, always ensure it goes to pause state
    setCurrentlyPlayingId(null);
  };

  // For clipBatch pages, render based on view mode
  if (isClipBatchPage && clipBatchViewMode === AIClipsViewStyle.GRID) {
    return (
      <BaseConversationLayout query={item.query}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-48">
          {item.data.quotes.map((quote, index) => (
            <PodcastSearchResultItem
              key={index}
              {...quote}
              id={`${item.id}-${index}`}
              isPlaying={currentlyPlayingId === `${item.id}-${index}`}
              onPlayPause={handlePlayPause}
              onEnded={handleEnded}
              onClipProgress={onClipProgress}
              authConfig={authConfig}
              onShareModalOpen={onShareModalOpen}
              onSocialShareModalOpen={onSocialShareModalOpen}
              presentationContext={PresentationContext.clipBatch}
              viewMode={AIClipsViewStyle.GRID}
            />
          ))}
        </div>
      </BaseConversationLayout>
    );
  }

  // Default list view
  return (
    <BaseConversationLayout query={item.query}>
      <div className="space-y-6 pb-48">
        {item.data.quotes.map((quote, index) => (
          <PodcastSearchResultItem
            key={index}
            {...quote}
            id={`${item.id}-${index}`}
            isPlaying={currentlyPlayingId === `${item.id}-${index}`}
            onPlayPause={handlePlayPause}
            onEnded={handleEnded}
            onClipProgress={onClipProgress}
            authConfig={authConfig}
            onShareModalOpen={onShareModalOpen}
            onSocialShareModalOpen={onSocialShareModalOpen}
            presentationContext={isClipBatchPage ? PresentationContext.clipBatch : PresentationContext.search}
          />
        ))}
      </div>
    </BaseConversationLayout>
  );
};
// components/conversation/ConversationRenderer.tsx
import React from 'react';
import { QuickModeConversation } from './QuickModeConversation.tsx';
import { ExpertModeConversation } from './ExpertModeConversation.tsx';
import { PodcastSearchConversation } from './PodcastSearchConversation.tsx';
import type { ConversationItem } from '../../types/conversation';
import { ClipProgress } from '../../types/clips.ts';
import { AuthConfig, AIClipsViewStyle } from '../../constants/constants.ts';

interface ConversationRendererProps {
  item: ConversationItem;
  clipProgress?: ClipProgress | null;
  onClipProgress: (progress: ClipProgress) => void;
  authConfig?: AuthConfig | null | undefined;
  onShareModalOpen?: (isOpen: boolean) => void;
  onSocialShareModalOpen?: (isOpen: boolean) => void;
  isClipBatchPage?: boolean;
  clipBatchViewMode?: AIClipsViewStyle;
  selectedParagraphId?: string | null;
  onResultClick?: (
    paragraphId: string,
    audioContext?: {
      audioUrl: string;
      timeContext: { start_time: number; end_time: number };
      episode: string;
      episodeImage: string;
      creator: string;
      listenLink?: string;
      date?: string;
    }
  ) => void;
}

export const ConversationRenderer: React.FC<ConversationRendererProps> = ({ 
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
  switch (item.type) {
    case 'web-search':
      return <QuickModeConversation item={item} />;
    case 'expert':
      return <ExpertModeConversation item={item} />;
    case 'podcast-search':
      return (
        <PodcastSearchConversation 
          item={item} 
          clipProgress={clipProgress}
          onClipProgress={onClipProgress}
          authConfig={authConfig}
          onShareModalOpen={onShareModalOpen}
          onSocialShareModalOpen={onSocialShareModalOpen}
          isClipBatchPage={isClipBatchPage}
          clipBatchViewMode={clipBatchViewMode}
          selectedParagraphId={selectedParagraphId}
          onResultClick={onResultClick}
        />
      );
    default:
      return null;
  }
};
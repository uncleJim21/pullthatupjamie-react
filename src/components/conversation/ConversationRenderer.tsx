// components/conversation/ConversationRenderer.tsx
import React from 'react';
import { QuickModeConversation } from './QuickModeConversation.tsx';
import { ExpertModeConversation } from './ExpertModeConversation.tsx';
import { PodcastSearchConversation } from './PodcastSearchConversation.tsx';
import type { ConversationItem } from '../../types/conversation';
import { ClipProgress } from '../../types/clips.ts';
import { AuthConfig } from '../../constants/constants.ts';

interface ConversationRendererProps {
  item: ConversationItem;
  clipProgress?: ClipProgress | null;
  onClipProgress: (progress: ClipProgress) => void;
  authConfig?: AuthConfig | null | undefined;
}

export const ConversationRenderer: React.FC<ConversationRendererProps> = ({ 
  item,
  clipProgress,
  onClipProgress,
  authConfig
}) => {
  switch (item.type) {
    case 'quick':
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
        />
      );
    default:
      return null;
  }
};
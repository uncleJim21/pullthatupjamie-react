// components/conversation/ConversationRenderer.tsx
import React from 'react';
import { QuickModeConversation } from './QuickModeConversation.tsx';
import { ExpertModeConversation } from './ExpertModeConversation.tsx';
import { PodcastSearchConversation } from './PodcastSearchConversation.tsx';
import type { ConversationItem } from '../../types/conversation';

interface ConversationRendererProps {
  item: ConversationItem;
}

export const ConversationRenderer: React.FC<ConversationRendererProps> = ({ item }) => {
  switch (item.type) {
    case 'quick':
      return <QuickModeConversation item={item} />;
    case 'expert':
      return <ExpertModeConversation item={item} />;
    case 'podcast-search':
      return <PodcastSearchConversation item={item} />;
    default:
      return null;
  }
};
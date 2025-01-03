import React from 'react';
import type { PodcastSearchItem } from '../../types/conversation.ts';
import { PodcastSearchResultItem } from '../podcast/PodcastSearchResultItem.tsx';
import { BaseConversationLayout } from './BaseConversationLayout.tsx';

interface PodcastSearchConversationProps {
  item: PodcastSearchItem;
}

export const PodcastSearchConversation: React.FC<PodcastSearchConversationProps> = ({ item }) => {
  return (
    <BaseConversationLayout query={item.query}>
      <div className="space-y-6">
        {item.data.quotes.map((quote, index) => (
          <PodcastSearchResultItem
            key={index}
            {...quote}
          />
        ))}
      </div>
    </BaseConversationLayout>
  );
};
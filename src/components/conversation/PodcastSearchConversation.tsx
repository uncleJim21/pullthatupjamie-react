// components/conversation/PodcastSearchConversation.tsx
import React from 'react';
import type { PodcastSearchItem } from '../../types/conversation.ts';
import { PodcastSearchResultItem } from '../podcast/PodcastSearchResultItem.tsx';

interface PodcastSearchConversationProps {
  item: PodcastSearchItem;
}

export const PodcastSearchConversation: React.FC<PodcastSearchConversationProps> = ({ item }) => {
  return (
    <div className="space-y-4">
      <div className="font-medium text-white-400 max-w-[75%] break-words">
        Query: {item.query}
      </div>
      <div style={{ "borderBottom": "1px solid #353535" }}></div>

      <div className="space-y-6">
        {item.data.quotes.map((quote, index) => (
          <PodcastSearchResultItem
            key={index}
            {...quote}
          />
        ))}
      </div>
    </div>
  );
};
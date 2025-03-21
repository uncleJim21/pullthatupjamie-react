// components/conversation/ExpertModeConversation.tsx
import React from 'react';
import { SourceTile } from '../SourceTile.tsx';
import { StreamingText } from '../StreamingText.tsx';
import type { ExpertModeItem } from '../../types/conversation';

interface ExpertModeConversationProps {
  item: ExpertModeItem;
}

export const ExpertModeConversation: React.FC<ExpertModeConversationProps> = ({ item }) => {
  return (
    <div className="space-y-4">
      <div className="font-medium text-white-400 max-w-[75%] break-words">
        Query: {item.query}
      </div>
      <div style={{ "borderBottom": "1px solid #353535" }}></div>

      {item.data.sources.length > 0 && (
        <div className="relative">
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-4">
              {item.data.sources.map((source, idx) => (
                <div key={idx} style={{ minWidth: '300px' }}>
                  <SourceTile
                    title={source.title}
                    url={source.url}
                    index={idx + 1}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute left-0 top-0 h-full w-5 bg-gradient-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-5 bg-gradient-to-l from-black to-transparent" />
        </div>
      )}

      <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
        <StreamingText 
          text={item.data.result} 
          isLoading={item.isStreaming}
        />
      </div>
    </div>
  );
};
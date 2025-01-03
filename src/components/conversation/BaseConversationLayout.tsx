import React from 'react';

interface BaseConversationLayoutProps {
  query: string;
  children: React.ReactNode;
}

export const BaseConversationLayout: React.FC<BaseConversationLayoutProps> = ({ 
  query, 
  children 
}) => {
  return (
    <div className="space-y-4">
      <div className="font-medium text-white-400 max-w-[75%] break-words">
        Query: {query}
      </div>
      <div className="border-b border-[#353535]"></div>
      {children}
    </div>
  );
};

export default BaseConversationLayout;
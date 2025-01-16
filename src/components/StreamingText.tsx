// components/StreamingText.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingTextProps {
  text: string;
  isLoading: boolean;
}

export const StreamingText: React.FC<StreamingTextProps> = ({ text, isLoading }) => {
  return (
    <div className="prose prose-invert max-w-none relative">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="text-white" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-4 my-4" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-4 my-4" />
          ),
          li: ({ node, children, ...props }) => (
            <li {...props} className="my-2">
              {React.Children.map(children, child => {
                if (React.isValidElement(child) && child.type === 'p') {
                  return child.props.children;
                }
                return child;
              })}
            </li>
          )
        }}
      >
        {text}
      </ReactMarkdown>
      {isLoading && (
        <span className="inline-block w-2 h-4 ml-1 bg-white animate-pulse" />
      )}
    </div>
  );
};
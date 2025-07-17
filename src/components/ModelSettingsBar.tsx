// components/ModelSettingsBar.tsx
import React, { useState } from 'react';

interface ModelSettingsBarProps {
  model: 'gpt-3.5-turbo' | 'claude-3-sonnet';
  setModel: (model: 'gpt-3.5-turbo' | 'claude-3-sonnet') => void;
  searchMode: 'web-search' | 'podcast-search';
  setSearchMode: (mode: 'web-search' | 'podcast-search') => void;
  dropUp?: boolean;
  className?: string;
}

const SearchDropdown = ({ searchMode, setSearchMode, className = "" }: { 
  searchMode: 'web-search' | 'podcast-search';
  setSearchMode: (mode: 'web-search' | 'podcast-search') => void;
  className?: string;
}) => (
  <div className={`mr-6 ${className}`}>
    <div className="border border-gray-700 rounded-md px-2 py-1">
      <select
        value={searchMode}
        onChange={(e) => setSearchMode(e.target.value as 'web-search' | 'podcast-search')}
        className="bg-transparent text-gray-400 border-none focus:outline-none cursor-pointer text-sm pr-4"
      >
        <option value="web-search" className="bg-[#111111]">🌐 Web Search</option>
        <option value="podcast-search" className="bg-[#111111]">🎙️ Podcast Search</option>
      </select>
    </div>
  </div>
);

const ModelSettings = ({ model, setModel, isOpen, setIsOpen, dropUp = false }: {
  model: 'gpt-3.5-turbo' | 'claude-3-sonnet';
  setModel: (model: 'gpt-3.5-turbo' | 'claude-3-sonnet') => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  dropUp?: boolean;
}) => {
  return (
    <div className="relative mr-3 pr-2 pl-2.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-gray-300 transition-colors"
        type="button"
      >
        <svg 
          className="w-5 h-5 mt-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-48 rounded-md shadow-lg bg-[#111111] border border-gray-800 ${
          dropUp ? 'bottom-full mb-2' : 'mt-2'
        }`}>
          <div className="py-1">
            <button
                type="button"
                className={`flex items-center px-4 py-2 text-sm w-full ${model === 'claude-3-sonnet' ? 'text-white' : 'text-gray-600'} hover:bg-[#1A1A1A]`}
                onClick={() => {
                  setModel('claude-3-sonnet');
                  setIsOpen(false);
                }}
              >
              <div className={`relative w-5 h-5 mr-2 ${model === 'claude-3-sonnet' ? 'opacity-100' : 'opacity-25'}`}>
              <img
                src="/claude-logo.png"
                alt="Claude Logo"
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                className="object-contain"
              />
              </div>
              Claude
            </button>
            <button
              type="button"
              className={`flex items-center px-4 py-2 text-sm w-full ${model === 'gpt-3.5-turbo' ? 'text-white' : 'text-gray-600'} hover:bg-[#1A1A1A]`}
              onClick={() => {
                setModel('gpt-3.5-turbo');
                setIsOpen(false);
              }}
            >
              <div className={`relative w-5 h-5 mr-2 ${model === 'gpt-3.5-turbo' ? 'opacity-100' : 'opacity-25'}`}>
                <img
                  src="/chat-gpt-logo.png"
                  alt="ChatGPT Logo"
                  className="object-contain"
                />
              </div>
              ChatGPT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ModelSettingsBar: React.FC<ModelSettingsBarProps> = ({
  model,
  setModel,
  searchMode,
  setSearchMode,
  dropUp = false,
  className = ""
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <SearchDropdown searchMode={searchMode} setSearchMode={setSearchMode} />
      <ModelSettings 
        model={model} 
        setModel={setModel} 
        isOpen={isSettingsOpen}
        setIsOpen={setIsSettingsOpen}
        dropUp={dropUp}
      />
    </>
  );
};

export type { ModelSettingsBarProps };
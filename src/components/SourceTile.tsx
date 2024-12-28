import React, { useEffect, useState } from 'react';

interface SourceTileProps {
  title: string;
  url: string;
  index: number;
}

export function SourceTile({ title, url, index }: SourceTileProps) {
  const [faviconUrl, setFaviconUrl] = useState('');

  useEffect(() => {
    try {
      const domain = new URL(url).origin;
      setFaviconUrl(`${domain}/favicon.ico`);
    } catch {
      setFaviconUrl('');
    }
  }, [url]);

  const siteName = (() => {
    try {
      return new URL(url).hostname
        .replace('www.', '')
        .split('.')
        .slice(0, -1)
        .join('.')
        .charAt(0)
        .toUpperCase() + 
        new URL(url).hostname
          .replace('www.', '')
          .split('.')
          .slice(0, -1)
          .join('.')
          .slice(1);
    } catch {
      return url;
    }
  })();

  const truncatedTitle = (() => {
    const maxLength = 60;
    if (title.length <= maxLength) return title;
    const truncated = title.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return `${truncated.slice(0, lastSpace)}...`;
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 hover:bg-[#1A1A1A] transition-all group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#1A1A1A] rounded-full text-xs font-medium text-gray-400 group-hover:bg-[#222222]">
          {index}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-4 h-4">
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt={`${siteName} favicon`}
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = './default-source-favicon.png';
                }}
              />
            )}
          </div>
          <div className="min-w-0 max-w-lg">
            <div className="text-white font-bold truncate" title={title}>
              {truncatedTitle}
            </div>
            <div className="text-sm text-gray-400 font-semibold truncate">
              {siteName}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
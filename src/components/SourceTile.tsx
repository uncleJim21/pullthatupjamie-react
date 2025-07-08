import React, { useEffect, useState, useRef } from 'react';

interface SourceTileProps {
  title: string;
  url: string;
  index: number;
}

// Global cache to track failed URLs and prevent repeated attempts
const failedUrls = new Set<string>();
const requestCounts = new Map<string, number>();
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay

export function SourceTile({ title, url, index }: SourceTileProps) {
  const [faviconUrl, setFaviconUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const cacheKey = url;
    
    // Check if this URL has already failed multiple times
    if (failedUrls.has(cacheKey)) {
      setFaviconUrl('');
      setIsLoading(false);
      setHasError(true);
      return;
    }

    try {
      const domain = new URL(url).origin;
      setFaviconUrl(`${domain}/favicon.ico`);
      setIsLoading(true);
      setHasError(false);
    } catch {
      setFaviconUrl('');
      setIsLoading(false);
      setHasError(true);
      failedUrls.add(cacheKey);
    }

    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [url]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    const cacheKey = url;

    // Get current retry count
    const currentCount = requestCounts.get(cacheKey) || 0;

    // If we've already tried the default favicon or exceeded max retries, give up
    if (currentSrc.includes('default-source-favicon.png') || currentCount >= MAX_RETRIES) {
      setIsLoading(false);
      setHasError(true);
      failedUrls.add(cacheKey);
      requestCounts.delete(cacheKey);
      return;
    }

    // Increment retry count
    requestCounts.set(cacheKey, currentCount + 1);

    // Calculate delay with exponential backoff
    const delay = BASE_DELAY * Math.pow(2, currentCount);

    // Set a timeout before trying the default favicon
    retryTimeoutRef.current = setTimeout(() => {
      if (target && target.parentNode) { // Make sure element still exists
        target.src = './default-source-favicon.png';
      }
    }, delay);

    setIsLoading(false);
  };

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
            {faviconUrl && !hasError && (
              <img
                src={faviconUrl}
                alt={`${siteName} favicon`}
                className="w-4 h-4 object-contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
            {isLoading && (
              <div className="w-4 h-4 bg-gray-700 rounded animate-pulse"></div>
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
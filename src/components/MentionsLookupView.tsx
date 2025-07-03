import React, { useState, useEffect } from 'react';
import { Twitter, Loader2 } from 'lucide-react';
import { mentionService } from '../services/mentionService.ts';
import { MentionResult, TwitterResult, NostrResult } from '../types/mention.ts';

enum Platform {
  Twitter = 'twitter',
  Nostr = 'nostr'
}

interface MentionsLookupViewProps {
  onMentionSelect?: (mention: MentionResult, platform: Platform) => void;
  searchQuery?: string;
  onClose?: () => void;
  onFirstMentionChange?: (mention: MentionResult | null) => void;
}

const MentionsLookupView: React.FC<MentionsLookupViewProps> = ({
  onMentionSelect,
  searchQuery = '',
  onClose,
  onFirstMentionChange
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(Platform.Twitter);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch mentions when searchQuery or platform changes
  useEffect(() => {
    const fetchMentions = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setMentionResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Search both platforms but we'll filter by selected platform for display
        const result = await mentionService.searchMentions(searchQuery, {
          platforms: ['twitter', 'nostr'], // Always search both platforms
          includePersonalPins: true,
          includeCrossPlatformMappings: true,
          limit: 10
        });
        
        if (result.success && result.results) {
          setMentionResults(result.results);
        } else {
          setError(result.error || 'Failed to fetch mentions');
          setMentionResults([]);
        }
      } catch (err) {
        setError('Network error occurred');
        setMentionResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchMentions, 300); // Debounce API calls
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Filter results by selected platform
  const filteredResults = mentionResults.filter(result => result.platform === selectedPlatform);

  // Notify parent of first mention changes for Tab key functionality
  useEffect(() => {
    const firstMention = filteredResults.length > 0 ? filteredResults[0] : null;
    onFirstMentionChange?.(firstMention);
  }, [filteredResults, onFirstMentionChange]);

  const handleMentionClick = (mention: MentionResult) => {
    onMentionSelect?.(mention, selectedPlatform);
    onClose?.();
  };

  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const truncateMiddle = (str: string, maxLength: number = 14) => {
    if (str.length <= maxLength) return str;
    
    const ellipsis = '...';
    const remainingLength = maxLength - ellipsis.length;
    const startLength = Math.ceil(remainingLength / 2);
    const endLength = Math.floor(remainingLength / 2);
    
    return str.slice(0, startLength) + ellipsis + str.slice(-endLength);
  };

  const renderTwitterResult = (result: TwitterResult) => (
    <div
      key={result.id}
      onClick={() => handleMentionClick(result)}
      className="px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group grid grid-cols-[32px_1fr] gap-3 items-center"
    >
      {/* Profile Image */}
      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
        {result.profile_image_url ? (
          <img 
            src={result.profile_image_url} 
            alt={result.name}
            className="w-8 h-8 object-cover"
          />
        ) : (
          <Twitter className="w-4 h-4 text-blue-400" />
        )}
      </div>
      
      {/* User Info */}
      <div className="min-w-0 flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <span className="text-white font-medium text-xs">
            {truncateMiddle(result.name)}
          </span>
          {result.verified && (
            <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {result.isPinned && (
            <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 002 2h2a1 1 0 110 2h-2a2 2 0 00-2 2v2a1 1 0 11-2 0v-2a2 2 0 00-2-2H7a2 2 0 00-2 2v2a1 1 0 11-2 0v-2a2 2 0 002-2h2a2 2 0 002-2V5z" />
              </svg>
            </div>
          )}
          {result.crossPlatformMapping?.hasNostrMapping && (
            <img 
              src="/nostr-logo-square.png" 
              alt="Has Nostr mapping" 
              className="w-3 h-3"
              style={{ filter: 'brightness(1.2)' }}
              title="Also available on Nostr"
            />
          )}
        </div>
        <div className="text-gray-400 text-xs">@{truncateMiddle(result.username)}</div>
      </div>
    </div>
  );

  const renderNostrResult = (result: NostrResult) => (
    <div
      key={result.npub}
      onClick={() => handleMentionClick(result)}
      className="px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group grid grid-cols-[32px_1fr] gap-3 items-center"
    >
      {/* Profile Image */}
      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
        {result.picture ? (
          <img 
            src={result.picture} 
            alt={result.displayName || 'Nostr User'}
            className="w-8 h-8 object-cover"
          />
        ) : (
          <img 
            src="/nostr-logo-square.png" 
            alt="Nostr" 
            className="w-4 h-4"
            style={{ filter: 'brightness(1.2)' }}
          />
        )}
      </div>
      
      {/* User Info */}
      <div className="min-w-0 flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <span className="text-white font-medium text-xs">
            {truncateMiddle(result.displayName || 'Unknown')}
          </span>
          {result.nip05 && (
            <div className="w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {result.isPinned && (
            <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 002 2h2a1 1 0 110 2h-2a2 2 0 00-2 2v2a1 1 0 11-2 0v-2a2 2 0 00-2-2H7a2 2 0 00-2 2v2a1 1 0 11-2 0v-2a2 2 0 002-2h2a2 2 0 002-2V5z" />
              </svg>
            </div>
          )}
          {result.crossPlatformMapping?.hasTwitterMapping && (
            <div title="Also available on Twitter">
              <Twitter className="w-3 h-3 text-blue-400" />
            </div>
          )}
        </div>
        <div className="text-gray-400 text-xs">
          {result.nip05 || `${truncateMiddle(result.npub, 12)}...`}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-72 sm:w-80 mx-2 sm:mx-0 bg-black border border-gray-700 rounded-lg shadow-xl overflow-hidden">
      {/* Compact Header with Platform Tabs */}
      <div className="flex bg-gray-900 border-b border-gray-700">
        <button
          onClick={() => setSelectedPlatform(Platform.Twitter)}
          className={`flex-1 flex items-center justify-center py-2 px-3 text-xs font-medium transition-all ${
            selectedPlatform === Platform.Twitter
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Twitter className="w-3 h-3 mr-1.5" />
          Twitter
          {mentionResults.filter(r => r.platform === 'twitter').length > 0 && (
            <span className="ml-2 bg-gray-600 text-xs px-1.5 py-0.5 rounded">
              {mentionResults.filter(r => r.platform === 'twitter').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSelectedPlatform(Platform.Nostr)}
          className={`flex-1 flex items-center justify-center py-2 px-3 text-xs font-medium transition-all ${
            selectedPlatform === Platform.Nostr
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <img 
            src="/nostr-logo-square.png" 
            alt="Nostr" 
            className="w-3 h-3 mr-1.5"
            style={{ filter: 'brightness(1.2)' }}
          />
          Nostr
          {mentionResults.filter(r => r.platform === 'nostr').length > 0 && (
            <span className="ml-2 bg-gray-600 text-xs px-1.5 py-0.5 rounded">
              {mentionResults.filter(r => r.platform === 'nostr').length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-y-auto">
        <div className="divide-y divide-gray-800">
          {isLoading ? (
            <div className="px-3 py-4 text-center text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading...</p>
            </div>
          ) : error ? (
            <div className="px-3 py-4 text-center text-gray-400">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((result) => 
              result.platform === 'twitter' 
                ? renderTwitterResult(result as TwitterResult)
                : renderNostrResult(result as NostrResult)
            )
          ) : (
            <div className="px-3 py-4 text-center text-gray-400">
              <p className="text-xs">No results found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MentionsLookupView; 
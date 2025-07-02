import React, { useState, useEffect } from 'react';
import { Twitter, Loader2 } from 'lucide-react';
import { twitterService, TwitterUser } from '../services/twitterService.ts';

enum Platform {
  Twitter = 'twitter',
  Nostr = 'nostr'
}

interface MentionsLookupViewProps {
  onMentionSelect?: (mention: TwitterUser, platform: Platform) => void;
  searchQuery?: string;
  onClose?: () => void;
}

const MentionsLookupView: React.FC<MentionsLookupViewProps> = ({
  onMentionSelect,
  searchQuery = '',
  onClose
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(Platform.Twitter);
  const [twitterUsers, setTwitterUsers] = useState<TwitterUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Twitter users when searchQuery changes
  useEffect(() => {
    const fetchUsers = async () => {
      if (!searchQuery || searchQuery.length < 2 || selectedPlatform !== Platform.Twitter) {
        setTwitterUsers([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Use the actual search query to find matching usernames
        const result = await twitterService.lookupUsers([searchQuery]);
        
        if (result.success && result.data) {
          setTwitterUsers(result.data);
        } else {
          setError(result.error || 'Failed to fetch users');
          setTwitterUsers([]);
        }
      } catch (err) {
        setError('Network error occurred');
        setTwitterUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 300); // Debounce API calls
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedPlatform]);

  const handleMentionClick = (mention: TwitterUser) => {
    onMentionSelect?.(mention, selectedPlatform);
    onClose?.();
  };

  const formatFollowerCount = (count: string) => {
    return count;
  };

  const truncateMiddle = (str: string, maxLength: number = 14) => {
    if (str.length <= maxLength) return str;
    
    const ellipsis = '...';
    const remainingLength = maxLength - ellipsis.length;
    const startLength = Math.ceil(remainingLength / 2);
    const endLength = Math.floor(remainingLength / 2);
    
    return str.slice(0, startLength) + ellipsis + str.slice(-endLength);
  };

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
        </button>
      </div>

      {/* Content */}
      <div className="max-h-48 overflow-y-auto">
                {selectedPlatform === Platform.Twitter ? (
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
            ) : twitterUsers.length > 0 ? (
              twitterUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleMentionClick(user)}
                  className="px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group grid grid-cols-[32px_1fr] gap-3 items-center"
                >
                  {/* Profile Image */}
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                    {user.profile_image_url ? (
                      <img 
                        src={user.profile_image_url} 
                        alt={user.name}
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
                        {truncateMiddle(user.name)}
                      </span>
                      {user.verified && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">@{truncateMiddle(user.username)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-gray-400">
                <p className="text-xs">No results found</p>
              </div>
            )}
          </div>
                 ) : (
           /* Nostr Coming Soon */
           <div className="px-3 py-6 text-center">
             <div className="w-8 h-8 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
               <img 
                 src="/nostr-logo-square.png" 
                 alt="Nostr" 
                 className="w-4 h-4"
                 style={{ filter: 'brightness(1.2)' }}
               />
             </div>
             <h3 className="text-white font-medium text-xs mb-1">Coming Soon</h3>
             <p className="text-gray-400 text-xs">
               Nostr handle lookup is in development
             </p>
           </div>
         )}
      </div>
    </div>
  );
};

export default MentionsLookupView; 
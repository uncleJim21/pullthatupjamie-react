import React, { useState, useEffect } from 'react';
import { Twitter, Loader2, Pin, PinOff, Users, X, Link } from 'lucide-react';
import { mentionService } from '../services/mentionService.ts';
import { MentionResult, TwitterResult, NostrResult } from '../types/mention.ts';
import { API_URL } from '../constants/constants.ts';

export enum Platform {
  Twitter = 'twitter',
  Nostr = 'nostr'
}

// Utility function to detect npub format
const isNpubQuery = (query: string): boolean => {
  return /^npub1[a-z0-9]{58}$/.test(query.trim());
};

interface MentionsLookupViewProps {
  onMentionSelect?: (mention: MentionResult, platform: Platform) => void;
  searchQuery?: string;
  onClose?: () => void;
  onFirstMentionChange?: (mention: MentionResult | null) => void;
  selectedIndex?: number;
  mentionResults?: MentionResult[];
  onMentionResultsChange?: (results: MentionResult[]) => void;
  isLoading?: boolean;
  error?: string | null;
  onPlatformChange?: (platform: Platform) => void;
  initialPlatform?: Platform;
  linkingMode?: {
    isActive: boolean;
    sourcePin?: any; // PersonalPin type
    targetPlatform?: 'twitter' | 'nostr';
    isUnpairMode?: boolean;
    isPairing?: boolean;
  };
  onPairProfile?: (mention: MentionResult) => void;
  onCancelLinking?: () => void;
  onLinkProfile?: (mention: MentionResult) => void;
  onMentionPinned?: (mention: MentionResult, wasNpubLookup: boolean) => void;
}

const MentionsLookupView: React.FC<MentionsLookupViewProps> = ({
  onMentionSelect,
  searchQuery = '',
  onClose,
  onFirstMentionChange,
  selectedIndex = -1,
  mentionResults: externalMentionResults = [],
  onMentionResultsChange,
  isLoading: externalIsLoading = false,
  error: externalError = null,
  onPlatformChange,
  initialPlatform = Platform.Twitter,
  linkingMode,
  onPairProfile,
  onCancelLinking,
  onLinkProfile,
  onMentionPinned
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(initialPlatform);
  const [pinningStates, setPinningStates] = useState<{[key: string]: boolean}>({});
  const [npubLookupLoading, setNpubLookupLoading] = useState(false);
  const [recentNpubLookups, setRecentNpubLookups] = useState<Set<string>>(new Set());

  // Sync internal platform state with parent when initialPlatform changes
  useEffect(() => {
    setSelectedPlatform(initialPlatform);
  }, [initialPlatform]);

  // Always use external results and states (no internal search anymore)
  const displayResults = externalMentionResults;
  const isLoading = externalIsLoading;
  const error = externalError;

  // Check if current search query is an npub for direct lookup
  const isNpubSearch = searchQuery && isNpubQuery(searchQuery);

  // Fetch mentions when searchQuery changes
  // DISABLED: Now using streaming search from parent component
  // useEffect(() => {
  //   const debounceTimer = setTimeout(fetchMentions, 300);
  //   return () => clearTimeout(debounceTimer);
  // }, [fetchMentions]);

  // Filter results by selected platform
  const filteredResults = displayResults.filter(result => result.platform === selectedPlatform);

  // For Nostr, if it's an npub query but no results, show a message to trigger direct lookup
  const shouldShowNpubLookup = selectedPlatform === Platform.Nostr && 
                               isNpubSearch && 
                               filteredResults.length === 0 && 
                               !isLoading;

  // Notify parent of first mention changes for Tab key functionality
  useEffect(() => {
    const firstMention = filteredResults.length > 0 ? filteredResults[0] : null;
    onFirstMentionChange?.(firstMention);
  }, [filteredResults, onFirstMentionChange]);

  // Auto-trigger npub lookup when npub is detected
  useEffect(() => {
    if (selectedPlatform === Platform.Nostr && 
        searchQuery && 
        isNpubQuery(searchQuery) && 
        filteredResults.length === 0 && 
        !isLoading && 
        !npubLookupLoading) {
      // Automatically trigger npub lookup
      handleNpubLookup(searchQuery);
    }
  }, [selectedPlatform, searchQuery, filteredResults.length, isLoading, npubLookupLoading]);

  const handleMentionClick = (mention: MentionResult) => {
    if (linkingMode?.isActive) {
      // In linking mode, don't close - let the pair button handle the action
      return;
    }
    onMentionSelect?.(mention, selectedPlatform);
    onClose?.();
  };

  const handlePairClick = (mention: MentionResult, e: React.MouseEvent) => {
    e.stopPropagation();
    onPairProfile?.(mention);
  };

  const handleLinkClick = (mention: MentionResult, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Link button clicked for mention:', {
      platform: mention.platform,
      username: mention.platform === 'twitter' 
        ? (mention as TwitterResult).username 
        : ((mention as NostrResult).nostr_data?.npub || (mention as NostrResult).npub || 'unknown'),
      pinId: mention.pinId,
      isPinned: mention.isPinned
    });
    onLinkProfile?.(mention);
  };

  const handlePlatformChange = (platform: Platform) => {
    setSelectedPlatform(platform);
    onPlatformChange?.(platform);
  };

  const handlePinToggle = async (mention: MentionResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const mentionKey = `${mention.platform}-${mention.platform === 'twitter' ? mention.username : mention.npub}`;
    setPinningStates(prev => ({ ...prev, [mentionKey]: true }));
    
    // Debug: Log mention data being pinned
    console.log('Pinning mention data:', {
      platform: mention.platform,
      npub: mention.platform === 'nostr' ? mention.npub : undefined,
      nprofile: mention.platform === 'nostr' ? mention.nprofile : undefined,
      picture: mention.platform === 'nostr' ? mention.picture : undefined,
      profile_image_url: mention.platform === 'nostr' ? mention.profile_image_url : undefined,
      imageUrlPriority: mention.platform === 'nostr' ? {
        fromResult: mention.profile_image_url,
        fromNostrData: mention.nostr_data?.profile_image_url,
        fromNostrDataPicture: mention.nostr_data?.picture,
        fromResultPicture: mention.picture
      } : undefined,
      willBeMappedTo: mention.platform === 'nostr' ? {
        profile_image_url: mention.profile_image_url || mention.picture, // Updated mapping logic
        nprofile: mention.nprofile
      } : undefined,
      fullMention: mention
    });
    
    try {
      const result = await mentionService.togglePin(mention);
              if (result.success) {
          // Toggle UI state directly on success
          const updatedResults = displayResults.map(m => {
            const mKey = `${m.platform}-${m.platform === 'twitter' ? m.username : m.npub}`;
            if (mKey === mentionKey) {
              return {
                ...m,
                isPinned: !m.isPinned,
                pinId: m.isPinned ? null : result.data?.id || 'temp-id'
              };
            }
            return m;
          });
          // Update results through parent callback if available
          if (onMentionResultsChange) {
            onMentionResultsChange(updatedResults);
          }
          
          // If this mention was just pinned (not unpinned) and was from npub lookup, notify parent
          if (!mention.isPinned && result.success && onMentionPinned) {
            const mentionNpub = mention.platform === 'nostr' ? (mention as NostrResult).npub : null;
            const wasNpubLookup = mentionNpub ? recentNpubLookups.has(mentionNpub) : false;
            onMentionPinned(mention, wasNpubLookup);
            
            // Clean up the tracking after use
            if (wasNpubLookup && mentionNpub) {
              setRecentNpubLookups(prev => {
                const newSet = new Set(prev);
                newSet.delete(mentionNpub);
                return newSet;
              });
            }
          }
        } else {
        console.error('Failed to toggle pin:', result.error);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    } finally {
      setPinningStates(prev => ({ ...prev, [mentionKey]: false }));
    }
  };

  // Handle direct npub lookup
  const handleNpubLookup = async (npub: string) => {
    if (!npub || !isNpubQuery(npub)) return;

    setNpubLookupLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/nostr/user/${npub}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success && result.profile) {
        // Create a NostrResult from the profile data
        const nostrResult: NostrResult = {
          platform: 'nostr',
          npub: result.profile.npub,
          nprofile: result.profile.nprofile, // This is crucial for proper mentions!
          pubkey: result.profile.pubkey,
          displayName: result.profile.displayName || result.profile.name,
          name: result.profile.name,
          nip05: result.profile.nip05,
          about: result.profile.about,
          picture: result.profile.picture,
          banner: result.profile.banner,
          website: result.profile.website,
          lud16: result.profile.lud16,
          isPinned: false,
          pinId: undefined,
          lastUsed: undefined,
          crossPlatformMapping: undefined,
          isPersonalPin: false,
          personalPin: null
        };

        // Add to results if not already present
        if (onMentionResultsChange) {
          const existingResults = displayResults || [];
          const isAlreadyPresent = existingResults.some(r => 
            r.platform === 'nostr' && (r as NostrResult).npub === npub
          );
          
          if (!isAlreadyPresent) {
            onMentionResultsChange([...existingResults, nostrResult]);
            // Track this npub as a recent lookup
            setRecentNpubLookups(prev => new Set([...prev, npub]));
          }
        }
      }
    } catch (error) {
      console.error('Error looking up npub:', error);
    } finally {
      setNpubLookupLoading(false);
    }
  };

  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const truncateMiddle = (str: string | undefined, maxLength: number = 14) => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    
    const ellipsis = '...';
    const remainingLength = maxLength - ellipsis.length;
    const startLength = Math.ceil(remainingLength / 2);
    const endLength = Math.floor(remainingLength / 2);
    
    return str.slice(0, startLength) + ellipsis + str.slice(-endLength);
  };

  const renderTwitterResult = (result: TwitterResult, index: number) => {
    const mentionKey = `twitter-${result.username}`;
    const isPinning = pinningStates[mentionKey];
    const isSelected = index === selectedIndex;
    
    return (
      <div
        key={result.id}
        onClick={() => handleMentionClick(result)}
        className={`px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group grid grid-cols-[32px_1fr_auto] gap-3 items-center ${
          isSelected ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
        }`}
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
            <span className={`font-medium text-xs ${isSelected ? 'text-blue-300' : 'text-white'}`}>
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
                <Pin className="w-2 h-2 text-white" />
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
          <div className={`text-xs ${isSelected ? 'text-blue-300' : 'text-gray-400'}`}>@{truncateMiddle(result.username)}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          {linkingMode?.isActive ? (
            <button
              onClick={(e) => handlePairClick(result, e)}
              disabled={linkingMode.isPairing}
              className={`px-2 py-1 text-xs text-white rounded transition-colors ${
                linkingMode.isUnpairMode 
                  ? 'bg-red-600 hover:bg-red-500' 
                  : 'bg-green-600 hover:bg-green-500'
              } ${linkingMode.isPairing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={`${linkingMode.isUnpairMode ? 'Unpair from' : 'Pair with'} ${linkingMode.sourcePin?.platform === 'twitter' ? 'Twitter' : 'Nostr'} profile`}
            >
              {linkingMode.isPairing ? (
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              ) : (
                <Users className="w-3 h-3 inline mr-1" />
              )}
              {linkingMode.isPairing 
                ? 'Pairing...' 
                : linkingMode.isUnpairMode ? 'Unpair' : 'Pair'
              }
            </button>
          ) : (
            <>
              {/* Link Button - Show for pinned items (green if no link, colored if linked) */}
              {result.isPinned && result.pinId && (
                <button
                  onClick={(e) => handleLinkClick(result, e)}
                  className={`p-1 rounded-full transition-colors ${
                    result.crossPlatformMapping 
                      ? 'text-green-500 hover:text-green-400'    // Cross-platform mapping available = bright green
                      : 'text-gray-400 hover:text-green-400'     // Not linked = gray with green hover
                  }`}
                  title={`${result.crossPlatformMapping ? 'Manage link with' : 'Link with'} ${(result.platform as string) === 'twitter' ? 'Nostr' : 'Twitter'} profile`}
                >
                  <Link className="w-3 h-3" />
                </button>
              )}
              
              {/* Pin Toggle Button */}
              <button
                onClick={(e) => handlePinToggle(result, e)}
                disabled={isPinning}
                className={`p-1 rounded-full transition-colors ${
                  result.isPinned 
                    ? 'text-yellow-500 hover:text-yellow-400' 
                    : 'text-gray-400 hover:text-yellow-500'
                } ${isPinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={result.isPinned ? 'Unpin user' : 'Pin user'}
              >
                {isPinning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : result.isPinned ? (
                  <PinOff className="w-3 h-3" />
                ) : (
                  <Pin className="w-3 h-3" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Helper to get effective profile data (prefer nostr_data from backend)
  const getEffectiveNostrData = (result: NostrResult) => {
    const nostrData = result.nostr_data;
    // Priority: profile_image_url (from API/DB) > picture (from nostr_data) > picture (from result)
    const imageUrl = result.profile_image_url || nostrData?.profile_image_url || nostrData?.picture || result.picture;
    
    return {
      displayName: nostrData?.displayName || nostrData?.name || result.displayName || result.name,
      picture: imageUrl, // Use the best available image URL
      profile_image_url: imageUrl, // Keep both for compatibility
      nip05: nostrData?.nip05 || result.nip05,
      npub: nostrData?.npub || result.npub,
      nprofile: nostrData?.nprofile || result.nprofile
    };
  };

  const renderNostrResult = (result: NostrResult, index: number) => {
    const mentionKey = `nostr-${result.npub}`;
    const isPinning = pinningStates[mentionKey];
    const isSelected = index === selectedIndex;
    const effectiveData = getEffectiveNostrData(result);
    
    return (
      <div
        key={result.npub}
        onClick={() => handleMentionClick(result)}
        className={`px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group grid grid-cols-[32px_1fr_auto] gap-3 items-center ${
          isSelected ? 'bg-purple-600/20 border-l-2 border-purple-500' : ''
        }`}
      >
        {/* Profile Image */}
        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
          {effectiveData.picture ? (
            <img 
              src={effectiveData.picture} 
              alt={effectiveData.displayName || 'Nostr User'}
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
            <span className={`font-medium text-xs ${isSelected ? 'text-purple-300' : 'text-white'}`}>
              {truncateMiddle(effectiveData.displayName || 'Unknown')}
            </span>
            {effectiveData.nip05 && (
              <div className="w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            {result.isPinned && (
              <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Pin className="w-2 h-2 text-white" />
              </div>
            )}
            {result.crossPlatformMapping?.hasTwitterMapping && (
              <div title="Also available on Twitter">
                <Twitter className="w-3 h-3 text-blue-400" />
              </div>
            )}
          </div>
          <div className={`text-xs ${isSelected ? 'text-purple-300' : 'text-gray-400'}`}>
            {effectiveData.nip05 || `${truncateMiddle(effectiveData.npub, 12)}...`}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          {linkingMode?.isActive ? (
            <button
              onClick={(e) => handlePairClick(result, e)}
              disabled={linkingMode.isPairing}
              className={`px-2 py-1 text-xs text-white rounded transition-colors ${
                linkingMode.isUnpairMode 
                  ? 'bg-red-600 hover:bg-red-500' 
                  : 'bg-green-600 hover:bg-green-500'
              } ${linkingMode.isPairing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={`${linkingMode.isUnpairMode ? 'Unpair from' : 'Pair with'} ${linkingMode.sourcePin?.platform === 'twitter' ? 'Twitter' : 'Nostr'} profile`}
            >
              {linkingMode.isPairing ? (
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              ) : (
                <Users className="w-3 h-3 inline mr-1" />
              )}
              {linkingMode.isPairing 
                ? 'Pairing...' 
                : linkingMode.isUnpairMode ? 'Unpair' : 'Pair'
              }
            </button>
          ) : (
            <>
              {/* Link Button - Show for pinned items (green if no link, colored if linked) */}
              {result.isPinned && result.pinId && (
                <button
                  onClick={(e) => handleLinkClick(result, e)}
                  className={`p-1 rounded-full transition-colors ${
                    result.crossPlatformMapping 
                      ? 'text-green-500 hover:text-green-400'    // Cross-platform mapping available = bright green
                      : 'text-gray-400 hover:text-green-400'     // Not linked = gray with green hover
                  }`}
                  title={`${result.crossPlatformMapping ? 'Manage link with' : 'Link with'} ${(result.platform as string) === 'twitter' ? 'Nostr' : 'Twitter'} profile`}
                >
                  <Link className="w-3 h-3" />
                </button>
              )}
              
              {/* Pin Toggle Button */}
              <button
                onClick={(e) => handlePinToggle(result, e)}
                disabled={isPinning}
                className={`p-1 rounded-full transition-colors ${
                  result.isPinned 
                    ? 'text-yellow-500 hover:text-yellow-400' 
                    : 'text-gray-400 hover:text-yellow-500'
                } ${isPinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={result.isPinned ? 'Unpin user' : 'Pin user'}
              >
                {isPinning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : result.isPinned ? (
                  <PinOff className="w-3 h-3" />
                ) : (
                  <Pin className="w-3 h-3" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-72 sm:w-80 mx-2 sm:mx-0 bg-black border border-gray-700 rounded-lg shadow-xl overflow-hidden">
      {/* Linking Mode Header */}
      {linkingMode?.isActive && (
        <div className="bg-green-900/30 border-b border-green-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300">
                Linking with {linkingMode.sourcePin?.platform === 'twitter' ? 'Twitter' : 'Nostr'} @{linkingMode.sourcePin?.username}
              </span>
            </div>
            <button
              onClick={onCancelLinking}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Cancel linking"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-green-400 mt-1">
            {linkingMode.isUnpairMode 
              ? `Select the linked ${linkingMode.targetPlatform} profile to unpair`
              : `Select a ${linkingMode.targetPlatform} profile to pair with`
            }
          </div>
        </div>
      )}
      
      {/* Compact Header with Platform Tabs */}
      <div className="flex bg-gray-900 border-b border-gray-700">
        <button
          onClick={() => handlePlatformChange(Platform.Twitter)}
          className={`flex-1 flex items-center justify-center py-2 px-3 text-xs font-medium transition-all ${
            selectedPlatform === Platform.Twitter
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Twitter className="w-3 h-3 mr-1.5" />
          Twitter
          {displayResults.filter(r => r.platform === 'twitter').length > 0 && (
            <span className="ml-2 bg-gray-600 text-xs px-1.5 py-0.5 rounded">
              {displayResults.filter(r => r.platform === 'twitter').length}
            </span>
          )}
        </button>
        <button
          onClick={() => handlePlatformChange(Platform.Nostr)}
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
          {displayResults.filter(r => r.platform === 'nostr').length > 0 && (
            <span className="ml-2 bg-gray-600 text-xs px-1.5 py-0.5 rounded">
              {displayResults.filter(r => r.platform === 'nostr').length}
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
          ) : shouldShowNpubLookup || npubLookupLoading ? (
            <div className="px-3 py-4 text-center">
              <div className="mb-2">
                <img src="/nostr-logo-square.png" alt="Nostr" className="w-6 h-6 mx-auto opacity-70" style={{ filter: 'brightness(1.2)' }} />
              </div>
              <p className="text-xs text-purple-300 mb-2">
                {npubLookupLoading ? 'Looking up Nostr profile...' : 'Valid npub detected'}
              </p>
              {npubLookupLoading && (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              )}
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((result, index) => 
              result.platform === 'twitter' 
                ? renderTwitterResult(result as TwitterResult, index)
                : renderNostrResult(result as NostrResult, index)
            )
          ) : (
            <div className="px-3 py-4 text-center text-gray-400">
              <p className="text-xs">
                {selectedPlatform === Platform.Nostr 
                  ? 'No Nostr profiles found. Try searching by name or entering a full npub.'
                  : 'No results found'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MentionsLookupView; 
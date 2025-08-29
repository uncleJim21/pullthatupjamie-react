import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Twitter, Sparkles, ChevronUp, ChevronRight, Info, Save, Check, Pin, Clock } from 'lucide-react';
import { printLog, API_URL } from '../constants/constants.ts';
import { generateAssistContent, JamieAssistError } from '../services/jamieAssistService.ts';
import { twitterService } from '../services/twitterService.ts';
import AuthService from '../services/authService.ts';
import RegisterModal from './RegisterModal.tsx';
import SocialShareSuccessModal from './SocialShareSuccessModal.tsx';
import MentionsLookupView from './MentionsLookupView.tsx';
import MentionPinManagement from './MentionPinManagement.tsx';
import DateTimePicker from './DateTimePicker.tsx';
import { MentionResult, TwitterResult, NostrResult, PersonalPin } from '../types/mention.ts';
import { Platform } from './MentionsLookupView.tsx';
import { useStreamingMentionSearch } from '../hooks/useStreamingMentionSearch.ts';
import ScheduledPostService from '../services/scheduledPostService.ts';
import { CreateScheduledPostRequest, ScheduledPost } from '../types/scheduledPost.ts';
import { formatScheduledDate } from '../utils/time.ts';
import ScheduledPostSlots from './ScheduledPostSlots.tsx';
import { mentionService } from '../services/mentionService.ts';
import { useUserSettings } from '../hooks/useUserSettings.ts';

// Define relay pool for Nostr
export const relayPool = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.mostr.pub",
  "wss://nostr.land",
  "wss://purplerelay.com",
  "wss://relay.snort.social"
];

// Define type for Nostr window extension
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: any) => Promise<any>;
      nip04?: {
        encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
      };
    };
  }
}

export enum SocialPlatform {
  Twitter = 'twitter',
  Nostr = 'nostr'
}

// Add operation types for better state management
enum OperationType {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  DISCONNECTING = 'disconnecting',
  PUBLISHING = 'publishing'
}

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  fileUrl: string;
  itemName?: string;
  onComplete: (success: boolean, platform: SocialPlatform) => void;
  platform: SocialPlatform; // Keep for backward compatibility but will be ignored
  renderUrl?: string; // URL to use in place of fileUrl for Twitter sharing
  lookupHash?: string; // Added lookupHash for Jamie Assist
  auth?: any; // Auth object for API calls
  // Update context props
  updateContext?: {
    scheduledPost: ScheduledPost;
    onUpdate: (updatedPost: ScheduledPost) => void;
  };
  onSchedulingModeChange?: (isScheduling: boolean, hasDropdowns: boolean) => void;
}

// Simplified unified state interface
interface PlatformState {
  enabled: boolean;
  available: boolean;
  authenticated: boolean;
  currentOperation: OperationType;
  success: boolean | null;
  error: string | null;
  username?: string;
}

// Update the TwitterTweetResponse type
interface TwitterTweetResponse {
  success: boolean;
  message?: string;
  error?: string;
  requiresReauth?: boolean;
  tweet?: {
    text: string;
    id: string;
    edit_history_tweet_ids: string[];
  };
}

// Bech32 helper function with proper checksum calculation
const encodeBech32 = (prefix: string, data: string): string => {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  const polymod = (values: number[]): number => {
    let chk = 1;
    for (let value of values) {
      const top = chk >> 25;
      chk = (chk & 0x1ffffff) << 5 ^ value;
      for (let i = 0; i < 5; i++) {
        if ((top >> i) & 1) {
          chk ^= GENERATOR[i];
        }
      }
    }
    return chk;
  };

  const hrpExpand = (hrp: string): number[] => {
    const result: number[] = [];
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) >> 5);
    }
    result.push(0);
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) & 31);
    }
    return result;
  };

  const hexToBytes = (hex: string): number[] => {
    const result: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return result;
  };

  const convertBits = (data: number[], fromBits: number, toBits: number, pad: boolean): number[] => {
    let acc = 0;
    let bits = 0;
    const result: number[] = [];
    const maxv = (1 << toBits) - 1;

    for (const value of data) {
      if (value < 0 || (value >> fromBits) !== 0) {
        throw new Error('Invalid value');
      }
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        result.push((acc >> bits) & maxv);
      }
    }

    if (pad) {
      if (bits > 0) {
        result.push((acc << (toBits - bits)) & maxv);
      }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
      throw new Error('Invalid padding');
    }

    return result;
  };

  // Convert event ID to bytes
  const eventIdBytes = hexToBytes(data);

  // Create TLV data
  const tlv = [0, 32, ...eventIdBytes]; // type 0, length 32, followed by event ID

  // Convert to 5-bit array
  const words = convertBits(tlv, 8, 5, true);

  // Calculate checksum
  const hrpExpanded = hrpExpand(prefix);
  const values = [...hrpExpanded, ...words];
  const polymodValue = polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksumWords: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksumWords.push((polymodValue >> 5 * (5 - i)) & 31);
  }

  // Combine everything
  return prefix + '1' + 
         words.map(i => CHARSET.charAt(i)).join('') + 
         checksumWords.map(i => CHARSET.charAt(i)).join('');
};

const ASPECT_RATIO = 16 / 9;
const PREVIEW_WIDTH = 240; // px, adjust as needed
const PREVIEW_HEIGHT = PREVIEW_WIDTH / ASPECT_RATIO;

const MENTION_MIN_CHARS = 2;

const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  onOpenChange,
  fileUrl,
  itemName = 'file',
  onComplete,
  platform,
  renderUrl,
  lookupHash,
  auth,
  updateContext,
  onSchedulingModeChange
}) => {
  const [content, setContent] = useState<string>('');
  
  // Unified platform state objects
  const [twitterState, setTwitterState] = useState<PlatformState>({
    enabled: true,
    available: true,
    authenticated: false,
    currentOperation: OperationType.IDLE,
    success: null,
    error: null,
    username: undefined
  });
  
  const [nostrState, setNostrState] = useState<PlatformState>({
    enabled: true,
    available: false,
    authenticated: false,
    currentOperation: OperationType.IDLE,
    success: null,
    error: null
  });

  const [relayConnections, setRelayConnections] = useState<{[key: string]: WebSocket | null}>({});
  const [publishStatus, setPublishStatus] = useState<{[key: string]: string}>({});
  
  // Token checking and polling states
  const [isCheckingTokens, setIsCheckingTokens] = useState(true);
  const [hasValidTokens, setHasValidTokens] = useState(false);
  const [isPollingTokens, setIsPollingTokens] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Jamie Assist states
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [showAdvancedPrefs, setShowAdvancedPrefs] = useState(false);
  const [additionalPrefs, setAdditionalPrefs] = useState<string>('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [prefsSuccessfullySaved, setPrefsSuccessfullySaved] = useState(false);
  const [jamieAssistError, setJamieAssistError] = useState<string | null>(null);
  const [lastJamieAssistCall, setLastJamieAssistCall] = useState<number>(0);
  const [userEditedSinceLastAssist, setUserEditedSinceLastAssist] = useState<boolean>(false);
  
  // RegisterModal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  // Add state for successful post URLs
  const [successUrls, setSuccessUrls] = useState<{[key: string]: string}>({});

  // Add state for success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Add state to track image/video loading
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // Add state to track retrying the thumbnail
  const [thumbnailRetry, setThumbnailRetry] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // User settings hook for managing preferences including jamieAssistDefaults with cloud sync enabled
  const { settings: jamieSettings, updateSetting: updateJamieSetting, flushPendingChanges } = useUserSettings({
    enableCloudSync: true
  });

  // Load Jamie Assist preferences only on mount
  useEffect(() => {
    if (jamieSettings.jamieAssistDefaults && !additionalPrefs) {
      setAdditionalPrefs(jamieSettings.jamieAssistDefaults);
      printLog('Jamie Assist preferences loaded from userSettings on mount');
    }
  }, [jamieSettings.jamieAssistDefaults]); // Remove additionalPrefs from dependencies

  // Add state for scheduling functionality
  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  const [hasOpenDropdowns, setHasOpenDropdowns] = useState(false);
  const [pendingScheduledDate, setPendingScheduledDate] = useState<Date | undefined>(undefined);
  
  // Check if we're in update mode
  const isUpdateMode = !!updateContext;

  // User settings for scheduled slots
  const {
    settings: userSettings,
    updateSetting: updateUserSetting
  } = useUserSettings({
    enableCloudSync: false, // Don't need cloud sync in modal
    autoLoadOnMount: true
  });

  // Add state for mentions lookup
  const [showMentionsLookup, setShowMentionsLookup] = useState(false);
  

  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [firstMention, setFirstMention] = useState<MentionResult | null>(null);
  const [showPinManagement, setShowPinManagement] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(-1);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  
  // Platform-specific search state for independent @ handling
  const [platformSearchState, setPlatformSearchState] = useState<{
    twitter: { query: string; hasResults: boolean };
    nostr: { query: string; hasResults: boolean };
  }>({
    twitter: { query: '', hasResults: false },
    nostr: { query: '', hasResults: false }
  });
  const [currentMentionPlatform, setCurrentMentionPlatform] = useState<Platform>(Platform.Twitter);
  
  // Legacy: keeping for compatibility during transition
  const [selectedMentions, setSelectedMentions] = useState<Array<{
    displayText: string;
    actualText: string;
    platform: string;
    position: number;
  }>>([]);
  
  // Unified platform mode - single source of truth for current platform
  const [platformMode, setPlatformMode] = useState<'twitter' | 'nostr'>('twitter');
  
  // Separate text variables for each platform
  const [twitterText, setTwitterText] = useState<string>('');
  const [nostrText, setNostrText] = useState<string>('');
  
  // Mention dictionary: maps display name to posting format and metadata
  const [mentionDictionary, setMentionDictionary] = useState<{[displayName: string]: {
    twitterHandle?: string;      // @username for Twitter
    nostrNprofile?: string;      // nostr:nprofile... for Nostr
    nostrDisplayName?: string;   // Human readable name for Nostr
    platform: 'twitter' | 'nostr' | 'both';  // Which platforms this mention supports
  }}>({});

  // Simple mapping: nprofile -> display name for Twitter→Nostr transitions
  const [nprofileToDisplayName, setNprofileToDisplayName] = useState<{[nprofile: string]: string}>({});

  // Cross-platform linking state
  const [linkingMode, setLinkingMode] = useState<{
    isActive: boolean;
    sourcePin?: PersonalPin;
    targetPlatform?: 'twitter' | 'nostr';
    isUnpairMode?: boolean;
    isPairing?: boolean;
  }>({ isActive: false });

  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Unified platform mode handler
  const handlePlatformModeChange = (newMode: 'twitter' | 'nostr') => {
    setPlatformMode(newMode);
    setCurrentMentionPlatform(newMode === 'twitter' ? Platform.Twitter : Platform.Nostr);
  };

  // Helper function to update content after successful pairing
  const updateContentAfterPairing = (sourcePin: any, targetMention: MentionResult) => {
    // Update the mention dictionary with the new cross-platform mapping
    const sourceUsername = sourcePin.platform === 'twitter' 
      ? sourcePin.username 
      : sourcePin.username; // Adjust as needed for display name
    
    if (sourcePin.platform === 'twitter' && targetMention.platform === 'nostr') {
      // Twitter → Nostr pairing
      const nostrMention = targetMention as NostrResult;
      const nprofile = nostrMention.nostr_data?.nprofile || nostrMention.nprofile;
      const displayName = nostrMention.nostr_data?.displayName || nostrMention.displayName || sourceUsername;
      
      // Create bidirectional dictionary entries
      const dictionaryEntry = {
        twitterHandle: `@${sourceUsername}`,
        nostrNprofile: nprofile ? `nostr:${nprofile}` : `@${displayName}`,
        nostrDisplayName: displayName,
        platform: 'both' as const
      };
      
      setMentionDictionary(prev => ({
        ...prev,
        [sourceUsername]: dictionaryEntry, // Map Twitter username -> cross-platform entry
        [displayName]: dictionaryEntry // Map Nostr display name -> cross-platform entry  
      }));
      
      // Add nprofile to display name mapping
      if (nprofile) {
        setNprofileToDisplayName(prev => ({
          ...prev,
          [`nostr:${nprofile}`]: displayName
        }));
      }
      
      console.log(`Twitter→Nostr pairing: sourceUsername="${sourceUsername}", displayName="${displayName}"`);
      
      // If we're currently showing the npub in content, replace @npub with `@displayName`
      const currentContent = content;
      const npub = nostrMention.nostr_data?.npub || nostrMention.npub || nostrMention.username;
      if (currentContent.includes(`@${npub}`)) {
        const newContent = currentContent.replace(`@${npub}`, `\`@${displayName}\``);
        setContent(newContent);
        console.log(`Content replaced: "${currentContent}" -> "${newContent}"`);
        
        // Force immediate platform text updates with new content
        setTimeout(() => {
          const newTwitterText = buildPlatformTextWithContent(newContent, 'twitter');  
          const newNostrText = buildPlatformTextWithContent(newContent, 'nostr');
          setTwitterText(newTwitterText);
          setNostrText(newNostrText);
          console.log(`Platform texts updated after pairing: twitterText="${newTwitterText}", nostrText="${newNostrText}"`);
        }, 100);
      }
      
    } else if (sourcePin.platform === 'nostr' && targetMention.platform === 'twitter') {
      // Nostr → Twitter pairing
      const twitterMention = targetMention as TwitterResult;
      const nostrDisplayName = sourcePin.displayName || sourcePin.name || 'unknown';
      
      // Create bidirectional dictionary entries
      const dictionaryEntry = {
        twitterHandle: `@${twitterMention.username}`,
        nostrNprofile: `nostr:${sourcePin.username}`, // sourcePin.username is the npub/nprofile
        nostrDisplayName: nostrDisplayName,
        platform: 'both' as const
      };
      
      setMentionDictionary(prev => ({
        ...prev,
        [nostrDisplayName]: dictionaryEntry, // Map display name -> cross-platform entry
        [twitterMention.username]: dictionaryEntry // Map Twitter username -> cross-platform entry  
      }));
      
      // Add nprofile to display name mapping
      setNprofileToDisplayName(prev => ({
        ...prev,
        [`nostr:${sourcePin.username}`]: nostrDisplayName
      }));
      
      console.log(`Nostr→Twitter pairing: npub="${sourcePin.username}", displayName="${nostrDisplayName}", twitterUsername="${twitterMention.username}"`);
      
      // Replace @npub in content with `@displayName`
      const currentContent = content;
      if (currentContent.includes(`@${sourcePin.username}`)) {
        const newContent = currentContent.replace(`@${sourcePin.username}`, `\`@${nostrDisplayName}\``);
        setContent(newContent);
        console.log(`Content replaced: "${currentContent}" -> "${newContent}"`);
        
        // Force immediate platform text updates with new content
        setTimeout(() => {
          const newTwitterText = buildPlatformTextWithContent(newContent, 'twitter');  
          const newNostrText = buildPlatformTextWithContent(newContent, 'nostr');
          setTwitterText(newTwitterText);
          setNostrText(newNostrText);
          console.log(`Platform texts updated after pairing: twitterText="${newTwitterText}", nostrText="${newNostrText}"`);
        }, 100);
      }
    }
    
    console.log('Content updated after pairing - mention dictionary updated for cross-platform mapping');
  };

  // Cross-platform linking handlers
  const handleStartLinking = (sourcePin: PersonalPin) => {
    const targetPlatform = sourcePin.platform === 'twitter' ? 'nostr' : 'twitter';
    setLinkingMode({
      isActive: true,
      sourcePin,
      targetPlatform
    });
    // Switch to the target platform for searching
    handlePlatformModeChange(targetPlatform);
    setShowMentionsLookup(true);
  };

  const handleCancelLinking = () => {
    setLinkingMode({ isActive: false });
    // Keep modal open unless user explicitly closes it
    // setShowMentionsLookup(false);
  };

  const handlePairProfile = async (targetMention: MentionResult) => {
    if (!linkingMode.sourcePin || !linkingMode.isActive) return;

    // Set pairing loading state
    setLinkingMode(prev => ({ ...prev, isPairing: true }));

    try {
      if (linkingMode.isUnpairMode) {
        // UNPAIR mode - unlink the profiles
        if (linkingMode.sourcePin.platform === 'nostr') {
          // Unlink Nostr profile from pin
          const result = await mentionService.unlinkNostrProfile(linkingMode.sourcePin.id);
          
          if (result.success) {
            console.log('Successfully unlinked Nostr profile from pin:', linkingMode.sourcePin.id);
            
            // Show success feedback
            setSuccessMessage('Successfully unpaired profiles!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Reset linking mode but keep modal open for continued interaction
            setLinkingMode({ isActive: false });
            // setShowMentionsLookup(false); // Keep modal open
            
            // TODO: Refresh the mention results to show updated state
          } else {
            console.error('Failed to unlink Nostr profile:', result.error);
            // TODO: Show error feedback
          }
        } else {
          // For Twitter pins, we update to remove the cross-platform link
          const updateData = {
            targetPlatform: undefined,
            targetUsername: undefined,
            notes: `Unlinked cross-platform mapping for ${linkingMode.sourcePin.platform} @${linkingMode.sourcePin.username}`
          };

          const result = await mentionService.updatePin(linkingMode.sourcePin.id, updateData);
          
          if (result.success) {
            console.log('Successfully unlinked Twitter pin:', linkingMode.sourcePin.id);
            
            // Show success feedback
            setSuccessMessage('Successfully unpaired profiles!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Reset linking mode but keep modal open for continued interaction
            setLinkingMode({ isActive: false });
            // setShowMentionsLookup(false); // Keep modal open
          } else {
            console.error('Failed to unlink Twitter pin:', result.error);
            // TODO: Show error feedback
          }
        }
      } else {
        // PAIR mode - link the profiles
        if (linkingMode.sourcePin.platform === 'nostr' && targetMention.platform === 'twitter') {
          // Link Nostr pin with Twitter profile using updatePin
          const updateData = {
            targetPlatform: 'twitter' as const,
            targetUsername: targetMention.username,
            notes: `Cross-platform link: nostr @${linkingMode.sourcePin.username} ↔ twitter @${targetMention.username}`
          };

          const result = await mentionService.updatePin(linkingMode.sourcePin.id, updateData);
          
          if (result.success) {
            console.log('Successfully linked Nostr pin to Twitter profile');
            setSuccessMessage('Successfully paired profiles!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Update content with cross-platform pairing and close modal
            updateContentAfterPairing(linkingMode.sourcePin, targetMention);
            setShowMentionsLookup(false);
          } else {
            console.error('Failed to link Nostr pin to Twitter:', result.error);
          }
        } else if (linkingMode.sourcePin.platform === 'twitter' && targetMention.platform === 'nostr') {
          // Link Twitter pin with Nostr profile using linkNostrProfile
          const nostrMention = targetMention as NostrResult;
          // Get npub from nostr_data or fallback to direct npub field
          const npub = nostrMention.nostr_data?.npub || nostrMention.npub;
          
          console.log('Linking Twitter pin to Nostr profile:', {
            pinId: linkingMode.sourcePin.id,
            npub: npub,
            nostr_data_npub: nostrMention.nostr_data?.npub,
            direct_npub: nostrMention.npub,
            targetMention: targetMention
          });
          
          if (!npub) {
            console.error('No npub found for Nostr mention:', targetMention);
            return;
          }
          
          const result = await mentionService.linkNostrProfile(linkingMode.sourcePin.id, npub);
          
          if (result.success) {
            console.log('Successfully linked Twitter pin to Nostr profile');
            setSuccessMessage('Successfully paired profiles!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Update content with cross-platform pairing and close modal
            updateContentAfterPairing(linkingMode.sourcePin, targetMention);
            setShowMentionsLookup(false);
          } else {
            console.error('Failed to link Twitter pin to Nostr:', result.error);
          }
        }
        
        // Reset linking mode but keep modal open for continued interaction
        setLinkingMode({ isActive: false });
        // setShowMentionsLookup(false); // Keep modal open
        
        // TODO: Refresh the mention results to show updated state
        // TODO: Show success feedback
      }
    } catch (error) {
      console.error('Error in pair/unpair operation:', error);
      // TODO: Show error feedback
    } finally {
      // Clear pairing loading state
      setLinkingMode(prev => ({ ...prev, isPairing: false }));
    }
  };

  const handleLinkProfile = async (mention: MentionResult) => {

    if (!mention.pinId) {
      console.error('No pinId found for mention:', mention);
      return;
    }

    // Check if this is already linked (has cross-platform mapping)
    const isAlreadyLinked = mention.crossPlatformMapping && (
      (mention.platform === 'twitter' && mention.crossPlatformMapping.hasNostrMapping) ||
      (mention.platform === 'nostr' && mention.crossPlatformMapping.hasTwitterMapping)
    );

    const targetPlatform = mention.platform === 'twitter' ? 'nostr' : 'twitter';

    if (isAlreadyLinked) {
      // Already linked - set up for UNPAIR mode
      setLinkingMode({
        isActive: true,
        sourcePin: {
          id: mention.pinId,
          platform: mention.platform,
          username: mention.platform === 'twitter' 
            ? (mention as TwitterResult).username 
            : ((mention as NostrResult).nostr_data?.npub || (mention as NostrResult).npub || 'unknown')
        } as PersonalPin,
        targetPlatform,
        isUnpairMode: true
      });
    } else {
      // Not linked - set up for PAIR mode
      setLinkingMode({
        isActive: true,
        sourcePin: {
          id: mention.pinId,
          platform: mention.platform,
          username: mention.platform === 'twitter' 
            ? (mention as TwitterResult).username 
            : ((mention as NostrResult).nostr_data?.npub || (mention as NostrResult).npub || 'unknown')
        } as PersonalPin,
        targetPlatform,
        isUnpairMode: false
      });
    }

    // Switch to target platform mode (keep modal open)
    handlePlatformModeChange(targetPlatform);

    // Ensure modal stays open and set search query to source username for context
    setShowMentionsLookup(true);
    const sourceUsername = mention.platform === 'twitter' 
      ? (mention as TwitterResult).username 
      : ((mention as NostrResult).nostr_data?.displayName || (mention as NostrResult).displayName || 'user');
    setMentionSearchQuery(sourceUsername);
    
    // Trigger search for the source username on BOTH platforms to detect cross-platform mappings
    if (sourceUsername.length >= 2) {
      performMentionSearch(sourceUsername, {
        platforms: ['twitter', 'nostr'], // Search both platforms to find cross-platform mappings
        includePersonalPins: true,
        includeCrossPlatformMappings: true,
        limit: 10
      });
    }
    

  };

  // Sync platformMode with currentMentionPlatform on initial load
  useEffect(() => {
    const initialMode = currentMentionPlatform === Platform.Twitter ? 'twitter' : 'nostr';
    if (platformMode !== initialMode) {
      setPlatformMode(initialMode);
    }
  }, [currentMentionPlatform, platformMode]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const jamieAssistTextareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // Streaming mention search hook
  const {
    results: mentionResults,
    loading: mentionSearchLoading,
    completedSources,
    error: mentionSearchError,
    streamSearch: performMentionSearch,
    clearSearch: clearMentionSearch,
    updateResults: updateMentionResults
  } = useStreamingMentionSearch();

  // Computed state for overall publishing status
  const isPublishing = twitterState.currentOperation === OperationType.PUBLISHING || 
                      nostrState.currentOperation === OperationType.PUBLISHING;

  // Helper to determine if file is video
  const isVideo = fileUrl && (fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm') || fileUrl.endsWith('.mov'));
  const isImage = fileUrl && (fileUrl.endsWith('.png') || fileUrl.endsWith('.jpg') || fileUrl.endsWith('.jpeg') || fileUrl.endsWith('.gif'));

  // Set preview sizing constants for consistency
  const previewMaxWidth = 300;
  const previewHeight = 150; // fixed height for all states
  const playIconSize = 32;

  // For video, try to use a thumbnail if CDN supports it
  const videoThumbnailUrl = isVideo ? `${fileUrl}?thumbnail=1` : undefined;

  // Add useEffect to notify parent of modal state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Auto-select next slot when scheduling mode opens
  useEffect(() => {
    if (isSchedulingMode && !pendingScheduledDate && userSettings.scheduledPostSlots) {
      const enabledSlots = userSettings.scheduledPostSlots.filter((slot: any) => slot.enabled);
      if (enabledSlots.length > 0) {
        // Find the next upcoming slot
        const now = new Date();
        const currentDayOfWeek = now.getDay();
        const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const slotsWithDistance = enabledSlots.map((slot: any) => {
          let dayDiff = (slot.dayOfWeek - currentDayOfWeek + 7) % 7;
          if (dayDiff === 0 && slot.time <= currentTimeString) {
            dayDiff = 7;
          }
          return { ...slot, distance: dayDiff };
        });

        slotsWithDistance.sort((a, b) => {
          if (a.distance !== b.distance) {
            return a.distance - b.distance;
          }
          return a.time.localeCompare(b.time);
        });

        if (slotsWithDistance.length > 0) {
          handleSlotSelect(slotsWithDistance[0]);
        }
      }
    }
  }, [isSchedulingMode, userSettings.scheduledPostSlots]);

  // Notify parent of scheduling mode and dropdown state changes
  useEffect(() => {
    if (onSchedulingModeChange) {
      onSchedulingModeChange(isSchedulingMode, hasOpenDropdowns);
    }
  }, [isSchedulingMode, hasOpenDropdowns, onSchedulingModeChange]);

  // Disable body scroll when scheduling mode is active and no dropdowns are open
  useEffect(() => {
    if (isOpen && isSchedulingMode && !hasOpenDropdowns) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isSchedulingMode, hasOpenDropdowns]);



  // Update the polling function to handle Twitter auth status
  const startTokenPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    setIsPollingTokens(true);
    printLog('Starting token polling...');
    
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          printLog('No auth token found during polling');
          stopTokenPolling();
          return;
        }

        printLog(`Polling tokens at ${API_URL}/api/twitter/tokens`);
        const response = await fetch(`${API_URL}/api/twitter/tokens`, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': window.location.origin
          },
          credentials: 'include',
          mode: 'cors'
        });
        
        if (response.ok) {
          const data = await response.json();
          printLog(`Polling response: ${JSON.stringify(data)}`);
          
          // Only stop polling when authenticated is true
          if (data.authenticated === true) {
            printLog('Authentication successful! Stopping polling.');
            setHasValidTokens(true);
            setIsPollingTokens(false);
            clearInterval(interval);
            setPollingInterval(null);
            
            // Update Twitter auth state
            setTwitterState(prev => ({ 
              ...prev, 
              authenticated: true,
              username: data.twitterUsername
            }));
          } else {
            printLog(`Still waiting for authentication. Current status: authenticated=${data.authenticated}`);
          }
        } else {
          printLog(`Polling request failed with status ${response.status}`);
        }
      } catch (error) {
        printLog(`Error during token polling: ${error}`);
      }
    }, 1800); // Poll every 3 seconds
    
    setPollingInterval(interval);
  };

  // Function to stop polling
  const stopTokenPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsPollingTokens(false);
  };

  // Initial check when modal opens - unified with Twitter auth
  useEffect(() => {
    if (isOpen) {
      const initialCheck = async () => {
        setIsCheckingTokens(true);
        try {
          await checkTwitterAuth(); // This now handles both auth check and hasValidTokens
        } catch (error) {
          printLog(`Error during initial check: ${error}`);
          setHasValidTokens(false);
        } finally {
          setIsCheckingTokens(false);
        }
      };
      
      initialCheck();
    }
    
    // Cleanup polling when modal closes
    return () => {
      stopTokenPolling();
    };
  }, [isOpen]);

  // Function to save preferences to userSettings and sync to cloud
  const saveJamieAssistPreferences = async () => {
    try {
      // Update the setting locally and trigger cloud sync
      await updateJamieSetting('jamieAssistDefaults', additionalPrefs);
      
      // Force immediate sync to cloud (bypasses debouncing)
      await flushPendingChanges();
      
      setPrefsSuccessfullySaved(true);
      
      // Reset the success indicator after 2 seconds
      setTimeout(() => {
        setPrefsSuccessfullySaved(false);
      }, 2000);
      
      printLog('Jamie Assist preferences saved to userSettings and synced to cloud');
    } catch (error) {
      console.error('Error saving Jamie Assist preferences:', error);
      // You might want to show an error state here
    }
  };


  


  // Initialize content with default text and check for Nostr extension if needed
  useEffect(() => {
    if (isUpdateMode && updateContext) {
      // Update mode: populate with existing scheduled post data
      const scheduledPost = updateContext.scheduledPost;
      setContent(scheduledPost.content.text || '');
      // Start in non-scheduling mode when editing so all items are visible
      setIsSchedulingMode(false);
      setScheduledDate(new Date(scheduledPost.scheduledFor));
      
      // Set platform states based on the scheduled post's platform
      if (scheduledPost.platform === 'twitter') {
        setTwitterState(prev => ({ ...prev, enabled: true }));
        setNostrState(prev => ({ ...prev, enabled: false }));
      } else if (scheduledPost.platform === 'nostr') {
        setTwitterState(prev => ({ ...prev, enabled: false }));
        setNostrState(prev => ({ ...prev, enabled: true }));
      }
    } else {
      // Create mode: empty content
      setContent('');
      setIsSchedulingMode(false);
      setScheduledDate(undefined);
    }
    
    // Check Nostr platform
    checkNostrExtension();

    // Initialize relay status
    const initialStatus: {[key: string]: string} = {};
    relayPool.forEach(relay => {
      initialStatus[relay] = 'idle';
    });
    setPublishStatus(initialStatus);

    // Jamie Assist preferences are now loaded automatically via useEffect

    return () => {
      // Clean up WebSocket connections when component unmounts
      Object.values(relayConnections).forEach(conn => {
        const ws = conn as WebSocket | null;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    };
  }, [fileUrl, itemName, isOpen, isUpdateMode, updateContext]);

  // Effect to check for Nostr extension when modal opens
  useEffect(() => {
    if (isOpen) {
      checkNostrExtension();
      // Auto-authenticate if extension is available
      if (window.nostr) {
        connectNostrExtension();
      }
    }
  }, [isOpen]);

  // Effect to initialize and check lookupHash
  useEffect(() => {
    if (lookupHash) {
      if (typeof lookupHash === 'string' && lookupHash.startsWith('undefined-')) {
        console.error(`Invalid lookupHash format detected on mount: ${lookupHash}`);
      } else {
        printLog(`SocialShareModal initialized with lookupHash: ${lookupHash}`);
      }
    } else {
      printLog('SocialShareModal initialized without lookupHash');
    }
  }, [lookupHash]);

  // Cleanup streaming search when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear any pending search timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      clearMentionSearch();
      setShowMentionsLookup(false);
      setMentionSearchQuery('');
      setMentionStartIndex(-1);
      setSelectedMentionIndex(-1);
      setLastSearchQuery('');
    }
  }, [isOpen, clearMentionSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to adjust textarea height based on screen size
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const lineHeight = 24; // 1.5rem = 24px
    const defaultLines = window.innerWidth >= 640 ? 3.5 : 2.5;
    const defaultHeight = defaultLines * lineHeight;
    
    // Use the larger of default height or content height (expandable)
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = Math.max(defaultHeight, contentHeight) + 'px';
  }, []);

  // Handle window resize for responsive line clamping and initial setup
  useEffect(() => {
    const handleResize = () => {
      if (jamieAssistTextareaRef.current) {
        adjustTextareaHeight(jamieAssistTextareaRef.current);
      }
    };

    // Set initial height when component mounts
    if (jamieAssistTextareaRef.current) {
      adjustTextareaHeight(jamieAssistTextareaRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustTextareaHeight]);

  // Adjust height when additionalPrefs changes
  useEffect(() => {
    if (jamieAssistTextareaRef.current) {
      adjustTextareaHeight(jamieAssistTextareaRef.current);
    }
  }, [additionalPrefs, adjustTextareaHeight]);

  const checkNostrExtension = async () => {
    try {
      if (window.nostr) {
        setNostrState(prev => ({ ...prev, available: true }));
        printLog("Nostr extension detected but not authenticated yet");
        // Don't automatically request public key - only check availability
      } else {
        setNostrState(prev => ({ ...prev, available: false, authenticated: false }));
      }
    } catch (error) {
      setNostrState(prev => ({ ...prev, available: false, authenticated: false }));
      console.error("Error checking for Nostr extension:", error);
    }
  };

  const connectNostrExtension = async () => {
    try {
      if (window.nostr) {
        const pubKey = await window.nostr.getPublicKey();
        setNostrState(prev => ({ ...prev, authenticated: true }));
        printLog(`Nostr extension connected with public key: ${pubKey}`);
      } else {
        setNostrState(prev => ({ ...prev, available: false, authenticated: false }));
      }
    } catch (error) {
      printLog("Failed to connect to Nostr extension");
      setNostrState(prev => ({ ...prev, authenticated: false }));
      console.error("Error connecting to Nostr extension:", error);
    }
  };

  // Check Twitter authentication status (unified with token checking)
  const checkTwitterAuth = async () => {
    printLog('Checking Twitter auth status in SocialShareModal...');
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        printLog('No auth token found for Twitter auth check');
        setTwitterState(prev => ({ ...prev, authenticated: false, username: undefined }));
        return;
      }

      const response = await fetch(`${API_URL}/api/twitter/tokens`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      if (response.ok) {
        const data = await response.json();
        printLog(`Twitter auth check response: ${JSON.stringify(data)}`);
        
        setTwitterState(prev => ({ 
          ...prev, 
          authenticated: data.authenticated === true,
          available: true,
          username: data.authenticated ? data.twitterUsername : undefined
        }));
        
        // Set hasValidTokens for the UI flow
        setHasValidTokens(data.authenticated === true);
      } else {
        printLog(`Twitter auth check failed with status ${response.status}`);
        setTwitterState(prev => ({ ...prev, authenticated: false, username: undefined }));
        setHasValidTokens(false);
      }
    } catch (error) {
      printLog(`Error checking Twitter auth: ${error}`);
      setTwitterState(prev => ({ ...prev, authenticated: false, username: undefined }));
      setHasValidTokens(false);
    }
  };

  // Updated connectTwitter function to start polling
  const connectTwitter = async () => {
    printLog('Connect Twitter button clicked in SocialShareModal');
    setTwitterState(prev => ({ ...prev, currentOperation: OperationType.CONNECTING }));
    try {
      const authUrl = await AuthService.startTwitterAuth();
      printLog(`Opening Twitter auth URL: ${authUrl}`);
      window.open(authUrl, '_blank');
      
      // Start polling for tokens after opening auth window
      startTokenPolling();
    } catch (error) {
      printLog(`Error starting Twitter auth: ${error}`);
      setJamieAssistError(error instanceof Error ? error.message : 'Failed to start Twitter auth');
    } finally {
      setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE }));
    }
  };

  // Disconnect from Twitter
  const disconnectTwitter = async () => {
    const confirmed = window.confirm(
      'Disconnect your Twitter account? You\'ll need to re-authorize to post tweets again.'
    );
    
    if (!confirmed) {
      return;
    }

    printLog('Disconnect Twitter button clicked in SocialShareModal');
    setTwitterState(prev => ({ ...prev, currentOperation: OperationType.DISCONNECTING }));
    try {
      const response = await twitterService.revoke(true);
      printLog(`Twitter disconnect response: ${JSON.stringify(response)}`);
      
      if (response.success) {
        setTwitterState(prev => ({ ...prev, authenticated: false, username: undefined }));
        setJamieAssistError(null);
        printLog('Twitter account disconnected successfully');
      } else {
        setJamieAssistError(response.message || 'Failed to disconnect Twitter account');
      }
    } catch (error) {
      printLog(`Error disconnecting Twitter: ${error}`);
      setJamieAssistError(error instanceof Error ? error.message : 'Failed to disconnect Twitter account');
    } finally {
      setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE }));
    }
  };



  // Handle escape key to close mentions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMentionsLookup) {
        handleCloseMentions();
      }
    };

    if (showMentionsLookup) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMentionsLookup]);

  // Nostr-specific functions
  const connectToRelay = (relay: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      try {
        setPublishStatus(prev => ({ ...prev, [relay]: 'connecting' }));
        
        const socket = new WebSocket(relay);
        
        socket.onopen = () => {
          setPublishStatus(prev => ({ ...prev, [relay]: 'connected' }));
          setRelayConnections(prev => ({ ...prev, [relay]: socket }));
          resolve(socket);
        };
        
        socket.onerror = (error) => {
          console.error(`Error connecting to relay ${relay}:`, error);
          setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
          reject(error);
        };
        
        socket.onclose = () => {
          setRelayConnections(prev => ({ ...prev, [relay]: null }));
        };
        
        return socket;
      } catch (error) {
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        reject(error);
        return null;
      }
    });
  };

  const publishEventToRelay = (relay: string, event: any): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        let socket = relayConnections[relay];
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          try {
            socket = await connectToRelay(relay);
          } catch (error) {
            console.error(`Failed to connect to relay ${relay}:`, error);
            setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
            resolve(false);
            return;
          }
        }
        
        setPublishStatus(prev => ({ ...prev, [relay]: 'publishing' }));
        
        // Create a publish message in the Nostr protocol format
        const publishMessage = JSON.stringify(["EVENT", event]);
        
        // Set up a timeout to handle unresponsive relays
        const timeoutId = setTimeout(() => {
          setPublishStatus(prev => ({ ...prev, [relay]: 'timeout' }));
          resolve(false);
        }, 10000); // 10 seconds timeout
        
        // One-time message handler for the relay response
        const handleMessage = (msg: MessageEvent) => {
          try {
            const data = JSON.parse(msg.data);
            if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) {
              clearTimeout(timeoutId);
              setPublishStatus(prev => ({ ...prev, [relay]: 'published' }));
              socket.removeEventListener('message', handleMessage);
              resolve(true);
            }
          } catch (error) {
            console.error(`Error parsing relay response from ${relay}:`, error);
          }
        };
        
        socket.addEventListener('message', handleMessage);
        
        // Send the event to the relay
        socket.send(publishMessage);
        
      } catch (error) {
        console.error(`Error publishing to relay ${relay}:`, error);
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        resolve(false);
      }
    });
  };

  // Helper function to get user signature from localStorage
  const getUserSignature = (): string | null => {
    try {
      const settings = localStorage.getItem('userSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        const signature = parsed.crosspostSignature;
        
        // Handle null, undefined, or empty string cases
        if (signature == null || signature === '') {
          return null;
        }
        
        // Trim whitespace and check if it's effectively empty
        const trimmedSignature = signature.trim();
        return trimmedSignature.length > 0 ? trimmedSignature : null;
      }
    } catch (error) {
      console.error('Error reading user signature from localStorage:', error);
    }
    return null;
  };

  // Helper function to build final content with signature and proper mention formatting
  const buildFinalContent = (baseContent: string, mediaUrl: string, platform: 'twitter' | 'nostr'): string => {
    // First, apply platform-specific mention formatting
    const contentWithMentions = buildFinalContentForPlatform(platform);
    
    const signature = getUserSignature();
    const signaturePart = signature ? `\n\n${signature}` : '';
    
    // Only include media URL for Nostr posts (back to original behavior)
    const mediaUrlPart = platform === 'nostr' ? `\n\n${mediaUrl}` : '';
    const callToActionPart = platform === 'nostr' ? `\n\nShared via https://pullthatupjamie.ai` : '';
    
    return `${contentWithMentions}${signaturePart}${mediaUrlPart}${callToActionPart}`;
  };

  // Unified helper to build a Nostr event: NO r-tag, media URL goes in content (original behavior)
  const createNostrEventUnified = (text: string, media?: string) => {
    const evt: any = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content: text, // text already includes media URL via buildFinalContent
      tags: [], // no r-tag
    };
    return evt;
  };

  const publishToNostr = async (): Promise<boolean> => {
    if (!window.nostr) {
      console.error("No Nostr extension available");
      return false;
    }

    try {
      setNostrState(prev => ({ ...prev, currentOperation: OperationType.PUBLISHING }));
      
      // If not authenticated, try to authenticate first
      if (!nostrState.authenticated) {
        try {
          await connectNostrExtension();
        } catch (error) {
          console.error("Failed to authenticate with Nostr extension before publishing");
          setNostrState(prev => ({ ...prev, currentOperation: OperationType.IDLE }));
          return false;
        }
      }
      
      const mediaUrl = fileUrl || renderUrl || '';
      const finalContent = buildFinalContent(content, mediaUrl, 'nostr');
      const eventToSign = createNostrEventUnified(finalContent, mediaUrl || undefined);
      const signedEvent = await window.nostr.signEvent(eventToSign);
      printLog(`Successfully signed Nostr event: ${JSON.stringify(signedEvent)}`);
      
      const publishPromises = relayPool.map(relay => 
        publishEventToRelay(relay, signedEvent)
      );
      
      const results = await Promise.allSettled(publishPromises);
      
      const successCount = results.filter(
        result => result.status === 'fulfilled' && result.value === true
      ).length;
      
      printLog(`Published to ${successCount}/${relayPool.length} relays`);
      
      const success = successCount > 0;
      if (success) {
        // Create Primal.net URL using proper bech32 encoding
        const bech32EventId = encodeBech32('nevent', signedEvent.id);
        const primalUrl = `https://primal.net/e/${bech32EventId}`;
        setSuccessUrls(prev => ({ ...prev, nostr: primalUrl }));
      }
      
      setNostrState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success }));
      return success;
    } catch (error) {
      console.error("Error publishing to Nostr:", error);
      setNostrState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success: false, error: error instanceof Error ? error.message : 'Failed to publish' }));
      return false;
    }
  };

  const publishToTwitter = async (): Promise<boolean> => {
    try {
      setTwitterState(prev => ({ ...prev, currentOperation: OperationType.PUBLISHING }));
      
      const mediaUrl = fileUrl || renderUrl || '';
      const isAdmin = AuthService.isAdmin();
      
      if (isAdmin && twitterState.authenticated) {
        const finalContent = buildFinalContent(content, mediaUrl, 'twitter');
        printLog(`Posting tweet with content: "${finalContent}" and mediaUrl: "${mediaUrl}"`);
        
        const response = await twitterService.postTweet(finalContent, mediaUrl);
        printLog(`Twitter post response: ${JSON.stringify(response)}`);
        
        if (response.error === 'TWITTER_AUTH_EXPIRED' && response.requiresReauth) {
          printLog('Twitter auth expired detected in SocialShareModal');
          setTwitterState(prev => ({ ...prev, authenticated: false, currentOperation: OperationType.IDLE, error: 'Authentication expired' }));
          return false;
        }
        
        if (response.success && response.tweet?.id) {
          printLog('Tweet posted successfully');
          const tweetUrl = `https://x.com/RobinSeyr/status/${response.tweet.id}`;
          setSuccessUrls(prev => ({ ...prev, twitter: tweetUrl }));
          setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success: true }));
          return true;
        } else {
          setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success: false, error: response.message || response.error || 'Failed to post tweet' }));
          return false;
        }
      } else {
        // For non-admin users or unauthenticated admins, open Twitter web intent
        const finalContent = buildFinalContent(content, mediaUrl, 'twitter');
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(finalContent)}`;
        window.open(twitterUrl, '_blank');
        setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success: true }));
        return true;
      }
    } catch (error) {
      printLog(`Error posting tweet: ${error}`);
      setTwitterState(prev => ({ ...prev, currentOperation: OperationType.IDLE, success: false, error: error instanceof Error ? error.message : 'Failed to post tweet' }));
      return false;
    }
  };


  const handleSchedule = async () => {
    if (!scheduledDate) {
      setSchedulingError("Please select a date and time");
      return;
    }

    // Check if scheduled date is in the future (with a 1-minute buffer)
    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    if (scheduledDate <= minScheduleTime) {
      setSchedulingError("Please select a time at least 1 minute in the future");
      return;
    }

    // Check if we have either content or media URL
    const mediaUrl = fileUrl || renderUrl || '';
    if (!content.trim() && !mediaUrl) {
      setSchedulingError("Please enter some content or select media for your post");
      return;
    }

    setIsScheduling(true);
    setSchedulingError(null);

    try {
      if (isUpdateMode && updateContext) {
        // Update existing scheduled post
        const signature = getUserSignature();
        const signaturePart = signature ? `\n\n${signature}` : "";
        const finalContent = `${content}${signaturePart}`;

        // Get the correct post ID (handles both postId and _id)
        const postId = updateContext.scheduledPost.postId || updateContext.scheduledPost._id;
        console.log('Update mode - Post ID:', postId, 'Post object:', updateContext.scheduledPost);

        if (!postId) {
          throw new Error('No valid post ID found for update');
        }

        // Apply randomization if enabled
        const finalScheduledDate = randomizeTime(scheduledDate, userSettings.randomizePostTime ?? true);
        
        let updateRequest: any = {
          text: finalContent,
          mediaUrl: mediaUrl,
          scheduledFor: convertToChicagoTime(finalScheduledDate).toISOString(),
          timezone: "America/Chicago"
        };

        // If this is a Nostr post, we need to re-sign the event with new content
        if (updateContext.scheduledPost.platform === 'nostr') {
          if (!window.nostr) {
            throw new Error('Nostr extension not available. Please install/enable a NIP-07 extension.');
          }

          // Build the EXACT content that will be sent to backend
          const fullContentWithMedia = buildFinalContent(content, mediaUrl || '', 'nostr');
          
          // Re-sign the event with the new content
          const eventToSign = createNostrEventUnified(fullContentWithMedia, mediaUrl || undefined);
          const signedEvent = await window.nostr.signEvent(eventToSign);

          // Generate new Primal URL from new event ID
          const bech32EventId = encodeBech32('nevent', signedEvent.id);
          const primalUrl = `https://primal.net/e/${bech32EventId}`;

          // Update the request to include new Nostr platform data
          updateRequest.text = fullContentWithMedia;
          updateRequest.platformData = {
            nostrEventId: signedEvent.id,
            nostrSignature: signedEvent.sig,
            nostrPubkey: signedEvent.pubkey,
            nostrCreatedAt: (signedEvent as any)?.created_at ?? eventToSign.created_at,
            nostrRelays: relayPool,
            nostrPostUrl: primalUrl,
          };
        }

        const updatedPost = await ScheduledPostService.updateScheduledPost(postId, updateRequest);

        printLog(`Successfully updated scheduled post: ${updatedPost.postId}`);
        
        // Call the update callback
        updateContext.onUpdate(updatedPost);
        
        // Close modal
        onClose();
      } else {
        // Create new scheduled post(s) - schedule Nostr first, then Twitter
        const twitterEnabled = twitterState.enabled && twitterState.available;
        const nostrEnabled = nostrState.enabled && nostrState.available && nostrState.authenticated;

        if (!twitterEnabled && !nostrEnabled) {
          setSchedulingError("Please enable at least one platform");
          return;
        }

        const signature = getUserSignature();
        const signaturePart = signature ? `\n\n${signature}` : "";
        const finalContent = `${content}${signaturePart}`;

        let nostrSucceeded = false;
        let twitterSucceeded = false;

        // Helper to create a minimal Nostr event for signature validation
        // Use unified event construction for Nostr

        // Apply randomization if enabled (only for new posts, not updates)
        const finalScheduledDate = randomizeTime(scheduledDate, userSettings.randomizePostTime ?? true);

        // Schedule Nostr first if enabled
        if (nostrEnabled) {
          try {
            if (!window.nostr) {
              throw new Error('Nostr extension not available. Please install/enable a NIP-07 extension.');
            }
            
            // Build the EXACT content that will be sent to backend
            const fullContentWithMedia = buildFinalContent(content, mediaUrl || '', 'nostr');
            
            // Sign that EXACT content
            const eventToSign = createNostrEventUnified(fullContentWithMedia, mediaUrl || undefined);
            const signedEvent = await window.nostr.signEvent(eventToSign);
            
            // Generate Primal URL from event ID
            const bech32EventId = encodeBech32('nevent', signedEvent.id);
            const primalUrl = `https://primal.net/e/${bech32EventId}`;

            const nostrRequest: CreateScheduledPostRequest = {
              text: fullContentWithMedia, // Send the complete content including media URL
              mediaUrl, // Still send mediaUrl for backend reference
              scheduledFor: convertToChicagoTime(finalScheduledDate).toISOString(),
              platforms: ["nostr"],
              timezone: "America/Chicago",
              platformData: {
                nostrEventId: signedEvent.id,
                nostrSignature: signedEvent.sig,
                nostrPubkey: signedEvent.pubkey,
                nostrCreatedAt: (signedEvent as any)?.created_at ?? eventToSign.created_at,
                nostrRelays: relayPool,
                nostrPostUrl: primalUrl, // Include client-calculated Primal URL
              },
            };

            const nostrResult = await ScheduledPostService.createScheduledPost(nostrRequest);
            printLog(`Successfully scheduled ${nostrResult.length} Nostr post(s)`);
            nostrSucceeded = true;
          } catch (error: any) {
            console.error("Error scheduling Nostr post:", error);
            const message = (error instanceof Error ? error.message : String(error)) || '';
            if (message.toLowerCase().includes('signature')) {
              setSchedulingError('Nostr signature validation failed. Please confirm your Nostr extension is connected and try again.');
            } else {
              setSchedulingError(message || 'Failed to schedule Nostr post.');
            }
            // Do not proceed to Twitter scheduling if Nostr fails
            return;
          }
        }

        // Schedule Twitter second if enabled
        if (twitterEnabled) {
          try {
            const twitterRequest: CreateScheduledPostRequest = {
              text: finalContent,
              mediaUrl,
              scheduledFor: convertToChicagoTime(finalScheduledDate).toISOString(),
              platforms: ["twitter"],
              timezone: "America/Chicago"
            };
            const twitterResult = await ScheduledPostService.createScheduledPost(twitterRequest);
            printLog(`Successfully scheduled ${twitterResult.length} Twitter post(s)`);
            twitterSucceeded = true;
          } catch (error: any) {
            console.error('Error scheduling Twitter post:', error);
            const message = (error instanceof Error ? error.message : String(error)) || '';
            setSchedulingError(message || 'Failed to schedule Twitter post.');
            // We intentionally do not early return here since Nostr already succeeded
          }
        }

        // Show success if at least one platform scheduled successfully
        if ((nostrEnabled && nostrSucceeded) || (twitterEnabled && twitterSucceeded)) {
          setShowSuccessModal(true);
        }
      }
    } catch (error) {
      console.error("Error scheduling post:", error);
      setSchedulingError(error instanceof Error ? error.message : "Failed to schedule post");
    } finally {
      setIsScheduling(false);
    }
  };

  const handlePublish = async () => {
    const promises: Promise<boolean>[] = [];
    
    // Add Twitter publishing if enabled and available
    if (twitterState.enabled && twitterState.available) {
      promises.push(publishToTwitter());
    }
    
    // Add Nostr publishing if enabled and available
    if (nostrState.enabled && nostrState.available && nostrState.authenticated) {
      promises.push(publishToNostr());
    }
    
    if (promises.length === 0) {
      return;
    }
    
    try {
      // Publish to all enabled platforms in parallel
      const results = await Promise.allSettled(promises);
      
      // Check if any succeeded
      const anySuccess = results.some(result => 
        result.status === 'fulfilled' && result.value === true
      );
      
      if (anySuccess) {
        // Show success modal instead of closing
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error during publishing:', error);
    }
  };

  const handleJamieAssist = async () => {
    // Clear any previous errors
    setJamieAssistError(null);

    // Get current timestamp
    const currentTime = Date.now();
    
    // Check if this is a back-to-back call without user edits
    const isBackToBackCall = (currentTime - lastJamieAssistCall < 10000) && !userEditedSinceLastAssist;
    
    // Update last call timestamp
    setLastJamieAssistCall(currentTime);
    
    // Reset user edit tracking flag
    setUserEditedSinceLastAssist(false);
    
    // Validate lookupHash
    if (!lookupHash) {
      console.error("Missing lookupHash for Jamie Assist");
      setJamieAssistError("Unable to generate content: Missing clip reference.");
      return;
    }
    
    // Handle case where lookupHash is in "undefined-X" format
    if (typeof lookupHash === 'string' && lookupHash.startsWith('undefined-')) {
      console.error(`Invalid lookupHash format: ${lookupHash}`);
      setJamieAssistError("Unable to generate content: Invalid clip reference.");
      return;
    }
    
    // Check for auth
    if (!auth) {
      console.error("Missing auth for Jamie Assist");
      // Instead of showing error, open the register modal
      setIsRegisterModalOpen(true);
      return;
    }

    printLog(`Calling Jamie Assist with lookupHash: ${lookupHash}`);
    setIsGeneratingContent(true);
    
    try {
      // If this is a back-to-back call, clear the content and start fresh
      if (isBackToBackCall) {
        printLog("Back-to-back Jamie Assist call detected - starting from scratch");
        setContent('');
      }
      
      // Prepare additional prefs string
      let prefs = additionalPrefs;
      
      // Only use existing content if it's not a back-to-back call
      if (content.trim() && !isBackToBackCall) {
        prefs = `User started this post, please help finish it with similar text: ${content}\n${prefs}`;
      }
      
      // Call Jamie Assist service
      await generateAssistContent(
        lookupHash,
        prefs,
        auth,
        (generatedContent) => {
          // This callback updates the content as it streams in
          setContent(generatedContent);
        }
      );
      
    } catch (error: any) {
      console.error("Error with Jamie Assist:", error);
      
      // Handle rate limit (429) errors specifically
      if (error instanceof JamieAssistError) {
        if (error.status === 429) {
          setJamieAssistError("You've reached your usage limit. Please upgrade your account to continue using Jamie Assist.");
        } else if (error.status === 401 || error.status === 403) {
          // Show register modal for auth errors
          setIsRegisterModalOpen(true);
        } else {
          setJamieAssistError(`Service error: ${error.message}`);
        }
      } else if (error.status === 429 || (error.message && error.message.includes('429'))) {
        setJamieAssistError("You've reached your usage limit. Please upgrade or sign into your account to continue using Jamie Assist.");
      } else {
        // Generic error message for other cases
        setJamieAssistError("An error occurred while generating content. Please try again later.");
      }
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Don't search if query hasn't changed
    if (query === lastSearchQuery) {
      return;
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (query.length >= 2) {
        setLastSearchQuery(query);
        
        // Update platform-specific state
        const platformKey = currentMentionPlatform === Platform.Twitter ? 'twitter' : 'nostr';
        setPlatformSearchState(prev => ({
          ...prev,
          [platformKey]: { query, hasResults: false }
        }));
        
        // Check if it's an npub query - if so, don't use streaming search
        const isNpub = /^npub1[a-z0-9]{58}$/.test(query.trim());
        if (isNpub && currentMentionPlatform === Platform.Nostr) {
          // For npub queries, clear search results and trigger automatic lookup
          clearMentionSearch();
          // Don't auto-lookup here since MentionsLookupView handles it
        } else {
          // For regular queries, use streaming search on BOTH platforms to detect cross-platform mappings
          performMentionSearch(query, {
            platforms: ['twitter', 'nostr'], // Always search both platforms to find cross-platform mappings
            includePersonalPins: true,
            includeCrossPlatformMappings: true,
            limit: 10
          });
        }
      } else {
        setLastSearchQuery('');
        clearMentionSearch();
        
        // Clear platform state
        const platformKey = currentMentionPlatform === Platform.Twitter ? 'twitter' : 'nostr';
        setPlatformSearchState(prev => ({
          ...prev,
          [platformKey]: { query: '', hasResults: false }
        }));
      }
    }, 300); // 300ms debounce
  }, [lastSearchQuery, performMentionSearch, clearMentionSearch, currentMentionPlatform]);

  // Function to handle content changes and track user edits
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setContent(newContent);
    
    // Only mark as edited if there's actual content
    if (newContent.trim() !== '') {
      // Mark that user has edited content since last Jamie Assist call
      setUserEditedSinceLastAssist(true);
    }
    
    // Check for @ mention detection
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Check if there's no space after @ (still typing the mention)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionSearchQuery(textAfterAt);
          setMentionStartIndex(lastAtIndex);
          setSelectedMentionIndex(-1); // Reset selection when search query changes
          setShowMentionsLookup(true);
          
          // Use debounced search
          debouncedSearch(textAfterAt);
          return;
        }
      }
    }
    
    // Hide mentions if no valid @ pattern found
    setShowMentionsLookup(false);
    setMentionSearchQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(-1);
    setLastSearchQuery('');
    
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    clearMentionSearch();
  };

  // Handle keyboard events for textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key to select first mention
    if (e.key === 'Tab' && showMentionsLookup && firstMention) {
      e.preventDefault();
      handleMentionSelect(firstMention, firstMention.platform);
    }
    
    // Handle arrow keys for mention navigation
    if (showMentionsLookup && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => {
          // If no selection yet, start with first item (index 0)
          if (prev === -1) return 0;
          const newIndex = prev < mentionResults.length - 1 ? prev + 1 : 0;
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => {
          // If no selection yet, start with last item
          if (prev === -1) return mentionResults.length - 1;
          const newIndex = prev > 0 ? prev - 1 : mentionResults.length - 1;
          return newIndex;
        });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const selectedMention = mentionResults[selectedMentionIndex >= 0 ? selectedMentionIndex : 0];
        if (selectedMention) {
          handleMentionSelect(selectedMention, selectedMention.platform);
        }
      }
    }
  };

  // Render the Jamie Assist info modal
  const renderInfoModal = () => {
    if (!showInfoModal) return null;
    
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-black border border-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md text-center relative shadow-xl max-h-[90vh] flex flex-col">
          <button 
            onClick={() => setShowInfoModal(false)} 
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="mb-4 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mr-3">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">Jamie Assist</h2>
          </div>
          
          <div className="text-left overflow-y-auto px-1 flex-1" style={{ scrollbarWidth: 'thin' }}>
            <p className="text-gray-300 mb-4">
              Jamie Assist helps you craft engaging social media posts about your clip using AI.
            </p>
            
            <h3 className="text-white font-medium mb-2">What it does:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1.5 mb-4 ml-1">
              <li>Generates promotional text based on the clip content</li>
              <li>Completes your thoughts if you've started writing</li>
              <li>Creates posts from scratch if your text area is empty</li>
              <li>Adapts to your preferences (tone, style, hashtags)</li>
            </ul>
            
            <h3 className="text-white font-medium mb-2">How to use it:</h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-1.5 mb-4 ml-1">
              <li>Optionally start writing your post</li>
              <li>Click "Jamie Assist" to generate content</li>
              <li>Use "Jamie Assist Prompt" to specify tone or style</li>
              <li>Edit the generated text as needed before sharing</li>
            </ol>
            
            <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg mt-4 mb-4">
              <p className="text-gray-400 text-sm">
                <span className="text-amber-500">Tip:</span> The link to your clip, attribution, and a signature will be added automatically when you publish.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowInfoModal(false)}
            className="mt-4 px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-400 hover:to-amber-500 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    );
  };

  // Register Modal handlers with polling
  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const handleLightningSelect = () => {
    setIsRegisterModalOpen(false);
    printLog("Lightning wallet connection selected");
    
    // Start polling for tokens after Lightning selection
    startTokenPolling();
    setJamieAssistError("Please complete the Lightning connection in the popup window.");
  };

  const handleSubscribeSelect = () => {
    setIsRegisterModalOpen(false);
    printLog("Subscription selected");
    
    // Start polling for tokens after subscription selection
    startTokenPolling();
    setJamieAssistError("Please complete the subscription process in the new window.");
  };

  // Add success modal close handler
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    onClose(); // Close the main modal after success modal is dismissed
  };

  // Helper function to detect if search query is an npub
  const isNpubQuery = (query: string): boolean => {
    return /^npub1[a-z0-9]{58}$/.test(query.trim());
  };

  // Handler for mention selection
  const handleMentionSelect = (mention: MentionResult, platform: string) => {
    printLog('=== MENTION SELECT START ===');
    printLog(`Selected mention: ${JSON.stringify(mention, null, 2)}`);
    printLog(`All mentionResults: ${JSON.stringify(mentionResults, null, 2)}`);
    printLog(`Current mentionSearchQuery: "${mentionSearchQuery}"`);
    printLog(`Platform parameter: "${platform}"`);
    printLog(`mentionStartIndex: ${mentionStartIndex}`);
    
    if (mentionStartIndex === -1) return;
    
    let displayName: string;
    let dictionaryKey: string;
    let dictionaryEntry: any;
    
    // Check if user searched by npub and we're selecting a Nostr profile
    const wasNpubSearch = isNpubQuery(mentionSearchQuery);
    printLog(`handleMentionSelect - npub detection: searchQuery="${mentionSearchQuery}", wasNpubSearch=${wasNpubSearch}, platform=${mention.platform}`);
    
    if (mention.platform === 'twitter') {
      const twitterMention = mention as TwitterResult;
      displayName = twitterMention.username;
      dictionaryKey = displayName;
      
      // Check if this mention has cross-platform mapping (Twitter + Nostr)
      // Handle both string format (from API) and object format (from type)
      const hasCrossPlatformMapping = 
        (typeof twitterMention.crossPlatformMapping === 'string' && (twitterMention.crossPlatformMapping as string).includes('Nostr')) ||
        (typeof twitterMention.crossPlatformMapping === 'object' && twitterMention.crossPlatformMapping?.hasNostrMapping);
      
      printLog(`Twitter crossPlatformMapping detection: raw=${JSON.stringify(twitterMention.crossPlatformMapping)}, type=${typeof twitterMention.crossPlatformMapping}, hasCrossPlatformMapping=${hasCrossPlatformMapping}`);
      
      if (hasCrossPlatformMapping) {
        // For string format, try to find the linked Nostr profile from the same search results
        let nostrNprofile = '';
        let nostrDisplayName = displayName;
        
        if (typeof twitterMention.crossPlatformMapping === 'object') {
          // Object format
          nostrNprofile = twitterMention.crossPlatformMapping.nostrNpub ? `nostr:${twitterMention.crossPlatformMapping.nostrNpub}` : '';
          nostrDisplayName = twitterMention.crossPlatformMapping.nostrDisplayName || displayName;
        } else {
          // String format - find the corresponding Nostr profile from search results
          const linkedNostrProfile = mentionResults.find(result => 
            result.platform === 'nostr' && 
            result.pinId === twitterMention.pinId && // Same pinId indicates linked profiles
            result.isPinned
          ) as NostrResult | undefined;
          
          if (linkedNostrProfile) {
            const nprofile = linkedNostrProfile.nostr_data?.nprofile || linkedNostrProfile.nprofile;
            nostrNprofile = nprofile ? `nostr:${nprofile}` : `@${linkedNostrProfile.nostr_data?.displayName || linkedNostrProfile.displayName || displayName}`;
            // USE THE ACTUAL NOSTR NAME, NOT THE TWITTER NAME!
            nostrDisplayName = linkedNostrProfile.nostr_data?.displayName || linkedNostrProfile.nostr_data?.name || linkedNostrProfile.displayName || linkedNostrProfile.name || 'walker';
            printLog(`Found linked Nostr profile: nprofile=${nprofile}, nostrNprofile=${nostrNprofile}, nostrDisplayName=${nostrDisplayName}`);
          } else {
            nostrNprofile = `@${displayName}`; // Fallback
            printLog('No linked Nostr profile found, using fallback');
          }
        }
        
        dictionaryEntry = {
          twitterHandle: `@${twitterMention.username}`,
          nostrNprofile: nostrNprofile,
          nostrDisplayName: nostrDisplayName,
          platform: 'both' as const
        };
        
        printLog(`Cross-platform Twitter mention detected: twitter=@${twitterMention.username}, nostr=${nostrNprofile}, displayName=${nostrDisplayName}, willPopulateBothPlatforms=true, mappingFormat=${typeof twitterMention.crossPlatformMapping}`);
      } else {
        // Twitter-only mention
        dictionaryEntry = {
          twitterHandle: `@${twitterMention.username}`,
          platform: 'twitter' as const
        };
      }
    } else if (mention.platform === 'nostr') {
      const nostrMention = mention as NostrResult;
      
      // Get effective data (prefer nostr_data from backend)
      const npub = nostrMention.nostr_data?.npub || nostrMention.npub || (nostrMention as any).username;
      const nprofile = nostrMention.nostr_data?.nprofile || nostrMention.nprofile;
      const displayNameFromData = nostrMention.nostr_data?.displayName || 
                                  nostrMention.nostr_data?.name || 
                                  nostrMention.displayName || 
                                  nostrMention.name ||
                                  'Unknown';
      
      // For npub searches, use display name in textarea but keep npub in dictionary key for lookup
      if (wasNpubSearch && mention.platform === 'nostr') {
        displayName = displayNameFromData; // Use human-readable name for display
        dictionaryKey = mentionSearchQuery; // Use the npub as dictionary key since that's what user typed
        console.log('NPub search detected - using display name for UI:', {
          npub: mentionSearchQuery,
          displayName: displayNameFromData,
          dictionaryKey: mentionSearchQuery
        });
      } else {
        displayName = displayNameFromData;
        dictionaryKey = displayName;
      }
      
      // Check if this mention has cross-platform mapping (Nostr + Twitter)
      // Handle both string format (from API) and object format (from type)
      const hasCrossPlatformMapping = 
        (typeof nostrMention.crossPlatformMapping === 'string' && (nostrMention.crossPlatformMapping as string).includes('Twitter')) ||
        (typeof nostrMention.crossPlatformMapping === 'object' && nostrMention.crossPlatformMapping?.hasTwitterMapping);
      
      printLog(`Nostr crossPlatformMapping detection: raw=${JSON.stringify(nostrMention.crossPlatformMapping)}, type=${typeof nostrMention.crossPlatformMapping}, hasCrossPlatformMapping=${hasCrossPlatformMapping}`);
      
      if (hasCrossPlatformMapping) {
        // For string format, try to find the linked Twitter profile from the same search results
        let twitterHandle = '';
        
        if (typeof nostrMention.crossPlatformMapping === 'object') {
          // Object format
          twitterHandle = `@${nostrMention.crossPlatformMapping.twitterUsername}`;
        } else {
          // String format - find the corresponding Twitter profile from search results
          const linkedTwitterProfile = mentionResults.find(result => 
            result.platform === 'twitter' && 
            result.pinId === nostrMention.pinId && // Same pinId indicates linked profiles
            result.isPinned
          ) as TwitterResult | undefined;
          
          if (linkedTwitterProfile) {
            twitterHandle = `@${linkedTwitterProfile.username}`;
            printLog(`Found linked Twitter profile: username=${linkedTwitterProfile.username}, twitterHandle=${twitterHandle}`);
          } else {
            // Fallback: extract from string format if possible
            const match = (nostrMention.crossPlatformMapping as string).match(/@(\w+)/);
            twitterHandle = match ? `@${match[1]}` : `@${displayNameFromData}`;
            printLog('No linked Twitter profile found, using fallback extraction');
          }
        }
        
        dictionaryEntry = {
          twitterHandle: twitterHandle,
          nostrNprofile: nprofile ? `nostr:${nprofile}` : (npub ? `nostr:${npub}` : `@${displayNameFromData}`),
          nostrDisplayName: displayNameFromData,
          platform: 'both' as const
        };
        
        console.log('Cross-platform Nostr mention detected:', {
          twitter: twitterHandle,
          nostr: nprofile ? `nostr:${nprofile}` : `nostr:${npub}`,
          displayName: displayNameFromData,
          wasNpubSearch,
          willPopulateBothPlatforms: true,
          mappingFormat: typeof nostrMention.crossPlatformMapping
        });
      } else {
        // Nostr-only mention
        dictionaryEntry = {
          nostrNprofile: nprofile ? `nostr:${nprofile}` : (npub ? `nostr:${npub}` : `@${displayNameFromData}`),
          nostrDisplayName: displayNameFromData,
          platform: 'nostr' as const
        };
      }
      
      // For npub searches, also add an entry for the display name to handle future searches by name
      if (wasNpubSearch && displayNameFromData !== mentionSearchQuery) {
        console.log('Adding secondary dictionary entry for display name:', displayNameFromData);
      }
    } else {
      displayName = 'unknown';
      dictionaryKey = 'unknown';
      dictionaryEntry = {
        twitterHandle: '@unknown',
        platform: 'twitter' as const
      };
    }
    
    // Update the mention dictionary
    printLog(`=== UPDATING MENTION DICTIONARY ===`);
    printLog(`dictionaryKey: "${dictionaryKey}"`);
    printLog(`dictionaryEntry: ${JSON.stringify(dictionaryEntry, null, 2)}`);
    
    setMentionDictionary(prev => {
      const newDict = {
        ...prev,
        [dictionaryKey]: dictionaryEntry
      };
      
      // Add bidirectional entries for cross-platform mentions
      if (dictionaryEntry.platform === 'both') {
        const twitterUsername = dictionaryEntry.twitterHandle?.replace('@', '');
        const nostrDisplayName = dictionaryEntry.nostrDisplayName;
        
        if (twitterUsername && twitterUsername !== dictionaryKey) {
          newDict[twitterUsername] = dictionaryEntry;
        }
        if (nostrDisplayName && nostrDisplayName !== dictionaryKey) {
          newDict[nostrDisplayName] = dictionaryEntry;
        }
      }
      
      return newDict;
    });
    
    // For cross-platform mentions, add nprofile → display name mapping
    if (dictionaryEntry.platform === 'both' && dictionaryEntry.nostrNprofile && dictionaryEntry.nostrDisplayName) {
      setNprofileToDisplayName(prev => ({
        ...prev,
        [dictionaryEntry.nostrNprofile]: dictionaryEntry.nostrDisplayName
      }));
      printLog(`Added nprofile mapping: "${dictionaryEntry.nostrNprofile}" -> "${dictionaryEntry.nostrDisplayName}"`);
    }
    
    // For npub searches, also add the npub key mapping
    if (wasNpubSearch && mention.platform === 'nostr' && displayName !== mentionSearchQuery) {
      setMentionDictionary(prev => ({
        ...prev,
        [mentionSearchQuery]: dictionaryEntry
      }));
    }
    
    // Determine display text based on current platform mode
    let currentDisplayName: string;
    if (dictionaryEntry.platform === 'both') {
      // Cross-platform mention: show appropriate name based on mode
      currentDisplayName = platformMode === 'twitter' ? 
        dictionaryEntry.twitterHandle.replace('@', '') : 
        dictionaryEntry.nostrDisplayName;
    } else if (dictionaryEntry.platform === 'twitter') {
      // Twitter-only: always show Twitter handle
      currentDisplayName = dictionaryEntry.twitterHandle.replace('@', '');
    } else {
      // Nostr-only: always show Nostr display name
      currentDisplayName = dictionaryEntry.nostrDisplayName;
    }
    
    // Create the display text for the textarea using backticks
    const mentionText = `\`@${currentDisplayName}\` `;
    
    // Replace the @ and search text with the selected mention
    // For npub searches, we need to replace the entire npub, not just @npub
    let replaceLength: number;
    if (wasNpubSearch && mention.platform === 'nostr') {
      // Replace @ + the entire npub (user typed npub but we detected @ + npub)
      replaceLength = 1 + mentionSearchQuery.length;
      printLog(`NPub replacement - replacing @ + npub: searchQuery="${mentionSearchQuery}", replaceLength=${replaceLength}, newDisplayText="${mentionText}"`);
    } else {
      // Normal case: replace @ + search query
      replaceLength = 1 + mentionSearchQuery.length;
    }
    
    const beforeMention = content.substring(0, mentionStartIndex);
    const afterMention = content.substring(mentionStartIndex + replaceLength);
    const newContent = beforeMention + mentionText + afterMention;
    
    setContent(newContent);
    
    // If this is a cross-platform mention, immediately update platform-specific texts
    if (dictionaryEntry.platform === 'both') {
      printLog('Cross-platform mention selected - triggering platform text updates');
      // Force immediate re-evaluation of platform texts using the new content
      setTimeout(() => {
        const newTwitterText = buildPlatformTextWithContent(newContent, 'twitter');
        const newNostrText = buildPlatformTextWithContent(newContent, 'nostr');
        setTwitterText(newTwitterText);
        setNostrText(newNostrText);
        printLog(`Platform texts updated after cross-platform mention: twitterText="${newTwitterText}", nostrText="${newNostrText}"`);
      }, 100); // Small delay to ensure state updates have propagated
    }
    
    printLog('=== MENTION SELECT END ===');
    
    // Calculate cursor position after insertion
    const cursorPosition = mentionStartIndex + mentionText.length;
    
    // Hide mentions popup
    setShowMentionsLookup(false);
    setMentionSearchQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(-1);
    
    // Mark as user edited
    setUserEditedSinceLastAssist(true);
    
    // Set cursor position after a brief delay to ensure DOM update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
    
    console.log('Mention Dictionary Updated:', {
      key: dictionaryKey,
      entry: dictionaryEntry,
      currentPlatformMode: platformMode,
      displayName: currentDisplayName,
      fullDictionary: { ...mentionDictionary, [dictionaryKey]: dictionaryEntry }
    });
    
    printLog(`Selected mention: @${currentDisplayName} (${dictionaryEntry.platform}) - Dictionary updated`);
  };

  // Handler to close mentions popup
  const handleCloseMentions = () => {
    setShowMentionsLookup(false);
    setMentionSearchQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(-1);
  };

  // Handler for platform changes in mention lookup
  const handleMentionPlatformChange = (platform: Platform) => {
    // Update both the current mention platform and the unified platform mode
    const platformKey = platform === Platform.Twitter ? 'twitter' : 'nostr';
    handlePlatformModeChange(platformKey);
    
    // Update search query to show platform-specific state
    const currentState = platformSearchState[platformKey];
    if (currentState.hasResults) {
      // If this platform has previous results, show that query
      setMentionSearchQuery(currentState.query);
    } else {
      // Otherwise, clear to show just @
      setMentionSearchQuery('');
    }
    
    // Re-trigger search if we have a query
    if (currentState.query && currentState.query.length >= 2) {
      setLastSearchQuery(currentState.query);
      
      // Check if it's an npub query
      const isNpub = /^npub1[a-z0-9]{58}$/.test(currentState.query.trim());
      if (isNpub && platform === Platform.Nostr) {
        // For npub queries, clear search results and let MentionsLookupView auto-lookup
        clearMentionSearch();
      } else {
        // For regular queries, use streaming search on BOTH platforms to detect cross-platform mappings
        performMentionSearch(currentState.query, {
          platforms: ['twitter', 'nostr'], // Always search both platforms to find cross-platform mappings
          includePersonalPins: true,
          includeCrossPlatformMappings: true,
          limit: 10
        });
      }
    } else {
      clearMentionSearch();
    }
  };

  // Track when mention results change to update platform state
  useEffect(() => {
    if (mentionResults.length > 0 && mentionSearchQuery) {
      const platformKey = currentMentionPlatform === Platform.Twitter ? 'twitter' : 'nostr';
      setPlatformSearchState(prev => ({
        ...prev,
        [platformKey]: { 
          query: mentionSearchQuery, 
          hasResults: true 
        }
      }));
    }
  }, [mentionResults, mentionSearchQuery, currentMentionPlatform]);

  // Update platform-specific text variables when content or dictionary changes
  useEffect(() => {
    const newTwitterText = buildPlatformText('twitter');
    const newNostrText = buildPlatformText('nostr');
    
    console.log('Text Transformation Update:', {
      content,
      dictionary: mentionDictionary,
      twitterText: newTwitterText,
      nostrText: newNostrText
    });
    
    setTwitterText(newTwitterText);
    setNostrText(newNostrText);
  }, [content, mentionDictionary]);

  // Update content display when platform mode changes (for cross-platform mentions)
  useEffect(() => {
    const updatedContent = updateContentForPlatformMode();
    if (updatedContent !== content) {
      console.log('Platform mode changed - updating content:', updatedContent);
      setContent(updatedContent);
    }
  }, [platformMode]); // Only depend on platformMode to avoid infinite loops

  // Function to get highlighted content for display overlay using backtick parsing
  const getHighlightedContent = (): string => {
    if (!content) return '';
    
    // console.log('getHighlightedContent - processing content:', content);
    // console.log('getHighlightedContent - selectedMentions:', selectedMentions);
    
    // Split content into parts and handle each part
    const parts: string[] = [];
    let lastIndex = 0;
    
    // Parse content to find mentions using backticks `@username` format
    const mentionRegex = /`(@[^`]+)`/g;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const fullMatch = match[0]; // `@username`
      const mentionText = match[1]; // @username
      
      console.log('Found mention:', fullMatch, 'extracted:', mentionText);
      
      // Add text before the mention (escaped)
      if (match.index > lastIndex) {
        const beforeText = content.substring(lastIndex, match.index);
        parts.push(escapeHtml(beforeText));
      }
      
      // Find the platform data for this mention
      const mentionData = selectedMentions.find(m => 
        m.displayText === mentionText || m.displayText === mentionText.replace('@', '')
      );
      
      const platform = mentionData?.platform || 'twitter';
      const highlightColor = platform === 'nostr' 
        ? 'rgba(139, 92, 246, 0.5)' 
        : 'rgba(29, 161, 242, 0.5)';
      
      console.log('Mention platform:', platform, 'color:', highlightColor);
      
      // Add highlighted mention (unescaped HTML)
      const highlightedSpan = `<mark style="background-color: ${highlightColor}; color: white; border-radius: 4px; padding: 1px 3px; font-weight: 500; margin: 0;">${escapeHtml(mentionText)}</mark>`;
      parts.push(highlightedSpan);
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Add remaining text after the last mention
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      parts.push(escapeHtml(remainingText));
    }
    
    // Join all parts and convert newlines and spaces
    const result = parts.join('').replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;');
    
    // console.log('getHighlightedContent result:', result);
    return result;
  };

  // Helper function to escape HTML
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Handle clicks on textarea to detect mention clicks and open lookup
  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorPosition = textarea.selectionStart;
    
    // Check if click is on a mention
    for (const mention of selectedMentions) {
      const mentionStart = content.indexOf(mention.displayText);
      const mentionEnd = mentionStart + mention.displayText.length;
      
      if (cursorPosition >= mentionStart && cursorPosition <= mentionEnd) {
        // Click was on a mention - open lookup view with this mention's platform
        const mentionPlatform = mention.platform === 'twitter' ? Platform.Twitter : Platform.Nostr;
        setCurrentMentionPlatform(mentionPlatform);
        setMentionStartIndex(mentionStart);
        setMentionSearchQuery(mention.displayText.replace('@', ''));
        setShowMentionsLookup(true);
        
        // Set cursor position
        setTimeout(() => {
          textarea.setSelectionRange(mentionEnd, mentionEnd);
        }, 10);
        
        return;
      }
    }
    
    // Normal click - check for @ symbol to trigger mention search
    const beforeCursor = content.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = content.substring(lastAtIndex + 1, cursorPosition);
      if (textAfterAt.length >= 0 && !textAfterAt.includes(' ')) {
        // Start mention search
        setMentionStartIndex(lastAtIndex);
        setMentionSearchQuery(textAfterAt);
        setShowMentionsLookup(true);
      }
    }
  };

  // Function to build platform-specific text using mention dictionary
  const buildPlatformText = (targetPlatform: 'twitter' | 'nostr'): string => {
    return buildPlatformTextWithContent(content, targetPlatform);
  };

  // Helper function that takes content as a parameter (for immediate updates)
  const buildPlatformTextWithContent = (sourceContent: string, targetPlatform: 'twitter' | 'nostr'): string => {
    if (!sourceContent) return '';
    
    // Parse content to find mentions using backticks `@username` format
    const mentionRegex = /`(@[^`]+)`/g;
    let processedContent = sourceContent;
    let match;
    const replacements: Array<{ original: string; replacement: string }> = [];
    
    // Find all mentions and prepare replacements using dictionary
    while ((match = mentionRegex.exec(sourceContent)) !== null) {
      const fullMatch = match[0]; // `@username`
      const mentionText = match[1].replace('@', ''); // username (clean)
      
      // Look up in mention dictionary
      const dictionaryEntry = mentionDictionary[mentionText];
      
      if (dictionaryEntry) {
        let replacementText: string;
        
        if (targetPlatform === 'twitter') {
          // For Twitter posting
          if (dictionaryEntry.platform === 'twitter' || dictionaryEntry.platform === 'both') {
            replacementText = dictionaryEntry.twitterHandle || `@${mentionText}`;
          } else {
            // Nostr-only mention: use display name as plain text
            replacementText = `@${dictionaryEntry.nostrDisplayName || mentionText}`;
          }
        } else {
          // For Nostr posting
          if (dictionaryEntry.platform === 'nostr' || dictionaryEntry.platform === 'both') {
            replacementText = dictionaryEntry.nostrNprofile || `@${mentionText}`;
          } else {
            // Twitter-only mention: use Twitter handle as plain text
            replacementText = dictionaryEntry.twitterHandle || `@${mentionText}`;
          }
        }
        
        replacements.push({ original: fullMatch, replacement: replacementText });
      } else {
        // If no dictionary entry found, just remove backticks
        replacements.push({ original: fullMatch, replacement: `@${mentionText}` });
      }
    }
    
    // Apply all replacements
    for (const { original, replacement } of replacements) {
      processedContent = processedContent.replace(original, replacement);
    }
    
    return processedContent;
  };
  
  // Function to update content display based on platform mode
  const updateContentForPlatformMode = (): string => {
    if (!content) return '';
    
    if (platformMode === 'nostr') {
      // Twitter→Nostr: Use nostrText to find nprofiles and map back to display names
      const nprofileRegex = /nostr:(nprofile[a-z0-9]+)/g;
      let match;
      const nprofileMatches: string[] = [];
      
      while ((match = nprofileRegex.exec(nostrText)) !== null) {
        nprofileMatches.push(`nostr:${match[1]}`);
      }
      
      if (nprofileMatches.length > 0) {
        let updatedContent = content;
        const mentionRegex = /`(@[^`]+)`/g;
        let mentionMatch;
        let mentionIndex = 0;
        
        while ((mentionMatch = mentionRegex.exec(content)) !== null) {
          if (mentionIndex < nprofileMatches.length) {
            const nprofile = nprofileMatches[mentionIndex];
            const displayName = nprofileToDisplayName[nprofile];
            
            if (displayName) {
              updatedContent = updatedContent.replace(mentionMatch[0], `\`@${displayName}\``);
              printLog(`Twitter→Nostr: Mapped ${nprofile} -> @${displayName}`);
            }
            mentionIndex++;
          }
        }
        
        return updatedContent;
      }
    }
    
    // Nostr→Twitter: Use existing dictionary logic
    const mentionRegex = /`(@[^`]+)`/g;
    let updatedContent = content;
    let match;
    const replacements: Array<{ original: string; replacement: string }> = [];
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const fullMatch = match[0]; // `@username`
      const mentionText = match[1].replace('@', ''); // username (clean)
      
      // Look up in mention dictionary
      const dictionaryEntry = mentionDictionary[mentionText];
      
      if (dictionaryEntry && dictionaryEntry.platform === 'both') {
        // Cross-platform mention: update display based on current mode
        const newDisplayName = platformMode === 'twitter' ? 
          dictionaryEntry.twitterHandle?.replace('@', '') : 
          dictionaryEntry.nostrDisplayName;
        
        if (newDisplayName && newDisplayName !== mentionText) {
          replacements.push({ 
            original: fullMatch, 
            replacement: `\`@${newDisplayName}\`` 
          });
        }
      }
    }
    
    // Apply replacements
    for (const { original, replacement } of replacements) {
      updatedContent = updatedContent.replace(original, replacement);
    }
    
    return updatedContent;
  };
  
  // Function to build final content with proper mention formatting for specific platform
  const buildFinalContentForPlatform = (targetPlatform: 'twitter' | 'nostr'): string => {
    return buildPlatformText(targetPlatform);
  };

  // Handler for scheduled slots changes
  const handleScheduledSlotsChange = async (slots: any[]) => {
    await updateUserSetting('scheduledPostSlots', slots);
  };

  // Handler for selecting a time slot
  const handleSlotSelect = (slot: any) => {
    // Calculate the next occurrence of this day/time in user's timezone
    const now = new Date();
    const [hours, minutes] = slot.time.split(':').map(Number);
    
    // Find the next occurrence of this day of week
    let targetDate = new Date(now);
    const dayDiff = (slot.dayOfWeek - now.getDay() + 7) % 7;
    
    // If it's the same day but the time has passed, move to next week
    if (dayDiff === 0 && (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes()))) {
      targetDate.setDate(now.getDate() + 7);
    } else {
      targetDate.setDate(now.getDate() + dayDiff);
    }
    
    targetDate.setHours(hours, minutes, 0, 0);
    
    setPendingScheduledDate(targetDate);
  };

  // Helper function to convert user's local time to Chicago time for backend
  const convertToChicagoTime = (localDate: Date): Date => {
    // Simply return the date as-is since the backend expects UTC timestamps
    // The timezone field ("America/Chicago") tells the backend how to interpret it
    return localDate;
  };

  // Helper function to randomize post time using white noise
  const randomizeTime = (date: Date, shouldRandomize: boolean): Date => {
    if (!shouldRandomize) return date;
    
    // Generate white noise: random value between -1 and 1
    const whiteNoise = (Math.random() * 2) - 1;
    
    // Multiply by 10 minutes (600,000 milliseconds)
    const randomOffset = whiteNoise * 10 * 60 * 1000;
    
    // Apply the offset to the date
    const randomizedDate = new Date(date.getTime() + randomOffset);
    
    // Ensure the randomized time is at least 1 minute from now
    const now = new Date();
    const minTime = new Date(now.getTime() + 60 * 1000); // now + 1 minute
    
    // If the randomized time is in the past or too close to now, use the minimum time
    if (randomizedDate < minTime) {
      return minTime;
    }
    
    return randomizedDate;
  };

  if (!isOpen || !fileUrl) return null;

  // Updated renderMainModalContent to show unified cross-posting interface
  const renderMainModalContent = () => {
    const isAdmin = AuthService.isAdmin();

    // Show loading state while checking tokens initially
    if (isCheckingTokens) {
      return (
        <div className="text-center py-8 px-4">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-300 text-lg">Checking authentication...</p>
        </div>
      );
    }

    // Show polling state after user clicks connect
    if (isPollingTokens) {
      return (
        <div className="text-center py-8 px-4">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
          <p className="text-gray-300 text-lg mb-2">Waiting for authentication...</p>
          <p className="text-gray-400 text-sm">Complete the authentication in the popup window</p>
          <button
            onClick={stopTokenPolling}
            className="mt-4 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      );
    }

    // Show register modal prompt if no valid tokens and no auth
    // Exception: If user has auth_token and admin_privs, let them through
    const hasAuthToken = !!localStorage.getItem('auth_token');
    const isAdminPrivs = localStorage.getItem('admin_privs') === 'true';
    
    if (!hasValidTokens && !auth && !(hasAuthToken && isAdminPrivs)) {
      return (
        <div className="text-center py-8 px-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Authentication Required</h3>
          <p className="text-gray-300 mb-6">
            You need to authenticate to use Jamie Assist and share content.
          </p>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-400 hover:to-amber-500 transition-colors"
          >
            Get Started
          </button>
        </div>
      );
    }

    // Main unified interface
    return (
      <>
        {/* Hide header and preview when in scheduling mode */}
        {!isSchedulingMode && (
          <>
            <div className="flex items-center mb-3 sm:mb-4 px-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-800 mr-2 sm:mr-3 flex items-center justify-center overflow-hidden">
                <img src="/twitter-nostr-crosspost.png" alt="Twitter and Nostr" className="w-8 h-8 object-cover" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium">Your Post</p>
              </div>
            </div>
            
            {/* Preview Section (between label and textarea) */}
            <div
              style={{
                width: PREVIEW_WIDTH,
                height: PREVIEW_HEIGHT,
                position: 'relative',
                background: '#222',
                borderRadius: 8,
                overflow: 'hidden',
                margin: '0 auto 16px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
          {/* Shimmer while loading */}
          {!previewLoaded && !thumbnailFailed && (
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                zIndex: 1,
              }}
            />
          )}
          {/* Image preview if loaded and not failed */}
          {isVideo && !thumbnailFailed && (
            <img
              src={videoThumbnailUrl + (thumbnailRetry ? `&retry=1` : '')}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: previewLoaded ? 'block' : 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 2,
              }}
              onLoad={() => setPreviewLoaded(true)}
              onError={e => {
                if (!thumbnailRetry) {
                  setTimeout(() => setThumbnailRetry(true), 3000);
                } else {
                  setThumbnailFailed(true);
                }
              }}
            />
          )}
          {/* Video fallback if thumbnail failed */}
          {isVideo && thumbnailFailed && (
            <video
              id="video-preview"
              src={fileUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 2,
                background: '#222',
              }}
              muted
              playsInline
              preload="metadata"
              onLoadedData={e => {
                (e.target as HTMLVideoElement).currentTime = 0;
                setPreviewLoaded(true);
              }}
            />
          )}
          {/* Image for non-video */}
          {!isVideo && (
            <img
              src={fileUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: previewLoaded ? 'block' : 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 2,
              }}
              onLoad={() => setPreviewLoaded(true)}
            />
          )}
          {/* Play icon overlay for video */}
          {isVideo && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              width: playIconSize,
              height: playIconSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3,
            }}>
              <svg width={playIconSize - 8} height={playIconSize - 8} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.6)"/>
                <polygon points="14,11 27,18 14,25" fill="#fff" />
              </svg>
            </div>
          )}
          </div>
        </>
        )}
        
        {!isSchedulingMode && (
          <div className="relative">
            {/* Backdrop container for highlighting */}
            <div 
              className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
              style={{ 
                height: "120px", 
                minHeight: "100px",
                zIndex: 1
              }}
            >
              {/* Background layer */}
              <div 
                className="absolute inset-0 bg-gray-900 border border-gray-700 rounded-xl"
              />
              
              {/* Highlighted content layer */}
              <div 
                ref={highlightLayerRef}
                className="absolute inset-0 p-3 sm:p-4 text-base whitespace-pre-wrap break-words overflow-hidden"
                style={{ 
                  height: "120px", 
                  minHeight: "100px",
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  color: 'transparent'
                }}
                dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
              />
            </div>
            
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleTextareaKeyDown}
              onClick={handleTextareaClick}
              onScroll={(e) => {
                // Synchronize scroll position with highlight layer
                if (highlightLayerRef.current) {
                  const target = e.target as HTMLTextAreaElement;
                  highlightLayerRef.current.scrollTop = target.scrollTop;
                  highlightLayerRef.current.scrollLeft = target.scrollLeft;
                }
              }}
              className="relative w-full border border-gray-700 rounded-xl p-3 sm:p-4 mb-1 text-base focus:border-gray-500 focus:outline-none text-white"
              placeholder={`Write about this ${itemName}...`}
              style={{ 
                resize: "none", 
                height: "120px", 
                minHeight: "100px",
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.9)',
                zIndex: 2,
                lineHeight: '1.5'
              }}
            />
            
            {/* Mode Switcher Toggle - Bottom Right Corner */}
            <div className="absolute bottom-3 right-3 z-10">
              <button
                onClick={() => handlePlatformModeChange(platformMode === 'twitter' ? 'nostr' : 'twitter')}
                className={`relative w-16 h-8 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 hover:scale-105 ${
                  platformMode === 'twitter' 
                    ? 'bg-blue-500 hover:bg-blue-400 focus:ring-blue-500' 
                    : 'bg-purple-500 hover:bg-purple-400 focus:ring-purple-500'
                }`}
                title={`Currently: ${platformMode === 'twitter' ? 'Twitter' : 'Nostr'} mode - Click to switch to ${platformMode === 'twitter' ? 'Nostr' : 'Twitter'} mode`}
              >
                {/* Track background with platform icons */}
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <Twitter 
                    className={`w-3 h-3 transition-opacity duration-300 ${
                      platformMode === 'twitter' ? 'text-blue-500 opacity-100' : 'text-white opacity-0'
                    }`} 
                  />
                  <div 
                    className={`w-3 h-3 transition-opacity duration-300 ${
                      platformMode === 'nostr' ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      backgroundColor: '#8B5CF6',
                      mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                      WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                    }}
                  />
                </div>
                
                {/* Sliding thumb */}
                <div
                  className={`absolute top-1 w-6 h-6 bg-black rounded-full shadow-lg transform transition-all duration-300 ease-in-out flex items-center justify-center ${
                    platformMode === 'twitter' ? 'translate-x-1' : 'translate-x-9'
                  }`}
                >
                  {/* Active icon in thumb */}
                  {platformMode === 'twitter' ? (
                    <Twitter className="w-3 h-3 text-blue-500" />
                  ) : (
                    <div 
                      className="w-3 h-3"
                      style={{
                        backgroundColor: '#8B5CF6',
                        mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                        WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                      }}
                    />
                  )}
                </div>
              </button>
            </div>
          
                  {/* Mentions Lookup Overlay */}
        {showMentionsLookup && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 flex justify-center">
            {mentionSearchQuery.length < MENTION_MIN_CHARS ? (
              <div className="bg-gray-900 text-gray-400 px-4 py-2 rounded shadow text-sm">
                Keep typing to search for mentions...
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-2 max-w-md w-full">
                {/* Streaming Search Status */}
                {mentionSearchLoading && (
                  <div className="flex items-center justify-between mb-2 px-2 py-1 bg-gray-800 rounded text-xs">
                    <span className="text-gray-300">Searching...</span>
                    <div className="flex items-center space-x-2">
                      {completedSources.includes('pins') && <span className="text-yellow-500">📌</span>}
                      {completedSources.includes('twitter') && <span className="text-blue-400">🐦</span>}
                      {completedSources.includes('mappings') && <span className="text-purple-400">🔗</span>}
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    </div>
                  </div>
                )}
                
                {/* Error Display */}
                {mentionSearchError && (
                  <div className="mb-2 px-2 py-1 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
                    {mentionSearchError}
                  </div>
                )}
                
                <MentionsLookupView 
                  onMentionSelect={handleMentionSelect}
                  searchQuery={mentionSearchQuery}
                  onClose={handleCloseMentions}
                  onFirstMentionChange={setFirstMention}
                  selectedIndex={selectedMentionIndex}
                  mentionResults={mentionResults}
                  onMentionResultsChange={updateMentionResults}
                  isLoading={mentionSearchLoading}
                  error={mentionSearchError}
                  onPlatformChange={handleMentionPlatformChange}
                  initialPlatform={currentMentionPlatform}
                  linkingMode={linkingMode}
                  onPairProfile={handlePairProfile}
                  onCancelLinking={handleCancelLinking}
                  onLinkProfile={handleLinkProfile}
                />
              </div>
            )}
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-sm">{successMessage}</span>
          </div>
        )}

        {/* Pin Management Modal */}
        <MentionPinManagement
          isOpen={showPinManagement}
          onClose={() => setShowPinManagement(false)}
          onStartLinking={handleStartLinking}
        />
          </div>
        )}
        
        {!isSchedulingMode && (
          <>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-400 text-xs pl-1">
                The link to your {itemName}, attribution, and a signature will be added automatically when you publish.
              </div>
              <button
                onClick={() => setShowPinManagement(true)}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-yellow-500 transition-colors"
                title="Manage pinned mentions"
              >
                <Pin className="w-3 h-3" />
                <span>Pins</span>
              </button>
            </div>
            
            {/* Platform Selection with Checkboxes */}
            <div className="mb-6">
          <div className="space-y-3">
            {/* Twitter Platform */}
            <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <Twitter className="w-6 h-6 text-blue-400" />
                <div className="flex-1">
                  {isAdmin && twitterState.authenticated ? (
                    successUrls.twitter ? (
                      <a 
                        href={successUrls.twitter} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-white text-sm hover:text-blue-400 transition-colors"
                      >
                        Post Successful - View on Twitter
                      </a>
                    ) : (
                      <p className="text-white text-sm">Signed in as @{twitterState.username}</p>
                    )
                  ) : (
                    <p className="text-white text-sm">
                      {isAdmin ? 'Connect to post directly' : 'Web sharing available'}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    {twitterState.authenticated ? (
                      <button
                        onClick={disconnectTwitter}
                        disabled={twitterState.currentOperation === OperationType.CONNECTING || twitterState.currentOperation === OperationType.DISCONNECTING}
                        className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                      >
                        {twitterState.currentOperation === OperationType.DISCONNECTING ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={connectTwitter}
                        disabled={twitterState.currentOperation === OperationType.CONNECTING}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                      >
                        {twitterState.currentOperation === OperationType.CONNECTING ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-2">
                {twitterState.currentOperation === OperationType.CONNECTING && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                {twitterState.currentOperation === OperationType.PUBLISHING && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                {twitterState.success === true && <Check className="w-4 h-4 text-green-500" />}
                {twitterState.success === false && <X className="w-4 h-4 text-red-500" />}
                <input
                  type="checkbox"
                  checked={twitterState.enabled}
                  onChange={(e) => setTwitterState(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Nostr Platform */}
            <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <img 
                  src="/nostr-logo-square.png" 
                  alt="Nostr" 
                  className="w-6 h-6"
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen', opacity: nostrState.available ? 1 : 0.5 }}
                />
                <div className="flex-1">
                  {nostrState.available && nostrState.authenticated ? (
                    successUrls.nostr ? (
                      <a 
                        href={successUrls.nostr} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-white text-sm hover:text-purple-400 transition-colors"
                      >
                        Post Successful - View on Primal
                      </a>
                    ) : (
                      <p className="text-white text-sm">Extension connected</p>
                    )
                  ) : nostrState.available ? (
                    <p className="text-white text-sm">Connect NIP07 Extension to Post on Nostr</p>
                  ) : (
                    <div className="text-xs text-gray-400 italic opacity-70">Nostr: Coming Soon</div>
                  )}
                </div>
                {nostrState.available && !nostrState.authenticated && (
                  <button
                    onClick={connectNostrExtension}
                    disabled={nostrState.currentOperation === OperationType.CONNECTING}
                    className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
                  >
                    Connect
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-2">
                {nostrState.currentOperation === OperationType.CONNECTING && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                {nostrState.currentOperation === OperationType.PUBLISHING && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                {nostrState.success === true && <Check className="w-4 h-4 text-green-500" />}
                {nostrState.success === false && <X className="w-4 h-4 text-red-500" />}
                <input
                  type="checkbox"
                  checked={nostrState.enabled && nostrState.available && nostrState.authenticated}
                  onChange={(e) => setNostrState(prev => ({ ...prev, enabled: e.target.checked }))}
                  disabled={!nostrState.available || !nostrState.authenticated}
                  className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
            </div>
            
            {/* Jamie Assist Advanced Preferences */}
            <div className="mb-4 sm:mb-6">
          <button 
            onClick={() => setShowAdvancedPrefs(!showAdvancedPrefs)}
            className="flex items-center text-gray-400 hover:text-white text-sm mb-1 sm:mb-2"
          >
            Jamie Assist Prompt {showAdvancedPrefs ? <ChevronUp className="ml-1 w-4 h-4" /> : <ChevronRight className="ml-1 w-4 h-4" />}
          </button>
          
          {showAdvancedPrefs && (
            <div className="border border-gray-800 rounded-lg p-2 sm:p-3 bg-gray-900 mb-2 sm:mb-3">
              <label className="block text-sm text-gray-300 mb-1 text-left">
                Specify tone, style or preferred hashtags:
              </label>
              <textarea
                ref={jamieAssistTextareaRef}
                value={additionalPrefs}
                onChange={(e) => setAdditionalPrefs(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2 sm:p-3 text-sm mb-2 sm:mb-3 resize-none overflow-y-auto leading-6"
                placeholder="E.g.: Professional tone, include hashtags #podcast #JRE"
                rows={3}
                style={{
                  minHeight: window.innerWidth >= 640 ? '5.25rem' : '3.75rem', // 3.5 lines on large, 2.5 lines on small (1.5rem line height)
                  height: window.innerWidth >= 640 ? '5.25rem' : '3.75rem'
                }}
                onInput={(e) => adjustTextareaHeight(e.target as HTMLTextAreaElement)}
              />
              <div className="flex justify-end">
                <button
                  onClick={saveJamieAssistPreferences}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  <span>{prefsSuccessfullySaved ? 'Saved!' : 'Save as Default'}</span>
                </button>
              </div>
            </div>
          )}
            </div>
          </>
        )}
        
        {/* Publishing status for enabled platforms */}
        {isPublishing && (
          <div className="mb-4 sm:mb-6 border border-gray-800 rounded-lg p-2 sm:p-3 bg-gray-900">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h3 className="text-white font-medium text-sm">Publishing...</h3>
              <Loader2 className="animate-spin w-4 h-4" />
            </div>
            {nostrState.enabled && nostrState.available && (
              <div className="text-xs text-gray-400">
                Nostr relays: {Object.values(publishStatus).filter(s => s === 'published').length}/{relayPool.length}
              </div>
            )}
          </div>
        )}
        
        {/* Jamie Assist button and info button */}
        {!isSchedulingMode && (
          <div className="flex justify-center mb-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleJamieAssist}
                disabled={isGeneratingContent || isPublishing || !lookupHash}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium flex items-center
                  ${(isGeneratingContent || isPublishing || !lookupHash) ? 'opacity-50 cursor-not-allowed' : 'hover:from-amber-400 hover:to-amber-500 transition-colors'}`}
              >
                {isGeneratingContent ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Sparkles className="w-4 h-4 mr-1 sm:mr-2" />
                    Jamie Assist
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center space-x-1 px-2 py-1 rounded-full border border-gray-700 group hover:bg-gray-800 hover:border-amber-500/30 transition-colors"
                title="About Jamie Assist"
                aria-label="Learn more about Jamie Assist"
              >
                <Info className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500" />
              </button>
            </div>
          </div>
        )}
        
        {/* Scheduling Section */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col items-center mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (!isSchedulingMode) {
                    setPendingScheduledDate(scheduledDate);
                  }
                  setIsSchedulingMode(!isSchedulingMode);
                }}
                disabled={isGeneratingContent || isPublishing}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center
                  ${isSchedulingMode 
                    ? "bg-white text-black hover:bg-gray-100" 
                    : "bg-black border border-white text-white hover:bg-gray-900"}
                  ${(isGeneratingContent || isPublishing) ? ' opacity-50 cursor-not-allowed' : ' transition-colors'}`}
              >
                <Clock className="w-4 h-4 mr-1 sm:mr-2" />
                {isSchedulingMode ? 'Close Scheduler' : 'Schedule'}
              </button>
              {!isSchedulingMode && scheduledDate && (
                <span className="text-xs text-gray-400">
                  Scheduled for {formatScheduledDate(scheduledDate)}
                </span>
              )}
            </div>
          </div>
          {isSchedulingMode && (
            <div className="text-center mb-3">
              <span className="text-xs text-gray-400">
                {isUpdateMode ? 'Edit scheduled time' : 'Choose when to publish this post'}
              </span>
            </div>
          )}
          
                      {isSchedulingMode && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <DateTimePicker
                  value={pendingScheduledDate ?? scheduledDate}
                  onChange={setPendingScheduledDate}
                  placeholder="Select date and time"
                  className=""
                  onDropdownStateChange={setHasOpenDropdowns}
                />
                
                {/* Randomize Post Time Option */}
                <div className="border-t border-gray-800 pt-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userSettings.randomizePostTime ?? true}
                      onChange={(e) => updateUserSetting('randomizePostTime', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 border-2 rounded-sm mr-3 flex items-center justify-center transition-colors ${
                      (userSettings.randomizePostTime ?? true)
                        ? 'bg-white border-white' 
                        : 'border-gray-400 bg-transparent'
                    }`}>
                      {(userSettings.randomizePostTime ?? true) && (
                        <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-white text-sm">Randomize post time (±10 min)</span>
                  </label>
                </div>

                {/* Scheduled Post Slots */}
                <div className="border-t border-gray-800 pt-4">
                  <ScheduledPostSlots
                    slots={userSettings.scheduledPostSlots || []}
                    onSlotsChange={handleScheduledSlotsChange}
                    onSlotSelect={handleSlotSelect}
                    maxSlots={10}
                    isSelectable={true}
                  />
                </div>
                
                {schedulingError && (
                  <div className="px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
                    {schedulingError}
                  </div>
                )}
              </div>
            )}
        </div>
        
        {/* Jamie Assist Error Message */}
        {jamieAssistError && (
          <div className="mb-3 sm:mb-4 px-3 sm:px-4 py-2 sm:py-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300 relative">
            <button 
              onClick={() => setJamieAssistError(null)}
              className="absolute top-1 sm:top-2 right-1 sm:right-2 text-red-400 hover:text-red-300"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="pr-6">{jamieAssistError}</div>
          </div>
        )}
        
        <div className="flex space-x-3 sm:space-x-4 justify-center">
          {isSchedulingMode ? (
            <>
              <button
                onClick={() => {
                  setPendingScheduledDate(scheduledDate);
                  setIsSchedulingMode(false);
                }}
                disabled={isPublishing || isGeneratingContent}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg border border-gray-700 text-gray-300 
                  ${(isPublishing || isGeneratingContent) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-white transition-colors'}`}
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setScheduledDate(pendingScheduledDate);
                  setIsSchedulingMode(false);
                }}
                disabled={!pendingScheduledDate || isPublishing || isGeneratingContent}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg bg-black border border-white text-white font-medium 
                  ${(!pendingScheduledDate || isPublishing || isGeneratingContent) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900 transition-colors'}`}
              >
                Confirm Time
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isPublishing || isGeneratingContent || isScheduling}
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg border border-gray-700 text-gray-300 
                  ${(isPublishing || isGeneratingContent || isScheduling) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-white transition-colors'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (scheduledDate) {
                    // Directly schedule (create or update) when a time exists
                    handleSchedule();
                  } else {
                    handlePublish();
                  }
                }}
                disabled={
                  scheduledDate
                    ? (isScheduling || isGeneratingContent || (!content.trim() && !(fileUrl || renderUrl)) || (!isUpdateMode && (!twitterState.enabled && !nostrState.enabled)) || !scheduledDate)
                    : (isPublishing || isGeneratingContent || (!content.trim() && !(fileUrl || renderUrl)) || (!twitterState.enabled && !nostrState.enabled))
                }
                className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg ${scheduledDate ? 'bg-white text-black' : 'bg-white text-black'} font-medium 
                  ${scheduledDate
                    ? ((isScheduling || isGeneratingContent || (!content.trim() && !(fileUrl || renderUrl)) || (!isUpdateMode && (!twitterState.enabled && !nostrState.enabled)) || !scheduledDate) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100')
                    : ((isPublishing || isGeneratingContent || (!content.trim() && !(fileUrl || renderUrl)) || (!twitterState.enabled && !nostrState.enabled)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100')
                  } transition-colors`}
              >
                {isPublishing ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                    {scheduledDate ? 'Scheduling...' : 'Publishing...'}
                  </span>
                ) : scheduledDate ? 'Schedule' : 'Post Now'}
              </button>
            </>
          )}
        </div>
        
        <div className="text-gray-500 text-xs mt-2 sm:mt-4 text-center">
          <p>Character count: {content.length}</p>
        </div>
      </>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[100] p-2 sm:p-4 md:p-8">
        <div className="bg-black border border-gray-800 rounded-xl md:rounded-xl p-4 sm:p-6 w-full sm:max-w-sm md:max-w-md lg:max-w-xl text-center relative shadow-xl sm:transform sm:-translate-y-12 h-[80vh] flex flex-col">
          <button onClick={onClose} className="absolute top-4 right-6 text-gray-400 hover:text-white transition-colors z-10">
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className={`flex-1 pr-2 mt-8 ${(isSchedulingMode && !hasOpenDropdowns) ? 'overflow-hidden' : 'overflow-y-auto'}`}
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#ffffff #374151',
              msOverflowStyle: 'auto'
            }}>
            {renderMainModalContent()}
          </div>
        </div>
        
        {renderInfoModal()}
        
        {/* RegisterModal overlay */}
        <RegisterModal 
          isOpen={isRegisterModalOpen}
          onClose={handleCloseRegisterModal}
          onLightningSelect={handleLightningSelect}
          onSubscribeSelect={handleSubscribeSelect}
        />
        
        {/* Success Modal */}
        <SocialShareSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          successUrls={successUrls}
        />
        
        {/* Add global styles for the scrollbar */}
        <style>{`
          .overflow-y-auto::-webkit-scrollbar {
            width: 8px;
            background-color: #374151;
          }
          
          .overflow-y-auto::-webkit-scrollbar-thumb {
            background-color: #ffffff;
            border-radius: 4px;
          }
          
          .overflow-y-auto::-webkit-scrollbar-track {
            background-color: #374151;
            border-radius: 4px;
          }
        `}</style>
      </div>
    </>
  );
};

export default SocialShareModal; 
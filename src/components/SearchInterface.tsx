import { performSearch } from '../lib/searxng.ts';
import { fetchClipById, checkClipStatus } from '../services/clipService.ts';
import { useSearchParams, useParams } from 'react-router-dom'; 
import { RequestAuthMethod, AuthConfig, API_URL, DEBUG_MODE, printLog, FRONTEND_URL, AIClipsViewStyle, SearchViewStyle } from '../constants/constants.ts';
import { handleQuoteSearch } from '../services/podcastService.ts';
import { ConversationItem, WebSearchModeItem } from '../types/conversation.ts';
import React, { useState, useEffect, useRef} from 'react';
import { ModelSettingsBar } from './ModelSettingsBar.tsx';
import { RegisterModal } from './RegisterModal.tsx';
import {SignInModal} from './SignInModal.tsx'
import LightningService from '../services/lightning.ts'
import {ClipProgress, ClipStatus, ClipRequest} from '../types/clips.ts'
import { checkFreeTierEligibility } from '../services/freeTierEligibility.ts';
import { useJamieAuth } from '../hooks/useJamieAuth.ts';
import {CheckoutModal} from './CheckoutModal.tsx'
import { ConversationRenderer } from './conversation/ConversationRenderer.tsx';
import QuickTopicGrid from './QuickTopicGrid.tsx';
import AvailableSourcesSection from './AvailableSourcesSection.tsx';
import PodcastLoadingPlaceholder from './PodcastLoadingPlaceholder.tsx';
import ClipTrackerModal from './ClipTrackerModal.tsx';
import PodcastFeedService from '../services/podcastFeedService.ts';
import { Filter, List, Grid3X3, X as XIcon } from 'lucide-react';
import PodcastSourceFilterModal, { PodcastSearchFilters } from './PodcastSourceFilterModal.tsx';
import { createClipShareUrl } from '../utils/urlUtils.ts';
import PageBanner from './PageBanner.tsx';
import ShareModal from './ShareModal.tsx';
import TutorialModal from './TutorialModal.tsx';
import WelcomeModal from './WelcomeModal.tsx';
import AccountButton from './AccountButton.tsx';
import SocialShareModal, { SocialPlatform } from './SocialShareModal.tsx';
import AuthService from '../services/authService.ts';
import ImageWithLoader from './ImageWithLoader.tsx';
import PodcastContextPanel from './PodcastContextPanel.tsx';


export type SearchMode = 'web-search' | 'podcast-search';
type ModelType = 'gpt-3.5-turbo' | 'claude-3-sonnet';
let buffer = '';

interface Source {
  title: string;
  url: string;
  snippet?: string;
}

interface SearchState {
  query: string;
  result: string;
  isLoading: boolean;
  error: Error | null;
  sources: Source[];
  activeConversationId?: number;
  clipProgress?: ClipProgress | null;
}

interface PodcastQuoteResult {
  id: string;
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  timeContext: {
    start_time: number;
    end_time: number;
  };
  similarity: {
    combined: number;
    vector: number;
  };
  episodeImage: string;
  shareUrl: string;
  shareLink: string;
  shareable?: boolean;
}

interface PodcastSearchData {
  quotes: PodcastQuoteResult[];
}

interface QuickTopicGridProps {
  triggerFadeOut: boolean;
  onTopicSelect: (topicQuery: string) => Promise<void>;
  className?: string;
}

interface ClipProgressData {
  isProcessing: boolean;
  creator: string;
  episode: string;
  timestamps: number[];
  cdnLink?: string;
  clipId: string;
  episodeImage: string;
  lookupHash: string;
  pollUrl?: string;
}

const initialSearchState: SearchState = {
  query: '',
  result: '',
  isLoading: false,
  error: null,
  sources: [],
  activeConversationId: undefined,
  clipProgress: null
};

interface SearchInterfaceProps {
  isSharePage?: boolean;
  isClipBatchPage?: boolean;
}

interface SubscriptionSuccessPopupProps {
  onClose: () => void;
  isJamiePro?: boolean;
}

interface BackoffConfig {
  initialDelay: number;  // Starting delay in ms
  maxDelay: number;     // Maximum delay in ms
  factor: number;       // Multiplication factor for each step
}

const defaultBackoff: BackoffConfig = {
  initialDelay: 2000,   // Start with 2 seconds
  maxDelay: 8000,      // Max out at 30 seconds
  factor: 1.1           // Increase by 50% each time
};

const SubscriptionSuccessPopup = ({ onClose, isJamiePro = false }: SubscriptionSuccessPopupProps) => (
  <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-lg font-bold mb-4">
        {isJamiePro ? 'Welcome to Jamie Pro!' : 'Your subscription was successful!'}
      </h2>
      <p className="text-gray-400 mb-4">
        {isJamiePro ? (
          'A team member will be in contact with you within 1 business day to complete your onboarding. \nIn the meantime enjoy additional on demand episode runs.'
        ) : (
          <>
            Enjoy unlimited access to Jamie and other{' '}
            <a
              href="https://cascdr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              CASCDR apps
            </a>
            .
          </>
        )}
      </p>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
      >
        Close
      </button>
    </div>
  </div>
);



const SUGGESTED_QUERIES = [
  {
    title: 'Get me up to speed',
    subtitle: 'on recent technology & stock market developments'
  },
  {
    title: 'Give me ideas',
    subtitle: 'on how to market my small business'
  },
  {
    title: 'Help me study',
    subtitle: 'vocabulary for my Spanish exam'
  }
];

interface PodcastStats {
  clipCount: number;
  episodeCount: number;
  feedCount: number;
}

export default function SearchInterface({ isSharePage = false, isClipBatchPage = false }: SearchInterfaceProps) {  
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('claude-3-sonnet' as ModelType);
  
  // Search view style state (Classic vs Split Screen)
  const [searchViewStyle, setSearchViewStyle] = useState<SearchViewStyle>(() => {
    const saved = localStorage.getItem('searchViewStyle');
    return saved === SearchViewStyle.CLASSIC ? SearchViewStyle.CLASSIC : SearchViewStyle.SPLIT_SCREEN;
  });
  
  // Context panel state for split-screen view
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  
  // Update state for filter button
  const [filterClicked, setFilterClicked] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Podcast search filters state
  const FILTERS_STORAGE_KEY = 'podcastSearchFilters';
  const [searchFilters, setSearchFilters] = useState<PodcastSearchFilters>(() => {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved filters:', e);
        return { episodeName: '', minDate: '', maxDate: '' };
      }
    }
    return { episodeName: '', minDate: '', maxDate: '' };
  });

  // Helper to check if any filters are active
  const hasActiveFilters = () => {
    return searchFilters.episodeName !== '' || searchFilters.minDate !== '' || searchFilters.maxDate !== '';
  };

  // Podcast stats - these will be updated from API later
  const [podcastStats, setPodcastStats] = useState<PodcastStats>({
    clipCount: 423587,
    episodeCount: 601,
    feedCount: 51
  });
  
  // Add a loading state for podcast stats
  const [podcastStatsLoading, setPodcastStatsLoading] = useState(false);
  
  // Function to fetch podcast stats from API
  const fetchPodcastStats = async () => {
    setPodcastStatsLoading(true);
    try {
      // Use the API_URL from constants to respect debug mode
      const response = await fetch(`${API_URL}/api/get-clip-count`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch podcast stats: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update just the clipCount, keep the other stats the same for now
      setPodcastStats(prevStats => ({
        ...prevStats,
        clipCount: data.clipCount
      }));

      printLog(`Fetched clip count: ${data.clipCount}`);
    } catch (error) {
      console.error('Failed to fetch podcast stats:', error);
      // Keep using the default values in case of error
    } finally {
      setPodcastStatsLoading(false);
    }
  };
  
  // Get the mode from URL parameters if available
  // This allows users to specify the search mode via URL parameter, e.g. ?mode=web-search or ?mode=podcast-search
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const queryParam = searchParams.get('q');
  
  const [searchMode, setSearchMode] = useState(
    // Only use the modeParam if it's a valid SearchMode
    modeParam && ['web-search', 'podcast-search'].includes(modeParam) 
      ? modeParam as SearchMode 
      : (isSharePage || isClipBatchPage ? 'podcast-search' as SearchMode : 'podcast-search' as SearchMode)
  );
  
  // Add state for admin privileges and toggle
  const [adminFeedId, setAdminFeedId] = useState<string | null>(null);
  const [podcastSearchMode, setPodcastSearchMode] = useState<'global' | 'my-pod'>('global');
  
  // Add state for clipBatch view mode with localStorage persistence
  const [clipBatchViewMode, setClipBatchViewMode] = useState<AIClipsViewStyle>(() => {
    const saved = localStorage.getItem('preferredAIClipsViewStyle');
    return saved === AIClipsViewStyle.LIST ? AIClipsViewStyle.LIST : AIClipsViewStyle.GRID;
  });

  // Handler for view mode changes with localStorage persistence
  const handleViewModeChange = (mode: AIClipsViewStyle) => {
    setClipBatchViewMode(mode);
    localStorage.setItem('preferredAIClipsViewStyle', mode);
  };
  
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const clipId = searchParams.get('clip');
  const { runId, feedId } = useParams<{ runId: string; feedId: string }>();
  const [authConfig, setAuthConfig] = useState<AuthConfig | null | undefined>(null);
  const [clipProgress, setClipProgress] = useState<ClipProgressData | undefined>(undefined);
  const pollIntervals = new Map<string, NodeJS.Timeout>();
  const STORAGE_KEY = 'selectedPodcastSources';
  const [searchState, setSearchState] = useState<SearchState>(initialSearchState);
  // Create a ref to store the last used selectedSources
  const lastUsedSourcesRef = useRef<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(() => {
    // Try to load saved selection from localStorage
    const savedSelection = localStorage.getItem(STORAGE_KEY);
    if (savedSelection) {
      try {
        const parsedSources = new Set<string>(JSON.parse(savedSelection));
        // Initialize the ref with the default sources
        lastUsedSourcesRef.current = parsedSources;
        return parsedSources;
      } catch (e) {
        console.error('Error parsing saved podcast sources:', e);
        return new Set<string>();
      }
    }
    return new Set<string>();
  });
  const [gridFadeOut, setGridFadeOut] = useState(false);
  const [searchHistory, setSearchHistory] = useState({
    'web-search': false,
    'podcast-search': isSharePage || isClipBatchPage
  });
  const hasSearchedInMode = (mode: SearchMode): boolean => {
    if (!searchHistory[mode]) return false;
    return searchHistory[mode];
  };

  // Add state to track if share modals are open
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSocialShareModalOpen, setIsSocialShareModalOpen] = useState(false);

  // Add state for ShareModal data
  const [shareModalData, setShareModalData] = useState<{
    fileUrl: string;
    lookupHash: string;
  } | null>(null);

  // Update the isAnyModalOpen function to include share modals
  const isAnyModalOpen = (): boolean => {
    return isRegisterModalOpen || 
           isSignInModalOpen || 
           isCheckoutModalOpen || 
           isUpgradeSuccessPopUpOpen || 
           isSendingFeedback ||
           isShareModalOpen ||
           isTutorialOpen ||
           isWelcomeOpen ||
           isSocialShareModalOpen;
  };

  //Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isUpgradeSuccessPopUpOpen, setIsUpgradeSuccessPopUpOpen] = useState(false);
  const [isClipTrackerCollapsed, setIsClipTrackerCollapsed] = useState(true);


  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [requestAuthMethod, setRequestAuthMethod] = useState(RequestAuthMethod.FREE);//free, lightning or square
  const [conversation, setConversation] = useState([] as ConversationItem[]);
  

  const searchInputRef = useRef<HTMLTextAreaElement>(null);
  const cleanupIntervalRef = useRef();
  const resultTextRef = useRef('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const nextConversationId = useRef(0);
  const searchSettingsBarStyle = "bg-[#000000] border-gray-800 border shadow-white-glow rounded-lg mt-2 pt-2 pb-1 max-w-3xl pr-1 mx-auto px-4 flex items-center justify-between relative"
  const searchButtonStyle = "ml-auto mt-1 mr-1 pl-3 pr-3 bg-white rounded-lg pt-1 pb-1 border-gray-800 hover:border-gray-700"

  //Lightning related
  const [isLightningInitialized, setIsLightningInitialized] = useState(false);
  const { 
    registerSubscription, 
    isRegistering, 
    registrationError 
  } = useJamieAuth();

  const handleUpgrade = () => {
    printLog(`handleUpgrade`)
    setIsCheckoutModalOpen(true);
  }

  const handleUpgradeSuccess = () => {
    setIsCheckoutModalOpen(false);
    setIsUpgradeSuccessPopUpOpen(true); // Show the popup
  };
  

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('squareId');
    localStorage.removeItem('isSubscribed');
    
    // Remove adminFeedId from localStorage and reset state
    const settings = localStorage.getItem('userSettings');
    if (settings) {
      const userSettings = JSON.parse(settings);
      delete userSettings.adminFeedId;
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
    }
    setAdminFeedId(null);
    
    setRequestAuthMethod(RequestAuthMethod.FREE);
  };

  const initializeLightning = async () => {
    const success = await LightningService.initialize();
    setIsLightningInitialized(success);
    setRequestAuthMethod(RequestAuthMethod.LIGHTNING);
  };

  const handlePayment = async () => {
    try {
      const result = await LightningService.handlePayment();
      if (!result) {
        throw new Error('Payment failed');
      }
      return result;
    } catch (error) {
      console.error('Payment failed:', error);
      if (error.message?.includes('already been paid')) {
        localStorage.removeItem('lightning_invoice');
        setSearchState(prev => ({ ...prev, isLoading: false, error: new Error('There was an error paying the invoice. Try again please.') }));
      }
      throw error;
    }
  };

  

  const handleSuggestionClick = async (suggestion: { title: string, subtitle: string }) => {
    const fullQuery = (`${suggestion.title} ${suggestion.subtitle}`);
    setQuery(fullQuery);
    searchInputRef.current?.focus();
    
    async function startStream(){
      try {
        await handleStreamingSearch(fullQuery);
      } catch (error) {
        console.error('Failed to process suggestion:', error);
      }
    }
    setTimeout(startStream,500);
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const handleLightningSelect = () => {
    if (!isLightningInitialized) {
      initializeLightning();
      setIsRegisterModalOpen(false);
    }
  };

  const handleSubscribeSelect = () => {
    setIsRegisterModalOpen(false);
    setIsSignInModalOpen(true);
  }

  const handleClipProgress = async (progress: ClipProgress) => {
      if (!progress || !progress.clipId || !progress.lookupHash) return;
      if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
        setIsRegisterModalOpen(true);
        setSearchState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const freshAuth = await getAuth();
      setAuthConfig(freshAuth);  // This will automatically propagate down
      const { clipId, lookupHash, pollUrl, isProcessing } = progress;

      setClipProgress(progress); // Update progress in state
      setIsClipTrackerCollapsed(false);

      if (!pollUrl || !isProcessing) return;

      // Prevent duplicate polling for the same clip
      if (pollIntervals.has(lookupHash)) {
          printLog(`Polling already in progress for ${lookupHash}`);
          return;
      }

      let currentDelay = defaultBackoff.initialDelay;

      const poll = async () => {
          try {
              const status = await checkClipStatus(pollUrl);

              if (status.status === "completed" && status.url) {
                  setClipProgress(prev => prev?.lookupHash === lookupHash
                      ? { ...prev, isProcessing: false, cdnLink: status.url }
                      : prev
                  );

                  // Stop polling for this clip
                  clearTimeout(pollIntervals.get(lookupHash));
                  pollIntervals.delete(lookupHash);
                  return;
              }

              currentDelay = Math.min(currentDelay * defaultBackoff.factor, defaultBackoff.maxDelay);
              pollIntervals.set(lookupHash, setTimeout(poll, currentDelay));

          } catch (error) {
              console.error(`Error polling clip status for ${lookupHash}:`, error);
              pollIntervals.set(lookupHash, setTimeout(poll, currentDelay));
          }
      };

      // Start polling
      pollIntervals.set(lookupHash, setTimeout(poll, currentDelay));

      // Cleanup polling after 5 minutes
      setTimeout(() => {
          if (pollIntervals.has(lookupHash)) {
              clearTimeout(pollIntervals.get(lookupHash));
              pollIntervals.delete(lookupHash);
              printLog(`Stopped polling ${lookupHash} after timeout`);
          }
      }, 5 * 60 * 1000);
  };

  


  const getAuth = async () => {
    let auth: AuthConfig;
    if (isLightningInitialized && requestAuthMethod === RequestAuthMethod.LIGHTNING) {
      try {
        const { preimage, paymentHash } = await handlePayment();
        auth = {
          type: RequestAuthMethod.LIGHTNING,
          credentials: {
            preimage,
            paymentHash
          }
        };
        setSearchState(prev => ({
          ...prev,
          error: null,
          isLoading: false
        }));
      } catch (error) {
        setSearchState(prev => ({
          ...prev,
          error: new Error('Payment failed: ' + error.message),
          isLoading: false
        }));
        return;
      }
    } else if(requestAuthMethod === RequestAuthMethod.SQUARE) {
      const squareId = localStorage.getItem('squareId');
      if (!squareId) {
        setSearchState(prev => ({
          ...prev,
          error: new Error('Square authentication required'),
          isLoading: false
        }));
        return;
      }
      auth = {
        type: RequestAuthMethod.SQUARE,
        credentials: { 
          username: squareId
        }
      };
    } else {
      auth = { type: RequestAuthMethod.FREE, credentials: {} };
    }
    return auth as AuthConfig;
  };

  const handleStreamingSearch = async (overrideQuery?: string) => {
    const queryToUse = overrideQuery || query;
    if (!queryToUse.trim()) return;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      setSearchState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setSearchState(prev => ({
      ...prev,
      error: null,
      isLoading: true
    }));

    const auth = await getAuth() as AuthConfig;
  
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  
    const conversationId = nextConversationId.current++;
  
    setQuery("");
    
    setConversation(prev => [...prev, {
      id: conversationId,
      type: 'web-search' as const,
      query: queryToUse, // Note: changed from query to queryToUse
      timestamp: new Date(),
      isStreaming: true,
      data: {
        result: '',
        sources: []
      }
    } as WebSearchModeItem]);
  
    setSearchState(prev => ({
      ...prev,
      isLoading: true,
      result: '',
      error: null,
      sources: [],
      activeConversationId: conversationId
    }));
  
    resultTextRef.current = '';
    setSearchHistory(prev => ({...prev, [searchMode]: true}));
  
    try {
      const response = await performSearch(queryToUse, auth);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
  
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setConversation(prev => 
            prev.map(item => 
              item.id === conversationId 
                ? { ...item, isStreaming: false }
                : item
            )
          );
          setSearchState(prev => ({ ...prev, isLoading: false }));
          break;
        }
  
        const chunk = decoder.decode(value);
        buffer += chunk;  // Add new chunk to buffer
  
        // Split on newlines, keeping any incomplete line in the buffer
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep the last (potentially incomplete) line
  
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setConversation(prev => 
                prev.map(item => 
                  item.id === conversationId 
                    ? { ...item, isStreaming: false }
                    : item
                )
              );
              setSearchState(prev => ({ ...prev, isLoading: false }));
              continue;
            }
  
            try {
              const parsed = JSON.parse(data);
              switch (parsed.type) {
                // In the switch (parsed.type) case handling:
                case 'search':
                  const sources = parsed.data.map((result: any) => ({
                    title: result.title,
                    url: result.url,
                    snippet: result.content || result.snippet || ''
                  }));
                  setConversation(prev => 
                    prev.map(item => {
                      if (item.id === conversationId && item.type === 'web-search') {
                        return {
                          ...item,
                          data: {
                            ...item.data,
                            sources
                          }
                        } as WebSearchModeItem;
                      }
                      return item;
                    })
                  );
                  break;
                
                case 'inference':
                  resultTextRef.current += parsed.data;
                  setConversation(prev => 
                    prev.map(item => {
                      if (item.id === conversationId && item.type === 'web-search') {
                        return {
                          ...item,
                          data: {
                            ...item.data,
                            result: resultTextRef.current
                          }
                        } as WebSearchModeItem;
                      }
                      return item;
                    })
                  );
                  break;
  
                case 'error':
                  setSearchState(prev => ({
                    ...prev,
                    error: new Error(parsed.data),
                    isLoading: false
                  }));
                  setConversation(prev => 
                    prev.map(item => 
                      item.id === conversationId 
                        ? { ...item, isStreaming: false }
                        : item
                    )
                  );
                  break;
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.error('JSON Parse Error:', {
                  data: data.substring(0, 100),
                  error: e.message
                });
                continue;
              }
              throw e;
            }
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
      setConversation(prev => 
        prev.map(item => 
          item.id === conversationId 
            ? { ...item, isStreaming: false }
            : item
        )
      );
    }

    printLog(`post search check:${requestAuthMethod}`)
    if(requestAuthMethod === RequestAuthMethod.FREE){
      await updateAuthMethodAndRegisterModalStatus();
    }
  };

  const performQuoteSearch = async () => {  
    setSearchHistory(prev => ({...prev, [searchMode]: true}));
    
    printLog("Starting quote search...");
    
    // Determine which sources to use based on podcast search mode
    let feedIdsToUse: string[];
    
    if (podcastSearchMode === 'my-pod' && adminFeedId) {
      // Use only the admin feedId when in "My Pod" mode
      feedIdsToUse = [adminFeedId];
      printLog(`Using My Pod mode with feedId: ${adminFeedId}`);
    } else {
      // Use selected podcast sources when in "Global" mode
      feedIdsToUse = Array.from(selectedSources) as string[];
      printLog(`Using Global mode with selected sources: ${JSON.stringify(feedIdsToUse)}`);
    }
    
    // Store the current selection in localStorage as a backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedIdsToUse));
    
    printLog(`Using feed IDs for search: ${JSON.stringify(feedIdsToUse,null,2)}`);
    printLog(`Using filters: ${JSON.stringify(searchFilters)}`);

    const auth = await getAuth() as AuthConfig;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      setSearchState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    printLog(`Request auth method:${requestAuthMethod}`)
    
    try {
      const quoteResults = await handleQuoteSearch(
        query, 
        auth, 
        feedIdsToUse,
        searchFilters.minDate || undefined,
        searchFilters.maxDate || undefined,
        searchFilters.episodeName || undefined
      );
      setConversation(prev => [...prev, {
        id: searchState.activeConversationId as number,
        type: 'podcast-search' as const,
        query: query,
        timestamp: new Date(),
        isStreaming: false,
        data: {
          quotes: quoteResults.results
        }
      }]);
      setQuery("");
      printLog("Quote search completed successfully");
    } catch (error) {
      console.error("Error during quote search:", error);
      setSearchState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
      return;
    } finally {
      // Only set loading to false at the very end
      setSearchState(prev => ({ ...prev, isLoading: false }));
    }
  }

  const handleSearch = async (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (searchMode === 'podcast-search') {
      try {
        setGridFadeOut(true);
        
        // Log the selected sources before search starts
        printLog(`Selected sources before search: ${JSON.stringify(Array.from(selectedSources))}`);
        
        // Before starting the search, ensure our selection is maintained
        // This prevents any potential state update issues during async operations
        const searchSelection = new Set(selectedSources);
        
        setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
        await new Promise(resolve => {
          setSearchState(prev => ({ ...prev, isLoading: true }));
          setTimeout(resolve, 0);
        });
        
        // We'll use this function's closure to capture the current selection state
        await performQuoteSearch();
        return;
      } catch (error) {
        console.error('Quote search error:', error);
        setSearchState(prev => ({
          ...prev,
          error: error as Error,
          isLoading: false
        }));
        return;
      }
    } else {
      await handleStreamingSearch();
    }
  };

  const updateAuthMethodAndRegisterModalStatus = async () => {
     if(localStorage.getItem('squareId')) {
      setRequestAuthMethod(RequestAuthMethod.SQUARE);
      const email = localStorage.getItem('squareId') as string;
      const success = await registerSubscription(email);
      printLog(`Registration result:${success}`);
      return;
    }else if (localStorage.getItem('bc:config')) {
      setRequestAuthMethod(RequestAuthMethod.LIGHTNING);
      return;
    } 
    else {
      // Check Free Tier Eligibility
      const eligible = await checkFreeTierEligibility();
      if (eligible) {
        setRequestAuthMethod(RequestAuthMethod.FREE);
        return;
      }
    }
    setRequestAuthMethod(RequestAuthMethod.FREE_EXPENDED);
    setIsRegisterModalOpen(true);
  };
  

  useEffect(() => {
    updateAuthMethodAndRegisterModalStatus();    
  }, []);

  // Add useEffect for checking admin privileges when user signs in
  useEffect(() => {
    if (isUserSignedIn) {
      checkAndStoreAdminPrivileges();
    } else {
      setAdminFeedId(null);
    }
  }, [isUserSignedIn]);

  // Add useEffect to load stored feedId on component mount
  useEffect(() => {
    const storedFeedId = getStoredFeedId();
    if (storedFeedId) {
      setAdminFeedId(storedFeedId);
      printLog(`Loaded stored feedId: ${storedFeedId}`);
    }
    printLog(`Initial adminFeedId state: ${storedFeedId}`);
  }, []);

  // Debug adminFeedId changes
  useEffect(() => {
    printLog(`adminFeedId changed to: ${adminFeedId}`);
    printLog(`searchMode: ${searchMode}`);
    printLog(`hasSearchedInMode(searchMode): ${hasSearchedInMode(searchMode)}`);
  }, [adminFeedId, searchMode]);

  // Auto-switch to 'my-pod' mode for users with admin privileges
  useEffect(() => {
    if (adminFeedId && podcastSearchMode === 'global') {
      setPodcastSearchMode('my-pod');
      printLog(`Auto-switched to 'my-pod' mode for admin user with feedId: ${adminFeedId}`);
    }
  }, [adminFeedId]);

  // Add useEffect for fetching podcast stats
  useEffect(() => {
    // Fetch podcast stats on component mount
    fetchPodcastStats();
  }, []);

  useEffect(() => {
    const updateAuth = async () => {
      const auth = await getAuth();
      console.log("AuthConfig fetched on mount or auth change:", auth);
      setAuthConfig(auth);
    };
  
    updateAuth(); // Call on mount immediately
  }, []); // Empty dependency array ensures this runs once when the component mounts
  
  // Also update `authConfig` when authentication method changes
  useEffect(() => {
    const updateAuth = async () => {
      const auth = await getAuth();
      console.log("AuthConfig updated due to requestAuthMethod change:", auth);
      setAuthConfig(auth);
    };
  
    updateAuth();
  }, [requestAuthMethod]); // Ensure re-fetching when auth method changes
  

  useEffect(() => {
    const loadSharedClip = async () => {
      if (isSharePage && clipId) {
        try {
          const clip = await fetchClipById(clipId);
          
          setConversation([{
            id: nextConversationId.current++,
            type: 'podcast-search' as const,
            query: '', 
            timestamp: new Date(),
            isStreaming: false,
            data: {
              quotes: [clip]
            }
          }]);
        } catch (error) {
          console.error('Error loading shared clip:', error);
          setSearchState(prev => ({
            ...prev,
            error: error as Error,
            isLoading: false
          }));
        } finally {
          setSearchState(prev => ({ 
            ...prev, 
            isLoading: false 
          }));
        }
      }
    };

    if (isSharePage && clipId) {
      loadSharedClip();
    }
  }, [isSharePage, clipId]);

  
  useEffect(() => {
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      setIsUserSignedIn(hasToken && hasSquareId);
    };
  
    // Add a slight delay before checking localStorage
    const timeout = setTimeout(checkSignedIn, 50); // 50ms delay
  
    return () => clearTimeout(timeout); // Cleanup timeout
  }, [requestAuthMethod]);

  useEffect(() => {
    if(!isLightningInitialized && localStorage.getItem('bc:config') && localStorage.getItem('isSubscribed') !== 'true'){
      printLog('Initializing lightning from stored config...');
      initializeLightning();
    } else {
      printLog(`Not initializing lightning:${JSON.stringify({
        isLightningInitialized,
        hasConfig: !!localStorage.getItem('bc:config'),
        isSubscribed: localStorage.getItem('isSubscribed')
      })}`);
    }
    return () => {
    };
  }, []);

  useEffect(() => {
    printLog(`model:${model}`)
  }, [model]);

  // Auto-search when 'q' parameter is present in URL (e.g., from TryJamieWizard)
  useEffect(() => {
    if (queryParam && !hasSearchedInMode(searchMode) && !searchState.isLoading) {
      setQuery(queryParam);
      // Small delay to ensure component is fully loaded and query state is set
      const timer = setTimeout(() => {
        // Use the queryParam directly instead of relying on state
        if (searchMode === 'podcast-search') {
          // Set the conversation first
          setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
          setSearchState(prev => ({ ...prev, isLoading: true }));
          setSearchHistory(prev => ({...prev, [searchMode]: true}));
          
          // Call the search with the direct query parameter
          const performSearchWithQuery = async () => {
            try {
              const auth = await getAuth() as AuthConfig;
              if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
                setIsRegisterModalOpen(true);
                setSearchState(prev => ({ ...prev, isLoading: false }));
                return;
              }
              
              // Determine which sources to use based on podcast search mode
              let feedIdsToUse: string[];
              if (podcastSearchMode === 'my-pod' && adminFeedId) {
                feedIdsToUse = [adminFeedId];
              } else {
                feedIdsToUse = Array.from(selectedSources) as string[];
              }
              
              const quoteResults = await handleQuoteSearch(
                queryParam, 
                auth, 
                feedIdsToUse,
                searchFilters.minDate || undefined,
                searchFilters.maxDate || undefined,
                searchFilters.episodeName || undefined
              );
              
              setConversation(prev => [...prev, {
                id: nextConversationId.current++,
                type: 'podcast-search' as const,
                query: queryParam,
                timestamp: new Date(),
                isStreaming: false,
                data: {
                  quotes: quoteResults.results
                }
              }]);
              setQuery("");
            } catch (error) {
              console.error("Error during auto quote search:", error);
              setSearchState(prev => ({
                ...prev,
                error: error as Error,
                isLoading: false
              }));
            } finally {
              setSearchState(prev => ({ ...prev, isLoading: false }));
            }
          };
          
          performSearchWithQuery();
        } else {
          handleStreamingSearch(queryParam);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [queryParam, searchMode, hasSearchedInMode(searchMode), searchState.isLoading]);

  useEffect(() => {
    if(searchMode === 'podcast-search' && searchState.isLoading === true){

    }
  },[searchState])

  useEffect(() => {
    const loadClipBatch = async () => {
      if (isClipBatchPage && runId && feedId) {
        try {
          const authToken = localStorage.getItem('auth_token');
          if (!authToken) {
            // User is not signed in - show sign in prompt
            setIsSignInModalOpen(true);
            setSearchState(prev => ({ ...prev, isLoading: false }));
            return;
          }

          try {
            const response = await PodcastFeedService.getClipBatchByRunId(feedId, runId, authToken);
            
            if (!response.success) {
              // Check if it's an authorization error (user is signed in but not authorized)
              if (response.error) {
                if (response.error.startsWith('401:')) {
                  setIsSignInModalOpen(true);
                  return;
                } else if (response.error.startsWith('403:')) {
                  setSearchState(prev => ({
                    ...prev, 
                    error: new Error("You don't have permission to access this content. Please contact the feed administrator."),
                    isLoading: false
                  }));
                  return;
                }
              }
              
              throw new Error(response.error || 'Failed to load clip batch');
            }

            if (!response.data) {
              throw new Error('No data returned');
            }

            setConversation([{
              id: nextConversationId.current++,
              type: 'podcast-search' as const,
              query: '', 
              timestamp: new Date(),
              isStreaming: false,
              data: {
                quotes: response.data.recommendations.map(rec => {
                  const clipId = rec.paragraph_ids[0];
                  
                  // Generate the share URL using our utility
                  let shareUrl = createClipShareUrl(clipId);
                  
                  // LAST RESORT OVERRIDE - Directly force localhost in development
                  if (process.env.NODE_ENV === 'development' && !shareUrl.includes('localhost')) {
                    shareUrl = `http://localhost:3000/app/share?clip=${clipId}`;
                  }
                  
                  return ({
                    id: clipId,
                    quote: rec.text,
                    episode: rec.title,
                    creator: `${rec.feed_title} - ${rec.episode_title}`,
                    audioUrl: rec.audio_url,
                    date: response.data?.run_date || '',
                    timeContext: {
                      start_time: rec.start_time,
                      end_time: rec.end_time
                    },
                    similarity: rec.relevance_score / 100,
                    episodeImage: rec.episode_image,
                    shareUrl: shareUrl,
                    shareLink: clipId,
                    shareable: rec.shareable
                  })
                })
              }
            }]);
          } catch (error) {
            console.error('Error loading clip batch:', error);
            
            // Handle 401/403 errors
            if (error instanceof Error) {
              const errorMessage = error.message;
              if (errorMessage.startsWith('401:') || errorMessage.includes('Authentication required')) {
                setIsSignInModalOpen(true);
                return;
              } else if (errorMessage.startsWith('403:') || errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('Forbidden')) {
                setSearchState(prev => ({
                  ...prev, 
                  error: new Error("You don't have permission to access this content. Please contact the feed administrator."),
                  isLoading: false
                }));
                return;
              } else {
                setSearchState(prev => ({
                  ...prev,
                  error: error as Error,
                  isLoading: false
                }));
              }
            }
          }
        } catch (error) {
          console.error('Error loading clip batch:', error);
          setSearchState(prev => ({
            ...prev,
            error: error as Error,
            isLoading: false
          }));
        } finally {
          setSearchState(prev => ({ 
            ...prev, 
            isLoading: false 
          }));
        }
      }
    };

    if (isClipBatchPage && runId && feedId) {
      setSearchState(prev => ({ ...prev, isLoading: true }));
      loadClipBatch();
    }
  }, [isClipBatchPage, runId, feedId]);

  // Auto-open context panel in split-screen mode when new podcast search results arrive
  useEffect(() => {
    printLog(`Context panel effect triggered - searchViewStyle: ${searchViewStyle}, searchMode: ${searchMode}, conversation.length: ${conversation.length}`);
    
    if (searchViewStyle === SearchViewStyle.SPLIT_SCREEN && 
        searchMode === 'podcast-search' && 
        conversation.length > 0) {
      
      // Get the latest podcast-search conversation item
      const latestPodcastSearch = [...conversation]
        .reverse()
        .find(item => item.type === 'podcast-search');
      
      printLog(`Latest podcast search found: ${!!latestPodcastSearch}`);
      
      if (latestPodcastSearch && 
          latestPodcastSearch.type === 'podcast-search' && 
          latestPodcastSearch.data.quotes.length > 0) {
        
        const firstResult = latestPodcastSearch.data.quotes[0];
        
        // Use shareLink as fallback if id is undefined
        const paragraphId = firstResult.id || firstResult.shareLink;
        
        printLog(`First result details: id=${firstResult.id}, shareLink=${firstResult.shareLink}`);
        printLog(`Using paragraphId: ${paragraphId}`);
        printLog(`Full first result: ${JSON.stringify(firstResult, null, 2)}`);
        
        // Set the first result as selected and open the context panel
        setSelectedParagraphId(paragraphId);
        setIsContextPanelOpen(true);
        
        printLog(`Split-screen: Auto-selected first result: ${paragraphId}`);
      }
    }
  }, [conversation, searchViewStyle, searchMode]);

  // Function to handle clicking on a search result (for split-screen context panel)
  const handleResultClick = (paragraphId: string) => {
    if (searchViewStyle === SearchViewStyle.SPLIT_SCREEN && searchMode === 'podcast-search') {
      printLog(`Result clicked, updating context panel with paragraphId: ${paragraphId}`);
      setSelectedParagraphId(paragraphId);
      setIsContextPanelOpen(true);
    }
  };

  // Function to handle filter button click
  const handleFilterClick = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent form
    e.preventDefault();
    e.stopPropagation();
    
    // Log selected sources before opening modal
    printLog(`Selected sources before filter modal: ${JSON.stringify(Array.from(selectedSources))}`);
    
    // Open the filter modal
    setIsFilterModalOpen(true);
    
    // Just print the function name without triggering search
    console.log("handleFilterClick");
    printLog("handleFilterClick function called");
  };

  // Function to reset all filters
  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const emptyFilters = {
      episodeName: '',
      minDate: '',
      maxDate: ''
    };
    setSearchFilters(emptyFilters);
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(emptyFilters));
    printLog('All filters reset from filter icon');
  };

  // Update the lastUsedSourcesRef whenever selectedSources changes
  useEffect(() => {
    // Create a deep copy of the selectedSources set to ensure it's not a reference
    lastUsedSourcesRef.current = new Set(selectedSources);
    printLog(`selectedSources updated: ${JSON.stringify(Array.from(selectedSources))}`);
  }, [selectedSources]);

  // Welcome modal state for first-time visitors
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => {
    // Check if this is the user's first visit
    const settings = localStorage.getItem('userSettings');
    const userSettings = settings ? JSON.parse(settings) : {};
    return userSettings.isFirstVisit !== false; // Default to true if not set
  });

  // Tutorial modal state
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Determine which tutorial section to show based on search mode
  const getDefaultTutorialSection = () => {
    switch (searchMode) {
      case 'podcast-search':
        return 0; // Podcast Search section
      case 'web-search':
        return 1; // Web Search section
      default:
        return 2; // Jamie Pro section
    }
  };

  const handleWelcomeQuickTour = () => {
    setIsWelcomeOpen(false);
    setIsTutorialOpen(true);
  };

  const handleWelcomeGetStarted = () => {
    // Mark that the user has visited before
    const settings = localStorage.getItem('userSettings');
    const userSettings = settings ? JSON.parse(settings) : {};
    userSettings.isFirstVisit = false;
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    
    setIsWelcomeOpen(false);
  };

  const handleTutorialClose = () => {
    // Mark that the user has visited before
    const settings = localStorage.getItem('userSettings');
    const userSettings = settings ? JSON.parse(settings) : {};
    userSettings.isFirstVisit = false;
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    
    setIsTutorialOpen(false);
  };

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  // Add handler for ClipTrackerModal share clicks
  const handleClipShare = (lookupHash: string, cdnLink: string) => {
    setShareModalData({
      fileUrl: cdnLink,
      lookupHash: lookupHash
    });
    setIsShareModalOpen(true);
  };

  // Function to safely store feedId in userSettings
  const storeFeedIdInUserSettings = (feedId: string) => {
    try {
      const settings = localStorage.getItem('userSettings');
      const userSettings = settings ? JSON.parse(settings) : {};
      userSettings.adminFeedId = feedId;
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
      printLog(`Stored feedId ${feedId} in userSettings`);
    } catch (error) {
      console.error('Error storing feedId in userSettings:', error);
    }
  };

  // Function to get stored feedId from userSettings
  const getStoredFeedId = (): string | null => {
    try {
      const settings = localStorage.getItem('userSettings');
      const userSettings = settings ? JSON.parse(settings) : {};
      return userSettings.adminFeedId || null;
    } catch (error) {
      console.error('Error getting feedId from userSettings:', error);
      return null;
    }
  };

  // Function to check admin privileges and store feedId
  const checkAndStoreAdminPrivileges = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setAdminFeedId(null);
        return;
      }

      const response = await AuthService.checkPrivs(token);
      if (response?.privs?.privs?.feedId && response.privs.privs.access === 'admin') {
        const feedId = response.privs.privs.feedId;
        setAdminFeedId(feedId);
        storeFeedIdInUserSettings(feedId);
        printLog(`Admin privileges confirmed for feedId: ${feedId}`);
      } else {
        setAdminFeedId(null);
        printLog('No admin privileges found');
      }
    } catch (error) {
      console.error('Error checking admin privileges:', error);
      setAdminFeedId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative pb-0.5">
      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onQuickTour={handleWelcomeQuickTour}
        onGetStarted={handleWelcomeGetStarted}
      />

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={handleTutorialClose}
        defaultSection={getDefaultTutorialSection()}
      />
      {/* Page Banner */}
      <PageBanner 
        logoText="Pull That Up Jamie!" 
        onConnect={() => initializeLightning()}
        onSignIn={() => setIsSignInModalOpen(true)}
        onUpgrade={handleUpgrade}
        onSignOut={handleSignOut}
        onTutorialClick={handleTutorialClick}
        isUserSignedIn={isUserSignedIn}
        setIsUserSignedIn={setIsUserSignedIn}
      />
      
      {/* Add the PodcastSourceFilterModal component */}
      <PodcastSourceFilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => {
          // Ensure selection is properly updated after modal is closed
          // This helps keep the selectedSources state in sync
          const currentSources = new Set(selectedSources);
          printLog(`Selection after modal close: ${JSON.stringify(Array.from(currentSources))}`);
          setIsFilterModalOpen(false);
        }}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        filters={searchFilters}
        setFilters={setSearchFilters}
      />
      
      {isClipBatchPage && (
        <div></div>
      )}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setRequestAuthMethod(RequestAuthMethod.SQUARE);
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          
          // For clipBatch pages, retry access after authentication without page reload
          if (isClipBatchPage && runId && feedId) {
            const token = localStorage.getItem('auth_token');
            if (token) {
              // Explicitly fetch the clip batch data with the new token
              PodcastFeedService.getClipBatchByRunId(feedId, runId, token)
                .then(response => {
                  if (response.success && response.data) {
                    setConversation([{
                      id: nextConversationId.current++,
                      type: 'podcast-search' as const,
                      query: '', 
                      timestamp: new Date(),
                      isStreaming: false,
                      data: {
                        quotes: response.data.recommendations.map(rec => {
                          const clipId = rec.paragraph_ids[0];
                          // Generate the share URL using our utility
                          let shareUrl = createClipShareUrl(clipId);
                          return ({
                            id: clipId,
                            quote: rec.text,
                            episode: rec.title,
                            creator: `${rec.feed_title} - ${rec.episode_title}`,
                            audioUrl: rec.audio_url,
                            date: response.data?.run_date || '',
                            timeContext: {
                              start_time: rec.start_time,
                              end_time: rec.end_time
                            },
                            similarity: rec.relevance_score / 100,
                            episodeImage: rec.episode_image,
                            shareUrl: shareUrl,
                            shareLink: clipId
                          });
                        })
                      }
                    }]);
                  }
                })
                .catch(error => {
                  console.error('Error loading clip batch after authentication:', error);
                  setSearchState(prev => ({
                    ...prev,
                    error: error as Error,
                    isLoading: false
                  }));
                });
            }
          }
        }}
        onSignUpSuccess={() => {
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          
          // For clipBatch pages, retry access after authentication without page reload
          if (isClipBatchPage && runId && feedId) {
            const token = localStorage.getItem('auth_token');
            if (token) {
              // Explicitly fetch the clip batch data with the new token
              PodcastFeedService.getClipBatchByRunId(feedId, runId, token)
                .then(response => {
                  if (response.success && response.data) {
                    setConversation([{
                      id: nextConversationId.current++,
                      type: 'podcast-search' as const,
                      query: '', 
                      timestamp: new Date(),
                      isStreaming: false,
                      data: {
                        quotes: response.data.recommendations.map(rec => {
                          const clipId = rec.paragraph_ids[0];
                          // Generate the share URL using our utility
                          let shareUrl = createClipShareUrl(clipId);
                          return ({
                            id: clipId,
                            quote: rec.text,
                            episode: rec.title,
                            creator: `${rec.feed_title} - ${rec.episode_title}`,
                            audioUrl: rec.audio_url,
                            date: response.data?.run_date || '',
                            timeContext: {
                              start_time: rec.start_time,
                              end_time: rec.end_time
                            },
                            similarity: rec.relevance_score / 100,
                            episodeImage: rec.episode_image,
                            shareUrl: shareUrl,
                            shareLink: clipId
                          });
                        })
                      }
                    }]);
                  }
                })
                .catch(error => {
                  console.error('Error loading clip batch after authentication:', error);
                  setSearchState(prev => ({
                    ...prev,
                    error: error as Error,
                    isLoading: false
                  }));
                });
            }
          } else {
            handleUpgrade();
          }
        }}
      />
      <RegisterModal 
        isOpen={isRegisterModalOpen} 
        onClose={handleCloseRegisterModal} 
        onLightningSelect={handleLightningSelect} 
        onSubscribeSelect={handleSubscribeSelect} 
      />

      <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => {setIsCheckoutModalOpen(false)}} onSuccess={handleUpgradeSuccess} />

      {isUpgradeSuccessPopUpOpen && (
        <SubscriptionSuccessPopup onClose={() => setIsUpgradeSuccessPopUpOpen(false)} />
      )}
      
      {/* { DEBUG_MODE &&
        (<button
        onClick={async () => {
          const email = localStorage.getItem('squareId');
          if (!email) {
            console.error('No squareId found in localStorage');
            return;
          }
          const success = await registerSubscription(email);
          printLog(`Registration result:${success}`);
        }}
        className="px-4 py-2 bg-white text-black rounded hover:bg-gray-100"
      >
        Test Registration
      </button>)
      } */}
      <br></br>
      <div className={`${hasSearchedInMode(searchMode) ? 'mb-8' : ''} ml-4 mr-4`}>
        {/* Header with Logo */}
        {isClipBatchPage ? (
          <div className="relative w-full max-w-4xl mx-auto">
            <div className="flex justify-start md:block mb-4 md:mb-0">
              <button 
                onClick={() => window.location.href = `/app/feed/${feedId}/jamieProHistory`} 
                className="md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 h-12 w-12 flex items-center justify-center bg-transparent text-white hover:text-gray-300 focus:outline-none z-10 ml-4 md:ml-0"
                style={{
                  color: '#C0C0C0',
                  textShadow: '0 0 8px #C0C0C0',
                  fontSize: '32px'
                }}
              >
                ←
              </button>
            </div>
            <div className="flex flex-col items-center py-8">
              <img
                src="/jamie-pro-banner.png"
                alt="Jamie Pro Banner"
                className="max-w-full h-auto"
              />
              <p className="text-gray-400 text-xl font-medium mt-2">AI Curated Clips for You</p>
              
              {/* View Mode Toggle */}
              <div className="flex justify-center mt-6">
                <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-[#111111]">
                  <button
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      clipBatchViewMode === AIClipsViewStyle.GRID
                        ? 'bg-[#1A1A1A] text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => handleViewModeChange(AIClipsViewStyle.GRID)}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span>Grid</span>
                  </button>
                  <button
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      clipBatchViewMode === AIClipsViewStyle.LIST
                        ? 'bg-[#1A1A1A] text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => handleViewModeChange(AIClipsViewStyle.LIST)}
                  >
                    <List className="w-4 h-4" />
                    <span>List</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex justify-center items-center py-8 select-none ${!hasSearchedInMode(searchMode) && 'mt-8'}`}>
            <div className="flex items-center gap-4">
              <img
                src="/jamie-logo.png"
                alt="Jamie Logo"
                width={128}
                height={128}
                className={`${hasSearchedInMode(searchMode) ? 'w-16 h-16' : ''} w-128 h-128`}
              />
              <div>
                <h1 className="text-3xl font-bold">Pull That Up Jamie!</h1>
                <p className={`text-gray-400 text-md text-shadow-light-white ${hasSearchedInMode(searchMode) ? 'hidden' : ''}`}>
                  {searchMode === 'web-search' ? 'Instantly pull up anything with private web search + AI.' : ''}
                  {searchMode === 'podcast-search' ? 'Find the exact moment of your favorite podcast' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Modes - Now shown when hasSearched is true */}
        {/* COMMENTED OUT: Hide the segmented control for modes
        {!isClipBatchPage && (
          <div className="flex justify-center mb-6 select-none">
            <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-[#111111]">
              {[
                { mode: 'web-search', emoji: '🌐', label: 'Web Search' },
                { mode: 'podcast-search', emoji: '🎙️', label: 'Podcast Search (Beta)' },
              ].map(({ mode, emoji, label }) => (
                <button
                  key={mode}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                    searchMode === mode
                      ? 'bg-[#1A1A1A] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setSearchMode(mode as SearchMode)}
                >
                  <span className="mr-2">{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        */}

        {hasSearchedInMode(searchMode) && searchMode === 'podcast-search' && (searchState.isLoading === false) && !isClipBatchPage && (
          <div>

            <AvailableSourcesSection 
              hasSearched={hasSearchedInMode(searchMode)} 
              selectedSources={selectedSources} 
              setSelectedSources={setSelectedSources} 
              isSendingFeedback={isSendingFeedback}
              setIsSendingFeedback={setIsSendingFeedback}
              sizeOverride={'24'}
            /> 
          </div>
          )}

        {/* Initial Search Form */}
        <div className="max-w-3xl mx-auto px-4">
          {!hasSearchedInMode(searchMode) && (searchMode === 'web-search' || searchMode === 'podcast-search') && (
            <div>
              <form onSubmit={handleSearch} className="relative">
            {/* Filter button and toggle - desktop version (outside search bar) */}
            {searchMode === 'podcast-search' && podcastSearchMode === 'global' && (
              <div className="absolute -right-14 top-0 z-10 hidden md:block">
                <div className="relative">
                  <button
                    onClick={handleFilterClick}
                    className="p-3 bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full transition-colors duration-200 flex items-center justify-center text-white border border-gray-700 shadow-lg"
                    aria-label="Filter"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  {hasActiveFilters() && (
                    <button
                      onClick={handleResetFilters}
                      className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors shadow-lg"
                      aria-label="Reset Filters"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Filter button - mobile version (inside search bar) */}
            {searchMode === 'podcast-search' && podcastSearchMode === 'global' && (
              <div className="absolute right-2 top-2 z-10 md:hidden">
                <div className="relative">
                  <button
                    onClick={handleFilterClick}
                    className="flex items-center justify-center text-white hover:text-gray-300 transition-colors"
                    aria-label="Filter"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  {hasActiveFilters() && (
                    <button
                      onClick={handleResetFilters}
                      className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors"
                      aria-label="Reset Filters"
                    >
                      <XIcon className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'podcast-search' ? `Search thousands of moments` : `Search the web privately with LLM summary`}
              className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 pl-4 pr-10 md:pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-white-glow resize-auto min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              // disabled={searchMode !== "web-search"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e);
                }
              }}
            />
            <div className={searchSettingsBarStyle}>
              {/* Left side - Empty space */}
              <div className="flex-shrink-0">
                <div className="w-0" />
              </div>
              
              {/* Right side - Toggle, Settings, and Search Button */}
              <div className="flex items-center space-x-2">
                {/* Podcast Mode Toggle - first on the right */}
                {!!adminFeedId && searchMode === 'podcast-search' && (
                  <div className="flex-shrink-0">
                    <div className="inline-flex rounded-md border border-gray-700 p-0.5 bg-transparent">
                      <button
                        type="button"
                        className={`py-1 rounded-sm text-xs transition-all ${
                          podcastSearchMode === 'global'
                            ? 'bg-[#1A1A1A] text-white px-2'
                            : 'text-gray-400 hover:text-white px-4'
                        }`}
                        onClick={() => setPodcastSearchMode('global')}
                      >
                        {podcastSearchMode === 'global' ? '🌐 All Pods' : '🌐'}
                      </button>
                      <button
                        type="button"
                        className={`py-1 rounded-sm text-xs transition-all ${
                          podcastSearchMode === 'my-pod'
                            ? 'bg-[#1A1A1A] text-white px-2'
                            : 'text-gray-400 hover:text-white px-4'
                        }`}
                        onClick={() => setPodcastSearchMode('my-pod')}
                      >
                        {podcastSearchMode === 'my-pod' ? '👤 My Pod' : '👤'}
                      </button>
                    </div>
                  </div>
                )}
                
                <ModelSettingsBar
                  model={model}
                  setModel={setModel}
                  searchMode={searchMode}
                  setSearchMode={setSearchMode}
                />
                
                <button
                  type="submit"
                  className="pl-3 pr-3 bg-white rounded-lg py-1 border-gray-800 hover:border-gray-700 flex-shrink-0"
                  disabled={searchState.isLoading}
                >
                  {searchState.isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                  ) : (
                    <svg
                      className="w-5 h-5 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
          

          </div>
          )}
          {/* Stats display for podcast search mode */}
          {!hasSearchedInMode(searchMode) && searchMode === 'podcast-search' && (
            <div className="text-center mt-8 text-gray-300">
              <p>Search from over <span className="font-bold">{podcastStats.clipCount.toLocaleString()}</span> podcast moments</p>
            </div>
          )}

          {/* Suggested Queries */}
          {!hasSearchedInMode(searchMode) && searchMode === 'web-search' && (
            <div className="mt-24 mb-8">
              <h3 className="text-gray-400 text-sm font-medium mb-4">Suggested</h3>
              <div className="space-y-4">
                {SUGGESTED_QUERIES.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left p-4 rounded-lg bg-[#111111] border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="font-medium">{suggestion.title}</div>
                    <div className="text-sm text-gray-400">{suggestion.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
      </div>


      {/* Conversation History */}
      {conversation.length > 0 && (
      <div className={`mx-auto px-4 space-y-8 transition-all duration-300 ${
        searchMode === 'podcast-search' && conversation.length > 0
          ? 'mb-1 pb-1'
          : 'mb-24 pb-24'
      } ${
        searchMode === 'podcast-search' && 
        searchViewStyle === SearchViewStyle.SPLIT_SCREEN && 
        isContextPanelOpen 
          ? 'max-w-2xl mr-[600px]' 
          : 'max-w-4xl'
      }`}>
        {conversation
          .filter(item => item.type === searchMode)
          .map((item) => (
            <ConversationRenderer 
              key={item.id}
              item={item} 
              clipProgress={clipProgress || null}
              onClipProgress={handleClipProgress}
              authConfig={authConfig}
              onShareModalOpen={setIsShareModalOpen}
              onSocialShareModalOpen={setIsSocialShareModalOpen}
              isClipBatchPage={isClipBatchPage}
              clipBatchViewMode={clipBatchViewMode}
              selectedParagraphId={selectedParagraphId}
              onResultClick={handleResultClick}
            />
          ))}
      </div>
    )}

      {searchMode === 'podcast-search' && !hasSearchedInMode(searchMode) && (
        <div className={`mt-4 ${hasSearchedInMode(searchMode) ? 'mb-52' : 'mb-36'}`}>
          {/* COMMENTED OUT: Hide available sources in initial view
          {
            <AvailableSourcesSection 
              hasSearched={hasSearchedInMode(searchMode)} 
              selectedSources={selectedSources} 
              setSelectedSources={setSelectedSources} 
              isSendingFeedback={isSendingFeedback}
              setIsSendingFeedback={setIsSendingFeedback}
              sizeOverride={'24'}
            /> 
          }
          */}
          {/* COMMENTED OUT: Hide quick topics grid
          <QuickTopicGrid 
            className=""
            triggerFadeOut={gridFadeOut}
            onTopicSelect={async (topicQuery) => {
              setQuery(topicQuery);
              // Instead of relying on the state update, use the topicQuery directly
              try {
                setSearchState(prev => ({
                  ...prev,
                  error: null,
                  isLoading: true
                }));
                const auth = await getAuth() as AuthConfig;
                if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
                  setIsRegisterModalOpen(true);
                  setSearchState(prev => ({ ...prev, isLoading: false }));
                  return;
                }
                setSearchState(prev => ({ ...prev, isLoading: true, data: {quotes:[]} }));
                setSearchHistory(prev => ({...prev, [searchMode]: true}));
                // Determine which sources to use based on podcast search mode
                let feedIdsToUse: string[];
                if (podcastSearchMode === 'my-pod' && adminFeedId) {
                  feedIdsToUse = [adminFeedId];
                } else {
                  feedIdsToUse = Array.from(selectedSources) as string[];
                }
                printLog(`selectedSources:${JSON.stringify(feedIdsToUse,null,2)}`);
                handleQuoteSearch(topicQuery,auth,feedIdsToUse).then(quoteResults => {
                  if(quoteResults === false){
                    setIsRegisterModalOpen(true);
                    return;
                  }
                  setConversation(prev => [...prev, {
                    id: nextConversationId.current++,
                    type: 'podcast-search' as const,
                    query: topicQuery,
                    timestamp: new Date(),
                    isStreaming: false,
                    data: {
                      quotes: quoteResults.results
                    }
                  }]);
                  setQuery("")
                  setSearchState(prev => ({ ...prev, isLoading: false }));
                }).catch(error => {
                  console.error('Quote search error:', error);
                  setSearchState(prev => ({
                    ...prev,
                    error: error as Error,
                    isLoading: false
                  }));
                });
              } catch (error) {
                console.error('Quote search error:', error);
                setSearchState(prev => ({
                  ...prev,
                  error: error as Error,
                  isLoading: false
                }));
              }
            }}
          />
          */}
        </div>
      )}

      {searchMode === 'podcast-search' && searchState.isLoading && (
        isClipBatchPage ? (
          <div className="flex flex-col items-center justify-center w-full py-8">
            <h2 className="text-gray-500 text-xl mb-8 text-center">
              Loading your
              <br />
              pre-made clips...
            </h2>
            <div className="relative">
              {/* Expanding rings */}
              <div className="absolute inset-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]">
                <svg 
                  width="120" 
                  height="120" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-gray-600 opacity-30"
                >
                  <circle cx="12" cy="12" r="1"/>
                  <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
                  <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>
                </svg>
              </div>
              <div className="absolute inset-0 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_infinite_1s]">
                <svg 
                  width="120" 
                  height="120" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-gray-600 opacity-30"
                >
                  <circle cx="12" cy="12" r="1"/>
                  <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
                  <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>
                </svg>
              </div>
              {/* Main icon */}
              <svg 
                width="120" 
                height="120" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-gray-600 relative"
              >
                <circle cx="12" cy="12" r="1"/>
                <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
                <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>
              </svg>
            </div>
          </div>
        ) : (
          <PodcastLoadingPlaceholder />
        )
      )}

      {searchMode === 'podcast-search' && !isAnyModalOpen() && (
        <div
          className={`fixed w-full z-50 transition-all duration-300 ${
            hasSearchedInMode('podcast-search') ? 'bottom-24' : 'bottom-0'
          }`}
        >
          <ClipTrackerModal
            clipProgress={clipProgress}
            hasSearched={hasSearchedInMode('podcast-search')}
            isCollapsed={isClipTrackerCollapsed}
            onCollapsedChange={setIsClipTrackerCollapsed}
            auth={authConfig || undefined}
            onShareClick={handleClipShare}
          />
        </div>
      )}



      {/* Floating Search Bar */}
      {hasSearchedInMode(searchMode) && (searchMode === 'web-search' || searchMode === 'podcast-search') && !isAnyModalOpen() && (
        <div className="fixed sm:bottom-12 bottom-1 left-1/2 transform -translate-x-1/2 w-full max-w-[40rem] px-4 sm:px-24 z-50">
          <form onSubmit={handleSearch} className="relative">
            {/* Filter button and toggle - desktop version (outside search bar) */}
            {searchMode === 'podcast-search' && podcastSearchMode === 'global' && (
              <div className="absolute -right-14 top-0 z-10 hidden md:block">
                <div className="relative">
                  <button
                    onClick={handleFilterClick}
                    className="p-3 bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full transition-colors duration-200 flex items-center justify-center text-white border border-gray-700 shadow-lg"
                    aria-label="Filter"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  {hasActiveFilters() && (
                    <button
                      onClick={handleResetFilters}
                      className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors shadow-lg"
                      aria-label="Reset Filters"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Filter button - mobile version (inside search bar) */}
            {searchMode === 'podcast-search' && podcastSearchMode === 'global' && (
              <div className="absolute right-2 top-2 z-10 md:hidden">
                <div className="relative">
                  <button
                    onClick={handleFilterClick}
                    className="flex items-center justify-center text-white hover:text-gray-300 transition-colors"
                    aria-label="Filter"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  {hasActiveFilters() && (
                    <button
                      onClick={handleResetFilters}
                      className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors"
                      aria-label="Reset Filters"
                    >
                      <XIcon className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'podcast-search' ? `Search thousands of moments` : `Search the web privately with LLM summary`}
              className="w-full bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow px-4 py-3 pl-4 pr-32 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg resize-none min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              // disabled={searchMode === 'web-search'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e);
                }
              }}
            />
            <div className={searchSettingsBarStyle}>
              {/* Left side - Empty space */}
              <div className="flex-shrink-0">
                <div className="w-0" />
              </div>
              
              {/* Right side - Toggle, Settings, and Search Button */}
              <div className="flex items-center space-x-2">
                {/* Podcast Mode Toggle - first on the right */}
                {!!adminFeedId && searchMode === 'podcast-search' && (
                  <div className="flex-shrink-0">
                    <div className="inline-flex rounded-md border border-gray-700 p-0.5 bg-transparent">
                      <button
                        type="button"
                        className={`px-2 py-1 rounded-sm text-xs transition-all ${
                          podcastSearchMode === 'global'
                            ? 'bg-[#1A1A1A] text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setPodcastSearchMode('global')}
                      >
                        {podcastSearchMode === 'global' ? '🌐 All Pods' : '🌐'}
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-1 rounded-sm text-xs transition-all ${
                          podcastSearchMode === 'my-pod'
                            ? 'bg-[#1A1A1A] text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setPodcastSearchMode('my-pod')}
                      >
                        {podcastSearchMode === 'my-pod' ? '👤 My Pod' : '👤'}
                      </button>
                    </div>
                  </div>
                )}
                
                <ModelSettingsBar
                  model={model}
                  setModel={setModel}
                  searchMode={searchMode}
                  setSearchMode={setSearchMode}
                  dropUp={true}
                />
                
                <button
                  type="submit"
                  className="pl-3 pr-3 bg-white rounded-lg py-1 border-gray-800 hover:border-gray-700 flex-shrink-0"
                  disabled={searchState.isLoading}
                >
                  {searchState.isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                  ) : (
                    <svg
                      className="w-5 h-5 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
          


        </div>
      )}
      {searchMode === 'web-search' && (
        <p> </p>
      )}

      {/* Error Display */}
      {searchState.error && (
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4 mb-28 z-50">
        <div className="bg-red-900/50 border border-red-800 text-red-200 rounded-lg p-4 relative">
          {/* Close Button */}
          <button
            onClick={() => setSearchState(prevState => ({ ...prevState, error: null }))}
            className="absolute top-2 right-2 text-red-200 hover:text-red-100 focus:outline-none"
          >
            ×
          </button>
          {searchState.error.message}
        </div>
      </div>
    )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareModalData(null);
        }}
        onOpenChange={setIsShareModalOpen}
        fileUrl={shareModalData?.fileUrl || ''}
        title="Share This Clip"
        itemName="clip"
        showCopy={true}
        showDownload={true}
        showTwitter={true}
        showNostr={true}
        copySuccessMessage="Clip link copied!"
        downloadButtonLabel="Download Clip"
        twitterButtonLabel="Tweet Clip"
        nostrButtonLabel="Share on Nostr"
        lookupHash={shareModalData?.lookupHash || ''}
        auth={authConfig}
      />
      <SocialShareModal
        isOpen={isSocialShareModalOpen}
        onClose={() => setIsSocialShareModalOpen(false)}
        onOpenChange={setIsSocialShareModalOpen}
        fileUrl=""
        onComplete={() => {}}
        platform={SocialPlatform.Twitter}
      />

      {/* Context Panel for Split-Screen Mode */}
      {searchMode === 'podcast-search' && searchViewStyle === SearchViewStyle.SPLIT_SCREEN && (
        <PodcastContextPanel
          paragraphId={selectedParagraphId}
          isOpen={isContextPanelOpen}
          onClose={() => setIsContextPanelOpen(false)}
        />
      )}

    </div>
  );
}
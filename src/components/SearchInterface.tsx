import { performSearch } from '../lib/searxng.ts';
import { fetchClipById, checkClipStatus } from '../services/clipService.ts';
import { useSearchParams, useParams } from 'react-router-dom'; 
import { RequestAuthMethod, AuthConfig, API_URL, DEBUG_MODE, printLog, FRONTEND_URL, AIClipsViewStyle, SearchViewStyle, SearchResultViewStyle, DISABLE_CLIPPING, ShareModalContext, NavigationMode } from '../constants/constants.ts';
import { handleQuoteSearch, handleQuoteSearch3D } from '../services/podcastService.ts';
import { ConversationItem, WebSearchModeItem } from '../types/conversation.ts';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getFountainLink } from '../services/fountainService.ts';
import PodcastFeedService from '../services/podcastFeedService.ts';
import { Filter, List, Grid3X3, X as XIcon, ChevronUp, ChevronDown, Sparkles, CheckCircle, AlertCircle} from 'lucide-react';
import PodcastSourceFilterModal, { PodcastSearchFilters } from './PodcastSourceFilterModal.tsx';
import { createClipShareUrl } from '../utils/urlUtils.ts';
import PageBanner from './PageBanner.tsx';
import ShareModal from './ShareModal.tsx';
import TutorialModal from './TutorialModal.tsx';
import WelcomeModal from './WelcomeModal.tsx';
import AccountButton from './AccountButton.tsx';
import NebulaBackground from './NebulaBackground.tsx';
import SocialShareModal, { SocialPlatform } from './SocialShareModal.tsx';
import AuthService from '../services/authService.ts';
import { extractImageFromAny } from '../utils/hierarchyImageUtils.ts';
import ImageWithLoader from './ImageWithLoader.tsx';
import PodcastContextPanel from './PodcastContextPanel.tsx';
import UnifiedSidePanel from './UnifiedSidePanel.tsx';
import SemanticGalaxyView from './SemanticGalaxyView.tsx';
import ContextService from '../services/contextService.ts';
import { MOCK_GALAXY_DATA } from '../data/mockGalaxyData.ts';
import { AudioControllerProvider } from '../context/AudioControllerContext.tsx';
import EmbedMiniPlayer from './EmbedMiniPlayer.tsx';
import PoweredByJamiePill from './PoweredByJamiePill.tsx';
import FeaturedGalaxiesCarousel from './FeaturedGalaxiesCarousel.tsx';
import { ResearchSessionItem, clearLocalSession, MAX_RESEARCH_ITEMS, loadCurrentSession, saveResearchSession, fetchResearchSession, backendItemsToFrontend, setCurrentSessionId, saveResearchSessionWithRetry, getCurrentSessionId } from '../services/researchSessionService.ts';
import { fetchSharedResearchSession, fetchResearchSessionWith3D } from '../services/researchSessionShareService.ts';


export type SearchMode = 'web-search' | 'podcast-search';
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

// Black overlay opacity - controls how much nebula shows through (0 = full nebula, 1 = solid black)
// 0.4 = 40% dimming, showing more of the nebula
// ============================================================================
// NEBULA BLACK OVERLAY OPACITY - Tweak this value!
// 0.0 = full nebula colors (no dimming)
// 0.5 = 50% dimmed
// 1.0 = completely black (nebula hidden)
// ============================================================================
const LANDING_NEBULA_DIM_OPACITY = 0.70;

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
  // Check embed mode early (before any hooks) so state initializers can reference it
  // Uses window.location directly since URL doesn't change during component lifecycle
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';
  
  const [query, setQuery] = useState('');
  
  // Search view style state (Classic vs Split Screen)
  const [searchViewStyle, setSearchViewStyle] = useState<SearchViewStyle>(() => {
    const saved = localStorage.getItem('searchViewStyle');
    return saved === SearchViewStyle.CLASSIC ? SearchViewStyle.CLASSIC : SearchViewStyle.SPLIT_SCREEN;
  });
  
  // Context panel state for split-screen view
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  
  // Analysis panel state
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  
  // Sessions panel state
  const [isSessionsPanelOpen, setIsSessionsPanelOpen] = useState(false);

  // Shared session title state (for displaying title banner)
  const [sharedSessionTitle, setSharedSessionTitle] = useState<string | null>(null);
  
  // Brand data for embed mode
  const [brandImage, setBrandImage] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<string[] | null>(null);
  
  // Embed mode hover state for auto-play control
  const [isEmbedHovered, setIsEmbedHovered] = useState(false);
  
  // Track if user has unlocked audio (for embed mode)
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Track warp speed deceleration completion
  // In embed mode, start as false so warp speed animation plays from the beginning
  const [isDecelerationComplete, setIsDecelerationComplete] = useState(!isEmbedMode);
  
  // Result view style state (List vs Galaxy)
  // In embed mode, always use GALAXY view
  const [resultViewStyle, setResultViewStyle] = useState<SearchResultViewStyle>(() => {
    if (isEmbedMode) return SearchResultViewStyle.GALAXY;
    const saved = localStorage.getItem('searchResultViewStyle');
    return saved === SearchResultViewStyle.LIST ? SearchResultViewStyle.LIST : SearchResultViewStyle.GALAXY;
  });
  
  // 3D search results state
  const [galaxyResults, setGalaxyResults] = useState<any[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState<number>(0);
  const [axisLabels, setAxisLabels] = useState<any>(null);
  
  // Research session state
  const [researchSessionItems, setResearchSessionItems] = useState<ResearchSessionItem[]>([]);
  const [showResearchToast, setShowResearchToast] = useState(false);
  const [showResearchLimitToast, setShowResearchLimitToast] = useState(false);
  
  // Debounced auto-save queue
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SAVE_DEBOUNCE_MS = 2000; // Wait 2 seconds after last change
  const researchToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const researchLimitToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load research session from backend on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const items = await loadCurrentSession();
        if (items.length > 0) {
          setResearchSessionItems(items);
          printLog(`[ResearchSession] Loaded ${items.length} items from existing session`);
        }
      } catch (error) {
        console.error('Failed to load research session:', error);
      }
    };
    
    loadSession();
  }, []); // Run once on mount

  // Load showAxisLabels from userSettings
  const getShowAxisLabels = () => {
    try {
      const userSettings = localStorage.getItem('userSettings');
      if (userSettings) {
        const settings = JSON.parse(userSettings);
        // Default to true for first-time users (when showAxisLabels is undefined)
        return settings.showAxisLabels ?? true;
      }
    } catch (e) {
      console.error('Error loading showAxisLabels:', e);
    }
    // Default to true for new users
    return true;
  };
  
  // Update state for filter button
  const [filterClicked, setFilterClicked] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Podcast search filters state
  const FILTERS_STORAGE_KEY = 'podcastSearchFilters';
  const [searchFilters, setSearchFilters] = useState<PodcastSearchFilters>(() => {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Backwards-compat: older saved filters used `episodeName`; we now use `episodeGuid`.
        return {
          episodeGuid: parsed.episodeGuid || '',
          minDate: parsed.minDate || '',
          maxDate: parsed.maxDate || '',
        };
      } catch (e) {
        console.error('Error parsing saved filters:', e);
        return { episodeGuid: '', minDate: '', maxDate: '' };
      }
    }
    return { episodeGuid: '', minDate: '', maxDate: '' };
  });

  // Helper to check if any filters are active
  const hasActiveFilters = () => {
    return searchFilters.episodeGuid !== '' || searchFilters.minDate !== '' || searchFilters.maxDate !== '';
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
  // Historically supported ?mode=web-search, but web search is now deprecated.
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const queryParam = searchParams.get('q');
  const isWebSearchDeprecated = modeParam === 'web-search';
  
  // Force the interface into podcast-search mode even if modeParam=web-search
  const [searchMode] = useState<SearchMode>('podcast-search');
  
  // Add state for admin privileges and toggle
  const [adminFeedId, setAdminFeedId] = useState<string | null>(null);
  const [adminFeedUrl, setAdminFeedUrl] = useState<string | null>(null);
  const [podcastSearchMode, setPodcastSearchMode] = useState<'global' | 'my-pod'>('global');
  const [showPodcastModeLabel, setShowPodcastModeLabel] = useState(false);
  const [podcastModeLabelText, setPodcastModeLabelText] = useState('');
  const [showScopeSlideout, setShowScopeSlideout] = useState(false);
  
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
  // In embed mode, start with loading state so galaxy loading animation shows immediately
  const [searchState, setSearchState] = useState<SearchState>(() => ({
    ...initialSearchState,
    isLoading: isEmbedMode
  }));
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
  // In embed mode, start with search history true so landing page is skipped
  const [searchHistory, setSearchHistory] = useState({
    'web-search': false,
    'podcast-search': isSharePage || isClipBatchPage || isEmbedMode
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
    customUrl?: string;
  } | null>(null);

  // Clip-batch pages know the episode GUID; use it to provide a Fountain listen link to Jamie Assist
  const [clipBatchEpisodeGuid, setClipBatchEpisodeGuid] = useState<string | null>(null);
  const [clipBatchFountainLink, setClipBatchFountainLink] = useState<string | null>(null);

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
  const [galaxy3DResults, setGalaxy3DResults] = useState<any[]>([]);
  

  const searchInputRef = useRef<HTMLTextAreaElement>(null);
  const cleanupIntervalRef = useRef();
  const resultTextRef = useRef('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const nextConversationId = useRef(0);
  const podcastModeLabelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scopeSlideoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    
    // Remove adminFeedId and adminFeedUrl from localStorage and reset state
    const settings = localStorage.getItem('userSettings');
    if (settings) {
      const userSettings = JSON.parse(settings);
      delete userSettings.adminFeedId;
      delete userSettings.adminFeedUrl;
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
    }
    setAdminFeedId(null);
    setAdminFeedUrl(null);
    
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

  const handlePodcastSearchModeChange = (mode: 'global' | 'my-pod') => {
    printLog(`[handlePodcastSearchModeChange] Called with mode: ${mode}`);
    setPodcastSearchMode(mode);
    const label = mode === 'global' ? 'All Pods' : 'My Pod';
    setPodcastModeLabelText(label);
    setShowPodcastModeLabel(true);

    if (podcastModeLabelTimeoutRef.current) {
      clearTimeout(podcastModeLabelTimeoutRef.current);
    }

    podcastModeLabelTimeoutRef.current = setTimeout(() => {
      setShowPodcastModeLabel(false);
    }, 1500);
  };

  // Debounced auto-save with queue to prevent race conditions
  const debouncedQueuedSave = useCallback((items: ResearchSessionItem[]) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Schedule new save after debounce delay
    saveTimeoutRef.current = setTimeout(() => {
      // Add to queue to serialize saves
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          try {
            await saveResearchSessionWithRetry(items);
            printLog(`[ResearchSession] Auto-saved session with ${items.length} items`);
          } catch (error) {
            console.error('[ResearchSession] Save failed after retries:', error);
            // Could show a toast here for persistent failures
          }
        })
        .catch(err => {
          console.error('[ResearchSession] Queue error:', err);
        });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Research session handlers
  const handleAddToResearchSession = async (result: any) => {
    // Check if item already exists
    const exists = researchSessionItems.some(item => item.shareLink === result.shareLink);
    if (exists) {
      printLog(`[ResearchSession] Item already in session: ${result.shareLink}`);
      return;
    }

    // Check 50 item limit
    if (researchSessionItems.length >= MAX_RESEARCH_ITEMS) {
      setShowResearchLimitToast(true);
      if (researchLimitToastTimeoutRef.current) {
        clearTimeout(researchLimitToastTimeoutRef.current);
      }
      researchLimitToastTimeoutRef.current = setTimeout(() => {
        setShowResearchLimitToast(false);
      }, 3000);
      return;
    }

    const newItem: ResearchSessionItem = {
      shareLink: result.shareLink,
      quote: result.quote,
      summary: result.summary,
      headline: result.headline,
      episode: result.episode,
      creator: result.creator,
      episodeImage: result.episodeImage || extractImageFromAny(result),
      date: result.date,
      hierarchyLevel: result.hierarchyLevel,
      coordinates3d: result.coordinates3d, // Capture 3D coordinates from galaxy
      addedAt: new Date(),
    };

    const updatedItems = [...researchSessionItems, newItem];
    setResearchSessionItems(updatedItems);
    printLog(`[ResearchSession] Added item: ${result.shareLink}`);

    // Debounced auto-save (waits 2s after last change)
    debouncedQueuedSave(updatedItems);

    // Show toast notification
    setShowResearchToast(true);
    if (researchToastTimeoutRef.current) {
      clearTimeout(researchToastTimeoutRef.current);
    }
    researchToastTimeoutRef.current = setTimeout(() => {
      setShowResearchToast(false);
    }, 2000);
  };

  const handleRemoveFromResearchSession = async (shareLink: string) => {
    const updatedItems = researchSessionItems.filter(item => item.shareLink !== shareLink);
    setResearchSessionItems(updatedItems);
    printLog(`[ResearchSession] Removed item: ${shareLink}`);
    
    // If no items left, clear the session
    if (updatedItems.length === 0) {
      clearLocalSession();
      printLog(`[ResearchSession] No items left, cleared session`);
    } else {
      // Debounced auto-save after removal
      debouncedQueuedSave(updatedItems);
    }
  };

  const handleClearResearchSession = () => {
    setResearchSessionItems([]);
    clearLocalSession(); // Clear the stored session ID
    setSharedSessionTitle(null); // Clear the session title when clearing research
    printLog(`[ResearchSession] Cleared all items and session ID`);
  };

  // Debug: log research items + sessionId whenever research changes
  useEffect(() => {
    const sessionId = getCurrentSessionId();
    const first = researchSessionItems[0]?.shareLink;
    const last = researchSessionItems[researchSessionItems.length - 1]?.shareLink;
    printLog(
      `[ResearchSession] Items changed: count=${researchSessionItems.length} sessionId=${sessionId || 'null'} first=${first || 'null'} last=${last || 'null'}`,
    );
  }, [researchSessionItems]);

  // Debug: log when analysis panel opens/closes (and what sessionId we think is active)
  useEffect(() => {
    const sessionId = getCurrentSessionId();
    printLog(
      `[AI Analysis] Panel ${isAnalysisPanelOpen ? 'opened' : 'closed'}: sessionId=${sessionId || 'null'} items=${researchSessionItems.length}`,
    );
  }, [isAnalysisPanelOpen]);

  // Handle clicks from AI Analysis inline cards (CARD_JSON mentions)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const embedFlag = searchParams.get('embed') === 'true';

    const onAnalysisCardClick = async (e: Event) => {
      const pineconeId = (e as CustomEvent<{ pineconeId?: string }>).detail?.pineconeId;
      if (!pineconeId) return;

      printLog(`[AI Analysis] analysisCardClick received: pineconeId=${pineconeId}`);

      // First try to find the item in current galaxy results.
      const match = galaxyResults.find(r => r?.shareLink === pineconeId);
      if (match) {
        printLog(`[AI Analysis] Found pineconeId in galaxyResults; triggering star-click behavior`);

        setSelectedParagraphId(match.shareLink);

        const resultIndex = galaxyResults.findIndex(r => r?.shareLink === match.shareLink);
        if (resultIndex !== -1) {
          setCurrentResultIndex(resultIndex);
        }

        let autoPlay = true;
        if (!embedFlag) {
          try {
            const settings = localStorage.getItem('userSettings');
            if (settings) {
              const userSettings = JSON.parse(settings);
              autoPlay = userSettings.autoPlayOnStarClick ?? true;
            }
          } catch {
            // ignore
          }
        }

        setSelectedAudioContext({
          audioUrl: match.audioUrl,
          timeContext: {
            start_time: match.timeContext?.start_time ?? 0,
            end_time: match.timeContext?.end_time ?? 0,
          },
          episode: match.episode,
          episodeImage: match.episodeImage || '',
          creator: match.creator,
          listenLink: match.listenLink,
          date: match.date,
          quote: match.quote,
          summary: match.summary,
          headline: match.headline,
          hierarchyLevel: match.hierarchyLevel,
          shareLink: match.shareLink,
        });

        // Start playback immediately (even if the UI is currently on the Analysis tab)
        if (match.audioUrl) {
          window.dispatchEvent(
            new CustomEvent('playAudioTrack', {
              detail: {
                id: match.shareLink,
                audioUrl: match.audioUrl,
                startTime: match.timeContext?.start_time ?? 0,
                endTime: match.timeContext?.end_time,
              },
            }),
          );
        }
        return;
      }

      // Fallback: fetch the paragraph metadata so we can play it even if galaxyResults doesn't contain it.
      try {
        printLog(`[AI Analysis] pineconeId not in galaxyResults; fetching paragraph metadata for playback`);
        const adjacent = await ContextService.fetchAdjacentParagraphs(pineconeId, 0);
        const para = adjacent.paragraphs.find(p => p.id === pineconeId) || adjacent.paragraphs[0];
        if (!para) {
          printLog(`[AI Analysis] No paragraph metadata found for pineconeId=${pineconeId}`);
          return;
        }

        const meta = para.metadata;
        setSelectedParagraphId(pineconeId);
        const startTime = meta.start_time ?? para.start_time ?? 0;
        const endTime = meta.end_time ?? para.end_time ?? 0;
        setSelectedAudioContext({
          audioUrl: meta.audioUrl,
          timeContext: {
            start_time: startTime,
            end_time: endTime,
          },
          episode: meta.episode || para.episode,
          episodeImage: meta.episodeImage || '',
          creator: meta.creator || para.creator,
          listenLink: meta.listenLink,
          date: new Date().toISOString(),
          quote: meta.text || para.text,
          summary: undefined,
          headline: undefined,
          hierarchyLevel: 'paragraph',
          shareLink: pineconeId,
        });

        // Start playback immediately (even if the UI is currently on the Analysis tab)
        if (meta.audioUrl) {
          window.dispatchEvent(
            new CustomEvent('playAudioTrack', {
              detail: {
                id: pineconeId,
                audioUrl: meta.audioUrl,
                startTime,
                endTime,
              },
            }),
          );
        }
      } catch (err) {
        printLog(`[AI Analysis] Failed to fetch paragraph metadata for pineconeId=${pineconeId}`);
        console.error('[AI Analysis] analysisCardClick error:', err);
      }
    };

    window.addEventListener('analysisCardClick', onAnalysisCardClick);
    return () => window.removeEventListener('analysisCardClick', onAnalysisCardClick);
  }, [galaxyResults, searchParams]);
  
  // Handler for opening a session from the Sessions history tab
  const handleOpenSessionFromHistory = async (sessionId: string, sessionTitle?: string) => {
    printLog(`[SessionHistory] Opening session: ${sessionId}`);
    
    // Close the sessions panel
    setIsSessionsPanelOpen(false);
    
    // Set the session title for display (when opening from history, show the title)
    setSharedSessionTitle(sessionTitle || null);
    
    // If autoplay is enabled, switch to context tab
    if (autoPlayContextOnOpen) {
      setIsContextPanelOpen(true);
    }
    
    // Load the session using the shared loading function
    await loadResearchSessionWithWarpSpeed(
      sessionId, 
      sessionTitle || 'Research Session'
    );
  };

  const toggleScopeSlideout = (e?: React.MouseEvent) => {
    printLog(`[toggleScopeSlideout] Called. Current state: ${showScopeSlideout}`);
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newState = !showScopeSlideout;
    setShowScopeSlideout(newState);
    printLog(`[toggleScopeSlideout] New state: ${newState}`);
    
    if (scopeSlideoutTimeoutRef.current) {
      clearTimeout(scopeSlideoutTimeoutRef.current);
    }

    // Only set timeout if we're opening (not closing)
    if (newState) {
      scopeSlideoutTimeoutRef.current = setTimeout(() => {
        setShowScopeSlideout(false);
      }, 5000);
    }
  };

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

  type KeywordSearchScope = 'episode' | 'feed' | 'all';
  type KeywordSearchOverride = {
    scope: KeywordSearchScope;
    feedId?: string | number;
    guid?: string;
  };

  // Normalize feed identifiers that may come through as "feed_1143651" or similar.
  const normalizeFeedId = (value: string | number | null | undefined): string | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
    const raw = value.trim();
    if (!raw) return undefined;
    // Strip common prefixes like "feed_"
    const stripped = raw.startsWith('feed_') ? raw.slice('feed_'.length) : raw;
    // If still not purely numeric, try taking trailing digits.
    const match = stripped.match(/(\d+)$/);
    return match ? match[1] : stripped;
  };

  const performQuoteSearch = async (queryOverride?: string, override?: KeywordSearchOverride) => {  
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
    
    const queryToUse = (queryOverride ?? query).trim();
    if (!queryToUse) {
      setSearchState(prev => ({
        ...prev,
        error: new Error('Missing query'),
        isLoading: false
      }));
      return;
    }

    // Apply filter override rules for keyword-driven searches.
    const scope = override?.scope;
    const overrideGuid = override?.guid?.trim();
    const overrideFeedId = normalizeFeedId(override?.feedId);

    const effectiveGuid =
      scope === 'episode'
        ? overrideGuid
        : (searchFilters.episodeGuid || '').trim() || undefined;

    const effectiveFeedIds =
      scope === 'feed'
        ? (overrideFeedId ? [overrideFeedId] : [])
        : scope === 'episode'
          ? [] // Per requirements: episode search uses ONLY guid
          : scope === 'all'
            ? [] // Per requirements: all feeds uses NO filters
            : feedIdsToUse;

    const effectiveMinDate = scope ? undefined : (searchFilters.minDate || undefined);
    const effectiveMaxDate = scope ? undefined : (searchFilters.maxDate || undefined);

    try {
      const quoteResults = await handleQuoteSearch(
        queryToUse, 
        auth, 
        effectiveFeedIds,
        effectiveMinDate,
        effectiveMaxDate,
        undefined, // episodeName (deprecated in favor of guid)
        ['chapter', 'paragraph'], // Include both chapters and paragraphs
        effectiveGuid
      );
      setConversation(prev => [...prev, {
        id: searchState.activeConversationId as number,
        type: 'podcast-search' as const,
        query: queryToUse,
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

  const performQuoteSearch3D = async (queryOverride?: string, override?: KeywordSearchOverride) => {
    setSearchHistory(prev => ({...prev, [searchMode]: true}));
    
    printLog("Starting 3D quote search...");
    
    // Determine which sources to use based on podcast search mode
    let feedIdsToUse: string[];
    
    if (podcastSearchMode === 'my-pod' && adminFeedId) {
      feedIdsToUse = [adminFeedId];
      printLog(`Using My Pod mode with feedId: ${adminFeedId}`);
    } else {
      feedIdsToUse = Array.from(selectedSources) as string[];
      printLog(`Using Global mode with selected sources: ${JSON.stringify(feedIdsToUse)}`);
    }
    
    printLog(`Using feed IDs for 3D search: ${JSON.stringify(feedIdsToUse,null,2)}`);
    printLog(`Using filters: ${JSON.stringify(searchFilters)}`);

    const auth = await getAuth() as AuthConfig;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      setSearchState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    printLog(`Request auth method:${requestAuthMethod}`)
    
    const queryToUse = (queryOverride ?? query).trim();
    if (!queryToUse) {
      setSearchState(prev => ({
        ...prev,
        error: new Error('Missing query'),
        isLoading: false
      }));
      return;
    }

    // Apply filter override rules for keyword-driven searches.
    const scope = override?.scope;
    const overrideGuid = override?.guid?.trim();
    const overrideFeedId = normalizeFeedId(override?.feedId);

    const effectiveGuid =
      scope === 'episode'
        ? overrideGuid
        : (searchFilters.episodeGuid || '').trim() || undefined;

    const effectiveFeedIds =
      scope === 'feed'
        ? (overrideFeedId ? [overrideFeedId] : [])
        : scope === 'episode'
          ? [] // Per requirements: episode search uses ONLY guid
          : scope === 'all'
            ? [] // Per requirements: all feeds uses NO filters
            : feedIdsToUse;

    const effectiveMinDate = scope ? undefined : (searchFilters.minDate || undefined);
    const effectiveMaxDate = scope ? undefined : (searchFilters.maxDate || undefined);

    try {
      const shouldExtractAxisLabels = getShowAxisLabels();
      printLog(`Extracting axis labels: ${shouldExtractAxisLabels}`);
      
      const quoteResults3D = await handleQuoteSearch3D(
        queryToUse, 
        auth, 
        effectiveFeedIds,
        effectiveMinDate,
        effectiveMaxDate,
        undefined, // episodeName (deprecated in favor of guid)
        undefined, // hierarchyLevels - not currently used
        shouldExtractAxisLabels, // Request axis labels if enabled in settings
        effectiveGuid
      );
      
      printLog(`[3D Search] Received ${quoteResults3D.results?.length || 0} results from API`);

      // Store 3D results separately
      setGalaxyResults(quoteResults3D.results || []);
      
      // Store axis labels if returned
      if (quoteResults3D.axisLabels) {
        setAxisLabels(quoteResults3D.axisLabels);
        printLog(`Received axis labels: ${JSON.stringify(quoteResults3D.axisLabels)}`);
      }
      
      // Also update conversation with regular results for list view
      setConversation(prev => [...prev, {
        id: searchState.activeConversationId as number,
        type: 'podcast-search' as const,
        query: queryToUse,
        timestamp: new Date(),
        isStreaming: false,
        data: {
          quotes: quoteResults3D.results
        }
      }]);
      setQuery("");
      printLog("3D quote search completed successfully");
    } catch (error) {
      console.error("Error during 3D quote search:", error);
      setSearchState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
      return;
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }));
    }
  }

  const handleSearch = async (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (searchMode === 'podcast-search') {
      try {
        // New search: collapse context panel and clear any stale audio/UI context
        resetContextPanelState();
        setGridFadeOut(true);
        
        // Clear shared session title when performing a new search
        setSharedSessionTitle(null);
        
        // Log the selected sources before search starts
        printLog(`Selected sources before search: ${JSON.stringify(Array.from(selectedSources))}`);
        
        // Before starting the search, ensure our selection is maintained
        // This prevents any potential state update issues during async operations
        const searchSelection = new Set(selectedSources);
        
        setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
        await new Promise(resolve => {
          setSearchState(prev => ({ ...prev, isLoading: true }));
          setIsDecelerationComplete(false); // Reset deceleration flag when starting new search
          setTimeout(resolve, 0);
        });
        
        // We'll use this function's closure to capture the current selection state
        // Call 3D search if in galaxy mode, otherwise regular search
        if (resultViewStyle === SearchResultViewStyle.GALAXY) {
          await performQuoteSearch3D();
        } else {
          await performQuoteSearch();
        }
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

  // Cleanup for podcast mode label timeout
  useEffect(() => {
    return () => {
      if (podcastModeLabelTimeoutRef.current) {
        clearTimeout(podcastModeLabelTimeoutRef.current);
      }
      if (scopeSlideoutTimeoutRef.current) {
        clearTimeout(scopeSlideoutTimeoutRef.current);
      }
    };
  }, []);

  // Add useEffect for checking admin privileges when user signs in
  useEffect(() => {
    if (isUserSignedIn) {
      checkAndStoreAdminPrivileges();
    } else {
      setAdminFeedId(null);
      setAdminFeedUrl(null);
    }
  }, [isUserSignedIn]);

  // Add useEffect to load stored feedId and feedUrl on component mount
  useEffect(() => {
    const storedFeedId = getStoredFeedId();
    const storedFeedUrl = getStoredFeedUrl();
    if (storedFeedId) {
      setAdminFeedId(storedFeedId);
      printLog(`Loaded stored feedId: ${storedFeedId}`);
    }
    if (storedFeedUrl) {
      setAdminFeedUrl(storedFeedUrl);
      printLog(`Loaded stored feedUrl: ${storedFeedUrl}`);
    }
    printLog(`Initial adminFeedId state: ${storedFeedId}, adminFeedUrl state: ${storedFeedUrl}`);
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

  // Load shared research session from URL parameter with warp speed animation
  const sharedSessionId = searchParams.get('sharedSession');
  const researchSessionId = searchParams.get('researchSessionId');
  
  // Reusable function to load a research session with warp speed animation
  const loadResearchSessionWithWarpSpeed = async (sessionId: string, sessionTitle: string = 'Research Session') => {
        try {
      printLog(`[SessionLoad] Starting warp speed for session: ${sessionId}`);
          
          // Hide initial search UI and prepare for warp speed (do this first!)
          setSearchHistory(prev => ({
            ...prev,
            'podcast-search': true
          }));
          setGridFadeOut(true);
          resetContextPanelState();
          setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
          
          // Start warp speed animation
          setSearchState(prev => ({ ...prev, isLoading: true }));
          setIsDecelerationComplete(false);
          setResultViewStyle(SearchResultViewStyle.GALAXY); // Switch to galaxy view immediately
          
      // Fetch both 3D coordinates AND session items in parallel
      const [research3DData, sessionData] = await Promise.all([
        fetchResearchSessionWith3D(sessionId),
        fetchResearchSession(sessionId)
      ]);
      
      printLog(`[SessionLoad] Loaded ${research3DData.results?.length || 0} results with 3D coordinates`);
          
      // Debug: Log the session data structure
      console.log('[SessionLoad] Session data:', sessionData);
      console.log('[SessionLoad] Session items:', sessionData?.items);
      
      // Debug: Log coordinates for each result
      if (research3DData.results) {
        research3DData.results.forEach((result: any, index: number) => {
          console.log(`[SessionLoad] Galaxy result ${index} coordinates:`, {
            shareLink: result.shareLink,
            x: result.coordinates3d?.x,
            y: result.coordinates3d?.y,
            z: result.coordinates3d?.z,
            hierarchyLevel: result.hierarchyLevel
          });
        });
      }

      // Set galaxy results from the 3D endpoint response
      setGalaxyResults(research3DData.results || []);
      
      // Populate research session items from the session data
      if (sessionData && sessionData.items && sessionData.items.length > 0) {
        console.log('[SessionLoad] Raw items from backend:', sessionData.items);
        console.log('[SessionLoad] Number of raw items:', sessionData.items.length);
        console.log('[SessionLoad] First item structure:', sessionData.items[0]);
        
        // The API returns items directly as metadata objects (not wrapped in pineconeId/metadata structure)
        // So we need to convert them differently
        const filteredItems = sessionData.items.filter((item: any) => item);
        console.log('[SessionLoad] After null filter:', filteredItems.length);
        
        // Build a map of shareLink -> coordinates3d from the 3D results for quick lookup
        const coordinatesMap = new Map<string, { x: number; y: number; z: number }>();
        research3DData.results?.forEach((result: any) => {
          if (result.shareLink && result.coordinates3d) {
            coordinatesMap.set(result.shareLink, result.coordinates3d);
          }
        });
        
        const items: ResearchSessionItem[] = filteredItems.map((item: any, index: number) => {
          console.log(`[SessionLoad] Processing item ${index}:`, {
            shareLink: item.shareLink,
            id: item.id,
            episode: item.episode,
            creator: item.creator
          });
          
          // Merge coordinates from 3D results if available
          const coordinates3d = coordinatesMap.get(item.shareLink || item.id);
          
          return {
            shareLink: item.shareLink || item.id || '',
            quote: item.quote,
            summary: item.summary,
            headline: item.headline,
            episode: item.episode || 'Unknown Episode',
            creator: item.creator || 'Unknown Creator',
            episodeImage: item.episodeImage || item.episode_image,
            date: item.date || item.published || new Date().toISOString(),
            hierarchyLevel: (item.hierarchyLevel || 'paragraph') as 'feed' | 'episode' | 'chapter' | 'paragraph',
            coordinates3d: coordinates3d || item.coordinates3d, // Prefer from 3D results, fallback to stored
            addedAt: new Date(),
          };
        });
        
        console.log('[SessionLoad] Final items array:', items);
        console.log('[SessionLoad] Final items count:', items.length);
        
        setResearchSessionItems(items);
        printLog(`[SessionLoad] Loaded ${items.length} items into research session collector`);
      } else {
        printLog(`[SessionLoad] No items found in session data`);
        setResearchSessionItems([]);
      }
          
          // Store axis labels if returned
          if (research3DData.axisLabels) {
            setAxisLabels(research3DData.axisLabels);
        printLog(`[SessionLoad] Received axis labels: ${JSON.stringify(research3DData.axisLabels)}`);
          }
          
      // Note: Intentionally NOT setting query state here to keep search bar empty
      // for deeplinked sessions. The conversation item below will show the title.
          
          // Also update conversation for consistency
          setConversation(prev => [...prev, {
            id: nextConversationId.current++,
            type: 'podcast-search' as const,
            query: sessionTitle,
            timestamp: new Date(),
            isStreaming: false,
            data: {
              quotes: research3DData.results || []
            }
          }]);
          
      // Set this session as the current active session
      // This allows sharing, saving updates, etc. to work properly
      setCurrentSessionId(sessionId);
      printLog(`[SessionLoad] Set session ${sessionId} as current active session`);
      
      printLog('[SessionLoad] Loaded successfully with warp speed!');
        } catch (error) {
      console.error('Error loading research session:', error);
          setSearchState(prev => ({
            ...prev,
            error: error as Error,
            isLoading: false
          }));
        } finally {
          // Stop warp speed (triggers deceleration)
          setSearchState(prev => ({ ...prev, isLoading: false }));
        }
  };
  
  useEffect(() => {
    const loadSharedSessionWithWarpSpeed = async () => {
      const sessionId = sharedSessionId || researchSessionId;
      if (sessionId) {
        let mongoDbId = sessionId;
        let sessionTitle = 'Research Session';
        
        // If using sharedSession (short ID), fetch metadata first
        if (sharedSessionId) {
          try {
            const sharedSession = await fetchSharedResearchSession(sharedSessionId);

            if (!sharedSession || !sharedSession.researchSessionId) {
              throw new Error('Session not found or invalid - backend must return researchSessionId');
            }

            printLog(`[SharedSession] Found research session ID: ${sharedSession.researchSessionId}`);
            mongoDbId = sharedSession.researchSessionId;
            sessionTitle = sharedSession.title || 'Shared Research Session';
            
            // Store the shared session title for display
            setSharedSessionTitle(sessionTitle);
            
            // Store brand data if present (for embed mode)
            if (sharedSession.brandImage) {
              setBrandImage(sharedSession.brandImage);
              printLog(`[SharedSession] Brand image: ${sharedSession.brandImage}`);
            }
            if (sharedSession.brandColors && sharedSession.brandColors.length > 0) {
              setBrandColors(sharedSession.brandColors);
              printLog(`[SharedSession] Brand colors: ${JSON.stringify(sharedSession.brandColors)}`);
            }
          } catch (error) {
            console.error('Error fetching shared session metadata:', error);
            setSearchState(prev => ({
              ...prev,
              error: error as Error,
              isLoading: false
            }));
            return;
          }
        }
        
        // Load the session using the reusable function
        await loadResearchSessionWithWarpSpeed(mongoDbId, sessionTitle);
      }
    };

    if (sharedSessionId || researchSessionId) {
      loadSharedSessionWithWarpSpeed();
    }
  }, [sharedSessionId, researchSessionId]);

  
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

  // Auto-search when 'q' parameter is present in URL (e.g., from TryJamieWizard)
  useEffect(() => {
    if (queryParam && !hasSearchedInMode(searchMode) && !searchState.isLoading) {
      setQuery(queryParam);
      // Small delay to ensure component is fully loaded and query state is set
      const timer = setTimeout(() => {
        // Use the queryParam directly instead of relying on state
        if (searchMode === 'podcast-search') {
          // Set the conversation first
          resetContextPanelState();
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
                undefined,
                undefined,
                (searchFilters.episodeGuid || '').trim() || undefined
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

            // Store episode GUID for this batch so we can resolve Fountain link for share/Jamie Assist.
            const episodeGuid = response.data.filter_scope?.episode_guid || null;
            setClipBatchEpisodeGuid(episodeGuid);
            
            // Resolve Fountain link up-front so the per-item Share button can use it (via PodcastSearchResultItem.listenLink).
            let fountainLink: string | null = null;
            if (episodeGuid) {
              fountainLink = await getFountainLink(episodeGuid);
            }
            setClipBatchFountainLink(fountainLink);

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
                    listenLink: fountainLink || undefined,
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
        const paragraphId = firstResult.id || firstResult.shareLink || null;
        
        printLog(`First result details: id=${firstResult.id}, shareLink=${firstResult.shareLink}`);
        printLog(`Using paragraphId: ${paragraphId}`);
        printLog(`Full first result: ${JSON.stringify(firstResult, null, 2)}`);
        
        // Set the first result as selected and open the context panel
        if (paragraphId) {
          setSelectedParagraphId(paragraphId);
          
          // IMPORTANT: Also set audio context for auto-play to work
          const audioContext = {
            audioUrl: firstResult.audioUrl,
            timeContext: {
              start_time: firstResult.timeContext?.start_time ?? 0,
              end_time: firstResult.timeContext?.end_time ?? 0,
            },
            episode: firstResult.episode,
            episodeImage: firstResult.episodeImage || '',
            creator: firstResult.creator,
            listenLink: firstResult.listenLink,
            date: firstResult.date,
            quote: firstResult.quote,
            summary: firstResult.summary,
            headline: firstResult.headline,
            hierarchyLevel: firstResult.hierarchyLevel,
            shareLink: firstResult.shareLink,
          };
          printLog(`[AutoSelect] Setting audio context for first result: ${JSON.stringify(audioContext)}`);
          setSelectedAudioContext(audioContext);
          
          // Read auto-play preference
          let autoPlay = true; // Default to true for first-time users
          try {
            const settings = localStorage.getItem('userSettings');
            if (settings) {
              const userSettings = JSON.parse(settings);
              // Use nullish coalescing to default to true when undefined
              autoPlay = userSettings.autoPlayOnStarClick ?? true;
            }
          } catch (e) {
            console.error('Error reading autoPlayOnStarClick from userSettings:', e);
          }
          printLog(`[AutoSelect] AutoPlay setting: ${autoPlay}`);
          setAutoPlayContextOnOpen(autoPlay);

          // Non-embed: start playback immediately when we auto-select the first result after search.
          maybeDispatchAutoPlay({
            enabled: autoPlay,
            shareLink: firstResult.shareLink,
            audioUrl: firstResult.audioUrl,
            startTime: firstResult.timeContext?.start_time ?? 0,
            endTime: firstResult.timeContext?.end_time,
          });
          
          // Small delay to ensure state updates propagate
          setTimeout(() => {
            setIsContextPanelOpen(true);
            printLog(`[AutoSelect] Split-screen: Auto-selected first result: ${paragraphId}`);
          }, 0);
        }
      }
    }
  }, [conversation, searchViewStyle, searchMode]);

  // Function to handle clicking on a search result (for split-screen context panel)
  const handleResultClick = (
    paragraphId: string,
    audioContext?: {
      audioUrl: string;
      timeContext: { start_time: number; end_time: number };
      episode: string;
      episodeImage: string;
      creator: string;
      listenLink?: string;
      date?: string;
      quote?: string;
      summary?: string;
      headline?: string;
      hierarchyLevel?: 'feed' | 'episode' | 'chapter' | 'paragraph';
      shareLink?: string;
    }
  ) => {
    if (searchViewStyle === SearchViewStyle.SPLIT_SCREEN && searchMode === 'podcast-search') {
      printLog(`Result clicked, updating context panel with paragraphId: ${paragraphId}`);
      setSelectedParagraphId(paragraphId);
      if (audioContext) {
        setSelectedAudioContext(audioContext);
        setAutoPlayContextOnOpen(false);
      }
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
      episodeGuid: '',
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
    
    // Initialize defaults for first-time users on mount
    if (userSettings.isFirstVisit !== false) {
      // Set defaults if not already set
      if (userSettings.showAxisLabels === undefined) {
        userSettings.showAxisLabels = true;
      }
      if (userSettings.autoPlayOnStarClick === undefined) {
        userSettings.autoPlayOnStarClick = true;
      }
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
    }
    
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
    // Mark that the user has visited before and set defaults for first-time users
    const settings = localStorage.getItem('userSettings');
    const userSettings = settings ? JSON.parse(settings) : {};
    userSettings.isFirstVisit = false;
    // Set defaults for first-time users
    if (userSettings.showAxisLabels === undefined) {
      userSettings.showAxisLabels = true;
    }
    if (userSettings.autoPlayOnStarClick === undefined) {
      userSettings.autoPlayOnStarClick = true;
    }
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    
    setIsWelcomeOpen(false);
  };

  const handleTutorialClose = () => {
    // Mark that the user has visited before and set defaults for first-time users
    const settings = localStorage.getItem('userSettings');
    const userSettings = settings ? JSON.parse(settings) : {};
    userSettings.isFirstVisit = false;
    // Set defaults for first-time users
    if (userSettings.showAxisLabels === undefined) {
      userSettings.showAxisLabels = true;
    }
    if (userSettings.autoPlayOnStarClick === undefined) {
      userSettings.autoPlayOnStarClick = true;
    }
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    
    setIsTutorialOpen(false);
  };

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  // Add handler for ClipTrackerModal share clicks
  const handleClipShare = (lookupHash: string, cdnLink: string) => {
    // Prefer Fountain link for clip-batch/audio contexts so Jamie Assist prompts use a listen page, not the raw CDN mp4.
    const initialCustomUrl = clipBatchFountainLink || undefined;
    setShareModalData({
      fileUrl: cdnLink,
      lookupHash: lookupHash,
      customUrl: initialCustomUrl
    });
    setIsShareModalOpen(true);

    // If we don't have it yet but we do know the episode GUID, resolve it in the background and update the modal.
    if (!initialCustomUrl && clipBatchEpisodeGuid) {
      getFountainLink(clipBatchEpisodeGuid)
        .then((link) => {
          if (!link) return;
          setClipBatchFountainLink(link);
          setShareModalData((prev) => prev ? { ...prev, customUrl: link } : prev);
        })
        .catch((e) => console.error('Error fetching Fountain link on share:', e));
    }
  };

  // Function to safely store feedId in userSettings
  const storeFeedIdInUserSettings = (feedId: string, feedUrl: string) => {
    try {
      const settings = localStorage.getItem('userSettings');
      const userSettings = settings ? JSON.parse(settings) : {};
      userSettings.adminFeedId = feedId;
      userSettings.adminFeedUrl = feedUrl;
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
      printLog(`Stored feedId ${feedId} and feedUrl ${feedUrl} in userSettings`);
    } catch (error) {
      console.error('Error storing feedId and feedUrl in userSettings:', error);
    }
  };

  // Function to get stored feedId and feedUrl from userSettings
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

  const getStoredFeedUrl = (): string | null => {
    try {
      const settings = localStorage.getItem('userSettings');
      const userSettings = settings ? JSON.parse(settings) : {};
      return userSettings.adminFeedUrl || null;
    } catch (error) {
      console.error('Error getting feedUrl from userSettings:', error);
      return null;
    }
  };

  // Function to check admin privileges and store feedId and feedUrl
  const checkAndStoreAdminPrivileges = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setAdminFeedId(null);
        setAdminFeedUrl(null);
        return;
      }

      const response = await AuthService.checkPrivs(token);
      if (response?.privs?.privs?.feedId && response?.privs?.privs?.feedUrl && response.privs.privs.access === 'admin') {
        const feedId = response.privs.privs.feedId;
        const feedUrl = response.privs.privs.feedUrl;
        setAdminFeedId(feedId);
        setAdminFeedUrl(feedUrl);
        storeFeedIdInUserSettings(feedId, feedUrl);
        printLog(`Admin privileges confirmed for feedId: ${feedId}, feedUrl: ${feedUrl}`);
      } else {
        setAdminFeedId(null);
        setAdminFeedUrl(null);
        printLog('No admin privileges found');
      }
    } catch (error) {
      console.error('Error checking admin privileges:', error);
      setAdminFeedId(null);
      setAdminFeedUrl(null);
    }
  };

  // Selected audio context for podcast results (used e.g. in Galaxy + context panel)
  const [selectedAudioContext, setSelectedAudioContext] = useState<{
    audioUrl: string;
    timeContext: {
      start_time: number;
      end_time: number;
    };
    episode: string;
    episodeImage: string;
    creator: string;
    listenLink?: string;
    date?: string;
    quote?: string;
    summary?: string;
    headline?: string;
    hierarchyLevel?: 'feed' | 'episode' | 'chapter' | 'paragraph';
    shareLink?: string;
  } | null>(null);
  const [autoPlayContextOnOpen, setAutoPlayContextOnOpen] = useState(false);
  const autoPlayDispatchKeyRef = useRef<string | null>(null);

  const maybeDispatchAutoPlay = (args: {
    shareLink?: string;
    audioUrl?: string;
    startTime?: number | null;
    endTime?: number | null;
    enabled: boolean;
  }) => {
    if (isEmbedMode) return;
    if (!args.enabled) return;
    if (!args.audioUrl || !args.shareLink) return;

    const startTime = args.startTime ?? 0;
    const endTime = args.endTime ?? undefined;
    const key = `${args.shareLink}-${startTime}-${endTime ?? 'null'}`;
    if (autoPlayDispatchKeyRef.current === key) return;
    autoPlayDispatchKeyRef.current = key;

    window.dispatchEvent(
      new CustomEvent('playAudioTrack', {
        detail: {
          id: args.shareLink,
          audioUrl: args.audioUrl,
          startTime,
          endTime,
        },
      }),
    );
  };

  // Track the effective width of the podcast context panel so we can center the floating search bar
  const [contextPanelWidth, setContextPanelWidth] = useState(0);
  // Keep a ref so the narrow-layout ResizeObserver can incorporate the latest panel width
  // without needing to re-register the observer on every width change.
  const contextPanelWidthRef = useRef(0);
  useEffect(() => {
    contextPanelWidthRef.current = contextPanelWidth;
  }, [contextPanelWidth]);

  // Responsive layout: treat "narrow" the same way PageBanner collapses nav items.
  // We base this on the measured main content width (not window width) so it also triggers
  // when the side panel squeezes the content area.
  const mainContentRef = useRef<HTMLDivElement | null>(null);
  // For galaxy mode, the most important thing is the actual space the galaxy has.
  // Using the galaxy viewport as the measurement target makes the breakpoint feel much more intuitive.
  const galaxyViewportRef = useRef<HTMLDivElement | null>(null);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  // Narrow layout: show a compact mini player by default; user can expand to see UnifiedSidePanel.
  const [isNarrowInfoExpanded, setIsNarrowInfoExpanded] = useState(false);
  
  // Compact height mode: for very short viewports (e.g., landscape mobile, small embeds)
  // Hide non-essential UI elements to maximize galaxy visibility
  const COMPACT_HEIGHT_THRESHOLD = 500; // pixels
  const [isCompactHeight, setIsCompactHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight < COMPACT_HEIGHT_THRESHOLD;
    }
    return false;
  });

  // Debug: log the key layout flags driving scroll + touch behavior on mobile.
  useEffect(() => {
    printLog(
      `[ScrollDebug] flags changed: isEmbedMode=${isEmbedMode} isNarrowLayout=${isNarrowLayout} isNarrowInfoExpanded=${isNarrowInfoExpanded}`,
    );
  }, [isEmbedMode, isNarrowLayout, isNarrowInfoExpanded]);

  // Track viewport height for compact mode (embed/landscape scenarios)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setIsCompactHeight(window.innerHeight < COMPACT_HEIGHT_THRESHOLD);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // DISABLED: Scroll lock was breaking nested scroll on mobile.
  // The bottom sheet's z-index and pointer-events should be sufficient.
  // useEffect(() => {
  //   const shouldLock = !isEmbedMode && Boolean(isNarrowLayout && isNarrowInfoExpanded);
  //   if (!shouldLock) return;
  //   // ... scroll lock code removed
  // }, [isEmbedMode, isNarrowLayout, isNarrowInfoExpanded]);

  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;

    // Keep aligned with PageBanner's MOBILE_BREAKPOINT (900px), but:
    // - Avoid feedback loops: opening the side panel reduces `el` width, which can cause
    //   bottom↔side oscillation if we key off `el` alone.
    // - Use a *wide* hysteresis band so the mode doesn't flap while resizing.
    //
    // We approximate the "true available width" as:
    //   effectiveWidth = mainContentWidth + contextPanelWidth
    // This removes the panel-open feedback because (main shrinks) + (panel grows) ≈ constant.
    //
    // Thresholds (tuned per observed behavior in split-screen):
    // - Collapse sooner (user preference): enter narrow around ~65% of a typical wide layout.
    // - Expand later: allow it to take close to full width to return to side layout.
    //
    // NOTE: These are absolute px values because we don't have a reliable "percent of full"
    // baseline across different layouts; but we measure the galaxy viewport (when present),
    // which makes these thresholds feel consistent.
    const NARROW_ENTER = 1150;
    const NARROW_EXIT = 1750;

    const updateFromWidth = (mainWidth: number) => {
      const effectiveWidth = mainWidth + (contextPanelWidthRef.current || 0);
      setIsNarrowLayout((prev) => {
        if (prev) {
          // Currently narrow: only exit once we're clearly above the threshold.
          return effectiveWidth < NARROW_EXIT;
        }
        // Currently wide: only enter once we're clearly below the threshold.
        return effectiveWidth <= NARROW_ENTER;
      });
    };

    // Prefer the galaxy viewport when it's mounted; fallback to the full main content area.
    // This avoids using header/other chrome as the primary signal.
    const measureEl = galaxyViewportRef.current ?? el;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        if (!entries.length) return;
        const entry = entries[0];
        const width = entry.contentRect?.width ?? measureEl.getBoundingClientRect().width;
        updateFromWidth(width);
      });
      observer.observe(measureEl);
      updateFromWidth(measureEl.getBoundingClientRect().width);
      return () => observer.disconnect();
    }

    const onResize = () => updateFromWidth(measureEl.getBoundingClientRect().width);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resetContextPanelState = () => {
    setIsContextPanelOpen(false);
    setSelectedParagraphId(null);
    setSelectedAudioContext(null);
    setAutoPlayContextOnOpen(false);
    setIsNarrowInfoExpanded(false);
    // Also stop any in-flight audio playback via the shared controller
    window.dispatchEvent(new Event('stopAllAudio'));
  };

  // Check if we should show nebula background
  const showNebulaBackground = !hasSearchedInMode(searchMode) && !isClipBatchPage && !isSharePage;
  
  return (
    <AudioControllerProvider>
    {/* Nebula background - rendered at root level for proper layering */}
    {showNebulaBackground && (
      <div 
        style={{ 
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <NebulaBackground dimOpacity={LANDING_NEBULA_DIM_OPACITY} />
      </div>
    )}
    <div 
      className="min-h-screen text-white flex relative"
      style={{ 
        zIndex: 1,
        backgroundColor: showNebulaBackground ? 'transparent' : '#000000',
      }}
      onMouseEnter={() => isEmbedMode && setIsEmbedHovered(true)}
      onMouseLeave={() => isEmbedMode && setIsEmbedHovered(false)}
      onClick={() => {
        if (isEmbedMode && !audioUnlocked) {
          console.log('[SearchInterface] User clicked - unlocking audio');
          setAudioUnlocked(true);
        }
      }}
    >
      {/* Main Content Area - Left Side */}
      <div ref={mainContentRef} className="flex-1 min-w-0 transition-all duration-300">
        {/* Welcome Modal - Hidden in embed mode */}
        {!isEmbedMode && (
          <WelcomeModal
            isOpen={isWelcomeOpen}
            onQuickTour={handleWelcomeQuickTour}
            onGetStarted={handleWelcomeGetStarted}
          />
        )}

        {/* Tutorial Modal - Hidden in embed mode */}
        {!isEmbedMode && (
          <TutorialModal
            isOpen={isTutorialOpen}
            onClose={handleTutorialClose}
            defaultSection={getDefaultTutorialSection()}
          />
        )}
        {/* Page Banner - Hidden in embed mode */}
        {!isEmbedMode && (
          <PageBanner 
            logoText="Pull That Up Jamie!" 
            onConnect={() => initializeLightning()}
            onSignIn={() => setIsSignInModalOpen(true)}
            onUpgrade={handleUpgrade}
            onSignOut={handleSignOut}
            onTutorialClick={handleTutorialClick}
            isUserSignedIn={isUserSignedIn}
            setIsUserSignedIn={setIsUserSignedIn}
            navigationMode={NavigationMode.CLEAN}
          />
        )}

        {/* Web Search Deprecation Banner */}
        {isWebSearchDeprecated && (
          <div className="max-w-3xl mx-auto px-4 mt-4">
            <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg p-4 text-sm text-yellow-100">
              <p className="font-semibold mb-1">
                Web search is no longer available in Jamie.
              </p>
              <p className="text-xs sm:text-sm text-gray-200">
                Podcast search is still fully supported below. If you previously relied on Jamie for web search or need help,
                you can reach out at{' '}
                <span className="blur-[2px] hover:blur-none cursor-help">
                  jim at cascdr dot xyz
                </span>
                .
              </p>
            </div>
          </div>
        )}
        
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
                .then(async response => {
                  if (response.success && response.data) {
                    const episodeGuid = response.data.filter_scope?.episode_guid || null;
                    setClipBatchEpisodeGuid(episodeGuid);

                    let fountainLink: string | null = null;
                    if (episodeGuid) {
                      fountainLink = await getFountainLink(episodeGuid);
                    }
                    setClipBatchFountainLink(fountainLink);

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
                            listenLink: fountainLink || undefined,
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
                .then(async response => {
                  if (response.success && response.data) {
                    const episodeGuid = response.data.filter_scope?.episode_guid || null;
                    setClipBatchEpisodeGuid(episodeGuid);

                    let fountainLink: string | null = null;
                    if (episodeGuid) {
                      fountainLink = await getFountainLink(episodeGuid);
                    }
                    setClipBatchFountainLink(fountainLink);

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
                            listenLink: fountainLink || undefined,
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
      <div className={`${!hasSearchedInMode(searchMode) ? 'mb-4' : 'mb-0'} ml-4 mr-4`}>
        {/* Header with Logo / Hero - hide for main app once a search has been run */}
        {isClipBatchPage ? (
          <div className="relative w-full max-w-4xl mx-auto">
            <div className="flex justify-start md:block mb-4 md:mb-0">
              <button 
                onClick={() => window.location.href = `/app/feed/${feedId}/jamieProHistory`} 
                className="md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 h-10 w-10 flex items-center justify-center bg-transparent text-white hover:text-gray-300 focus:outline-none z-10 ml-4 md:ml-0"
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
          !hasSearchedInMode(searchMode) && (
            <div className="flex flex-col justify-center items-center py-12 select-none mt-4">
              <h1 
                className="text-4xl md:text-5xl text-white text-center mb-3"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
              >
                Break free from the timeline.
              </h1>
              <p 
                className="text-gray-400 text-lg md:text-xl text-center"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
              >
                Search podcasts by meaning, not minutes.
              </p>
            </div>
          )
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


        {/* Initial Search Form - only show before first search */}
        {!hasSearchedInMode(searchMode) && (
          <div className="max-w-3xl mx-auto px-4">
            {searchMode === 'podcast-search' && (
              <div>
                {!DISABLE_CLIPPING && !isAnyModalOpen() && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <ClipTrackerModal
                        clipProgress={clipProgress}
                        isCollapsed={isClipTrackerCollapsed}
                        onCollapsedChange={setIsClipTrackerCollapsed}
                        auth={authConfig || undefined}
                        onShareClick={handleClipShare}
                      />
                    </div>
                    <div className="w-10"></div>
                  </div>
                )}
                <form onSubmit={handleSearch}>
                  <div className="flex items-start gap-3">
                    {/* Textarea - grows to fill available space */}
                    <textarea
                      ref={searchInputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchMode === 'podcast-search' ? `Search thousands of moments` : `Search the web privately with LLM summary`}
                      className="flex-1 bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-white-glow resize-auto min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSearch(e);
                        }
                      }}
                    />

                    {/* Button column - fixed width */}
                    <div className="flex flex-col gap-2 relative">
                      {/* Floating scope switch and arrow - above the grid, centered on filter button */}
                      {!!adminFeedId && searchMode === 'podcast-search' && (
                        <div className="absolute bottom-full mb-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50">
                          {/* Scope switch with slide animation */}
                          <div className={`transition-all duration-300 ${
                            showScopeSlideout 
                              ? 'max-h-20 opacity-100' 
                              : 'max-h-0 opacity-0 pointer-events-none'
                          }`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                printLog(`[Scope Switch Button] Clicked. Current mode: ${podcastSearchMode}`);
                                handlePodcastSearchModeChange(
                                  podcastSearchMode === 'global' ? 'my-pod' : 'global'
                                );
                                if (scopeSlideoutTimeoutRef.current) {
                                  clearTimeout(scopeSlideoutTimeoutRef.current);
                                }
                                setShowScopeSlideout(true);
                                scopeSlideoutTimeoutRef.current = setTimeout(() => {
                                  setShowScopeSlideout(false);
                                }, 5000);
                              }}
                              disabled={!showScopeSlideout}
                              className="inline-flex rounded-md border border-gray-700 bg-black/90 backdrop-blur-sm text-xs text-gray-200 whitespace-nowrap mb-1 shadow-lg"
                              aria-label={
                                podcastSearchMode === 'global'
                                  ? 'Switch to My Pod scope'
                                  : 'Switch to All Pods scope'
                              }
                            >
                              <div className="flex text-xs">
                                <div
                                  className={`flex items-center px-2 py-1 transition-colors duration-200 ${
                                    podcastSearchMode === 'global'
                                      ? 'bg-[#1A1A1A] text-white'
                                      : 'bg-black text-gray-400'
                                  }`}
                                >
                                  <span className="mr-1">🌐</span>
                                  {podcastSearchMode === 'global' && <span>All Pods</span>}
                                </div>
                                <div
                                  className={`flex items-center px-2 py-1 transition-colors duration-200 ${
                                    podcastSearchMode === 'my-pod'
                                      ? 'bg-[#1A1A1A] text-white'
                                      : 'bg-black text-gray-400'
                                  }`}
                                >
                                  <span className="mr-1">👤</span>
                                  {podcastSearchMode === 'my-pod' && <span>My Pod</span>}
                                </div>
                              </div>
                            </button>
                          </div>

                          {/* Arrow toggle button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleScopeSlideout(e);
                            }}
                            className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            aria-label={showScopeSlideout ? 'Collapse scope selector' : 'Expand scope selector'}
                          >
                            {showScopeSlideout ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Filter button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={podcastSearchMode === 'my-pod' ? undefined : handleFilterClick}
                          disabled={podcastSearchMode === 'my-pod'}
                          className={`w-10 h-10 rounded-full transition-colors duration-200 flex items-center justify-center border shadow-lg ${
                            podcastSearchMode === 'my-pod'
                              ? 'bg-black/30 border-gray-800 text-gray-600 cursor-not-allowed'
                              : 'bg-black/50 backdrop-blur-sm hover:bg-black/70 border-gray-700 text-white'
                          }`}
                          aria-label="Filter"
                          aria-disabled={podcastSearchMode === 'my-pod'}
                        >
                          <Filter className="w-4 h-4" />
                        </button>
                        
                        {/* Reset filters badge */}
                        {podcastSearchMode === 'global' && hasActiveFilters() && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors shadow-lg z-10"
                            aria-label="Reset Filters"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Search button */}
                      <button
                        type="submit"
                        className="w-10 h-10 bg-white rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
                        disabled={searchState.isLoading}
                      >
                        {searchState.isLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                        ) : (
                          <svg
                            className="w-4 h-4 text-black"
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
          </div>
        )}

      {/* Stats display for podcast search mode */}
      {!hasSearchedInMode(searchMode) && searchMode === 'podcast-search' && (
        <div className="text-center mt-2 text-gray-300">
          <p>Search from over <span className="font-bold">{podcastStats.clipCount.toLocaleString()}</span> podcast moments</p>
        </div>
      )}

      {/* Featured Galaxies Carousel - shown on landing page */}
      {!hasSearchedInMode(searchMode) && searchMode === 'podcast-search' && !isEmbedMode && !isSharePage && !isClipBatchPage && (
        <div className="mt-12 px-4">
          <FeaturedGalaxiesCarousel 
            onSessionClick={async (shareId, fallbackTitle) => {
              // Update URL first for proper navigation state
              setSearchParams({ sharedSession: shareId });
              
              try {
                // Resolve shareId (12-char) to researchSessionId (24-char MongoDB ObjectId)
                const sharedSession = await fetchSharedResearchSession(shareId);
                
                if (!sharedSession || !sharedSession.researchSessionId) {
                  throw new Error('Session not found or invalid');
                }
                
                const mongoDbId = sharedSession.researchSessionId;
                const sessionTitle = sharedSession.title || fallbackTitle;
                
                // Store brand data if present
                if (sharedSession.brandImage) {
                  setBrandImage(sharedSession.brandImage);
                }
                if (sharedSession.brandColors && sharedSession.brandColors.length > 0) {
                  setBrandColors(sharedSession.brandColors);
                }
                
                // Now load with the proper MongoDB ObjectId
                await loadResearchSessionWithWarpSpeed(mongoDbId, sessionTitle);
              } catch (error) {
                console.error('Error loading featured session:', error);
                setSearchState(prev => ({
                  ...prev,
                  error: error as Error,
                  isLoading: false
                }));
              }
            }}
          />
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


      {/* Conversation History / Galaxy View */}
      {((conversation.length > 0 || (searchState.isLoading && resultViewStyle === SearchResultViewStyle.GALAXY)) && searchMode === 'podcast-search') && (
        <div>
          {/* View Toggle - Hidden in embed mode - show during loading in galaxy mode OR when we have results */}
          {!isEmbedMode && (conversation.length > 0 || (searchState.isLoading && resultViewStyle === SearchResultViewStyle.GALAXY)) && (
          <div className="flex justify-center mt-4 mb-3">
            <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-[#111111]">
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  resultViewStyle === SearchResultViewStyle.LIST
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => {
                  setResultViewStyle(SearchResultViewStyle.LIST);
                  localStorage.setItem('searchResultViewStyle', SearchResultViewStyle.LIST);
                }}
              >
                <List className="w-4 h-4" />
                <span>List</span>
              </button>
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  resultViewStyle === SearchResultViewStyle.GALAXY
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => {
                  setResultViewStyle(SearchResultViewStyle.GALAXY);
                  localStorage.setItem('searchResultViewStyle', SearchResultViewStyle.GALAXY);
                }}
              >
                <Sparkles className="w-4 h-4" />
                <span>Galaxy</span>
              </button>
            </div>
          </div>
          )}

          {/* Conditional rendering: List or Galaxy view */}
          {resultViewStyle === SearchResultViewStyle.GALAXY ? (
            <div
              ref={galaxyViewportRef}
              className="relative w-full transition-all duration-300 ease-in-out"
              style={{
              height: isEmbedMode ? '100vh' : 'calc(100vh - 150px)' 
              }}
            >
              <SemanticGalaxyView
                results={galaxyResults}
                disableInteractions={Boolean(isNarrowLayout && isNarrowInfoExpanded)}
                onStarClick={(result) => {
                  printLog(`[StarClick] Star clicked: ${result.shareLink}`);
                  printLog(`[StarClick] Audio URL: ${result.audioUrl}`);
                  printLog(`[StarClick] Time context: ${JSON.stringify(result.timeContext)}`);
                  
                  setSelectedParagraphId(result.shareLink);
                  
                  // Track the index of the clicked result for navigation
                  const resultIndex = galaxyResults.findIndex(r => r.shareLink === result.shareLink);
                  if (resultIndex !== -1) {
                    setCurrentResultIndex(resultIndex);
                    printLog(`[StarClick] Set current result index to: ${resultIndex}`);
                  }
                  
                  // Read auto-play preference from userSettings
                  let autoPlay = true; // Default to true for first-time users
                  
                  // In embed mode, always auto-play
                  if (!isEmbedMode) {
                    try {
                      const settings = localStorage.getItem('userSettings');
                      printLog(`[StarClick] Raw userSettings from localStorage: ${settings}`);
                      if (settings) {
                        const userSettings = JSON.parse(settings);
                        printLog(`[StarClick] Parsed userSettings: ${JSON.stringify(userSettings)}`);
                        // Use nullish coalescing to default to true when undefined
                        autoPlay = userSettings.autoPlayOnStarClick ?? true;
                        printLog(`[StarClick] autoPlayOnStarClick from settings: ${userSettings.autoPlayOnStarClick}, coerced to: ${autoPlay}`);
                      }
                    } catch (e) {
                      console.error('Error reading autoPlayOnStarClick from userSettings:', e);
                    }
                  }
                  printLog(`[StarClick] Final AutoPlay setting: ${autoPlay} (isEmbedMode: ${isEmbedMode})`);
                  
                  // Store audio context so PodcastContextPanel/EmbedMiniPlayer can render
                  const audioContext = {
                    audioUrl: result.audioUrl,
                    timeContext: {
                      start_time: result.timeContext?.start_time ?? 0,
                      end_time: result.timeContext?.end_time ?? 0,
                    },
                    episode: result.episode,
                    episodeImage: result.episodeImage || '',
                    creator: result.creator,
                    listenLink: result.listenLink,
                    date: result.date,
                    quote: result.quote,
                    summary: result.summary,
                    headline: result.headline,
                    hierarchyLevel: result.hierarchyLevel,
                    shareLink: result.shareLink,
                  };
                  printLog(`[StarClick] Setting audio context: ${JSON.stringify(audioContext)}`);
                  setSelectedAudioContext(audioContext);
                  setAutoPlayContextOnOpen(autoPlay);

                  // Non-embed: if autoplay is enabled, start playback immediately (independent of which panel is mounted).
                  maybeDispatchAutoPlay({
                    enabled: autoPlay,
                    shareLink: result.shareLink,
                    audioUrl: result.audioUrl,
                    startTime: result.timeContext?.start_time ?? 0,
                    endTime: result.timeContext?.end_time,
                  });
                  
                  // In embed mode, trigger playback immediately via AudioController
                  if (isEmbedMode && autoPlay && result.audioUrl) {
                    printLog(`[StarClick] Embed mode - triggering immediate playback`);
                    // Import playTrack from the audio controller will be handled via the mini player
                    // The mini player will auto-play when selectedAudioContext changes
                  }
                  
                  // Small delay to ensure state updates propagate before opening panel (non-embed mode)
                  if (!isEmbedMode) {
                    setTimeout(() => {
                      setIsContextPanelOpen(true);
                      printLog(`[StarClick] Panel opened after state updates`);
                    }, 0);
                  }
                }}
                selectedStarId={selectedParagraphId}
                axisLabels={axisLabels}
                isLoading={searchState.isLoading && searchMode === 'podcast-search'}
                onDecelerationComplete={() => {
                  printLog('Deceleration complete from galaxy view');
                  setIsDecelerationComplete(true); // Allow context panel to appear
                }}
                query={
                  [...conversation]
                    .reverse()
                    .find(item => item.type === 'podcast-search')?.query || undefined
                }
                onAddToResearch={handleAddToResearchSession}
                researchSessionShareLinks={researchSessionItems.map(item => item.shareLink)}
                researchSessionItems={researchSessionItems}
                onRemoveFromResearch={handleRemoveFromResearchSession}
                onClearResearch={handleClearResearchSession}
                showResearchToast={showResearchToast}
                isContextPanelOpen={isContextPanelOpen}
                onCloseContextPanel={() => setIsContextPanelOpen(false)}
                onOpenAnalysisPanel={() => {
                  const sessionId = getCurrentSessionId();
                  printLog(`[AI Analysis] Open requested from Galaxy: sessionId=${sessionId || 'null'} items=${researchSessionItems.length}`);
                  setIsAnalysisPanelOpen(true);
                }}
                sharedSessionTitle={sharedSessionTitle}
                hideStats={isEmbedMode}
                compactStats={isNarrowLayout}
                hideOptions={isEmbedMode}
                nebulaDimOpacity={isEmbedMode ? 0.78 : undefined}
                brandImage={isEmbedMode ? (brandImage || undefined) : undefined}
                brandColors={isEmbedMode ? (brandColors || undefined) : undefined}
                isCompactHeight={isEmbedMode && isCompactHeight}
              />
            </div>
          ) : (
            <div className={`mx-auto px-4 space-y-8 transition-all duration-300 ${
              searchMode === 'podcast-search' && conversation.length > 0
                ? 'mb-1 pb-1'
                : 'mb-24 pb-24'
            } max-w-4xl`}>
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
        </div>
      )}

      {/* Conversation History for Web Search */}
      {conversation.length > 0 && searchMode !== 'podcast-search' && (
      <div className={`mx-auto px-4 space-y-8 transition-all duration-300 mb-24 pb-24 max-w-4xl`}>
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

      {searchMode === 'podcast-search' && searchState.isLoading && resultViewStyle === SearchResultViewStyle.LIST && (
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

      {/* Floating Search Bar - Hidden in embed mode */}
      {!isEmbedMode &&
        // Hide search when narrow "info" is expanded (UnifiedSidePanel full mode).
        !(isNarrowLayout && isNarrowInfoExpanded) &&
        hasSearchedInMode(searchMode) &&
        (searchMode === 'web-search' || searchMode === 'podcast-search') &&
        !isAnyModalOpen() && (
        <div
          className="fixed sm:bottom-4 bottom-1 z-40 flex justify-center px-4 sm:px-24"
          style={{
            left: '0',
            right:
              !isNarrowLayout &&
              searchMode === 'podcast-search' &&
              searchViewStyle === SearchViewStyle.SPLIT_SCREEN &&
              isContextPanelOpen
                ? `${contextPanelWidth}px`
                : '0',
            // When the mini player is visible (narrow + not expanded), lift the search bar above it.
            ...(isNarrowLayout && !isNarrowInfoExpanded && selectedAudioContext
              ? { bottom: 'calc(var(--mini-player-height, 92px) + 8px)' }
              : null),
          }}
        >
          <div className={`w-full flex flex-col ${isNarrowLayout ? 'max-w-[22rem]' : 'max-w-[40rem]'}`}>
            {!DISABLE_CLIPPING && searchMode === 'podcast-search' && !isAnyModalOpen() && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <ClipTrackerModal
                    clipProgress={clipProgress}
                    isCollapsed={isClipTrackerCollapsed}
                    onCollapsedChange={setIsClipTrackerCollapsed}
                    auth={authConfig || undefined}
                    onShareClick={handleClipShare}
                  />
                </div>
                <div className="w-10"></div>
              </div>
            )}
            <form onSubmit={handleSearch}>
            <div className={`flex gap-3 ${isNarrowLayout ? 'items-end' : 'items-start'}`}>
              {/* Input (narrow) / Textarea (wide) */}
              {isNarrowLayout ? (
                <input
                  ref={searchInputRef as any}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchMode === 'podcast-search' ? `Search thousands of moments` : `Search the web privately with LLM summary`}
                  className="flex-1 bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg min-h-[36px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e as any);
                    }
                  }}
                />
              ) : (
                <textarea
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchMode === 'podcast-search' ? `Search thousands of moments` : `Search the web privately with LLM summary`}
                  className="flex-1 bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg resize-none min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                />
              )}

              {/* Button column - fixed width */}
              <div className="flex flex-col gap-2 relative">
                {/* Floating scope switch and arrow - above the grid, centered on filter button */}
                {!!adminFeedId && searchMode === 'podcast-search' && (
                  <div
                    className={`absolute bottom-full mb-0 flex flex-col gap-1 z-50 ${
                      // On narrow, right-align to keep the segmented control from clipping off-screen.
                      isNarrowLayout ? 'right-0 items-end' : 'left-1/2 -translate-x-1/2 items-center'
                    }`}
                  >
                    {/* Scope switch with slide animation */}
                    <div className={`transition-all duration-300 ${
                      showScopeSlideout 
                        ? 'max-h-20 opacity-100' 
                        : 'max-h-0 opacity-0 pointer-events-none'
                    }`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          printLog(`[Scope Switch Button] Clicked. Current mode: ${podcastSearchMode}`);
                          handlePodcastSearchModeChange(
                            podcastSearchMode === 'global' ? 'my-pod' : 'global'
                          );
                          if (scopeSlideoutTimeoutRef.current) {
                            clearTimeout(scopeSlideoutTimeoutRef.current);
                          }
                          setShowScopeSlideout(true);
                          scopeSlideoutTimeoutRef.current = setTimeout(() => {
                            setShowScopeSlideout(false);
                          }, 5000);
                        }}
                        disabled={!showScopeSlideout}
                        className="inline-flex rounded-md border border-gray-700 bg-black/90 backdrop-blur-sm text-xs text-gray-200 whitespace-nowrap mb-1 shadow-lg"
                        aria-label={
                          podcastSearchMode === 'global'
                            ? 'Switch to My Pod scope'
                            : 'Switch to All Pods scope'
                        }
                      >
                        <div className="flex text-xs">
                          <div
                            className={`flex items-center px-2 py-1 transition-colors duration-200 ${
                              podcastSearchMode === 'global'
                                ? 'bg-[#1A1A1A] text-white'
                                : 'bg-black text-gray-400'
                            }`}
                          >
                            <span className="mr-1">🌐</span>
                            {podcastSearchMode === 'global' && <span>All Pods</span>}
                          </div>
                          <div
                            className={`flex items-center px-2 py-1 transition-colors duration-200 ${
                              podcastSearchMode === 'my-pod'
                                ? 'bg-[#1A1A1A] text-white'
                                : 'bg-black text-gray-400'
                            }`}
                          >
                            <span className="mr-1">👤</span>
                            {podcastSearchMode === 'my-pod' && <span>My Pod</span>}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Arrow toggle button */}
                    <button
                      type="button"
                      onClick={toggleScopeSlideout}
                      className={`${isNarrowLayout ? 'w-6 h-5' : 'w-8 h-6'} flex items-center justify-center text-gray-400 hover:text-white transition-colors`}
                      aria-label={showScopeSlideout ? 'Collapse scope selector' : 'Expand scope selector'}
                    >
                      {showScopeSlideout ? (
                        <ChevronDown className={isNarrowLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                      ) : (
                        <ChevronUp className={isNarrowLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                      )}
                    </button>
                  </div>
                )}

                {/* Filter button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={podcastSearchMode === 'my-pod' ? undefined : handleFilterClick}
                    disabled={podcastSearchMode === 'my-pod'}
                    className={`rounded-full transition-colors duration-200 flex items-center justify-center border shadow-lg ${
                      podcastSearchMode === 'my-pod'
                        ? 'bg-black/30 border-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-black/50 backdrop-blur-sm hover:bg-black/70 border-gray-700 text-white'
                    } ${isNarrowLayout ? 'w-7 h-7' : 'w-10 h-10'}`}
                    aria-label="Filter"
                    aria-disabled={podcastSearchMode === 'my-pod'}
                  >
                    <Filter className={isNarrowLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                  </button>
                  
                  {/* Reset filters badge */}
                  {podcastSearchMode === 'global' && hasActiveFilters() && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="absolute -top-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-0.5 transition-colors shadow-lg z-10"
                      aria-label="Reset Filters"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Search button */}
                <button
                  type="submit"
                  className={`${isNarrowLayout ? 'w-7 h-7' : 'w-10 h-10'} bg-white rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center`}
                  disabled={searchState.isLoading}
                >
                  {searchState.isLoading ? (
                    <div className={`animate-spin rounded-full border-b-2 border-black ${isNarrowLayout ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />
                  ) : (
                    <svg
                      className={`${isNarrowLayout ? 'w-3 h-3' : 'w-4 h-4'} text-black`}
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
        </div>
      )}

      {/* Mini Player */}
      {(isEmbedMode || (isNarrowLayout && !isEmbedMode && selectedAudioContext)) && (
        <EmbedMiniPlayer
          mode={isEmbedMode ? 'embed' : 'app'}
          isHovered={isEmbedMode ? isEmbedHovered : true}
          audioUnlocked={isEmbedMode ? audioUnlocked : true}
          brandImage={isEmbedMode ? (brandImage || undefined) : undefined}
          audioUrl={selectedAudioContext?.audioUrl}
          episodeTitle={selectedAudioContext?.episode}
          episodeImage={selectedAudioContext?.episodeImage}
          creator={selectedAudioContext?.creator}
          timeContext={selectedAudioContext?.timeContext}
          quote={selectedAudioContext?.quote}
          summary={selectedAudioContext?.summary}
          headline={selectedAudioContext?.headline}
          hierarchyLevel={selectedAudioContext?.hierarchyLevel}
          trackId={selectedAudioContext?.shareLink || 'embed-player'}
          isExpanded={isNarrowInfoExpanded}
          onExpandChange={(expanded) => setIsNarrowInfoExpanded(expanded)}
          isCompactHeight={isEmbedMode && isCompactHeight}
          onPrevious={selectedAudioContext && currentResultIndex > 0 ? () => {
            const prevIndex = currentResultIndex - 1;
            const prevResult = galaxyResults[prevIndex];
            if (prevResult) {
              printLog(`[Navigation] Moving to previous result at index ${prevIndex}`);
              setCurrentResultIndex(prevIndex);
              setSelectedParagraphId(prevResult.shareLink);
              setSelectedAudioContext({
                audioUrl: prevResult.audioUrl,
                timeContext: {
                  start_time: prevResult.timeContext?.start_time ?? 0,
                  end_time: prevResult.timeContext?.end_time ?? 0,
                },
                episode: prevResult.episode,
                episodeImage: prevResult.episodeImage || '',
                creator: prevResult.creator,
                listenLink: prevResult.listenLink,
                date: prevResult.date,
                quote: prevResult.quote,
                summary: prevResult.summary,
                headline: prevResult.headline,
                hierarchyLevel: prevResult.hierarchyLevel,
                shareLink: prevResult.shareLink,
              });

              // Match embed-mode UX: immediately play the next/previous clip when user navigates.
              // (Non-embed narrow mode does not have hover-autoplay.)
              if (!isEmbedMode && isNarrowLayout && prevResult.audioUrl) {
                window.dispatchEvent(
                  new CustomEvent('playAudioTrack', {
                    detail: {
                      id: prevResult.shareLink,
                      audioUrl: prevResult.audioUrl,
                      startTime: prevResult.timeContext?.start_time ?? 0,
                      endTime: prevResult.timeContext?.end_time,
                    },
                  }),
                );
              }
            }
          } : undefined}
          onNext={selectedAudioContext && currentResultIndex < galaxyResults.length - 1 ? () => {
            const nextIndex = currentResultIndex + 1;
            const nextResult = galaxyResults[nextIndex];
            if (nextResult) {
              printLog(`[Navigation] Moving to next result at index ${nextIndex}`);
              setCurrentResultIndex(nextIndex);
              setSelectedParagraphId(nextResult.shareLink);
              setSelectedAudioContext({
                audioUrl: nextResult.audioUrl,
                timeContext: {
                  start_time: nextResult.timeContext?.start_time ?? 0,
                  end_time: nextResult.timeContext?.end_time ?? 0,
                },
                episode: nextResult.episode,
                episodeImage: nextResult.episodeImage || '',
                creator: nextResult.creator,
                listenLink: nextResult.listenLink,
                date: nextResult.date,
                quote: nextResult.quote,
                summary: nextResult.summary,
                headline: nextResult.headline,
                hierarchyLevel: nextResult.hierarchyLevel,
                shareLink: nextResult.shareLink,
              });

              // Match embed-mode UX: immediately play the next/previous clip when user navigates.
              if (!isEmbedMode && isNarrowLayout && nextResult.audioUrl) {
                window.dispatchEvent(
                  new CustomEvent('playAudioTrack', {
                    detail: {
                      id: nextResult.shareLink,
                      audioUrl: nextResult.audioUrl,
                      startTime: nextResult.timeContext?.start_time ?? 0,
                      endTime: nextResult.timeContext?.end_time,
                    },
                  }),
                );
              }
            }
          } : undefined}
        />
      )}

      {/* Embed Mode Attribution (bottom-right) */}
      {isEmbedMode && (
        <div
          className="fixed right-4 z-40"
          style={{ bottom: 'calc(var(--embed-mini-player-height, 92px) + 12px)' }}
        >
          <PoweredByJamiePill sharedSessionId={sharedSessionId} />
        </div>
      )}

      {searchMode === 'podcast-search' && !isAnyModalOpen() && (
        <div
          className={`fixed w-full z-50 transition-all duration-300 ${
            hasSearchedInMode('podcast-search') ? 'bottom-24' : 'bottom-0'
          }`}
        >
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

      {/* Research Session Toast Notification - only show outside galaxy view */}
      {showResearchToast && resultViewStyle !== SearchResultViewStyle.GALAXY && (
        <div className="fixed bottom-24 right-4 z-50 animate-slide-in-right">
          <div className="bg-black/95 backdrop-blur-sm border border-gray-700 text-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Added to Research</span>
          </div>
        </div>
      )}

      {/* Research Session Limit Toast - only show outside galaxy view */}
      {showResearchLimitToast && resultViewStyle !== SearchResultViewStyle.GALAXY && (
        <div className="fixed bottom-24 right-4 z-50 animate-slide-in-right">
          <div className="bg-red-900/95 backdrop-blur-sm border border-red-700 text-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Maximum {MAX_RESEARCH_ITEMS} items per session</span>
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
        context={ShareModalContext.AUDIO_CLIP}
        videoMetadata={shareModalData?.customUrl ? { customUrl: shareModalData.customUrl } : undefined}
      />
      <SocialShareModal
        isOpen={isSocialShareModalOpen}
        onClose={() => setIsSocialShareModalOpen(false)}
        onOpenChange={setIsSocialShareModalOpen}
        fileUrl=""
        onComplete={() => {}}
        platform={SocialPlatform.Twitter}
      />
      </div>

      {/* Unified Side Panel (Context + Analysis) for Split-Screen Mode - Hidden in embed mode.
          On narrow screens, we only mount this when the user expands from the mini player. */}
      {!isEmbedMode && searchMode === 'podcast-search' && searchViewStyle === SearchViewStyle.SPLIT_SCREEN && isDecelerationComplete && (!isNarrowLayout || isNarrowInfoExpanded) && (
        <UnifiedSidePanel
          layoutMode={isNarrowLayout ? 'bottom' : 'side'}
          defaultSheetMode={isNarrowLayout ? 'full' : 'peek'}
          onRequestCollapseToMiniPlayer={
            isNarrowLayout ? () => setIsNarrowInfoExpanded(false) : undefined
          }
          paragraphId={selectedParagraphId}
          isContextOpen={isContextPanelOpen}
          onCloseContext={() => setIsContextPanelOpen(false)}
          smartInterpolation={true}
          auth={authConfig || undefined}
          audioUrl={selectedAudioContext?.audioUrl}
          episodeTitle={selectedAudioContext?.episode}
          episodeImage={selectedAudioContext?.episodeImage}
          creator={selectedAudioContext?.creator}
          listenLink={selectedAudioContext?.listenLink}
          timeContext={selectedAudioContext?.timeContext}
          date={selectedAudioContext?.date}
          autoPlayOnOpen={autoPlayContextOnOpen}
          isAnalysisOpen={isAnalysisPanelOpen}
          onCloseAnalysis={() => setIsAnalysisPanelOpen(false)}
          isSessionsOpen={isSessionsPanelOpen}
          onCloseSessions={() => setIsSessionsPanelOpen(false)}
          onOpenSession={handleOpenSessionFromHistory}
          onWidthChange={isNarrowLayout ? () => setContextPanelWidth(0) : setContextPanelWidth}
          onTimestampClick={(timestamp) => {
            printLog(`Context panel timestamp clicked: ${timestamp}`);
            window.dispatchEvent(new CustomEvent('seekToTimestamp', { 
              detail: { 
                paragraphId: selectedParagraphId, 
                timestamp 
              } 
            }));
          }}
          onKeywordSearch={async (keyword, feedId, guid, forceSearchAll = false) => {
            printLog(`Keyword search triggered: keyword="${keyword}", feedId="${feedId}", guid="${guid}", forceSearchAll="${forceSearchAll}"`);
            printLog(`Current resultViewStyle: ${resultViewStyle}, searchViewStyle: ${searchViewStyle}`);
            resetContextPanelState();
            setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
            
            // Set the query and trigger search
            setQuery(keyword);
            
            // Trigger search based on view style
            setGridFadeOut(true);
            setSearchState(prev => ({ ...prev, isLoading: true }));
            setIsDecelerationComplete(false);

            // Override rules:
            // - Search this episode: guid only (ignore all other filters)
            // - Search this feed: feedId only (ignore all other filters)
            // - Search all feeds: no filters at all (ignore all other filters)
            const override: KeywordSearchOverride | undefined = forceSearchAll
              ? { scope: 'all' }
              : guid
                ? { scope: 'episode', guid }
                : feedId
                  ? { scope: 'feed', feedId }
                  : undefined;
            
            if (resultViewStyle === SearchResultViewStyle.GALAXY) {
              await performQuoteSearch3D(keyword, override);
            } else {
              await performQuoteSearch(keyword, override);
            }
          }}
          // Used by AI Analysis: "Current Search" mode (what's on screen right now)
          currentSearchResults={
            resultViewStyle === SearchResultViewStyle.GALAXY
              ? galaxyResults
              : ([...conversation]
                  .reverse()
                  .find(item => item.type === 'podcast-search')?.data?.quotes || [])
          }
          // Used by Context panel: add/remove the current paragraph to research
          researchSessionShareLinks={researchSessionItems.map(item => item.shareLink)}
          onAddToResearch={handleAddToResearchSession}
          onRemoveFromResearch={handleRemoveFromResearchSession}
          onPreviousTrack={
            selectedAudioContext && currentResultIndex > 0 ? () => {
              const prevIndex = currentResultIndex - 1;
              const prevResult = galaxyResults[prevIndex];
              if (!prevResult) return;
              printLog(`[Navigation] Moving to previous result at index ${prevIndex}`);
              setCurrentResultIndex(prevIndex);
              setSelectedParagraphId(prevResult.shareLink);
              setSelectedAudioContext({
                audioUrl: prevResult.audioUrl,
                timeContext: {
                  start_time: prevResult.timeContext?.start_time ?? 0,
                  end_time: prevResult.timeContext?.end_time ?? 0,
                },
                episode: prevResult.episode,
                episodeImage: prevResult.episodeImage || '',
                creator: prevResult.creator,
                listenLink: prevResult.listenLink,
                date: prevResult.date,
                quote: prevResult.quote,
                summary: prevResult.summary,
                headline: prevResult.headline,
                hierarchyLevel: prevResult.hierarchyLevel,
                shareLink: prevResult.shareLink,
              });

              // Always auto-play when user explicitly navigates tracks from the player UI.
              if (prevResult.audioUrl) {
                window.dispatchEvent(
                  new CustomEvent('playAudioTrack', {
                    detail: {
                      id: prevResult.shareLink,
                      audioUrl: prevResult.audioUrl,
                      startTime: prevResult.timeContext?.start_time ?? 0,
                      endTime: prevResult.timeContext?.end_time,
                    },
                  }),
                );
              }
            } : undefined
          }
          onNextTrack={
            selectedAudioContext && currentResultIndex < galaxyResults.length - 1 ? () => {
              const nextIndex = currentResultIndex + 1;
              const nextResult = galaxyResults[nextIndex];
              if (!nextResult) return;
              printLog(`[Navigation] Moving to next result at index ${nextIndex}`);
              setCurrentResultIndex(nextIndex);
              setSelectedParagraphId(nextResult.shareLink);
              setSelectedAudioContext({
                audioUrl: nextResult.audioUrl,
                timeContext: {
                  start_time: nextResult.timeContext?.start_time ?? 0,
                  end_time: nextResult.timeContext?.end_time ?? 0,
                },
                episode: nextResult.episode,
                episodeImage: nextResult.episodeImage || '',
                creator: nextResult.creator,
                listenLink: nextResult.listenLink,
                date: nextResult.date,
                quote: nextResult.quote,
                summary: nextResult.summary,
                headline: nextResult.headline,
                hierarchyLevel: nextResult.hierarchyLevel,
                shareLink: nextResult.shareLink,
              });

              if (nextResult.audioUrl) {
                window.dispatchEvent(
                  new CustomEvent('playAudioTrack', {
                    detail: {
                      id: nextResult.shareLink,
                      audioUrl: nextResult.audioUrl,
                      startTime: nextResult.timeContext?.start_time ?? 0,
                      endTime: nextResult.timeContext?.end_time,
                    },
                  }),
                );
              }
            } : undefined
          }
        />
      )}
    </div>
    </AudioControllerProvider>
  );
}
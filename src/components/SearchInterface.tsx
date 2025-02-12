import { performSearch } from '../lib/searxng.ts';
import { fetchClipById, checkClipStatus } from '../services/clipService.ts';
import { useSearchParams } from 'react-router-dom'; 
import { RequestAuthMethod, AuthConfig } from '../constants/constants.ts';
import { handleQuoteSearch } from '../services/podcastService.ts';
import { ConversationItem } from '../types/conversation.ts';
import React, { useState, useEffect, useRef} from 'react';
import { ModelSettingsBar } from './ModelSettingsBar.tsx';
import { DepthModeCard, ExpertModeCard } from './ModeCards.tsx';
import { RegisterModal } from './RegisterModal.tsx';
import {SignInModal} from './SignInModal.tsx'
import LightningService from '../services/lightning.ts'
import { useInvoicePool } from '../hooks/useInvoicePool.ts';
import { Invoice } from '../types/invoice.ts';
import {ClipProgress, ClipStatus, ClipRequest} from '../types/clips.ts'
import { checkFreeTierEligibility } from '../services/freeTierEligibility.ts';
import { useJamieAuth } from '../hooks/useJamieAuth.ts';
import {AccountButton} from './AccountButton.tsx'
import {CheckoutModal} from './CheckoutModal.tsx'
import { QuickModeItem } from '../types/conversation.ts';
import { ConversationRenderer } from './conversation/ConversationRenderer.tsx';
import { DEBUG_MODE,printLog } from '../constants/constants.ts';
import QuickTopicGrid from './QuickTopicGrid.tsx';
import AvailableSourcesSection from './AvailableSourcesSection.tsx';
import PodcastLoadingPlaceholder from './PodcastLoadingPlaceholder.tsx';
import ClipTrackerModal from './ClipTrackerModal.tsx';


export type SearchMode = 'quick' | 'depth' | 'expert' | 'podcast-search';
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

interface SearchInterfaceProps {
  isSharePage?: boolean;
}

interface SubscriptionSuccessPopupProps {
  onClose: () => void;
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

const SubscriptionSuccessPopup = ({ onClose }: SubscriptionSuccessPopupProps) => (
  <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-lg font-bold mb-4">
        Your subscription was successful!
      </h2>
      <p className="text-gray-400 mb-4">
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



export default function SearchInterface({ isSharePage = false }: SearchInterfaceProps) {  
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('claude-3-sonnet' as ModelType);
  const [searchMode, setSearchMode] = useState(
    isSharePage ? 'podcast-search' as SearchMode : 'podcast-search' as SearchMode
  );
  const [searchParams] = useSearchParams(); 
  const clipId = searchParams.get('clip');
  const [clipProgress, setClipProgress] = useState<ClipProgress | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    // Parse the searchMode parameter from the URL
    const mode = searchParams.get('searchMode') as SearchMode;
    if (mode && ['quick', 'depth', 'expert', 'podcast-search'].includes(mode)) {
      setSearchMode(mode);
    }
  }, [searchParams]);

  const [selectedSources, setSelectedSources] = useState(new Set());
  const [gridFadeOut, setGridFadeOut] = useState(false);
  const [searchHistory, setSearchHistory] = useState({
    'quick': false,
    'depth': false,
    'expert': false,
    'podcast-search': isSharePage
  });
  const hasSearchedInMode = (mode: SearchMode): boolean => {
    if (!searchHistory[mode]) return false;
    return searchHistory[mode];
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
  

  const [searchState, setSearchState] = useState({
    query: '',
    result: '',
    isLoading: isSharePage && !!clipId,
    error: null,
    sources: []
  });

  const searchInputRef = useRef(null);
  const cleanupIntervalRef = useRef();
  const resultTextRef = useRef('');
  const eventSourceRef = useRef(null);
  const nextConversationId = useRef(0);
  const searchSettingsBarStyle = "bg-[#000000] border-gray-800 border shadow-white-glow rounded-lg mt-2 pt-2 pb-1 max-w-3xl pr-1 mx-auto px-4 flex items-start relative"
  const searchButtonStyle = "ml-auto mt-1 mr-1 pl-3 pr-3 bg-white rounded-lg pt-1 pb-1 border-gray-800 hover:border-gray-700"

  //Lightning related
  const [isLightningInitialized, setIsLightningInitialized] = useState(false);
  const paymentInProgressRef = useRef(false);
  const { 
    invoicePool, 
    isLoading: isLoadingInvoices, 
    markInvoicePaid, 
    markInvoiceUsed,
    markInvoiceFailed,
    getNextUnpaidInvoice ,
    cleanupExpiredInvoices,
    refreshPool
  } = useInvoicePool();

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
    setRequestAuthMethod(RequestAuthMethod.FREE);
  };

  const refreshEmptyPool = () => {
    const existingPool = localStorage.getItem("invoice_pool");
    if(!existingPool || existingPool === '[]'){
      refreshPool();
    }
  }

  const initializeLightning = async () => {
    const success = await LightningService.initialize();
    setIsLightningInitialized(success);
    setRequestAuthMethod(RequestAuthMethod.LIGHTNING);
    refreshEmptyPool();
  };

  const payInvoice = async (bolt11: string) => {
    if (!isLightningInitialized) {
      throw new Error('Lightning not initialized');
    }
  
    if (!bolt11) {
      throw new Error('Invalid invoice: missing bolt11');
    }
  
    printLog(`Starting payment with bolt11:${bolt11}`);

    const existingInvoice = invoicePool.find((inv) => inv.pr === bolt11);
    if (existingInvoice && existingInvoice.preimage) {
      printLog(`Invoice already paid. Returning preimage: ${existingInvoice.preimage}`);
      return existingInvoice.preimage;
    }
  
    try {
      printLog('Calling LightningService.payInvoice...');
      const preimage = await LightningService.payInvoice(bolt11);
      printLog(`Payment successful! Preimage:${preimage}`);
  
      // Find the invoice in the pool and mark it as paid
      const paidInvoice = invoicePool.find((inv) => inv.pr === bolt11);
      printLog(`Found paid invoice in pool:${paidInvoice}`);
  
      if (paidInvoice && paidInvoice.paymentHash) {
        markInvoicePaid(paidInvoice.paymentHash, preimage);
      } else {
        throw new Error('Invoice found but paymentHash is missing');
      }
  
      return preimage;
    } catch (error) {
      console.error('Payment failed:', error);
  
      // Mark the invoice as failed and move to the next one
      const failedInvoice = invoicePool.find((inv) => inv.pr === bolt11);
      if (failedInvoice?.paymentHash) {
        markInvoiceFailed(failedInvoice.paymentHash);
      }
  
      // Try the next unpaid invoice
      const nextInvoice = getNextUnpaidInvoice();
      if (nextInvoice?.pr) {
        printLog('Retrying with next unpaid invoice...');
        return await payInvoice(nextInvoice.pr);
      } else {
        throw new Error('No unpaid invoices available after payment failure');
      }
    }
  };
  

  const handleInvoicePayment = async (invoice: Invoice) => {
    if (paymentInProgressRef.current) {
      printLog('Payment already in progress, skipping...');
      return null;
    }
  
    // Check if this invoice has already been paid
    if (invoice.paid) {
      printLog('Invoice already paid, skipping...');
      return null;
    }
  
    try {
      paymentInProgressRef.current = true;
      const preimage = await payInvoice(invoice.pr);
      return preimage;
    } catch (error) {
      console.error('Payment failed:', error);
      return null;
    } finally {
      paymentInProgressRef.current = false;
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

  const handleClipProgress = (progress: ClipProgress) => {
    if (!progress) return; // Prevent undefined errors

    // Ensure timeContext exists
    if (!progress.timestamps || progress.timestamps.length !== 2) {
        console.error("Invalid clip timestamps received:", progress);
        return;
    }

    const [start_time, end_time] = progress.timestamps;

    const updatedProgress: ClipProgress = {
        ...progress,
        lookupHash: progress.lookupHash || progress.pollUrl || '', // Ensure lookupHash exists
        timestamps: [start_time, end_time] // Ensure valid timestamps
    };

    setClipProgress(updatedProgress);
    setIsClipTrackerCollapsed(false);

    if (updatedProgress.pollUrl && updatedProgress.isProcessing) {
        if (pollInterval.current) {
            clearTimeout(pollInterval.current);
            pollInterval.current = null;
        }

        let currentDelay = defaultBackoff.initialDelay;
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            try {
                const status = await checkClipStatus(updatedProgress.pollUrl!);
                
                if (status.status === "completed" && status.url) {
                    setClipProgress(prev => prev && {
                        ...prev,
                        isProcessing: false,
                        cdnLink: status.url
                    });

                    return;
                }

                currentDelay = Math.min(
                    currentDelay * defaultBackoff.factor,
                    defaultBackoff.maxDelay
                );

                timeoutId = setTimeout(poll, currentDelay);
            } catch (error) {
                console.error('Error polling clip status:', error);
                timeoutId = setTimeout(poll, currentDelay);
            }
        };

        timeoutId = setTimeout(poll, currentDelay);
        pollInterval.current = timeoutId;

        setTimeout(() => {
            if (pollInterval.current) {
                clearTimeout(pollInterval.current);
                pollInterval.current = null;
            }
        }, 5 * 60 * 1000);
    }
};

  


  const getAuth = async () => {
    let auth: AuthConfig;
    if (isLightningInitialized && requestAuthMethod === RequestAuthMethod.LIGHTNING) {
      // Look for a paid but unused invoice
      let paidInvoice = invoicePool.find(inv => inv.paid && !inv.usedAt && inv.preimage);
      if (!paidInvoice?.preimage || !paidInvoice?.paymentHash) {
        // No paid invoice - trigger refresh and wait briefly
        await refreshPool();
        // Small delay to allow new invoices to arrive
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try again after refresh
        const retryInvoice = invoicePool.find(inv => inv.paid && !inv.usedAt && inv.preimage);
        if (!retryInvoice?.preimage || !retryInvoice?.paymentHash) {
          setSearchState(prev => ({
            ...prev,
            error: new Error('Payment required'),
            isLoading: false
          }));
          return;
        }
        paidInvoice = retryInvoice;
      }
      
      auth = {
        type: RequestAuthMethod.LIGHTNING,
        credentials: {
          preimage: paidInvoice.preimage,
          paymentHash: paidInvoice.paymentHash
        }
      };

      markInvoiceUsed(paidInvoice.paymentHash);
      
      // Fire off next payment asynchronously
      const futureInvoice = getNextUnpaidInvoice();
      if (!futureInvoice) {
        // No unpaid invoice available - trigger refresh
        refreshPool().catch(error => {
          console.error('Failed to refresh invoice pool:', error);
        });
      } else if (!futureInvoice.paid) {
        handleInvoicePayment(futureInvoice)
          .catch(error => {
            console.error('Failed to pre-pay next invoice:', error);
          });
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
    }
    else{
      auth = { type: RequestAuthMethod.FREE, credentials:{} };
    }

    return auth as AuthConfig;
  }

  const handleStreamingSearch = async (overrideQuery?: string) => {
    const queryToUse = overrideQuery || query;
    if (!queryToUse.trim()) return;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      setSearchState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const auth = await getAuth() as AuthConfig;
  
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  
    const conversationId = nextConversationId.current++;
  
    setQuery("");
    
    setConversation(prev => [...prev, {
      id: conversationId,
      type: 'quick' as const,
      query: queryToUse, // Note: changed from query to queryToUse
      timestamp: new Date(),
      isStreaming: true,
      data: {
        result: '',
        sources: []
      }
    } as QuickModeItem]);
  
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
                      if (item.id === conversationId && item.type === 'quick') {
                        return {
                          ...item,
                          data: {
                            ...item.data,
                            sources
                          }
                        } as QuickModeItem;
                      }
                      return item;
                    })
                  );
                  break;
                
                case 'inference':
                  resultTextRef.current += parsed.data;
                  setConversation(prev => 
                    prev.map(item => {
                      if (item.id === conversationId && item.type === 'quick') {
                        return {
                          ...item,
                          data: {
                            ...item.data,
                            result: resultTextRef.current
                          }
                        } as QuickModeItem;
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
    setSearchState(prev => ({ ...prev, isLoading: true }));
    setSearchHistory(prev => ({...prev, [searchMode]: true}));
    const selectedFeedIds = Array.from(selectedSources) as string[]
    printLog(`selectedSources:${JSON.stringify(selectedFeedIds,null,2)}`);

    const auth = await getAuth() as AuthConfig;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      setSearchState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    printLog(`Request auth method:${requestAuthMethod}`)
    const quoteResults = await handleQuoteSearch(query, auth, selectedFeedIds);
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
    setSearchState(prev => ({ ...prev, isLoading: false }));
  }

  const handleSearch = async (e: { preventDefault: () => void; target: HTMLFormElement }) => {
    e.preventDefault();
    if (searchMode === 'podcast-search') {
      try {
        setGridFadeOut(true);
        setConversation(prev => prev.filter(item => item.type !== 'podcast-search'));
        performQuoteSearch();
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
    }
    else{
      await handleStreamingSearch();
    }
  };

  const updateAuthMethodAndRegisterModalStatus = async () => {
    if (localStorage.getItem('bc:config')) {
      setRequestAuthMethod(RequestAuthMethod.LIGHTNING);
      setTimeout(refreshEmptyPool,1000);
      return;
    } else if (localStorage.getItem('squareId')) {
      setRequestAuthMethod(RequestAuthMethod.SQUARE);
      const email = localStorage.getItem('squareId') as string;
      const success = await registerSubscription(email);
      printLog(`Registration result:${success}`);
      return;
    } else {
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

  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

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
    const checkInvoices = async () => {
      const needsRefresh = await cleanupExpiredInvoices();
      if (needsRefresh) {
        const nextInvoice = getNextUnpaidInvoice();
        if (nextInvoice?.pr && !nextInvoice.paid) {
          await handleInvoicePayment(nextInvoice);
        }
      }
    };
  
    if (!cleanupIntervalRef.current) {
      cleanupIntervalRef.current = setInterval(checkInvoices, 5000);
    }
  
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = undefined;
      }
    };
  }, [cleanupExpiredInvoices, getNextUnpaidInvoice, handleInvoicePayment]);
  
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
    if(!isLightningInitialized && localStorage.getItem('bc:config')){
      printLog('Initializing lightning from stored config...');
      initializeLightning();
    } else {
      printLog(`Not initializing lightning:${{
        isLightningInitialized,
        hasConfig: !!localStorage.getItem('bc:config')
      }}`);
    }
    return () => {
    };
  }, []);

  useEffect(() => {
    const ensurePaidInvoice = async () => {
      if (!isLightningInitialized) return;
      
      // Check if we have any paid invoices
      const hasPaidInvoice = invoicePool.some(inv => inv.paid && !inv.usedAt);
      
      if (!hasPaidInvoice) {
        printLog('No paid invoices found, preparing initial invoice...');
        const nextInvoice = getNextUnpaidInvoice();
        if (nextInvoice?.pr && !nextInvoice.paid) {
          try {
            await handleInvoicePayment(nextInvoice);
          } catch (error) {
            console.error('Failed to prepare initial invoice:', error);
            // Retry after a delay if first attempt fails
            setTimeout(ensurePaidInvoice, 2000);
          }
        }
      }
    };

    ensurePaidInvoice();
  }, [isLightningInitialized, invoicePool]);

// Remove the other payment-related effects

  useEffect(() => {
    const prepareInitialInvoice = async () => {
      if (!isLightningInitialized) return;
      
      // Check if we have any paid invoices
      const hasPaidInvoice = invoicePool.some(inv => inv.paid && !inv.usedAt);
      
      if (!hasPaidInvoice) {
        printLog('No paid invoices found, preparing initial invoice...');
        const nextInvoice = getNextUnpaidInvoice();
        if (nextInvoice?.pr && !nextInvoice.paid) {
          try {
            await handleInvoicePayment(nextInvoice);
          } catch (error) {
            console.error('Failed to prepare initial invoice:', error);
          }
        }
      }
    };
  
    prepareInitialInvoice();
  }, [isLightningInitialized]);
  

  useEffect(() => {
    printLog(`model:${model}`)
  }, [model]);


  return (
    <div className="min-h-screen bg-black text-white relative pb-0.5">
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setRequestAuthMethod(RequestAuthMethod.SQUARE); // or other appropriate method
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          // Any additional success handling
        }}
        onSignUpSuccess={()=>{
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          handleUpgrade();
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

      {!isRegisterModalOpen && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
          <AccountButton 
            onConnect={() => initializeLightning()}
            onSignInClick={() => setIsSignInModalOpen(true)}
            onUpgradeClick={handleUpgrade}
            onSignOut={handleSignOut}
            isSignedIn={isUserSignedIn}
          />
        </div>
      )}
      { DEBUG_MODE &&
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
      }
      <br></br>
      <div className={`${hasSearchedInMode(searchMode) ? 'mb-8' : ''} ml-4 mr-4`}>
        {/* Header with Logo */}
        <div className={`flex justify-center items-center py-8 ${!hasSearchedInMode(searchMode) && 'mt-8'}`}>
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
                {searchMode === 'quick' ? 'Instantly pull up anything with private web search + AI.' : ''}
                {searchMode === 'podcast-search' ? 'Search podcasts and clip them instantly.' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Search Modes - Now shown when hasSearched is true */}
        {(hasSearchedInMode(searchMode) || searchMode !== "quick") && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-[#111111]">
              {[
                { mode: 'quick', emoji: '⚡', label: 'Quick Mode' },
                { mode: 'podcast-search', emoji: '🎙️', label: 'Podcast Search (Beta)' },
                { mode: 'expert', emoji: '🔮', label: 'Expert Mode' }
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

        {hasSearchedInMode(searchMode) && searchMode === 'podcast-search' && 
          <AvailableSourcesSection 
            hasSearched={hasSearchedInMode(searchMode)} 
            selectedSources={selectedSources} 
            setSelectedSources={setSelectedSources} 
            /> 
          }

        {/* Initial Search Form */}
        <div className="max-w-3xl mx-auto px-4">
          {!hasSearchedInMode(searchMode) && (searchMode === "quick" || searchMode === 'podcast-search') && (
            <form onSubmit={handleSearch} className="relative">
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'podcast-search' ? `Search Thousands of Podcast Clips` : `How Can I Help You Today?`}
              className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 pl-4 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-white-glow resize-auto min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              // disabled={searchMode !== "quick"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e);
                }
              }}
            />
            <div className={searchSettingsBarStyle}>
              <ModelSettingsBar
                model={model}
                setModel={setModel}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
              />
              <button
                type="submit"
                className={searchButtonStyle}
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
          </form>
          )}
          {/* Suggested Queries */}
          {!hasSearchedInMode(searchMode) && searchMode === "quick" && (
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
      {conversation.length > 0 && (searchMode !== 'expert') && (
      <div
        className={`max-w-4xl mx-auto px-4 space-y-8 ${
          searchMode === 'podcast-search' && conversation.length > 0
            ? 'mb-1 pb-1'
            : 'mb-24 pb-24'
        }`}
      >
        {conversation
          .filter(item => item.type === searchMode)
          .map((item) => (
            <ConversationRenderer 
              item={item} 
              clipProgress={clipProgress}
              onClipProgress={handleClipProgress}
            />
          ))}
      </div>
    )}

      {searchMode === 'podcast-search' && !hasSearchedInMode(searchMode) && (
        <div className={`mt-12 ${hasSearchedInMode(searchMode) ? 'mb-52' : 'mb-36'}`}>
          <QuickTopicGrid 
            className=""
            triggerFadeOut={gridFadeOut}
            onTopicSelect={async (topicQuery) => {
              setQuery(topicQuery);
              // Instead of relying on the state update, use the topicQuery directly
              try {
                const auth = await getAuth() as AuthConfig;
                if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
                  setIsRegisterModalOpen(true);
                  setSearchState(prev => ({ ...prev, isLoading: false }));
                  return;
                }
                setSearchState(prev => ({ ...prev, isLoading: true, data: {quotes:[]} }));
                setSearchHistory(prev => ({...prev, [searchMode]: true}));
                const selectedFeedIds = Array.from(selectedSources) as string[]
                printLog(`selectedSources:${JSON.stringify(selectedFeedIds,null,2)}`);
                handleQuoteSearch(topicQuery,auth,selectedFeedIds).then(quoteResults => {
                  if(quoteResults === false){
                    setIsRegisterModalOpen();
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
          {
            <AvailableSourcesSection 
              hasSearched={hasSearchedInMode(searchMode)} 
              selectedSources={selectedSources} 
              setSelectedSources={setSelectedSources} 
          />}
        </div>
      )}

      {searchMode === 'podcast-search' && searchState.isLoading && (
        <PodcastLoadingPlaceholder />
      )}

      {searchMode === 'podcast-search' && (
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
          />
        </div>
      )}



      {/* Floating Search Bar - Only show after first search */}
      {hasSearchedInMode(searchMode) && (searchMode === "quick" || searchMode === 'podcast-search') && !isRegisterModalOpen && !isSignInModalOpen && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 w-full max-w-[40rem] px-4 z-50">
          <form onSubmit={handleSearch} className="relative">
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'podcast-search' ? `Search Thousands of Podcast Clips` : `How Can I Help You Today?`}
              className="w-full bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow px-4 py-3 pl-4 pr-32 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg resize-none min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              // disabled={searchMode === "quick"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e);
                }
              }}
            />
            <div className={searchSettingsBarStyle}>
              <ModelSettingsBar
                model={model}
                setModel={setModel}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                dropUp={true}
              />
              <button
                type="submit"
                className={searchButtonStyle}
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
          </form>
        </div>
      )}
      {searchMode === 'depth' && <DepthModeCard />}
      {searchMode === 'expert' && <ExpertModeCard />}

      {/* Error Display */}
      {searchState.error && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4">
          <div className="bg-red-900/50 border border-red-800 text-red-200 rounded-lg p-4">
            {searchState.error.message}
          </div>
        </div>
      )}
    </div>
  );
}
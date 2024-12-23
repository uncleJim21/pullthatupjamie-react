

import { performSearch, AuthConfig, RequestAuthMethod } from '../lib/searxng.ts';
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceTile } from './SourceTile.tsx';
import { ModelSettingsBar } from './ModelSettingsBar.tsx';
import { DepthModeCard, ExpertModeCard } from './ModeCards.tsx';
import { RegisterModal } from './RegisterModal.tsx';
import {SignInModal} from './SignInModal.tsx'
import LightningService from '../services/lightning.ts'
import { useInvoicePool } from '../hooks/useInvoicePool.ts';
import { Invoice } from '../types/invoice.ts';
import { checkFreeTierEligibility } from '../services/freeTierEligibility.ts';
import { useJamieAuth } from '../hooks/useJamieAuth.ts';
import {AccountButton} from './AccountButton.tsx'
import {CheckoutModal} from './CheckoutModal.tsx'
import { Check } from 'lucide-react';

const DEBUG_MODE = false;

export type SearchMode = 'quick' | 'depth' | 'expert';
let buffer = '';

interface Source {
  title: string;
  url: string;
  snippet?: string;
}

interface StreamingTextProps {
  text: string;
  isLoading: boolean;
}

const StreamingText: React.FC<StreamingTextProps> = ({ text, isLoading }) => {
  return (
    <div className="prose prose-invert max-w-none relative">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="text-white" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-4 my-4" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-4 my-4" />
          ),
          li: ({ node, children, ...props }) => (
            <li {...props} className="my-2">
              {React.Children.map(children, child => {
                if (React.isValidElement(child) && child.type === 'p') {
                  return child.props.children;
                }
                return child;
              })}
            </li>
          )
        }}
      >
        {text}
      </ReactMarkdown>
      {isLoading && (
        <span className="inline-block w-2 h-4 ml-1 bg-white animate-pulse" />
      )}
    </div>
  );
};

const SubscriptionSuccessPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => (
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


interface ConversationItem {
  id: number;
  query: string;
  result: string;
  sources: Source[];
  timestamp: Date;
  isStreaming: boolean;
}

interface SearchState {
  query: string;
  result: string;
  isLoading: boolean;
  error: Error | null;
  sources: Source[];
  activeConversationId?: number;
}

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

export default function SearchInterface() {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<'gpt-3.5-turbo' | 'claude-3-sonnet'>('claude-3-sonnet');
  const [searchMode, setSearchMode] = useState<SearchMode>('quick');
  const [hasSearched, setHasSearched] = useState(false);

  //Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isUpgradeSuccessPopUpOpen, setIsUpgradeSuccessPopUpOpen] = useState(false);


  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [requestAuthMethod, setRequestAuthMethod] = useState<RequestAuthMethod>(RequestAuthMethod.FREE); //free, lightning or square
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    result: '',
    isLoading: false,
    error: null,
    sources: []
  });

  const searchInputRef = useRef<HTMLTextAreaElement | null>(null);
  const resultTextRef = useRef<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const nextConversationId = useRef(0);
  const searchSettingsBarStyle = "bg-[#000000] border-gray-800 border shadow-white-glow rounded-lg mt-2 pt-2 pb-2 max-w-3xl pr-1 mx-auto px-4 flex items-start relative"
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
    refreshPool
  } = useInvoicePool();

  const { 
    registerSubscription, 
    isRegistering, 
    registrationError 
  } = useJamieAuth();

  const handleUpgrade = () => {
    console.log(`handleUpgrade`)
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
  
    console.log('Starting payment with bolt11:', bolt11);
  
    try {
      console.log('Calling LightningService.payInvoice...');
      const preimage = await LightningService.payInvoice(bolt11);
      console.log('Payment successful! Preimage:', preimage);
  
      // Find the invoice in the pool and mark it as paid
      const paidInvoice = invoicePool.find((inv) => inv.pr === bolt11);
      console.log('Found paid invoice in pool:', paidInvoice);
  
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
        console.log('Retrying with next unpaid invoice...');
        return await payInvoice(nextInvoice.pr);
      } else {
        throw new Error('No unpaid invoices available after payment failure');
      }
    }
  };
  

  const handleInvoicePayment = async (invoice: Invoice) => {
    if (paymentInProgressRef.current) {
      console.log('Payment already in progress, skipping...');
      return null;
    }
  
    // Check if this invoice has already been paid
    if (invoice.paid) {
      console.log('Invoice already paid, skipping...');
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

  const handleStreamingSearch = async (overrideQuery?: string) => {
    const queryToUse = overrideQuery || query;
    if (!queryToUse.trim()) return;
    if(requestAuthMethod === RequestAuthMethod.FREE_EXPENDED){
      setIsRegisterModalOpen(true);
      return;
    }

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
  
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  
    const conversationId = nextConversationId.current++;
  
    setQuery("");
    
    setConversation(prev => [...prev, {
      id: conversationId,
      query: queryToUse,  
      result: '',
      sources: [],
      timestamp: new Date(),
      isStreaming: true
    }]);
  
    setSearchState(prev => ({
      ...prev,
      isLoading: true,
      result: '',
      error: null,
      sources: [],
      activeConversationId: conversationId
    }));
  
    resultTextRef.current = '';
    setHasSearched(true);
  
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
                case 'search':
                  const sources = parsed.data.map((result: any) => ({
                    title: result.title,
                    url: result.url,
                    snippet: result.content || result.snippet || ''
                  }));
                  setConversation(prev => 
                    prev.map(item => 
                      item.id === conversationId 
                        ? { ...item, sources }
                        : item
                    )
                  );
                  break;
  
                case 'inference':
                  resultTextRef.current += parsed.data;
                  setConversation(prev => 
                    prev.map(item => 
                      item.id === conversationId 
                        ? { ...item, result: resultTextRef.current }
                        : item
                    )
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

    console.log(`post search check:${requestAuthMethod}`)
    if(requestAuthMethod === RequestAuthMethod.FREE){
      await updateAuthMethodAndRegisterModalStatus();
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStreamingSearch();
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
      console.log('Registration result:', success);
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
      console.log('Initializing lightning from stored config...');
      initializeLightning();
    } else {
      console.log('Not initializing lightning:', {
        isLightningInitialized,
        hasConfig: !!localStorage.getItem('bc:config')
      });
    }
    return () => {
      // Clean up any resources if needed
    };
  }, []);

  // This should be the only payment-related effect
  useEffect(() => {
    const ensurePaidInvoice = async () => {
      if (!isLightningInitialized) return;
      
      // Check if we have any paid invoices
      const hasPaidInvoice = invoicePool.some(inv => inv.paid && !inv.usedAt);
      
      if (!hasPaidInvoice) {
        console.log('No paid invoices found, preparing initial invoice...');
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
        console.log('No paid invoices found, preparing initial invoice...');
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
    console.log(`model:${model}`)
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
      {/* {isLightningInitialized && (
        <button
          onClick={async () => {
            const testInvoice = invoices[0]?.pr as string
            try {
              const preimage = await payInvoice(testInvoice);
              console.log('Test payment successful! Preimage:', preimage);
            } catch (error) {
              console.error('Test payment failed:', error);
            }
          }}
          className="px-4 py-2 bg-white text-black rounded hover:bg-gray-100"
        >
          Pay Test Invoice
        </button>
      )} */}
      { DEBUG_MODE &&
        (<button
        onClick={async () => {
          const email = localStorage.getItem('squareId');
          if (!email) {
            console.error('No squareId found in localStorage');
            return;
          }
          const success = await registerSubscription(email);
          console.log('Registration result:', success);
        }}
        className="px-4 py-2 bg-white text-black rounded hover:bg-gray-100"
      >
        Test Registration
      </button>)
      }
      <br></br>
      <div className={`${hasSearched ? 'mb-8' : ''} ml-4 mr-4`}>
        {/* Header with Logo */}
        <div className={`flex justify-center items-center py-8 ${!hasSearched && 'mt-8'}`}>
          <div className="flex items-center gap-4">
            <img
              src="/jamie-logo.png"
              alt="Jamie Logo"
              width={128}
              height={128}
              className={`${hasSearched ? 'w-16 h-16' : ''} w-128 h-128`}
            />
            <div>
              <h1 className="text-3xl font-bold">Pull That Up Jamie!</h1>
              <p className={`text-gray-400 text-md text-shadow-light-white ${hasSearched ? 'hidden' : ''}`}>
                Instantly pull up anything with private web search + AI.
              </p>
            </div>
          </div>
        </div>

        {/* Search Modes - Now shown when hasSearched is true */}
        {(hasSearched || searchMode !== "quick") && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg border border-gray-700 p-0.5 bg-[#111111]">
              {[
                { mode: 'quick', emoji: '⚡', label: 'Quick Mode' },
                // { mode: 'depth', emoji: '🤿', label: 'Depth Mode' },
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

        {/* Initial Search Form */}
        <div className="max-w-3xl mx-auto px-4">
          {!hasSearched && searchMode === "quick" && (
            <form onSubmit={handleSearch} className="relative">
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="How Can I Help You Today?"
              className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 pl-4 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-white-glow resize-auto min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              disabled={searchMode !== "quick"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStreamingSearch();
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
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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
          {!hasSearched && searchMode === "quick" && (
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
      {searchMode === 'quick' && conversation.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 space-y-8 mb-24 pb-24">
          {conversation.map((item) => (
            <div key={item.id} className="space-y-4">
              <div className="font-medium text-white-400 max-w-[75%] break-words">
                Query: {item.query}
              </div>
              <div style={{"borderBottom":"1px solid #353535"}}></div>
              {/* Sources for this specific query */}
              {item.sources.length > 0 && (
                <div className="relative">
                  <div className="overflow-x-auto pb-4">
                    <div className="flex space-x-4">
                      {item.sources.map((source, idx) => (
                        <div key={idx} style={{ minWidth: '300px' }}>
                          <SourceTile
                            title={source.title}
                            url={source.url}
                            index={idx + 1}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Only show left gradient if scrolled from start */}
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-5 bg-gradient-to-r from-black to-transparent opacity-0 transition-opacity duration-200" 
                      id={`left-gradient-${item.id}`} />
                  {/* Only show right gradient if there's more content to scroll */}
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-5 bg-gradient-to-l from-black to-transparent opacity-0 transition-opacity duration-200" 
                      id={`right-gradient-${item.id}`} />
                </div>
              )}

              {/* Answer with streaming effect */}
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                <StreamingText 
                  text={item.result} 
                  isLoading={item.isStreaming}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Search Bar - Only show after first search */}
      {hasSearched && searchMode === "quick" && !isRegisterModalOpen && !isSignInModalOpen && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4 z-50">
          <form onSubmit={handleSearch} className="relative">
            <textarea
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="How Can I Help You Today?"
              className="w-full bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow px-4 py-3 pl-4 pr-32 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg resize-none min-h-[50px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
              disabled={searchMode !== "quick"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStreamingSearch();
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
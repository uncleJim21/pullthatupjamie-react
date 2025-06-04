import React, { useState, useEffect } from 'react';
import { X, Loader2, Twitter, Sparkles, ChevronDown, ChevronUp, ChevronRight, Info, Save, Check } from 'lucide-react';
import { printLog, API_URL } from '../constants/constants.ts';
import { generateAssistContent, JamieAssistError } from '../services/jamieAssistService.ts';
import { twitterService } from '../services/twitterService.ts';
import AuthService from '../services/authService.ts';
import RegisterModal from './RegisterModal.tsx';

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

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  itemName?: string;
  onComplete: (success: boolean, platform: SocialPlatform) => void;
  platform: SocialPlatform; // Keep for backward compatibility but will be ignored
  renderUrl?: string; // URL to use in place of fileUrl for Twitter sharing
  lookupHash?: string; // Added lookupHash for Jamie Assist
  auth?: any; // Auth object for API calls
}

interface PlatformStatus {
  enabled: boolean;
  available: boolean;
  authenticated: boolean;
  publishing: boolean;
  success: boolean | null;
  error: string | null;
  username?: string;
}

const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  itemName = 'file',
  onComplete,
  platform,
  renderUrl,
  lookupHash,
  auth
}) => {
  const [content, setContent] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Platform status objects
  const [twitterStatus, setTwitterStatus] = useState<PlatformStatus>({
    enabled: true,
    available: true,
    authenticated: false,
    publishing: false,
    success: null,
    error: null,
    username: undefined
  });
  
  const [nostrStatus, setNostrStatus] = useState<PlatformStatus>({
    enabled: true,
    available: false,
    authenticated: false,
    publishing: false,
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

  // Function to check tokens endpoint (for initial check)
  const checkTokensEndpoint = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        printLog('No auth token found for tokens check');
        return false;
      }

      printLog(`Checking tokens at ${API_URL}/api/twitter/tokens`);
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
        printLog(`Tokens endpoint response: ${JSON.stringify(data)}`);
        
        // Show the main UI for any valid response from the endpoint
        // The authenticated status will be handled by the existing Twitter auth flow
        return true;
      } else {
        printLog(`Tokens endpoint returned ${response.status}`);
        return false;
      }
    } catch (error) {
      printLog(`Error checking tokens endpoint: ${error}`);
      return false;
    }
  };

  // Function to start polling tokens endpoint
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
            
            // Update Twitter auth state if this was a Twitter auth flow
            if (platform === SocialPlatform.Twitter) {
              setTwitterStatus({ ...twitterStatus, authenticated: true });
              if (data.twitterUsername) {
                setTwitterStatus({ ...twitterStatus, username: data.twitterUsername });
              }
            }
          } else {
            printLog(`Still waiting for authentication. Current status: authenticated=${data.authenticated}`);
          }
        } else {
          printLog(`Polling request failed with status ${response.status}`);
        }
      } catch (error) {
        printLog(`Error during token polling: ${error}`);
      }
    }, 3000); // Poll every 3 seconds
    
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

  // Initial token check when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialCheck = async () => {
        setIsCheckingTokens(true);
        try {
          const hasTokens = await checkTokensEndpoint();
          setHasValidTokens(hasTokens);
        } catch (error) {
          printLog(`Error during initial token check: ${error}`);
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

  // Function to save preferences to localStorage
  const saveJamieAssistPreferences = () => {
    try {
      localStorage.setItem('jamieAssistDefaults', additionalPrefs);
      setPrefsSuccessfullySaved(true);
      
      // Reset the success indicator after 2 seconds
      setTimeout(() => {
        setPrefsSuccessfullySaved(false);
      }, 2000);
      
      printLog('Jamie Assist preferences saved to localStorage');
    } catch (error) {
      console.error('Error saving Jamie Assist preferences:', error);
    }
  };
  
  // Function to load preferences from localStorage
  const loadJamieAssistPreferences = () => {
    try {
      const savedPrefs = localStorage.getItem('jamieAssistDefaults');
      if (savedPrefs) {
        setAdditionalPrefs(savedPrefs);
        printLog('Jamie Assist preferences loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading Jamie Assist preferences:', error);
    }
  };

  // Initialize content with default text and check for Nostr extension if needed
  useEffect(() => {
    // No default content, empty textarea with just placeholder
    setContent('');
    
    // Check both platforms
    checkNostrExtension();
    checkTwitterAuth();

    // Initialize relay status
    const initialStatus: {[key: string]: string} = {};
    relayPool.forEach(relay => {
      initialStatus[relay] = 'idle';
    });
    setPublishStatus(initialStatus);

    // Load any saved Jamie Assist preferences
    loadJamieAssistPreferences();

    return () => {
      // Clean up WebSocket connections when component unmounts
      Object.values(relayConnections).forEach(conn => {
        if (conn && conn.readyState === WebSocket.OPEN) {
          conn.close();
        }
      });
    };
  }, [fileUrl, itemName, isOpen]);

  // Effect to check for Nostr extension when modal opens
  useEffect(() => {
    if (isOpen) {
      checkNostrExtension();
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

  const checkNostrExtension = async () => {
    try {
      if (window.nostr) {
        setNostrStatus(prev => ({ ...prev, available: true }));
        try {
          const pubKey = await window.nostr.getPublicKey();
          setNostrStatus(prev => ({ ...prev, authenticated: true }));
          printLog(`Nostr extension found with public key: ${pubKey}`);
        } catch (keyError) {
          printLog("Nostr extension found but couldn't get public key");
          setNostrStatus(prev => ({ ...prev, authenticated: false }));
        }
      } else {
        setNostrStatus(prev => ({ ...prev, available: false, authenticated: false }));
      }
    } catch (error) {
      setNostrStatus(prev => ({ ...prev, available: false, authenticated: false }));
      console.error("Error checking for Nostr extension:", error);
    }
  };

  // Check Twitter authentication status
  const checkTwitterAuth = async () => {
    printLog('Checking Twitter auth status in SocialShareModal...');
    try {
      const status = await AuthService.checkTwitterStatus();
      printLog(`Twitter auth status: ${status.authenticated}`);
      setTwitterStatus(prev => ({ 
        ...prev, 
        authenticated: status.authenticated,
        available: true, // Always available for admin users
        username: status.authenticated ? status.twitterUsername : undefined
      }));
    } catch (error) {
      printLog(`Error checking Twitter status: ${error}`);
      setTwitterStatus(prev => ({ ...prev, authenticated: false }));
    }
  };

  // Updated connectTwitter function to start polling
  const connectTwitter = async () => {
    printLog('Connect Twitter button clicked in SocialShareModal');
    setTwitterStatus(prev => ({ ...prev, publishing: true }));
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
      setTwitterStatus(prev => ({ ...prev, publishing: false }));
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
    setTwitterStatus(prev => ({ ...prev, publishing: true }));
    try {
      const response = await twitterService.revoke(true);
      printLog(`Twitter disconnect response: ${JSON.stringify(response)}`);
      
      if (response.success) {
        setTwitterStatus(prev => ({ ...prev, authenticated: false, username: undefined }));
        setJamieAssistError(null);
        printLog('Twitter account disconnected successfully');
      } else {
        setJamieAssistError(response.message || 'Failed to disconnect Twitter account');
      }
    } catch (error) {
      printLog(`Error disconnecting Twitter: ${error}`);
      setJamieAssistError(error instanceof Error ? error.message : 'Failed to disconnect Twitter account');
    } finally {
      setTwitterStatus(prev => ({ ...prev, publishing: false }));
    }
  };

  // Initialize Twitter auth check when modal opens
  useEffect(() => {
    if (isOpen) {
      checkTwitterAuth();
    }
  }, [isOpen]);

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

  const publishToNostr = async (): Promise<boolean> => {
    if (!window.nostr) {
      console.error("No Nostr extension available");
      return false;
    }

    try {
      setNostrStatus(prev => ({ ...prev, publishing: true }));
      
      // Add the URL and attribution to the content text before sending
      const finalContent = `${content}\n\n${fileUrl}\n\nShared via https://pullthatupjamie.ai`;
      
      // Construct a new Nostr event (kind 1 - text note)
      const event = {
        kind: 1,
        content: finalContent,
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event using the extension
      const signedEvent = await window.nostr.signEvent(event);
      printLog(`Successfully signed Nostr event: ${JSON.stringify(signedEvent)}`);
      
      // Publish to all relays in the pool
      const publishPromises = relayPool.map(relay => 
        publishEventToRelay(relay, signedEvent)
      );
      
      // Wait for all publish attempts to complete
      const results = await Promise.allSettled(publishPromises);
      
      // If at least one relay published successfully, consider it a success
      const successCount = results.filter(
        result => result.status === 'fulfilled' && result.value === true
      ).length;
      
      printLog(`Published to ${successCount}/${relayPool.length} relays`);
      
      const success = successCount > 0;
      setNostrStatus(prev => ({ ...prev, publishing: false, success }));
      return success;
    } catch (error) {
      console.error("Error publishing to Nostr:", error);
      setNostrStatus(prev => ({ ...prev, publishing: false, success: false, error: error instanceof Error ? error.message : 'Failed to publish' }));
      return false;
    }
  };

  const publishToTwitter = async (): Promise<boolean> => {
    try {
      setTwitterStatus(prev => ({ ...prev, publishing: true }));
      
      // For Twitter, use the actual CDN URL (fileUrl) since Twitter servers need to access it
      // Only fall back to renderUrl if fileUrl is not available
      const mediaUrl = fileUrl || renderUrl;
      const isAdmin = AuthService.isAdmin();
      
      // If user is admin and authenticated with Twitter, use OAuth flow
      if (isAdmin && twitterStatus.authenticated) {
        printLog(`Posting tweet with content: "${content}" and mediaUrl: "${mediaUrl}"`);
        
        const response = await twitterService.postTweet(content, mediaUrl);
        printLog(`Twitter post response: ${JSON.stringify(response)}`);
        
        // Handle auth expiration
        if (response.error === 'TWITTER_AUTH_EXPIRED' && response.requiresReauth) {
          printLog('Twitter auth expired detected in SocialShareModal');
          setTwitterStatus(prev => ({ ...prev, authenticated: false, publishing: false, error: 'Authentication expired' }));
          return false;
        }
        
        if (response.success) {
          printLog('Tweet posted successfully');
          setTwitterStatus(prev => ({ ...prev, publishing: false, success: true }));
          return true;
        } else {
          setTwitterStatus(prev => ({ ...prev, publishing: false, success: false, error: response.message || response.error || 'Failed to post tweet' }));
          return false;
        }
      } else {
        // For non-admin users or unauthenticated admins, open Twitter web intent
        const tweetText = `${content}\n${mediaUrl}\n\nShared via https://pullthatupjamie.ai`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterUrl, '_blank');
        setTwitterStatus(prev => ({ ...prev, publishing: false, success: true }));
        return true;
      }
    } catch (error) {
      printLog(`Error posting tweet: ${error}`);
      setTwitterStatus(prev => ({ ...prev, publishing: false, success: false, error: error instanceof Error ? error.message : 'Failed to post tweet' }));
      return false;
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    
    const promises: Promise<boolean>[] = [];
    
    // Add Twitter publishing if enabled and available
    if (twitterStatus.enabled && twitterStatus.available) {
      promises.push(publishToTwitter());
    }
    
    // Add Nostr publishing if enabled and available
    if (nostrStatus.enabled && nostrStatus.available && nostrStatus.authenticated) {
      promises.push(publishToNostr());
    }
    
    if (promises.length === 0) {
      setIsPublishing(false);
      return;
    }
    
    try {
      // Publish to all enabled platforms in parallel
      const results = await Promise.allSettled(promises);
      
      // Check if any succeeded
      const anySuccess = results.some(result => 
        result.status === 'fulfilled' && result.value === true
      );
      
      setIsPublishing(false);
      
      if (anySuccess) {
        // Close modal after successful publishing
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Error during publishing:', error);
      setIsPublishing(false);
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

  // Function to handle content changes and track user edits
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Only mark as edited if there's actual content
    if (newContent.trim() !== '') {
      // Mark that user has edited content since last Jamie Assist call
      setUserEditedSinceLastAssist(true);
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
              <li>Use "Advanced Preferences" to specify tone or style</li>
              <li>Edit the generated text as needed before sharing</li>
            </ol>
            
            <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg mt-4 mb-4">
              <p className="text-gray-400 text-sm">
                <span className="text-amber-500">Tip:</span> The link to your clip and attribution will be added automatically when you publish.
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

  // Updated shareToTwitter function to use twitterService
  const shareToTwitter = async () => {
    try {
      setIsPublishing(true);
      
      // For Twitter, use the actual CDN URL (fileUrl) since Twitter servers need to access it
      // Only fall back to renderUrl if fileUrl is not available
      const mediaUrl = fileUrl || renderUrl;
      const isAdmin = AuthService.isAdmin();
      
      // If user is admin and authenticated with Twitter, use OAuth flow
      if (isAdmin && twitterStatus.authenticated) {
        printLog(`Posting tweet with content: "${content}" and mediaUrl: "${mediaUrl}"`);
        printLog(`Available URLs - fileUrl: "${fileUrl}", renderUrl: "${renderUrl}"`);
        
        const response = await twitterService.postTweet(content, mediaUrl);
        printLog(`Twitter post response: ${JSON.stringify(response)}`);
        
        // Handle auth expiration
        if (response.error === 'TWITTER_AUTH_EXPIRED' && response.requiresReauth) {
          printLog('Twitter auth expired detected in SocialShareModal');
          setTwitterStatus(prev => ({ ...prev, authenticated: false }));
          setJamieAssistError('Twitter authentication expired. Please reconnect your account.');
          setIsPublishing(false);
          return;
        }
        
        if (response.success) {
          printLog('Tweet posted successfully');
          onComplete(true, SocialPlatform.Twitter);
          onClose();
        } else {
          setJamieAssistError(response.message || response.error || 'Failed to post tweet');
        }
      } else {
        // For non-admin users or unauthenticated admins, open Twitter web intent
        const tweetText = `${content}\n${mediaUrl}\n\nShared via https://pullthatupjamie.ai`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterUrl, '_blank');
        onComplete(true, SocialPlatform.Twitter);
        onClose();
      }
    } catch (error) {
      printLog(`Error posting tweet: ${error}`);
      setJamieAssistError(error instanceof Error ? error.message : 'Failed to post tweet');
    } finally {
      setIsPublishing(false);
    }
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
    if (!hasValidTokens && !auth) {
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
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">
          Share to Twitter/Nostr
        </h2>
        
        <div className="flex items-center mb-3 sm:mb-4 px-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-800 mr-2 sm:mr-3 flex items-center justify-center overflow-hidden">
            <img src="/twitter-nostr-crosspost.png" alt="Twitter and Nostr" className="w-8 h-8 object-cover" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium">Your Post</p>
          </div>
        </div>
        
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl p-3 sm:p-4 mb-1 text-base focus:border-gray-500 focus:outline-none"
          placeholder={`Write about this ${itemName}...`}
          style={{ resize: "none", height: "120px", minHeight: "100px" }}
        />
        
        <div className="text-gray-400 text-xs mb-2 sm:mb-3 text-left pl-1">
          The link to your {itemName} and attribution will be added automatically when you publish.
        </div>
        
        {/* Platform Selection with Checkboxes */}
        <div className="mb-6">
          <div className="space-y-3">
            {/* Twitter Platform */}
            <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <Twitter className="w-6 h-6 text-blue-400" />
                <div className="flex-1">
                  {isAdmin && twitterStatus.authenticated ? (
                    <p className="text-white text-sm">Signed in as @{twitterStatus.username}</p>
                  ) : (
                    <p className="text-white text-sm">
                      {isAdmin ? 'Connect to post directly' : 'Web sharing available'}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    {twitterStatus.authenticated ? (
                      <button
                        onClick={disconnectTwitter}
                        disabled={twitterStatus.publishing}
                        className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                      >
                        {twitterStatus.publishing ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={connectTwitter}
                        disabled={twitterStatus.publishing}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                      >
                        {twitterStatus.publishing ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-2">
                {twitterStatus.publishing && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                {twitterStatus.success === true && <Check className="w-4 h-4 text-green-500" />}
                {twitterStatus.success === false && <X className="w-4 h-4 text-red-500" />}
                <input
                  type="checkbox"
                  checked={twitterStatus.enabled}
                  onChange={(e) => setTwitterStatus(prev => ({ ...prev, enabled: e.target.checked }))}
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
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
                />
                <div className="flex-1">
                  {nostrStatus.available && nostrStatus.authenticated ? (
                    <p className="text-white text-sm">Extension connected</p>
                  ) : nostrStatus.available ? (
                    <p className="text-white text-sm">Connect NIP07 Extension to Post on Nostr</p>
                  ) : (
                    <p className="text-white text-sm">Install Nostr Extension</p>
                  )}
                </div>
                {nostrStatus.available && !nostrStatus.authenticated && (
                  <button
                    onClick={checkNostrExtension}
                    disabled={nostrStatus.publishing}
                    className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
                  >
                    Connect
                  </button>
                )}
                {!nostrStatus.available && (
                  <div className="text-xs text-gray-400">
                    <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get Alby</a>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-2">
                {nostrStatus.publishing && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                {nostrStatus.success === true && <Check className="w-4 h-4 text-green-500" />}
                {nostrStatus.success === false && <X className="w-4 h-4 text-red-500" />}
                <input
                  type="checkbox"
                  checked={nostrStatus.enabled && nostrStatus.available && nostrStatus.authenticated}
                  onChange={(e) => setNostrStatus(prev => ({ ...prev, enabled: e.target.checked }))}
                  disabled={!nostrStatus.available || !nostrStatus.authenticated}
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
            Advanced Preferences {showAdvancedPrefs ? <ChevronUp className="ml-1 w-4 h-4" /> : <ChevronRight className="ml-1 w-4 h-4" />}
          </button>
          
          {showAdvancedPrefs && (
            <div className="border border-gray-800 rounded-lg p-2 sm:p-3 bg-gray-900 mb-2 sm:mb-3">
              <label className="block text-sm text-gray-300 mb-1 text-left">
                Specify tone, style or preferred hashtags:
              </label>
              <textarea
                value={additionalPrefs}
                onChange={(e) => setAdditionalPrefs(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-2 sm:p-3 text-sm mb-2 sm:mb-3"
                placeholder="E.g.: Professional tone, include hashtags #podcast #JRE"
                rows={1}
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
        
        {/* Publishing status for enabled platforms */}
        {isPublishing && (
          <div className="mb-4 sm:mb-6 border border-gray-800 rounded-lg p-2 sm:p-3 bg-gray-900">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h3 className="text-white font-medium text-sm">Publishing...</h3>
              <Loader2 className="animate-spin w-4 h-4" />
            </div>
            {nostrStatus.enabled && nostrStatus.available && (
              <div className="text-xs text-gray-400">
                Nostr relays: {Object.values(publishStatus).filter(s => s === 'published').length}/{relayPool.length}
              </div>
            )}
          </div>
        )}
        
        {/* Jamie Assist button and info button */}
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
          <button
            onClick={onClose}
            disabled={isPublishing || isGeneratingContent}
            className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg border border-gray-700 text-gray-300 
              ${(isPublishing || isGeneratingContent) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-white transition-colors'}`}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || isGeneratingContent || content.trim().length === 0 || (!twitterStatus.enabled && !nostrStatus.enabled)}
            className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg bg-white text-black font-medium 
              ${(isPublishing || isGeneratingContent || content.trim().length === 0 || (!twitterStatus.enabled && !nostrStatus.enabled)) ? 
                'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 transition-colors'}`}
          >
            {isPublishing ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                Publishing...
              </span>
            ) : 'Post'}
          </button>
        </div>
        
        <div className="text-gray-500 text-xs mt-2 sm:mt-4 text-center">
          <p>Character count: {content.length}</p>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-2 sm:p-4 md:p-8">
      <div className="bg-black border border-gray-800 rounded-xl md:rounded-xl p-4 sm:p-6 w-full sm:max-w-sm md:max-w-md lg:max-w-xl text-center relative shadow-xl sm:transform sm:-translate-y-12 h-[80vh] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-6 text-gray-400 hover:text-white transition-colors z-10">
          <X className="w-6 h-6" />
        </button>
        
        <div className="overflow-y-auto flex-1 pr-2 mt-8" 
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
  );
};

export default SocialShareModal; 
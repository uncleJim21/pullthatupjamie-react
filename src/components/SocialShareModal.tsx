import React, { useState, useEffect } from 'react';
import { X, Loader2, Twitter, Sparkles, ChevronDown, ChevronUp, ChevronRight, Info, Save } from 'lucide-react';
import { printLog } from '../constants/constants.ts';
import { generateAssistContent, JamieAssistError } from '../services/jamieAssistService.ts';
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
  platform: SocialPlatform;
  renderUrl?: string; // URL to use in place of fileUrl for Twitter sharing
  lookupHash?: string; // Added lookupHash for Jamie Assist
  auth?: any; // Auth object for API calls
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
  const [hasNostrExtension, setHasNostrExtension] = useState(false);
  const [nostrPublicKey, setNostrPublicKey] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{[key: string]: string}>({});
  const [relayConnections, setRelayConnections] = useState<{[key: string]: WebSocket | null}>({});
  const [showNostrPrompt, setShowNostrPrompt] = useState(false);
  const [showTwitterPrompt, setShowTwitterPrompt] = useState(false);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>(platform);
  
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

  // Update activePlatform when platform prop changes
  useEffect(() => {
    setActivePlatform(platform);
  }, [platform]);

  // Update activePlatform when showing cross-posting prompts
  useEffect(() => {
    if (showNostrPrompt) {
      printLog("Showing Nostr prompt after Twitter, setting activePlatform to Nostr");
      setActivePlatform(SocialPlatform.Nostr);
    } else if (showTwitterPrompt) {
      printLog("Showing Twitter prompt after Nostr, setting activePlatform to Twitter");
      setActivePlatform(SocialPlatform.Twitter);
    }
  }, [showNostrPrompt, showTwitterPrompt]);

  // Effect to hide search bar when modal is open
  useEffect(() => {
    // Find all search forms - more reliable than class-based selector
    const searchForms = document.querySelectorAll('form[class*="relative"]');
    
    if (isOpen && searchForms.length > 0) {
      // Hide all search forms
      searchForms.forEach(form => {
        if (form instanceof HTMLElement) {
          form.style.display = 'none';
        }
      });
    }

    return () => {
      // Restore visibility of search forms when modal closes
      searchForms.forEach(form => {
        if (form instanceof HTMLElement) {
          form.style.display = '';
        }
      });
    };
  }, [isOpen]);

  // Initialize content with default text and check for Nostr extension if needed
  useEffect(() => {
    // No default content, empty textarea with just placeholder
    setContent('');
    
    // Check for Nostr extension only if platform is Nostr
    if (platform === SocialPlatform.Nostr) {
      checkNostrExtension();

      // Initialize relay status
      const initialStatus: {[key: string]: string} = {};
      relayPool.forEach(relay => {
        initialStatus[relay] = 'idle';
      });
      setPublishStatus(initialStatus);
    }

    // Reset cross-posting prompts when platform changes
    printLog(`Platform changed to: ${platform}`);
    setShowNostrPrompt(false);
    setShowTwitterPrompt(false);

    // Load any saved Jamie Assist preferences
    loadJamieAssistPreferences();

    return () => {
      // Clean up WebSocket connections when component unmounts
      if (platform === SocialPlatform.Nostr) {
        Object.values(relayConnections).forEach(conn => {
          if (conn && conn.readyState === WebSocket.OPEN) {
            conn.close();
          }
        });
      }
      // Reset prompts when unmounting
      setShowNostrPrompt(false);
      setShowTwitterPrompt(false);
    };
  }, [fileUrl, itemName, platform]);

  // Effect to check for Nostr extension when showing the cross-posting prompt
  useEffect(() => {
    if (showNostrPrompt) {
      checkNostrExtension();
    }
  }, [showNostrPrompt]);

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
        setHasNostrExtension(true);
        try {
          const pubKey = await window.nostr.getPublicKey();
          setNostrPublicKey(pubKey);
          printLog(`Nostr extension found with public key: ${pubKey}`);
        } catch (keyError) {
          printLog("Nostr extension found but couldn't get public key");
        }
      } else {
        setHasNostrExtension(false);
      }
    } catch (error) {
      setHasNostrExtension(false);
      console.error("Error checking for Nostr extension:", error);
    }
  };

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

  const publishToNostr = async () => {
    if (!window.nostr) {
      console.error("No Nostr extension available");
      return false;
    }

    try {
      // Add the URL and attribution to the content text before sending
      const finalContent = `${content}\n\n${fileUrl}\n\nShared via https://pullthatupjamie.ai`;
      
      // Construct a new Nostr event (kind 1 - text note)
      const event = {
        kind: 1,
        content: finalContent,
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: nostrPublicKey || ''
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
      
      return successCount > 0;
    } catch (error) {
      console.error("Error publishing to Nostr:", error);
      return false;
    }
  };

  const shareToTwitter = () => {
    // Add the URL and attribution to the content before sending to Twitter
    const urlToShare = renderUrl || fileUrl;
    // Append the URL and attribution to the content
    const finalContent = `${content}\n\n${urlToShare}\n\nShared via https://pullthatupjamie.ai`;
    
    const tweetText = encodeURIComponent(finalContent);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    
    window.open(twitterUrl, '_blank');
    printLog("Opened Twitter intent in new window");
    
    // Only show cross-posting option if this is the initial Twitter share
    if (!showTwitterPrompt) {
      printLog("Setting showNostrPrompt to true after initial Twitter share");
      setShowNostrPrompt(true);
    } else {
      // If this is a cross-post from Nostr to Twitter, close the modal
      printLog("This was a cross-post from Nostr to Twitter, closing modal");
      onComplete(true, SocialPlatform.Twitter);
      onClose();
    }
    
    setIsPublishing(false);
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

  const handlePublish = async () => {
    setIsPublishing(true);
    
    try {
      // Add debugging for current state
      printLog(`handlePublish called with activePlatform: ${activePlatform}, platform prop: ${platform}, showNostrPrompt: ${showNostrPrompt}, showTwitterPrompt: ${showTwitterPrompt}`);
      
      // Use platform to determine the correct publish method, not activePlatform
      if (platform === SocialPlatform.Nostr) {
        printLog("Publishing to Nostr");
        if (!hasNostrExtension) {
          onComplete(false, SocialPlatform.Nostr);
          return;
        }
        
        // Call the actual publishToNostr function
        const success = await publishToNostr();
        setIsPublishing(false);
        
        if (showNostrPrompt) {
          // This is part of the cross-posting flow from Twitter
          printLog(`Nostr cross-post ${success ? 'successful' : 'failed'}`);
          onComplete(success, SocialPlatform.Nostr);
          if (success) {
            onClose();
          }
        } else if (success) {
          // Show Twitter cross-posting prompt after successful Nostr publish
          printLog("Nostr publish successful, showing Twitter prompt");
          setShowTwitterPrompt(true);
        } else {
          // Only complete and close if not successful
          printLog("Nostr publish failed");
          onComplete(false, SocialPlatform.Nostr);
        }
      } 
      // Twitter share
      else if (platform === SocialPlatform.Twitter) {
        printLog("Sharing to Twitter");
        shareToTwitter();
      }
    } catch (error) {
      console.error(`Error during ${platform} publishing:`, error);
      setIsPublishing(false);
      onComplete(false, platform);
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

  // Register Modal handlers
  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
  };

  const handleLightningSelect = () => {
    setIsRegisterModalOpen(false);
    // This would typically redirect to lightning flow or trigger parent callback
    printLog("Lightning wallet connection selected");
    setJamieAssistError("Please complete the Lightning connection in the popup window.");
  };

  const handleSubscribeSelect = () => {
    setIsRegisterModalOpen(false);
    // This would typically redirect to subscription flow or trigger parent callback
    printLog("Subscription selected");
    setJamieAssistError("Please complete the subscription process in the new window.");
  };

  if (!isOpen || !fileUrl) return null;

  // Show Twitter cross-posting prompt after successful Nostr publishing
  if (showTwitterPrompt) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
        <div className="bg-black border border-gray-800 rounded-lg p-6 w-80 text-center relative">
          <div className="flex items-center justify-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
              <Twitter className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          
          <h2 className="text-lg font-semibold text-white mb-4">Share to Twitter Too?</h2>
          
          <div className="flex justify-center mt-4 gap-4">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-black text-white border border-white"
            >
              Skip
            </button>
            <button
              onClick={() => {
                shareToTwitter();
                onComplete(true, SocialPlatform.Twitter);
                onClose();
              }}
              className="px-5 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              Tweet
            </button>
          </div>
          
          <div className="text-gray-500 text-xs mt-4">
            <p className="mb-1">Character count: {content.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show the Nostr cross-posting prompt after Twitter sharing
  if (showNostrPrompt) {
    // If no Nostr extension, show extension installation prompt
    if (!hasNostrExtension) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="bg-black border border-gray-800 rounded-lg p-6 w-96 text-center relative">
            <div className="flex items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
                <img 
                  src="/nostr-logo-square.png" 
                  alt="Nostr" 
                  className="w-6 h-6"
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
                />
              </div>
            </div>
            
            <h2 className="text-lg font-semibold text-white mb-4">Nostr Extension Required</h2>
            
            <p className="text-gray-300 mb-6">
              You need a Nostr browser extension to publish this post.
            </p>
            
            <div className="space-y-3 max-w-xs mx-auto mb-4">
              <a 
                href="https://getalby.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline block py-2 px-4 bg-gray-900 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                <span className="font-bold">Alby</span>
                <span className="ml-2 text-xs text-gray-400">(Recommended)</span>
              </a>
            </div>
            
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-black text-white border border-white"
            >
              Skip
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
        <div className="bg-black border border-gray-800 rounded-lg p-6 w-80 text-center relative">
          <div className="flex items-center justify-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
              <img 
                src="/nostr-logo-square.png" 
                alt="Nostr" 
                className="w-6 h-6"
                style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
              />
            </div>
          </div>
          
          <h2 className="text-lg font-semibold text-white mb-4">Share to Nostr Too?</h2>
          
          <div className="flex justify-center mt-4 gap-4">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-black text-white border border-white"
            >
              Skip
            </button>
            <button
              onClick={async () => {
                setIsPublishing(true);
                // Call publishToNostr directly for cross-posting
                const success = await publishToNostr();
                setIsPublishing(false);
                if (success) {
                  onComplete(true, SocialPlatform.Nostr);
                  onClose();
                }
              }}
              disabled={isPublishing}
              className={`px-5 py-2 rounded-lg bg-purple-600 text-white font-medium 
                ${isPublishing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-500 transition-colors'}`}
            >
              {isPublishing ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Publishing...
                </span>
              ) : 'Publish'}
            </button>
          </div>
          
          {/* Publishing status for Nostr */}
          {isPublishing && (
            <div className="mt-4 border border-gray-800 rounded-lg p-3 bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium text-sm">Publishing to relays...</h3>
                <div className="flex items-center">
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  <span className="text-xs text-gray-400">
                    {Object.values(publishStatus).filter(s => s === 'published').length}/{relayPool.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Define the renderMainModalContent function to use in the return statement
  const renderMainModalContent = () => {
    if (platform === SocialPlatform.Nostr && !hasNostrExtension) {
      return (
        <div className="text-center py-4 sm:py-8 px-2 sm:px-4">
          <img 
            src="/nostr-logo-square.png" 
            alt="Nostr" 
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6"
            style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
          />
          <p className="text-gray-300 mb-4 sm:mb-6 text-base sm:text-lg">
            You need a Nostr browser extension to publish this post.
          </p>
          <div className="space-y-2 sm:space-y-3 max-w-xs mx-auto">
            <p className="text-gray-400 text-sm font-medium">Popular extensions:</p>
            <a 
              href="https://getalby.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline block py-2 px-4 bg-gray-900 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
              <span className="font-bold">Alby</span>
              <span className="ml-2 text-xs text-gray-400">(Recommended)</span>
            </a>
            <a 
              href="https://github.com/fiatjaf/nos2x" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline block py-2 px-4 bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
            >
              nos2x
            </a>
            <a 
              href="https://www.getflamingo.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline block py-2 px-4 bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
            >
              Flamingo
            </a>
          </div>
        </div>
      );
    }
    
    return (
      <>
        <div className="flex items-center mb-3 sm:mb-4 px-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-800 mr-2 sm:mr-3 flex items-center justify-center overflow-hidden">
            {platform === SocialPlatform.Nostr ? (
              <img 
                src="/nostr-logo-square.png" 
                alt="Nostr" 
                className="w-5 h-5 sm:w-6 sm:h-6"
                style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
              />
            ) : (
              <Twitter className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            )}
          </div>
          <div className="text-left">
            <p className="text-white font-medium">
              {platform === SocialPlatform.Nostr ? 'Your Nostr Post' : 'Your Tweet'}
            </p>
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
        
        {platform === SocialPlatform.Nostr && isPublishing && (
          <div className="mb-4 sm:mb-6 border border-gray-800 rounded-lg p-2 sm:p-3 bg-gray-900">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h3 className="text-white font-medium text-sm">Publishing to relays...</h3>
              <div className="flex items-center">
                <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm text-gray-400">
                  {Object.values(publishStatus).filter(s => s === 'published').length}/{relayPool.length}
                </span>
              </div>
            </div>
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
          {platform === SocialPlatform.Twitter ? (
            <button
              onClick={shareToTwitter}
              disabled={isPublishing || isGeneratingContent || content.trim().length === 0}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg bg-blue-600 text-white font-medium 
                ${(isPublishing || isGeneratingContent || content.trim().length === 0) ? 
                  'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500 transition-colors'}`}
            >
              {isPublishing ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                  Tweeting...
                </span>
              ) : 'Tweet'}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={isPublishing || isGeneratingContent || content.trim().length === 0}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg bg-purple-600 text-white font-medium 
                ${(isPublishing || isGeneratingContent || content.trim().length === 0) ? 
                  'opacity-50 cursor-not-allowed' : 'hover:bg-purple-500 transition-colors'}`}
            >
              {isPublishing ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin w-4 h-4 mr-1 sm:mr-2" />
                  Publishing...
                </span>
              ) : 'Publish'}
            </button>
          )}
        </div>
        
        <div className="text-gray-500 text-xs mt-2 sm:mt-4">
          <p className="sm:mb-1">Character count: {content.length}</p>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-2 sm:p-4 md:p-8">
      <div className="bg-black border border-gray-800 rounded-xl md:rounded-xl p-4 sm:p-6 w-full sm:max-w-sm md:max-w-md lg:max-w-xl text-center relative shadow-xl sm:transform sm:-translate-y-12 max-h-[100vh] sm:max-h-[80vh] overflow-y-auto sm:overflow-visible">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">
          {platform === SocialPlatform.Nostr ? 'Share to Nostr' : 'Share to Twitter'}
        </h2>
        
        {renderMainModalContent()}
      </div>
      
      {renderInfoModal()}
      
      {/* RegisterModal overlay */}
      <RegisterModal 
        isOpen={isRegisterModalOpen}
        onClose={handleCloseRegisterModal}
        onLightningSelect={handleLightningSelect}
        onSubscribeSelect={handleSubscribeSelect}
      />
    </div>
  );
};

export default SocialShareModal; 
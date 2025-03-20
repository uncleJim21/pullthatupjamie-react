import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { printLog } from '../constants/constants.ts';

// Define relay pool
export const relayPool = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.mostr.pub",
  "wss://nostr.land",
  "wss://purplerelay.com",
  "wss://relay.snort.social"
];

interface NostrPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  itemName?: string;
  onPublish: (success: boolean) => void;
}

const NostrPostModal: React.FC<NostrPostModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  itemName = 'file',
  onPublish
}) => {
  const [content, setContent] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasNostrExtension, setHasNostrExtension] = useState(false);
  const [nostrPublicKey, setNostrPublicKey] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{[key: string]: string}>({});
  const [relayConnections, setRelayConnections] = useState<{[key: string]: WebSocket | null}>({});

  // Add effect to hide search bar when modal is open
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

  useEffect(() => {
    // Initialize content with default text
    setContent(`Check out this ${itemName}:\n\n${fileUrl}\n\nShared via PullThatUpJamie.ai`);
    
    // Check for Nostr extension
    checkNostrExtension();

    // Initialize relay status
    const initialStatus: {[key: string]: string} = {};
    relayPool.forEach(relay => {
      initialStatus[relay] = 'idle';
    });
    setPublishStatus(initialStatus);

    return () => {
      // Clean up WebSocket connections when component unmounts
      Object.values(relayConnections).forEach(conn => {
        if (conn && conn.readyState === WebSocket.OPEN) {
          conn.close();
        }
      });
    };
  }, [fileUrl, itemName]);

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
      // Construct a new Nostr event (kind 1 - text note)
      const event = {
        kind: 1,
        content,
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

  const handlePublish = async () => {
    if (!hasNostrExtension) {
      onPublish(false);
      return;
    }

    setIsPublishing(true);
    try {
      const success = await publishToNostr();
      setIsPublishing(false);
      onPublish(success);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Error during Nostr publishing:", error);
      setIsPublishing(false);
      onPublish(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4 sm:p-6 md:p-8">
      <div className="bg-black border border-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md md:max-w-xl text-center relative shadow-xl transform -translate-y-12">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-semibold text-white mb-6">Share to Nostr</h2>
        
        {!hasNostrExtension ? (
          <div className="text-center py-8 px-4">
            <img 
              src="/nostr-logo-square.png" 
              alt="Nostr" 
              className="w-20 h-20 mx-auto mb-6"
              style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
            />
            <p className="text-gray-300 mb-6 text-lg">
              You need a Nostr browser extension to publish this post.
            </p>
            <div className="space-y-3 max-w-xs mx-auto">
              <p className="text-gray-400 text-sm font-medium">Popular extensions:</p>
              <a 
                href="https://getalby.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline block py-2 px-4 bg-gray-900 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                <span> Alby</span>
                <span className="ml-2 text-xs text-gray-400"></span>
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
        ) : (
          <>
            <div className="flex items-center mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-gray-800 mr-3 flex items-center justify-center overflow-hidden">
                <img 
                  src="/nostr-logo-square.png" 
                  alt="Nostr" 
                  className="w-6 h-6"
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
                />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Your Nostr Post</p>
                <p className="text-gray-400 text-sm">
                  {nostrPublicKey ? 
                    `${nostrPublicKey.substring(0, 8)}...${nostrPublicKey.substring(nostrPublicKey.length - 8)}` : 
                    'Anonymous'
                  }
                </p>
              </div>
            </div>
            
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-48 bg-gray-900 text-white border border-gray-700 rounded-xl p-4 mb-6 text-base focus:border-gray-500 focus:outline-none"
              placeholder="Write your Nostr post..."
              style={{ resize: "vertical", minHeight: "120px" }}
            />
            
            {isPublishing && (
              <div className="mb-6 border border-gray-800 rounded-lg p-3 bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">Publishing to relays...</h3>
                  <div className="flex items-center">
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    <span className="text-sm text-gray-400">
                      {Object.values(publishStatus).filter(s => s === 'published').length}/{relayPool.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto text-left text-xs">
                  {relayPool.map((relay) => (
                    <div key={relay} className="flex items-center justify-between">
                      <span className="text-gray-400 truncate max-w-[180px]">{relay.replace('wss://', '')}</span>
                      <span className={`
                        px-2 py-0.5 rounded text-xs font-medium
                        ${publishStatus[relay] === 'idle' ? 'bg-gray-800 text-gray-400' : ''}
                        ${publishStatus[relay] === 'connecting' ? 'bg-blue-900/30 text-blue-300' : ''}
                        ${publishStatus[relay] === 'connected' ? 'bg-yellow-900/30 text-yellow-300' : ''}
                        ${publishStatus[relay] === 'publishing' ? 'bg-yellow-900/50 text-yellow-300' : ''}
                        ${publishStatus[relay] === 'published' ? 'bg-green-900/30 text-green-300' : ''}
                        ${publishStatus[relay] === 'failed' ? 'bg-red-900/30 text-red-300' : ''}
                        ${publishStatus[relay] === 'timeout' ? 'bg-orange-900/30 text-orange-300' : ''}
                      `}>
                        {publishStatus[relay] === 'idle' && 'Idle'}
                        {publishStatus[relay] === 'connecting' && 'Connecting...'}
                        {publishStatus[relay] === 'connected' && 'Connected'}
                        {publishStatus[relay] === 'publishing' && 'Publishing...'}
                        {publishStatus[relay] === 'published' && 'Published'}
                        {publishStatus[relay] === 'failed' && 'Failed'}
                        {publishStatus[relay] === 'timeout' && 'Timeout'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex space-x-4 justify-center">
              <button
                onClick={onClose}
                disabled={isPublishing}
                className={`px-5 py-2 rounded-lg border border-gray-700 text-gray-300 
                  ${isPublishing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-white transition-colors'}`}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || content.trim().length === 0}
                className={`px-5 py-2 rounded-lg bg-purple-600 text-white font-medium 
                  ${(isPublishing || content.trim().length === 0) ? 
                    'opacity-50 cursor-not-allowed' : 
                    'hover:bg-purple-500 transition-colors'}`}
              >
                {isPublishing ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Publishing...
                  </span>
                ) : 'Publish'}
              </button>
            </div>
            
            <div className="text-gray-500 text-xs mt-4">
              <p>Character count: {content.length}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NostrPostModal;
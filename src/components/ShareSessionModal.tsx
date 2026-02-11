import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, Twitter, ExternalLink, Check, Loader, Copy, CheckCircle } from 'lucide-react';
import { relayPool, generatePrimalUrl } from '../utils/nostrUtils.ts';
import { printLog } from '../constants/constants.ts';
import '../types/nostr.ts'; // Import for Window.nostr type augmentation

interface ShareSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title?: string) => Promise<string | null>; // Now returns the shareUrl
  suggestedTitle?: string;
  isSharing?: boolean;
}

// Nostr types
interface NostrEvent {
  kind: number;
  created_at: number;
  content: string;
  tags: string[][];
  pubkey?: string;
  id?: string;
  sig?: string;
}

const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  suggestedTitle = '',
  isSharing = false
}) => {
  const [title, setTitle] = useState(suggestedTitle);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isLinkCreated, setIsLinkCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Nostr publishing state
  const [isPublishingNostr, setIsPublishingNostr] = useState(false);
  const [nostrPublishSuccess, setNostrPublishSuccess] = useState(false);
  const [nostrPublishUrl, setNostrPublishUrl] = useState<string | null>(null);
  const [nostrError, setNostrError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{[key: string]: string}>({});
  const [relayConnections, setRelayConnections] = useState<{[key: string]: WebSocket | null}>({});
  
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update title when suggestedTitle changes
  useEffect(() => {
    setTitle(suggestedTitle);
  }, [suggestedTitle]);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle(suggestedTitle);
      setShareUrl(null);
      setIsLinkCreated(false);
      setCopied(false);
      setIsPublishingNostr(false);
      setNostrPublishSuccess(false);
      setNostrPublishUrl(null);
      setNostrError(null);
      setShowToast(false);
      setPublishStatus({});
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    }
  }, [isOpen, suggestedTitle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Pass undefined if title is empty or only whitespace
    const trimmedTitle = title.trim();
    const resultUrl = await onConfirm(trimmedTitle.length > 0 ? trimmedTitle : undefined);
    
    if (resultUrl) {
      setShareUrl(resultUrl);
      setIsLinkCreated(true);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(resultUrl);
        setCopied(true);
        setShowToast(true);
        
        // Hide toast after 3 seconds
        toastTimeoutRef.current = setTimeout(() => {
          setShowToast(false);
        }, 3000);
        
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShowToast(true);
      
      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleShareTwitter = () => {
    if (!shareUrl) return;
    const tweetText = `\n\n${shareUrl}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleOpenLink = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank');
  };

  // Nostr relay connection
  const connectToRelay = (relay: string, timeoutMs: number = 10000): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      try {
        setPublishStatus(prev => ({ ...prev, [relay]: 'connecting' }));
        
        const socket = new WebSocket(relay);
        let settled = false;

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            socket.close();
          } catch {
            // ignore
          }
          setPublishStatus(prev => ({ ...prev, [relay]: 'timeout' }));
          reject(new Error(`Connection timeout to relay ${relay}`));
        }, timeoutMs);
        
        socket.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          setPublishStatus(prev => ({ ...prev, [relay]: 'connected' }));
          setRelayConnections(prev => ({ ...prev, [relay]: socket }));
          resolve(socket);
        };
        
        socket.onerror = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          console.error(`Error connecting to relay ${relay}:`, error);
          setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
          reject(error);
        };
        
        socket.onclose = () => {
          setRelayConnections(prev => ({ ...prev, [relay]: null }));
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
            reject(new Error(`Relay closed connection before opening: ${relay}`));
          }
        };
      } catch (error) {
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        reject(error);
      }
    });
  };

  const publishEventToRelay = (relay: string, event: NostrEvent, timeoutMs: number = 10000): Promise<boolean> => {
    return new Promise(async (resolve) => {
      let socket: WebSocket | null = null;
      let settled = false;
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        try {
          if (timeoutId) clearTimeout(timeoutId);
        } catch { /* ignore */ }
        try {
          if (socket) {
            socket.removeEventListener('message', handleMessage as any);
            socket.removeEventListener('error', handleError as any);
            socket.removeEventListener('close', handleClose as any);
          }
        } catch { /* ignore */ }
        try {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        } catch { /* ignore */ }
      };

      const handleMessage = (msg: MessageEvent) => {
        if (settled) return;
        try {
          const data = JSON.parse(msg.data);
          if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) {
            settled = true;
            cleanup();
            const ok = data[2] === true;
            setPublishStatus(prev => ({ ...prev, [relay]: ok ? 'published' : 'rejected' }));
            resolve(ok);
          }
        } catch (error) {
          console.error(`Error parsing relay response from ${relay}:`, error);
        }
      };

      const handleError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        resolve(false);
      };

      const handleClose = () => {
        if (settled) return;
        settled = true;
        cleanup();
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        resolve(false);
      };

      try {
        socket = await connectToRelay(relay, timeoutMs);
        setPublishStatus(prev => ({ ...prev, [relay]: 'publishing' }));

        timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          setPublishStatus(prev => ({ ...prev, [relay]: 'timeout' }));
          resolve(false);
        }, timeoutMs);

        socket.addEventListener('message', handleMessage);
        socket.addEventListener('error', handleError as any);
        socket.addEventListener('close', handleClose as any);

        const publishMessage = JSON.stringify(["EVENT", event]);
        socket.send(publishMessage);
      } catch (error) {
        if (settled) return;
        settled = true;
        cleanup();
        setPublishStatus(prev => ({ ...prev, [relay]: 'failed' }));
        resolve(false);
      }
    });
  };

  const handleShareNostr = async () => {
    if (!shareUrl) return;
    
    // Check for NIP-07 extension
    if (!window.nostr) {
      setNostrError('No Nostr extension found. Please install a NIP-07 compatible extension like Alby or nos2x.');
      return;
    }

    setIsPublishingNostr(true);
    setNostrError(null);
    setNostrPublishSuccess(false);
    setNostrPublishUrl(null);

    try {
      // Build content
      const noteContent = `${shareUrl}`;
      
      // Create event to sign
      const eventToSign: NostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: noteContent,
        tags: relayPool.slice(0, 5).map(r => ["r", r])
      };

      // Sign event with NIP-07 extension
      const signedEvent = await window.nostr.signEvent(eventToSign);
      printLog(`Successfully signed Nostr event: ${signedEvent.id}`);

      // Publish to relays
      const MIN_RELAY_SUCCESSES = 3;
      let successCount = 0;
      let resolved = false;

      const thresholdPromise = new Promise<boolean>((resolve) => {
        const tasks = relayPool.map((relay) =>
          publishEventToRelay(relay, signedEvent).then((ok) => {
            if (ok) {
              successCount += 1;
              if (!resolved && successCount >= MIN_RELAY_SUCCESSES) {
                resolved = true;
                const primalUrl = generatePrimalUrl(signedEvent.id!);
                setNostrPublishUrl(primalUrl);
                setNostrPublishSuccess(true);
                resolve(true);
              }
            }
            return ok;
          })
        );

        Promise.allSettled(tasks).then(() => {
          if (resolved) return;
          resolved = true;
          printLog(`Published to ${successCount}/${relayPool.length} relays`);
          if (successCount > 0) {
            const primalUrl = generatePrimalUrl(signedEvent.id!);
            setNostrPublishUrl(primalUrl);
            setNostrPublishSuccess(true);
            resolve(true);
          } else {
            setNostrError(`Failed to publish to any relays. Please try again.`);
            resolve(false);
          }
        });
      });

      await thresholdPromise;
    } catch (error) {
      console.error('Nostr publish error:', error);
      setNostrError(error instanceof Error ? error.message : 'Failed to publish to Nostr');
    } finally {
      setIsPublishingNostr(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md relative shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          disabled={isSharing || isPublishingNostr}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Create Link</h2>
            <p className="text-sm text-gray-400">Share your research session</p>
          </div>
        </div>

        {/* Form - only show before link is created */}
        {!isLinkCreated && (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="session-title" className="block text-sm font-medium text-gray-300 mb-2">
                Session Title <span className="text-gray-500">(optional)</span>
              </label>
              <input
                id="session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your research session..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
                maxLength={100}
                disabled={isSharing}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                If no title is provided, one will be generated automatically
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                disabled={isSharing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isSharing}
              >
                {isSharing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Create Link
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Share Options - animated dropdown after link is created */}
        {isLinkCreated && shareUrl && (
          <div 
            className="transition-all duration-300 ease-out"
            style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
          >
            {/* Success indicator */}
            <div className="flex items-center gap-2 mb-4 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Link created successfully!</span>
            </div>

            {/* Share URL textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Share Link
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  value={shareUrl}
                  className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-500"
                  rows={2}
                />
                <button
                  onClick={handleCopyLink}
                  className="absolute right-2 top-2 p-2 text-gray-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Share action buttons - 3 column grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Twitter */}
              <button
                onClick={handleShareTwitter}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-all group"
              >
                <Twitter className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">Twitter</span>
              </button>

              {/* Nostr */}
              <button
                onClick={handleShareNostr}
                disabled={isPublishingNostr}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishingNostr ? (
                  <>
                    <Loader className="w-6 h-6 text-purple-400 animate-spin" />
                    <span className="text-xs text-gray-400">Posting...</span>
                  </>
                ) : nostrPublishSuccess ? (
                  <>
                    <Check className="w-6 h-6 text-green-400" />
                    <span className="text-xs text-green-400">Posted!</span>
                  </>
                ) : (
                  <>
                    <img 
                      src="/nostr-logo-square.png" 
                      alt="Nostr" 
                      className="w-6 h-6 group-hover:scale-110 transition-transform"
                      style={{ filter: 'brightness(1.2)' }}
                    />
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors">Nostr</span>
                  </>
                )}
              </button>

              {/* Open */}
              <button
                onClick={handleOpenLink}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-all group"
              >
                <ExternalLink className="w-6 h-6 text-gray-300 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">Open</span>
              </button>
            </div>

            {/* Nostr success link */}
            {nostrPublishSuccess && nostrPublishUrl && (
              <div className="mb-4 p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                <a
                  href={nostrPublishUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center justify-center gap-2"
                >
                  View on Primal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            
            {/* Nostr error message */}
            {nostrError && (
              <p className="text-sm text-red-400 mb-4 text-center">{nostrError}</p>
            )}

            {/* Done button - prominent */}
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Toast notification - fixed at bottom of viewport for visibility */}
        {showToast && (
          <div 
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
            style={{ animation: 'fadeSlideUp 0.3s ease-out' }}
          >
            <div className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg shadow-2xl border border-green-500">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-semibold">Link copied to clipboard!</span>
            </div>
          </div>
        )}

        {/* Animation keyframes */}
        <style>{`
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeSlideUp {
            from {
              opacity: 0;
              transform: translate(-50%, 10px);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ShareSessionModal;

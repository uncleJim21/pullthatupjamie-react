import React, { useState } from 'react';
import { Download, Check, Link, Twitter, X } from 'lucide-react';
import { printLog, API_URL } from '../constants/constants.ts';
import SocialShareModal, { SocialPlatform } from './SocialShareModal.tsx';

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

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl?: string;
  title?: string;
  showCopy?: boolean;
  showTwitter?: boolean;
  showDownload?: boolean;
  showNostr?: boolean;
  itemName?: string;
  copySuccessMessage?: string;
  twitterButtonLabel?: string;
  downloadButtonLabel?: string;
  copyButtonLabel?: string;
  nostrButtonLabel?: string;
  lookupHash?: string;
  auth?: any;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  title = 'Share',
  showCopy = true,
  showTwitter = true,
  showDownload = true,
  showNostr = false,
  itemName = 'file',
  copySuccessMessage = 'Copied to clipboard!',
  twitterButtonLabel,
  downloadButtonLabel,
  copyButtonLabel,
  nostrButtonLabel,
  lookupHash,
  auth
}) => {
  const [copied, setCopied] = useState(false);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
  const [shareResult, setShareResult] = useState<string | null>(null);

  // Clear share result message after a timeout
  React.useEffect(() => {
    if (shareResult) {
      const timer = setTimeout(() => {
        setShareResult(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [shareResult]);

  if (!isOpen || !fileUrl) return null;

  const copyToClipboard = () => {
    if (!fileUrl) return;
    navigator.clipboard.writeText(fileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!fileUrl) {
      console.error("No URL found for download.");
      return;
    }
  
    try {
      // Fetch the file as a blob
      const response = await fetch(fileUrl, { mode: 'cors' });
      if (!response.ok) throw new Error("Failed to fetch file.");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
  
      // Create a hidden download link
      const link = document.createElement('a');
      link.href = blobUrl;
      // Extract a filename from the URL
      const fileName = fileUrl.split('/').pop() || `download-${Date.now()}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
  
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
  
      printLog(`Download completed: ${fileUrl}`);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleSocialShareComplete = (success: boolean, platform: SocialPlatform) => {
    if (success) {
      setShareResult(`✅ Shared to ${platform === SocialPlatform.Twitter ? 'Twitter' : 'Nostr'}!`);
    } else {
      setShareResult(`❌ Failed to share to ${platform === SocialPlatform.Twitter ? 'Twitter' : 'Nostr'}`);
    }
  };

  // Extract clip ID directly from fileUrl
  const extractClipIdFromUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    
    try {
      // Handle clip URL pattern
      if (url.includes('/clips/')) {
        const urlParts = url.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        
        if (lastPart && lastPart.includes('-clip.mp4')) {
          return lastPart.replace('-clip.mp4', '');
        }
      }
      return undefined;
    } catch (error) {
      console.error("Error extracting clip ID from URL:", error);
      return undefined;
    }
  };

  // Extract render URL for Twitter if it exists (e.g., for clips)
  const getRenderUrl = () => {
    if (!fileUrl) return undefined;
    
    try {
      // Check if this is a clip URL 
      if (fileUrl.includes('/clips/')) {
        // Extract the hash from the file URL
        const hash = extractClipIdFromUrl(fileUrl);
        
        if (hash) {
          // If no lookupHash was provided or it's an "undefined-X" format, use the extracted hash
          if (!lookupHash || (typeof lookupHash === 'string' && lookupHash.startsWith('undefined-'))) {
            printLog(`Extracted clip ID ${hash} from URL to use as lookupHash`);
            lookupHash = hash;
          }
          
          return `${API_URL}/api/render-clip/${hash}`;
        }
      }
      
      return undefined;
    } catch (error) {
      console.error("Error generating render URL:", error);
      return undefined;
    }
  };

  // Ensure we have a valid lookupHash
  const getValidLookupHash = (): string | undefined => {
    // First, try to use the provided lookupHash if it's valid
    if (lookupHash && typeof lookupHash === 'string' && !lookupHash.startsWith('undefined-')) {
      printLog(`Using provided lookupHash: ${lookupHash}`);
      return lookupHash;
    }
    
    // If no valid lookupHash, extract from fileUrl
    const extractedId = extractClipIdFromUrl(fileUrl);
    if (extractedId) {
      printLog(`Using extracted clip ID from URL: ${extractedId}`);
      return extractedId;
    }
    
    // If we still don't have a valid ID, log an error
    if (lookupHash) {
      printLog(`Invalid lookupHash format: ${lookupHash}, and couldn't extract ID from URL: ${fileUrl}`);
    } else {
      printLog(`No lookupHash provided and couldn't extract ID from URL: ${fileUrl}`);
    }
    
    return undefined;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 sm:mb-0 mb-48">
      {/* Social media share modal (Twitter or Nostr) */}
      {activePlatform !== null && (
        <SocialShareModal
          isOpen={activePlatform !== null}
          onClose={() => setActivePlatform(null)}
          fileUrl={fileUrl}
          itemName={itemName}
          onComplete={handleSocialShareComplete}
          platform={activePlatform}
          renderUrl={getRenderUrl()}
          lookupHash={getValidLookupHash()}
          auth={auth}
        />
      )}
      
      {/* Main share modal */}
      {activePlatform === null && (
        <div className="bg-black border border-gray-800 rounded-lg p-6 w-80 text-center relative">
          <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-white">{title}</h2>

          <div className="flex justify-center mt-4 gap-4">
            {showCopy && (
              <button
                onClick={copyToClipboard}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                title={copyButtonLabel || "Copy Link"}
              >
                {copied ? <Check className="w-6 h-6 text-green-500" /> : <Link className="w-6 h-6 text-white" />}
              </button>
            )}
            
            {showDownload && (
              <button
                onClick={handleDownload}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                title={downloadButtonLabel || "Download"}
              >
                <Download className="w-6 h-6 text-white" />
              </button>
            )}
            
            {showTwitter && (
              <button
                onClick={() => setActivePlatform(SocialPlatform.Twitter)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                title={twitterButtonLabel || "Share on Twitter"}
              >
                <Twitter className="w-6 h-6 text-blue-400" />
              </button>
            )}

            {showNostr && (
              <button
                onClick={() => setActivePlatform(SocialPlatform.Nostr)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                title={nostrButtonLabel || "Share on Nostr"}
              >
                <img 
                  src="/nostr-logo-square.png" 
                  alt="Nostr" 
                  className="w-6 h-6" 
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
                />
              </button>
            )}
          </div>
          
          {copied && <p className="text-sm text-green-400 mt-2">{copySuccessMessage}</p>}
          {shareResult && <p className="text-sm text-green-400 mt-2">{shareResult}</p>}
        </div>
      )}
    </div>
  );
};

export default ShareModal; 
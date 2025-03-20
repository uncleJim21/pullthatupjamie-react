import React, { useState } from 'react';
import { Download, Check, Link, Twitter, X } from 'lucide-react';
import { printLog } from '../constants/constants.ts';
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
  nostrButtonLabel
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

  // Extract render URL for Twitter if it exists (e.g., for clips)
  const getRenderUrl = () => {
    if (!fileUrl) return undefined;
    
    // Check if this is a clip URL and extract the ID for a render URL
    if (fileUrl.includes('/clips/')) {
      const urlParts = fileUrl.split('/');
      const fileIndex = urlParts.findIndex(part => part === 'clips');
      
      if (fileIndex !== -1 && fileIndex + 2 < urlParts.length) {
        const clipId = urlParts[fileIndex + 2].replace('-clip.mp4', '');
        return `${window.location.origin}/api/render-clip/${clipId}`;
      }
    }
    
    return undefined;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
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
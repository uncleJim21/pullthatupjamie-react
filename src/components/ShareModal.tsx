import React, { useState } from 'react';
import { Download, Check, Link, Twitter, X, Share2 } from 'lucide-react';
import { API_URL, printLog } from '../constants/constants.ts';

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

  const shareToTwitter = () => {
    if (!fileUrl) return;
    
    const tweetText = encodeURIComponent(`Check out this ${itemName}:\n${fileUrl}\n\nMade with PullThatUpJamie.ai`);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  
    window.open(twitterUrl, '_blank');
  };

  const shareToNostr = () => {
    if (!fileUrl) return;
    console.log(`Sharing to Nostr: ${fileUrl}`);
    // Placeholder for future Nostr integration
    printLog(`Nostr share initiated for: ${fileUrl}`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
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
              onClick={shareToTwitter}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
              title={twitterButtonLabel || "Share on Twitter"}
            >
              <Twitter className="w-6 h-6 text-blue-400" />
            </button>
          )}

          {showNostr && (
            <button
              onClick={shareToNostr}
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
      </div>
    </div>
  );
};

export default ShareModal; 
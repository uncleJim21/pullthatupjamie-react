import React, { useState, useEffect } from 'react';
import {Download, Play, Share, Check, Loader2, ChevronDown, ChevronUp, Clock, Scissors, Link, Twitter, X } from 'lucide-react';
import { API_URL,printLog } from '../constants/constants.ts';
import { checkClipStatus } from '../services/clipService.ts';
import ShareModal from './ShareModal.tsx';

interface ClipHistoryItem {
  creator: string;
  episode: string;
  timestamps: number[];
  cdnLink?: string;
  clipId: string;
  episodeImage: string;
  timestamp: number;
  id: string;
  lookupHash: string;
  failed?: boolean;  // Add this
}

interface ClipTrackerModalProps {
  clipProgress?: {
    creator: string;
    episode: string;
    timestamps: number[];
    cdnLink?: string;
    clipId: string;
    episodeImage: string;
    lookupHash?: string;
  };
  hasSearched:boolean;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function ClipTrackerModal({
  clipProgress,
  isCollapsed,
  hasSearched,
  onCollapsedChange
}: ClipTrackerModalProps) {
  const [clipHistory, setClipHistory] = useState<ClipHistoryItem[]>([]);
  const [isHistoryShown, setIsHistoryShown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lookupHash, setLookupHash] = useState<string | null | undefined>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCdnLink = (lookupHash?: string | null) => {
    printLog(`lookupHash:${lookupHash}`)
    if (!lookupHash) return;
  
    // Find the matching clip in the stored history
    const clip = clipHistory.find(item => item.lookupHash === lookupHash);
    return clip?.cdnLink;
  };

  const getRenderClipUrl = (lookupHash?: string | null) => {
    printLog(`getRenderClipUrl lookupHash:${lookupHash}`)
    if (!lookupHash) return;
    const extractLookupHash = (url) => {
      return url.split('/').pop();
    };
    const finalHash = extractLookupHash(lookupHash);
  
    const renderClipUrl = `${API_URL}/api/render-clip/${finalHash}`;
    return renderClipUrl;
  }


  const extractLookupHash = (cdnLink:string) => {
    // Remove the base URL part and split the rest
    const parts = cdnLink.split('/clips/')[1]?.split('/');
    if (!parts || parts.length < 3) return null;
    const fileWithSuffix = parts[2];
    const file = fileWithSuffix.replace('-clip.mp4', '');
    return `${file}`;
  };

  const copyToClipboard = (lookupHash?: string | null) => {
    const url = getCdnLink(lookupHash);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (lookupHash?: string | null | undefined) => {
    const cdnLink = getCdnLink(lookupHash);
    if (!cdnLink) {
      console.error("No CDN link found for this lookup hash.");
      return;
    }
  
    try {
      // Fetch the file as a blob
      const response = await fetch(cdnLink, { mode: 'cors' });
      if (!response.ok) throw new Error("Failed to fetch file.");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
  
      // Create a hidden download link
      const link = document.createElement('a');
      link.href = blobUrl;
      const id = extractLookupHash(cdnLink);
      link.download = `clip-${id}.mp4`; // Extract filename from lookupHash
      document.body.appendChild(link);
      link.click();
  
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
  
      printLog(`Download completed: ${cdnLink}`);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };
  

  const handleShare = (lookupHash?: string | null | undefined) => {
    printLog(`handleShare lookupHash:${lookupHash}`)
    setLookupHash(lookupHash);
    setShowShareModal(true);
  };

  const shareToTwitter = (lookupHash?: string | null) => {
    const cdnLink = getCdnLink(lookupHash);
    if(!cdnLink){
      throw(`Error sharing. Please try again.`)
      return;
    }
    const id = extractLookupHash(cdnLink);
    const url = getRenderClipUrl(id);
    if (!url) return;
    const tweetText = encodeURIComponent(`Check out this clip:\n${url}\n\nMade with PullThatUpJamie.ai`);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  
    window.open(twitterUrl, '_blank');
  };

  const updateOldPendingItems = async (historyJSON: ClipHistoryItem[]) => {
    printLog(`Checking pending clips...`);
  
    const pendingItems = historyJSON.filter(historyItem => !historyItem.cdnLink && !historyItem.failed);
  
    if (pendingItems.length === 0) {
      printLog("No pending clips found.");
      return;
    }
  
    printLog(`Pending clips to update: ${pendingItems.length}`);
  
    for (const pendingClip of pendingItems) {
      try {
        const endpoint = `/api/clip-status/${pendingClip.clipId}`;
        console.log(`endpoint:${endpoint}`);
        const response = await fetch(`${API_URL}${endpoint}`);
        
        if (response.status === 404) {
          // Mark as failed if we get a 404
          setClipHistory(prevHistory =>
            prevHistory.map(item =>
              item.lookupHash === pendingClip.lookupHash
                ? { ...item, failed: true }
                : item
            )
          );
          
          // Update localStorage
          const updatedHistory = historyJSON.map(item =>
            item.lookupHash === pendingClip.lookupHash
              ? { ...item, failed: true }
              : item
          );
          localStorage.setItem('clipHistory', JSON.stringify(updatedHistory));
          continue;
        }
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const status = await response.json();
        
        if (status.status === "completed" && status.url) {
          printLog(`Clip completed: ${pendingClip.clipId}, updating...`);
  
          // Update clip item in state and localStorage
          setClipHistory(prevHistory =>
            prevHistory.map(item =>
              item.lookupHash === pendingClip.lookupHash
                ? { ...item, cdnLink: status.url }
                : item
            )
          );
  
          // Update localStorage
          const updatedHistory = historyJSON.map(item =>
            item.lookupHash === pendingClip.lookupHash
              ? { ...item, cdnLink: status.url }
              : item
          );
          localStorage.setItem('clipHistory', JSON.stringify(updatedHistory));
        }
      } catch (error) {
        console.error(`Error updating clip ${pendingClip.clipId}:`, error);
      }
    }
  };

  
  const refreshItems = async () =>{
    const savedHistory = localStorage.getItem('clipHistory');
    if (savedHistory) {
      const historyJSON = JSON.parse(savedHistory);
      setClipHistory(historyJSON);
      updateOldPendingItems(historyJSON)
    }
  }

  // Load history from localStorage on mount
  useEffect(() => {
    refreshItems();
  }, []);

  useEffect(() => {
    refreshItems();
  }, [isCollapsed]);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth <= 768);
    checkScreenSize(); // Run on mount
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('clipHistory', JSON.stringify(clipHistory));
  }, [clipHistory]);

  // Update history when new clip arrives or existing clip updates
  useEffect(() => {
    // Only proceed if we have both clipId and lookupHash
    // printLog(`ClipTrackerModal:${JSON.stringify(clipProgress,null,2)}`)
    const lookupHash = clipProgress?.lookupHash
    if (!clipProgress?.clipId || !lookupHash) return;
    onCollapsedChange(false);
    setClipHistory(prev => {
      const existingIndex = prev.findIndex(item => item.lookupHash === clipProgress.lookupHash);

      const updatedItem: ClipHistoryItem = {
          creator: clipProgress.creator,
          episode: clipProgress.episode,
          timestamps: clipProgress.timestamps,
          cdnLink: clipProgress.cdnLink,
          clipId: clipProgress.clipId,
          episodeImage: clipProgress.episodeImage,
          timestamp: Date.now(),
          id: existingIndex >= 0 ? prev[existingIndex].id : Math.random().toString(36).substr(2, 9),
          lookupHash: lookupHash  // Ensure lookupHash is correctly set
      };

      if (existingIndex >= 0) {
          const newHistory = [...prev];
          newHistory.splice(existingIndex, 1);
          return [updatedItem, ...newHistory];
      }

      return [updatedItem, ...prev];
    });
  }, [clipProgress]);

  const bottomConstraint = (isCollapsed,hasSearched) => {
    if(!hasSearched){
      return 'bottom-[1.0rem]'
    }

    return isCollapsed ? 'bottom-36 sm:bottom-48' : 'bottom-[8.8rem] sm:bottom-[12.6rem]'
  }

  return (
    <div className={`fixed z-50 transition-all duration-300 ease-in-out
      xl:right-4 xl:bottom-24 xl:w-[22.5rem] px-4 sm:px-24 xl:left-auto xl:transform-none
      left-1/2 -translate-x-1/2 mx-auto w-full max-w-[40rem] sm:px-4
      ${bottomConstraint(isCollapsed,hasSearched)}`}
    >
      {showShareModal && lookupHash && (
        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          fileUrl={getCdnLink(lookupHash)}
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
        />
      )}
      {/* Current Clip */}
      <div className="bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow">
      <button
        onClick={() => onCollapsedChange(!isCollapsed)}
        className="w-full h-12 flex items-center justify-center hover:bg-gray-800/30 transition-colors"
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1">
            <ChevronUp className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-1 text-gray-200 text-sm mb-1">
              <Scissors className="h-4 w-4" />
              <span>Clips</span>
            </div>
          </div>
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
  
        <div className={`transition-all duration-300 ease-in-out overflow-hidden
          ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}
        >
          {/* Current Clip Section (Hidden on Mobile) */}
            {!clipProgress && (
              <div className="flex items-center justify-center bg-gray-900 text-white p-4 rounded-md">
                <p>No clips currently processing</p>
              </div>
            )}
            {!isMobile && clipProgress && (
              <div className="bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg shadow-white-glow">

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                  <div className="flex items-start space-x-4">
                    <div className="ml-2 mb-2 mt-2 w-24 h-24 rounded-lg bg-zinc-800 flex-shrink-0 border border-gray-800 overflow-hidden">
                      <img src={clipProgress?.episodeImage} alt={clipProgress?.creator} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0 mt-2">
                      <h3 className="text-lg font-semibold text-white truncate line-clamp-1">{clipProgress?.creator}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{clipProgress?.episode}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Timestamps: {clipProgress?.timestamps.map((t) => formatTime(t)).join(' - ')}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {clipProgress?.cdnLink ? (
                        <div className='pr-6 mt-4'>
                        <div
                          onClick={() => clipProgress?.cdnLink && window.open(clipProgress?.cdnLink, '_blank')}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer opacity-80"
                        >
                          <Play className="w-4 h-4 text-green-500" />
                        </div>
                        <div
                          onClick={() => handleShare(clipProgress.lookupHash)}
                          className="w-8 h-8 mt-5 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                        >
                          <Share className="w-4 h-4 text-white" />
                        </div>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center pt-10 mr-4 mt-4">
                          <Loader2 className="w-12 h-12 text-white-500 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  {clipProgress?.cdnLink && (
                    <div className="mt-4">
                      <a href={clipProgress?.cdnLink} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-[#111111] hover:bg-[#1A1A1A] text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-800 hover:border-gray-700">
                        View Clip
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
      </div>
  
      {/* History Toggle */}
      {clipHistory.length > 0 && !isCollapsed && !isMobile && (
        <button
          onClick={() => setIsHistoryShown(!isHistoryShown)}
          className="w-full mt-2 px-4 py-2 bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg 
                    text-gray-300 hover:bg-gray-800/30 transition-colors flex items-center justify-between shadow-white-glow"
        >
          <span>{isHistoryShown ? 'Hide History' : 'Show History'}</span>
          <Clock className="w-4 h-4" />
        </button>
      )}
  
      {/* History Items */}
      {(isHistoryShown || (isMobile)) && !isCollapsed && (
        <div className="mt-2 space-y-2 max-h-[12rem] overflow-y-auto bg-black">
          {clipHistory.map(item => (
            <div
              key={item.id}
              className={`bg-black/80 backdrop-blur-lg border border-gray-800 rounded-lg p-3 
                        flex items-center space-x-3`}
            >
              <img
                src={item.episodeImage}
                alt={item.creator}
                className="w-12 h-12 rounded-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate line-clamp-1">
                  {item.creator}
                </p>
                <p className="text-xs text-gray-400 truncate line-clamp-1 mr-12">
                  {item.episode}
                </p>
                <p className="text-xs text-gray-500">
                  Timestamps: {item.timestamps.map(t => formatTime(t)).join(' - ')}
                </p>
              </div>
              {item.cdnLink ? (
                <div className='pr-4 mt-3 flex-shrink-0'>
                  <div
                    onClick={() => item.cdnLink && window.open(item.cdnLink, '_blank')}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer opacity-80"
                  >
                    <Play className="w-3 h-3 text-green-500" />
                  </div>
                  <div
                    onClick={() => (handleShare(item.lookupHash))}
                    className="w-6 h-6 mt-3 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-700 cursor-pointer"
                  >
                    <Share className="w-3 h-3 text-white" />
                  </div>
                </div>
              ) : item.failed ? (
                <div className='pr-4 mt-2 flex-shrink-0'>
                  <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                </div>
              ) : (
                <div className='pr-4 mt-2 flex-shrink-0'>
                  <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
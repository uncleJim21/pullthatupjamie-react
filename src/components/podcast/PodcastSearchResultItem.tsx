import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Share, Play, Pause, Loader, RotateCcw, RotateCw, SkipBack, SkipForward,Scissors, Link, Edit2, ChevronRight, Check, Calendar } from 'lucide-react';
import { formatTime, formatShortDate } from '../../utils/time.ts';
import { makeClip, fetchClipById } from '../../services/clipService.ts';
import { ClipProgress } from '../../types/clips.ts';
import EditTimestampsModal from "./EditTimestampsModal.tsx";
import SocialShareModal, { SocialPlatform } from "../SocialShareModal.tsx";
import ShareModal from "../ShareModal.tsx";
import { AuthConfig, AIClipsViewStyle } from "../../constants/constants.ts";
import { printLog } from '../../constants/constants.ts';
import { useNavigate } from 'react-router-dom';

export enum PresentationContext {
  search = 'search',
  landingPage = 'landingPage',
  dashboard = 'dashboard',
  runHistoryPreview = 'runHistoryPreview',
  clipBatch = 'clipBatch'
}

interface PodcastSearchResultItemProps {
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  similarity: {
      combined: number;
      vector: number;
  }
  timeContext: {
    start_time: number;
    end_time: number;
  };
  episodeImage?: string;
  listenLink?: string;
  id: string;
  isPlaying: boolean;
  onPlayPause: (id: string) => void;
  onEnded: (id: string) => void;
  shareUrl:string;
  shareLink:string;
  onClipStart?: (progress: ClipProgress) => void;
  onClipProgress?: (progress: ClipProgress) => void;
  authConfig?: AuthConfig | null | undefined;
  presentationContext?:PresentationContext;
  viewMode?: AIClipsViewStyle;
  runId?: string;
  feedId?: string;
  onSignInClick?: () => void;
  error?: { status: number; message: string } | undefined;
  onShareModalOpen?: (isOpen: boolean) => void;
  onSocialShareModalOpen?: (isOpen: boolean) => void;
  shareable?: boolean;
  isHighlighted?: boolean;
  onResultClick?: (paragraphId: string) => void;
}

export const PodcastSearchResultItem = ({
  quote,
  episode,
  creator,
  audioUrl,
  date,
  similarity,
  timeContext,
  episodeImage = '/podcast-logo.png',
  listenLink,
  id,
  isPlaying,
  onPlayPause,
  onEnded,
  shareUrl,
  shareLink,
  onClipProgress,
  authConfig,
  presentationContext = PresentationContext.search,
  viewMode = AIClipsViewStyle.LIST,
  runId,
  feedId,
  onSignInClick,
  error,
  onShareModalOpen,
  onSocialShareModalOpen,
  shareable = false,
  isHighlighted = false,
  onResultClick
}: PodcastSearchResultItemProps) => {
  const [currentTime, setCurrentTime] = useState(timeContext.start_time);
  const [showCopied, setShowCopied] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false); // Image loading state
  const [hasEnded, setHasEnded] = useState(false);
  const [isContinuingBeyondClip, setIsContinuingBeyondClip] = useState(false);
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTimestampsError,setEditTimestampsError] = useState<string|undefined>(undefined);
  const [isShareProcessing, setIsShareProcessing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSocialShareModalOpen, setIsSocialShareModalOpen] = useState(false);
  const [shareClipUrl, setShareClipUrl] = useState<string>('');
  const [shareClipLookupHash, setShareClipLookupHash] = useState<string>('');
  const CLIP_LENGTH_LIMIT_SECONDS = 60 * 10;
  const navigate = useNavigate();

  const audioRef = useRef(null as HTMLAudioElement | null);
  const progressRef = useRef(null as HTMLDivElement | null);

  const duration = timeContext.end_time - timeContext.start_time;
  const progress = isContinuingBeyondClip
  ? 100 // Show full progress when continuing beyond clip
  : currentTime < timeContext.start_time
  ? 0 // Show 0% if playback is before the clip start time
  : Math.min(((currentTime - timeContext.start_time) / duration) * 100, 100);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if(isPlaying === true && isEditModalOpen === true){//pause playback on modal open
      onPlayPause(id);
    }
  },[isEditModalOpen])

  // Listen for events to close SocialShareModal when other modals open
  useEffect(() => {
    const handleCloseAllSocialShareModals = () => {
      if (isShareModalOpen) {
        setIsShareModalOpen(false);
        setShareClipUrl('');
        setShareClipLookupHash('');
      }
    };

    window.addEventListener('closeAllSocialShareModals', handleCloseAllSocialShareModals);
    return () => window.removeEventListener('closeAllSocialShareModals', handleCloseAllSocialShareModals);
  }, [isShareModalOpen]);

  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (!isPlaying) {
          setIsBuffering(true);
          onPlayPause(id); // Notify parent component to handle playback state
          audioRef.current.currentTime = timeContext.start_time;
          await audioRef.current.play();
          setIsBuffering(false);
        } else {
          audioRef.current.pause();
          onPlayPause(id); // Notify parent component to handle pause state
        }
      } catch (error) {
        console.error('Playback error:', error);
        setIsBuffering(false);
      }
    }
  };

  const handleProgressClick = (e: { clientX: number }) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = timeContext.start_time + duration * clickPosition;
  
      audioRef.current.currentTime = Math.max(newTime, 0); // Allow seeking to any time, even before start_time
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  const handleClip = () => {
    // Check for authentication before opening the clip modal
    if (!authConfig || !authConfig.credentials) {
      console.error('No valid auth credentials available');
      if (onSignInClick) {
        // Call the sign-in callback if provided
        onSignInClick();
        return;
      }
    }
    setIsClipModalOpen(true);
  };
  
  const handleClipConfirm = async (start?:number|null, end?:number|null) => {
    if (!authConfig || !authConfig.credentials) {
      console.error('No valid auth credentials available');
      if (onSignInClick) {
        // Call the sign-in callback if provided
        onSignInClick();
        return;
      }
      throw new Error('Authentication required');
    }
  
    setIsClipModalOpen(false);
    if(!onClipProgress){return}
    const startTime = start ?? timeContext.start_time ?? 0;
    const endTime = end ?? timeContext.end_time ?? startTime + 15;
  
    try {
      onClipProgress({
        isProcessing: true,
        creator,
        episode,
        timestamps: [startTime, endTime],
        clipId: shareLink,
        episodeImage,
        lookupHash: id
      });
      
      printLog(`makeClip ${shareLink}, ${startTime}, ${endTime}`);
      printLog(`makeClip auth:${JSON.stringify(authConfig,null,2)}`);
  
      const response = await makeClip(shareLink, authConfig, startTime, endTime);
  
      if (response.status === "completed" && response.url) {
        onClipProgress({
          isProcessing: false,
          creator,
          episode,
          timestamps: [startTime, endTime],
          clipId: response.lookupHash,
          episodeImage,
          cdnLink: response.url,
          lookupHash: id
        });
      } else {
        onClipProgress({
          isProcessing: true,
          creator,
          episode,
          timestamps: [startTime, endTime],
          clipId: response.lookupHash,
          episodeImage,
          pollUrl: response.pollUrl,
          lookupHash: id
        });
      }
    } catch (error) {
      console.error("Failed to create clip:", error);
    }
  };
  
  const handleClipCancel = () => {
    setIsClipModalOpen(false); // Close the modal
  };

  const handleEditTimestamps = () => {
    setIsClipModalOpen(false);
    setIsEditModalOpen(true);
  };

  const resetEditTimestampsError = () => {
    setTimeout(() => {setEditTimestampsError(undefined)},5000);
  }

  const handleUpdateTimestamps = (newStart: number, newEnd: number) => {
    if(newEnd - newStart > CLIP_LENGTH_LIMIT_SECONDS){
      setEditTimestampsError(`Error: Clip length of ${CLIP_LENGTH_LIMIT_SECONDS} seconds exceeded.`);
      resetEditTimestampsError();
      return
    }
    else{
      setEditTimestampsError(undefined);
    }
    
    // Check for authentication before continuing
    if (!authConfig || !authConfig.credentials) {
      console.error('No valid auth credentials available');
      setIsEditModalOpen(false);
      if (onSignInClick) {
        // Call the sign-in callback if provided
        onSignInClick();
        return;
      }
    }
    
    setIsEditModalOpen(false);
    handleClipConfirm(newStart,newEnd);
  };

  const handleShareClip = async () => {
    console.log("Starting share clip process");
    
    // Check for authentication
    if (!authConfig || !authConfig.credentials) {
      console.error('No valid auth credentials available');
      if (onSignInClick) {
        onSignInClick();
        return;
      }
    }

    setIsShareProcessing(true);
    
    try {
      // Step 1: Create clip using makeClip
      printLog(`Creating clip for share: ${shareLink}, start: ${timeContext.start_time}, end: ${timeContext.end_time}`);
      const response = await makeClip(shareLink, authConfig!, timeContext.start_time, timeContext.end_time);
      
      if (response.status === "completed" && response.url) {
        // Clip is ready immediately
        printLog(`Clip ready immediately: ${response.url}`);
        
        // Close any other open SocialShareModals by dispatching a custom event
        window.dispatchEvent(new CustomEvent('closeAllSocialShareModals'));
        
        setShareClipUrl(response.url);
        setShareClipLookupHash(response.lookupHash);
        setIsShareProcessing(false);
        setIsShareModalOpen(true);
      } else {
        // Need to poll for completion
        printLog(`Polling for clip completion with lookupHash: ${response.lookupHash}`);
        setShareClipLookupHash(response.lookupHash);
        await pollForClipCompletion(response.lookupHash);
      }
    } catch (error) {
      console.error("Failed to create clip for sharing:", error);
      setIsShareProcessing(false);
    }
  };

  const pollForClipCompletion = async (lookupHash: string) => {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        printLog(`Polling attempt ${attempts}/${maxAttempts} for clip: ${lookupHash}`);
        
        const clipData = await fetchClipById(lookupHash);
        
        if (clipData && clipData.audio_url) {
          // Clip is ready
          printLog(`Clip completed: ${clipData.audio_url}`);
          setShareClipUrl(clipData.audio_url);
          setIsShareProcessing(false);
          setIsShareModalOpen(true);
          return;
        }
        
        // Continue polling if not ready and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          console.error("Polling timeout: Clip creation took too long");
          setIsShareProcessing(false);
        }
      } catch (error) {
        console.error(`Error polling for clip completion:`, error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Continue polling on error
        } else {
          setIsShareProcessing(false);
        }
      }
    };
    
    poll();
  };

  const handleShare = async () => {
    try {
      let finalShareUrl = shareUrl;
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        // Force localhost in development AND ensure /app prefix is in the path
        finalShareUrl = shareUrl.replace(/^https?:\/\/[^\/]+/, 'http://localhost:3000');
        
        // Fix missing /app prefix
        if (finalShareUrl.includes('/share?') && !finalShareUrl.includes('/app/share?')) {
          finalShareUrl = finalShareUrl.replace('/share?', '/app/share?');
        }
      }
      
      await navigator.clipboard.writeText(finalShareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleListen = () => {
    if (listenLink) {
      window.open(listenLink, '_blank');
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleRestart = async () => {
    if (audioRef.current) {
      setHasEnded(false);
      try {
        audioRef.current.currentTime = timeContext.start_time;
        setCurrentTime(timeContext.start_time);
        await audioRef.current.play();
        onPlayPause(id);
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };
  
  const handleContinuePlaying = async () => {
    if (audioRef.current) {
      setHasEnded(false);
      setIsContinuingBeyondClip(true); // Allow playback beyond the clip segment
      try {
        await audioRef.current.play();
        onPlayPause(id);
      } catch (error) {
        console.error('Playback error:', error);
      }
    }
  };
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentAudioTime = audioRef.current.currentTime;
      setCurrentTime(currentAudioTime);
  
      // Handle clip end logic
      if (currentAudioTime >= timeContext.end_time && !hasEnded && !isContinuingBeyondClip) {
        setHasEnded(true);
        audioRef.current.pause();
        onEnded(id);
      }
    }
  };
  
  // Add conditional rendering based on presentation context
  if (presentationContext === PresentationContext.runHistoryPreview) {
    return (
      <div 
        className={`bg-[#111111] border rounded-lg overflow-hidden cursor-pointer hover:border-gray-700 transition-colors ${
          isHighlighted 
            ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
            : 'border-gray-800'
        }`}
        onClick={() => {
          if (runId) {
            navigate(`/app/feed/${feedId}/clipBatch/${runId}`);
          }
        }}
      >
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src={episodeImage}
              alt={creator}
              className="w-32 h-32 rounded-md border border-gray-700 object-cover mx-auto sm:mx-0 flex-shrink-0"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-medium text-white mb-1">
                    Clips Batch Run
                  </h3>
                  {date && (
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-400">{formatShortDate(date)}</span>
                    </div>
                  )}
                  <p className="text-base text-gray-400 truncate line-clamp-1">{creator}</p>
                  <p className="text-base text-gray-400 truncate line-clamp-1">{episode}</p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0 ml-2" size={32} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view for clipBatch
  if (viewMode === AIClipsViewStyle.GRID && presentationContext === PresentationContext.clipBatch) {
    return (
      <div className={`bg-[#111111] border rounded-lg overflow-hidden transition-all ${
        isHighlighted 
          ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
          : 'border-gray-800'
      }`}>
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = timeContext.start_time;
              setCurrentTime(timeContext.start_time);
            }
            onEnded(id);
          }}
        />
        
        {/* Episode Image with Better Aspect Ratio */}
        <div className="relative h-32 group cursor-pointer" onClick={handlePlayPause}>
          {!imageLoaded && (
            <div className="w-full h-full bg-gray-800 animate-pulse" />
          )}
          <img
            src={episodeImage}
            alt={episode}
            className={`w-full h-full object-cover ${
              imageLoaded ? 'block' : 'hidden'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(false)}
          />
          
          {/* Play/Pause Button - Always Visible */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              className={`p-2 rounded-full text-black transition-colors ${
                audioUrl === 'URL unavailable'
                  ? 'bg-gray-700'
                  : 'hover:bg-gray-200 bg-white'
              }`}
              disabled={audioUrl === 'URL unavailable'}
            >
              {isBuffering ? (
                <Loader className="animate-spin" size={16} />
              ) : isPlaying ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Content - Title and Action Buttons Side by Side */}
        <div className="p-4 flex items-start gap-4 min-h-[80px]">
          {/* Title Text with Date */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white line-clamp-3">{episode}</h3>
            {date && (
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">{formatShortDate(date)}</span>
              </div>
            )}
          </div>
          
          {/* Action Buttons - 2x2 Grid with Borders and Smaller Size */}
          <div className="grid grid-cols-2 gap-2 flex-shrink-0">
            <button
              className="p-2.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-colors flex items-center justify-center"
              onClick={handleShare}
              title="Copy Link"
            >
              {showCopied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
            </button>
            {listenLink && (
              <button
                className="p-2.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-colors flex items-center justify-center"
                onClick={handleListen}
                title="Listen"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            {onClipProgress && (
              <button
                className="p-2.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-colors flex items-center justify-center"
                onClick={handleClip}
                title="Clip"
              >
                <Scissors className="h-4 w-4" />
              </button>
            )}
            {shareable && (
              <button
                className="p-2.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-colors flex items-center justify-center"
                onClick={handleShareClip}
                disabled={isShareProcessing}
                title="Share"
              >
                {isShareProcessing ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Share className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Share Modal for Grid View */}
        {isShareModalOpen && shareClipUrl && (
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => {
              setIsShareModalOpen(false);
              setShareClipUrl('');
              setShareClipLookupHash('');
            }}
            fileUrl={shareClipUrl}
            title="Share This Clip"
            itemName="clip"
            showCopy={true}
            showDownload={true}
            showTwitter={true}
            showNostr={true}
            copySuccessMessage="Clip link copied!"
            downloadButtonLabel="Download Clip"
            twitterButtonLabel="Share on Social Media"
            nostrButtonLabel="Share on Nostr"
            lookupHash={shareClipLookupHash}
            auth={authConfig}
            onSocialShareModalOpen={onSocialShareModalOpen}
          />
        )}

        {/* Social Share Modal for Grid View */}
        {isSocialShareModalOpen && shareClipUrl && (
          <SocialShareModal
            isOpen={isSocialShareModalOpen}
            onClose={() => {
              setIsSocialShareModalOpen(false);
              setShareClipUrl('');
              setShareClipLookupHash('');
              onSocialShareModalOpen?.(false);
            }}
            fileUrl={shareClipUrl}
            itemName="clip"
            onComplete={(success, platform) => {
              printLog(`Share completed: ${success} on ${platform}`);
              setIsSocialShareModalOpen(false);
              setShareClipUrl('');
              setShareClipLookupHash('');
              onSocialShareModalOpen?.(false);
            }}
            platform={SocialPlatform.Twitter}
            lookupHash={shareClipLookupHash}
            auth={authConfig}
          />
        )}

        {/* Edit Timestamps Modal for Grid View */}
        {isEditModalOpen && (
          <EditTimestampsModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            audioUrl={audioUrl}
            episodeTitle={episode}
            episodeDate={date}
            creator={creator}
            episodeImage={episodeImage}
            initialStartTime={timeContext.start_time}
            initialEndTime={timeContext.end_time}
            onConfirm={handleUpdateTimestamps}
            editTimestampsError={editTimestampsError}
          />
        )}

        {/* Clip Modal for Grid View */}
        {isClipModalOpen && (
          <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-[9999]">
            <div className="bg-[#111111] rounded-lg p-6 text-center w-[90%] max-w-sm border border-gray-800 relative mb-36">
              {/* Close Button */}
              <button
                onClick={handleClipCancel}
                className="absolute top-2 right-2 text-white text-3xl"
                aria-label="Close"
              >
                &times;
              </button>

              {/* Modal Content */}
              <div className="flex flex-col items-center space-y-6">
                {/* Edit Timestamps Button */}
                <button
                  onClick={handleEditTimestamps}
                  className="flex items-center justify-center px-6 py-3 bg-[#1A1A1A] text-white border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors w-full mt-8 z-100"
                >
                  <Edit2 className="w-5 h-5 mr-2" />
                  Edit Timestamps
                </button>
                {/* Clip This Button */}
                <button
                  onClick={() => handleClipConfirm(null,null)}
                  className="flex items-center font-bold justify-center px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-400 transition-colors w-full mt-8"
                >
                  <Scissors className="w-5 h-5 mr-2" />
                  Clip This
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Return original component rendering for other contexts
  return (
    <div 
      className={`bg-[#111111] border rounded-lg overflow-hidden z-100 transition-all cursor-pointer ${
        isHighlighted 
          ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
          : 'border-gray-800'
      }`}
      onClick={() => {
        // Call the onResultClick callback if provided (for split-screen context panel)
        if (onResultClick) {
          printLog(`Result clicked: ${shareLink}`);
          onResultClick(shareLink);
        }
      }}
    >
      <div className="border-b border-gray-800 bg-[#0A0A0A] p-4">

        {
         isEditModalOpen &&( <EditTimestampsModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            audioUrl={audioUrl}
            episodeTitle={episode}
            episodeDate={date}
            creator={creator}
            episodeImage={episodeImage}
            initialStartTime={timeContext.start_time}
            initialEndTime={timeContext.end_time}
            onConfirm={handleUpdateTimestamps}
            editTimestampsError={editTimestampsError}
          />)
        }
      {isClipModalOpen && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-[9999]">
          <div className="bg-[#111111] rounded-lg p-6 text-center w-[90%] max-w-sm border border-gray-800 relative mb-36">
            {/* Close Button */}
            <button
              onClick={handleClipCancel}
              className="absolute top-2 right-2 text-white text-3xl"
              aria-label="Close"
            >
              &times;
            </button>

            {/* Modal Content */}
            <div className="flex flex-col items-center space-y-6">
              {/* Edit Timestamps Button */}
              <button
                onClick={handleEditTimestamps} // Replace with the logic for editing timestamps
                className="flex items-center justify-center px-6 py-3 bg-[#1A1A1A] text-white border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors w-full mt-8 z-100"
              >
                <Edit2 className="w-5 h-5 mr-2" />
                Edit Timestamps
              </button>
              {/* Clip This Button */}
              {(<button
                onClick={() => handleClipConfirm(null,null)}
                className="flex items-center font-bold justify-center px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-400 transition-colors w-full mt-8"
              >
                <Scissors className="w-5 h-5 mr-2" />
                Clip This
              </button>)}
            </div>
          </div>
        </div>
      )}
        <div className="flex flex-col sm:flex-row">
          {/* Episode Artwork */}
          <div className="flex-shrink-0 mb-2 sm:mb-0 sm:mr-4">
            {!imageLoaded && (
              <div className="w-32 h-32 rounded-md mx-auto sm:mx-0 border border-gray-700 bg-gray-800 animate-pulse" />
            )}
            <img
              src={episodeImage}
              alt={episode}
              className={`w-20 h-20 sm:w-32 sm:h-32 rounded-md mx-auto sm:mx-0 border border-gray-700 ${
                imageLoaded ? 'block' : 'hidden'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
          </div>
  
          <div className="flex-grow min-w-0">
            <div className="flex flex-col sm:flex-row sm:justify-between">
              {/* Episode text */}
              <div className="flex-grow pr-0 sm:pr-4 min-w-0 w-full sm:max-w-[calc(100%-220px)]">
                <h3 className="text-lg font-medium text-white line-clamp-1 sm:line-clamp-2">{episode}</h3>
                <p className="text-sm text-gray-400 line-clamp-1">{creator}</p>
                {date && (
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{formatShortDate(date)}</span>
                  </div>
                )}
              </div>
  
              {/* Action Buttons */}
              <div className={`mt-4 sm:mt-0 sm:w-[200px] sm:min-w-[200px] sm:flex-shrink-0 grid ${presentationContext === PresentationContext.clipBatch ? 'grid-cols-2 sm:grid-cols-2 grid-rows-2' : 'grid-rows-1 grid-flow-col sm:grid-cols-2 sm:grid-flow-row'} gap-2`}>
                <button
                  className="flex items-center justify-start px-2 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  onClick={handleShare}
                >
                  <Link className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{showCopied ? 'Copied!' : 'Link'}</span>
                </button>
                <button
                  className={`flex items-center justify-start px-2 py-2 rounded-md text-sm ${
                    listenLink
                      ? 'text-gray-300 hover:bg-gray-800 transition-colors'
                      : 'text-gray-600'
                  }`}
                  onClick={handleListen}
                  disabled={!listenLink}
                >
                  <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Listen</span>
                </button>
                {onClipProgress && (<button
                  className="flex items-center justify-start px-2 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  onClick={handleClip}
                >
                  <Scissors className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Clip</span>
                </button>
                )}
                {presentationContext === PresentationContext.clipBatch && shareable && (
                  <button
                    className="flex items-center justify-start px-2 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={handleShareClip}
                    disabled={isShareProcessing}
                  >
                    {isShareProcessing ? (
                      <Loader className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
                    ) : (
                      <Share className="h-4 w-4 mr-2 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {isShareProcessing ? '' : 'Share'}
                    </span>
                  </button>
                )}
              </div>
            </div>
  
            {/* Mini Player */}
            <div className="mt-4 pl-0">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = timeContext.start_time;
                    setCurrentTime(timeContext.start_time);
                  }
                  onEnded(id);
                }}
              />
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {hasEnded && !isContinuingBeyondClip ? (
                    // Rewind and Continue buttons at clip end
                    <>
                      <button
                        onClick={handleRestart}
                        className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                        title="Restart from clip beginning"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={handleContinuePlaying}
                        className="flex items-center px-4 py-2 rounded-md bg-white text-black transition-colors hover:bg-gray-200"
                        title="Continue playing beyond clip"
                      >
                        Continue
                        <SkipForward className="ml-2 h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    // Regular playback controls
                    <>
                      <button
                        onClick={() => handleSkip(-5)}
                        className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                        title="Back 5 seconds"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className={`p-2 rounded-full text-black transition-colors ${
                          audioUrl === 'URL unavailable'
                            ? 'bg-gray-700'
                            : 'hover:bg-gray-200 bg-white'
                        }`}
                        disabled={audioUrl === 'URL unavailable'}
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isBuffering ? (
                          <Loader className="animate-spin" size={16} />
                        ) : isPlaying ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleSkip(5)}
                        className="p-2 rounded-full text-white transition-colors hover:bg-gray-700"
                        title="Forward 5 seconds"
                      >
                        <RotateCw size={16} />
                      </button>
                    </>
                  )}
                </div>
  
                {/* Progress Bar */}
                <div
                  ref={progressRef}
                  className="flex-grow h-1 bg-gray-700 rounded cursor-pointer relative"
                  onClick={handleProgressClick}
                >
                  {/* Progress Indicator */}
                  <div
                    className="h-full bg-white rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Demarcation Point for Clip Continuation */}
                  {isContinuingBeyondClip && (
                    <div
                      className="absolute right-0 top-0 h-full w-1 bg-gray-300"
                      title="Clip Continued"
                    />
                  )}
                </div>
  
                {/* Clip Continued Label */}
                {isContinuingBeyondClip && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    (Clip Continued)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  
      <div className="p-4 space-y-2">
        <div className="text-sm text-gray-300 bg-[#0A0A0A] p-3 rounded-md line-clamp-4 sm:line-clamp-6 pb-1">
          {quote}
        </div>
        {presentationContext === PresentationContext.search && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              Similarity: {(similarity.combined).toFixed(3)}
              {similarity.vector !== similarity.combined && (
                <span className="ml-2 text-gray-600">
                  (Vector: {(similarity.vector).toFixed(3)})
                </span>
              )}
            </span>
            <span>
              {formatTime(timeContext.start_time)} - {formatTime(timeContext.end_time)}
            </span>
          </div>
        )}

        {presentationContext === PresentationContext.dashboard && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              Relevance: {(similarity.combined * 100).toFixed(0)}%
            </span>
            <span>
              {formatTime(timeContext.start_time)} - {formatTime(timeContext.end_time)}
            </span>
          </div>
        )}
      </div>

      {/* Share Modal (Link, Download, etc.) */}
      {isShareModalOpen && shareClipUrl && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setShareClipUrl('');
            setShareClipLookupHash('');
          }}
          fileUrl={shareClipUrl}
          title="Share This Clip"
          itemName="clip"
          showCopy={true}
          showDownload={true}
          showTwitter={true}
          showNostr={true}
          copySuccessMessage="Clip link copied!"
          downloadButtonLabel="Download Clip"
          twitterButtonLabel="Share on Social Media"
          nostrButtonLabel="Share on Nostr"
          lookupHash={shareClipLookupHash}
          auth={authConfig}
          onSocialShareModalOpen={onSocialShareModalOpen}
        />
      )}

      {/* Social Share Modal (Twitter/Nostr Cross-posting) */}
      {isSocialShareModalOpen && shareClipUrl && (
        <SocialShareModal
          isOpen={isSocialShareModalOpen}
          onClose={() => {
            setIsSocialShareModalOpen(false);
            setShareClipUrl('');
            setShareClipLookupHash('');
            onSocialShareModalOpen?.(false);
          }}
          fileUrl={shareClipUrl}
          itemName="clip"
          onComplete={(success, platform) => {
            printLog(`Share completed: ${success} on ${platform}`);
            setIsSocialShareModalOpen(false);
            setShareClipUrl('');
            setShareClipLookupHash('');
            onSocialShareModalOpen?.(false);
          }}
          platform={SocialPlatform.Twitter}
          lookupHash={shareClipLookupHash}
          auth={authConfig}
        />
      )}
    </div>
  );
  
  
};

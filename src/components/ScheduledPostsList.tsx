import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Twitter, Edit, Trash2, RefreshCw, AlertCircle, CheckCircle, XCircle, PenTool, X } from 'lucide-react';
import { printLog } from '../constants/constants.ts';
import DeleteConfirmationModal from './DeleteConfirmationModal.tsx';
import SocialShareModal, { SocialPlatform } from './SocialShareModal.tsx';
import ScheduledPostService from '../services/scheduledPostService.ts';
import { ScheduledPost, ScheduledPostsQuery } from '../types/scheduledPost.ts';
import { formatScheduledDate, formatShortDate } from '../utils/time.ts';

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

// Constants for preview sizing (matching SocialShareModal)
const ASPECT_RATIO = 16 / 9;
const PREVIEW_WIDTH = 160; // Smaller for list view
const PREVIEW_HEIGHT = (PREVIEW_WIDTH / ASPECT_RATIO) * 1.3; // Increased by 30%

// Helper function to get user signature from localStorage
const getUserSignature = (): string | null => {
  try {
    const settings = localStorage.getItem('userSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      const signature = parsed.crosspostSignature;
      
      // Handle null, undefined, or empty string cases
      if (signature == null || signature === '') {
        return null;
      }
      
      // Trim whitespace and check if it's effectively empty
      const trimmedSignature = signature.trim();
      return trimmedSignature.length > 0 ? trimmedSignature : null;
    }
  } catch (error) {
    console.error('Error reading user signature from localStorage:', error);
  }
  return null;
};

// Helper function to build final content with signature and media URL for Nostr posts
const buildFinalContentForNostr = (baseContent: string, mediaUrl: string): string => {
  printLog(`=== buildFinalContentForNostr DEBUG ===`);
  printLog(`Input baseContent: "${baseContent}"`);
  printLog(`Input mediaUrl: "${mediaUrl}"`);
  
  const signature = getUserSignature();
  printLog(`Retrieved signature: "${signature}"`);
  
  const signaturePart = signature ? `\n\n${signature}` : '';
  const mediaUrlPart = mediaUrl ? `\n\n${mediaUrl}` : '';
  const callToActionPart = `\n\nShared via https://pullthatupjamie.ai`;
  
  printLog(`Signature part: "${signaturePart}"`);
  printLog(`Media URL part: "${mediaUrlPart}"`);
  printLog(`Call to action part: "${callToActionPart}"`);
  
  const result = `${baseContent}${signaturePart}${mediaUrlPart}${callToActionPart}`;
  printLog(`Final result: "${result}"`);
  printLog(`=== buildFinalContentForNostr DEBUG END ===`);
  
  return result;
};

interface ScheduledPostsListProps {
  className?: string;
  autoSignAll?: boolean; // URL parameter to auto-navigate to unsigned and prompt Sign All
}

const ScheduledPostsList: React.FC<ScheduledPostsListProps> = ({ className = '', autoSignAll = false }) => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'posted' | 'failed' | 'unsigned'>('all');
  const hasProcessedAutoSignAll = useRef(false);
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<ScheduledPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Sign All modal state
  const [showSignAllModal, setShowSignAllModal] = useState(false);
  const [isSigningAll, setIsSigningAll] = useState(false);
  
  // Review Each state
  const [isReviewingEach, setIsReviewingEach] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(-1);
  const [reviewQueue, setReviewQueue] = useState<ScheduledPost[]>([]);
  
  // SocialShareModal state
  const [showSocialShareModal, setShowSocialShareModal] = useState(false);
  const [currentPost, setCurrentPost] = useState<ScheduledPost | null>(null);
  
  // Slot tracking for scheduling
  const [usedSlots, setUsedSlots] = useState<Set<string>>(new Set());
  
  // Progress tracking for Sign All
  const [signAllProgress, setSignAllProgress] = useState({ current: 0, total: 0 });
  const [cancelSignAll, setCancelSignAll] = useState(false);

  // Helper function to get the correct ID (handles both postId and _id)
  const getPostId = (post: ScheduledPost): string => {
    return post.postId || post._id || '';
  };

  // Utility function to get user's scheduled slots from localStorage
  const getUserScheduledSlots = () => {
    try {
      const userSettings = localStorage.getItem('userSettings');
      if (userSettings) {
        const parsed = JSON.parse(userSettings);
        return parsed.scheduledPostSlots || [];
      }
    } catch (error) {
      console.error('Error reading user scheduled slots:', error);
    }
    return [];
  };

  // Utility function to find next available slot
  const getNextAvailableSlot = (currentUsedSlots: Set<string>) => {
    const slots = getUserScheduledSlots().filter((slot: any) => slot.enabled);
    if (slots.length === 0) {
      printLog('No enabled slots found, using current time + 1 hour');
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Create slot instances with dates for the next 2 weeks
    const slotInstances = [];
    for (let week = 0; week < 2; week++) {
      for (const slot of slots) {
        const slotKey = `${week}-${slot.dayOfWeek}-${slot.time}`;
        if (!currentUsedSlots.has(slotKey)) {
          let dayDiff = (slot.dayOfWeek - currentDayOfWeek + 7) % 7;
          if (week === 0 && dayDiff === 0 && slot.time <= currentTimeString) {
            dayDiff = 7; // Move to next week if time has passed today
          }
          dayDiff += week * 7; // Add week offset

          const [hours, minutes] = slot.time.split(':').map(Number);
          const slotDate = new Date(now);
          slotDate.setDate(now.getDate() + dayDiff);
          slotDate.setHours(hours, minutes, 0, 0);

          slotInstances.push({
            date: slotDate,
            key: slotKey,
            slot: slot
          });
        }
      }
    }

    // Sort by date and return the earliest available slot
    slotInstances.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (slotInstances.length > 0) {
      return {
        date: slotInstances[0].date,
        slotKey: slotInstances[0].key
      };
    }

    // Fallback: current time + 1 hour
    printLog('No available slots found, using current time + 1 hour');
    return { 
      date: new Date(Date.now() + 60 * 60 * 1000),
      slotKey: `fallback-${Date.now()}`
    };
  };

  // Load scheduled posts
  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const query: ScheduledPostsQuery = {
        status: filter === 'all' ? undefined : filter,
        limit: 50,
        sortBy: 'scheduledFor',
        sortOrder: 'desc'
      };
      
      const response = await ScheduledPostService.getScheduledPosts(query);
      setPosts(response.posts);
    } catch (err) {
      console.error('Error loading scheduled posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  // Load posts on mount and filter change
  useEffect(() => {
    loadPosts();
  }, [filter]);

  // Handle autoSignAll functionality
  useEffect(() => {
    if (autoSignAll && posts.length > 0 && !hasProcessedAutoSignAll.current) {
      hasProcessedAutoSignAll.current = true;
      
      // Set filter to unsigned
      setFilter('unsigned');
      
      // Check if there are unsigned posts
      const unsignedPosts = posts.filter(post => post.status === 'unsigned');
      
      if (unsignedPosts.length > 0) {
        // Small delay to ensure UI has updated
        setTimeout(() => {
          printLog(`Auto Sign All: Found ${unsignedPosts.length} unsigned posts, prompting user`);
          setShowSignAllModal(true);
        }, 500);
      } else {
        printLog('Auto Sign All: No unsigned posts found');
      }
    }
  }, [autoSignAll, posts]);

  // Note: Using imported formatScheduledDate from utils/time.ts

  // Get status icon and color
  const getStatusIcon = (status: ScheduledPost['status']) => {
    switch (status) {
      case 'unsigned':
        return <Edit className="w-4 h-4 text-purple-400" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'posted':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get platform icon
  const getPlatformIcon = (platform: 'twitter' | 'nostr') => {
    switch (platform) {
      case 'twitter':
        return <Twitter className="w-4 h-4 text-blue-400" />;
      case 'nostr':
        return <img src="/nostr-logo-square.png" alt="Nostr" className="w-4 h-4 opacity-80" />;
      default:
        return null;
    }
  };

  // Handle delete button click
  const handleDeleteClick = (post: ScheduledPost) => {
    setPostToDelete(post);
    setIsDeleteModalOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;

    try {
      setIsDeleting(true);
      const postId = getPostId(postToDelete);
      await ScheduledPostService.deleteScheduledPost(postId);
      
      // Remove the deleted post from the local state
      setPosts(prevPosts => prevPosts.filter(post => getPostId(post) !== postId));
      
      // Close the modal
      setIsDeleteModalOpen(false);
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting scheduled post:', error);
      // Could add error handling UI here
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle delete modal close
  const handleDeleteModalClose = () => {
    if (!isDeleting) {
      setIsDeleteModalOpen(false);
      setPostToDelete(null);
    }
  };

  // Handle retry
  const handleRetry = async (postId: string) => {
    try {
      await ScheduledPostService.retryScheduledPost(postId);
      await loadPosts(); // Refresh list
    } catch (err) {
      console.error('Error retrying post:', err);
      printLog('Failed to retry post. Please try again.');
    }
  };

  // Unsigned post action handlers
  const handleSignAllUnsigned = () => {
    const unsignedPosts = posts.filter(post => post.status === 'unsigned');
    printLog(`Sign All clicked - would sign ${unsignedPosts.length} unsigned posts`);
    setShowSignAllModal(true);
  };

  const handleReviewEachUnsigned = () => {
    const unsignedPosts = posts.filter(post => post.status === 'unsigned');
    printLog(`Review Each clicked - would open review interface for ${unsignedPosts.length} unsigned posts`);
    setReviewQueue(unsignedPosts);
    setCurrentReviewIndex(0);
    setIsReviewingEach(true);
    if (unsignedPosts.length > 0) {
      setCurrentPost(unsignedPosts[0]);
      setShowSocialShareModal(true);
    }
  };

  const handleRejectAllUnsigned = async () => {
    const unsignedPosts = posts.filter(post => post.status === 'unsigned');
    printLog(`Reject All clicked - rejecting ${unsignedPosts.length} unsigned posts`);
    
    try {
      // Delete all unsigned posts (reject = delete for now)
      const deletePromises = unsignedPosts.map(post => 
        ScheduledPostService.deleteScheduledPost(getPostId(post))
      );
      
      await Promise.allSettled(deletePromises);
      
      printLog(`Successfully rejected/deleted ${unsignedPosts.length} unsigned posts`);
      
      // Refresh the list
      await loadPosts();
      
    } catch (error) {
      console.error('Error rejecting all unsigned posts:', error);
      printLog(`Failed to reject all unsigned posts: ${error}`);
    }
  };

  // Cancel Review Each process
  const handleCancelReviewEach = () => {
    printLog('Review Each process cancelled by user');
    setIsReviewingEach(false);
    setCurrentReviewIndex(-1);
    setReviewQueue([]);
    setShowSocialShareModal(false);
    setCurrentPost(null);
    
    // Refresh the list
    loadPosts();
  };

  // Sign All confirmation handler
  const handleSignAllConfirm = async () => {
    setShowSignAllModal(false);
    setIsSigningAll(true);
    
    const unsignedPosts = posts.filter(post => post.status === 'unsigned');
    setSignAllProgress({ current: 0, total: unsignedPosts.length });
    printLog(`Starting Sign All process for ${unsignedPosts.length} posts`);
    
    // Reset used slots for this batch
    const currentUsedSlots = new Set<string>();
    
    for (let i = 0; i < unsignedPosts.length && !cancelSignAll; i++) {
      const post = unsignedPosts[i];
      setSignAllProgress({ current: i + 1, total: unsignedPosts.length });
      printLog(`Processing post ${i + 1}/${unsignedPosts.length}: ${post.postId || post._id}`);
      
      // Set current post to show in modal
      setCurrentPost(post);
      setShowSocialShareModal(true);
      
      // Check for cancellation
      if (cancelSignAll) {
        printLog('Sign All process cancelled by user');
        break;
      }
      
      try {
        // Check if Nostr extension is available
        if (!window.nostr) {
          throw new Error('Nostr extension not available. Please install/enable a NIP-07 extension.');
        }
        
        // 1. Access both the text and media url
        const baseContent = post.content.text || '';
        const mediaUrl = post.content.mediaUrl || '';
        
        printLog(`DEBUG: baseContent="${baseContent}"`);
        printLog(`DEBUG: mediaUrl="${mediaUrl}"`);
        
        // 2. Append the mediaurl to the text
        const finalContent = `${baseContent}\n\n${mediaUrl}`;
        
        printLog(`DEBUG: finalContent="${finalContent}"`);
        
        // 3. Sign using the user's extension assuming that that is the kind 1 event itself. Nothing else. Just that text
        const eventToSign = {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          content: finalContent,
          tags: []
        };
        
        const signedEvent = await window.nostr.signEvent(eventToSign);
        
        // Determine scheduled date
        let scheduledDate = new Date(post.scheduledFor);
        const now = new Date();
        
        if (scheduledDate <= now) {
          // Date is in the past, find next available slot
          const nextSlot = getNextAvailableSlot(currentUsedSlots);
          scheduledDate = nextSlot.date;
          currentUsedSlots.add(nextSlot.slotKey);
          printLog(`Post ${post.postId || post._id} rescheduled to ${scheduledDate.toISOString()} using slot ${nextSlot.slotKey}`);
        } else {
          printLog(`Post ${post.postId || post._id} keeping original date ${scheduledDate.toISOString()}`);
        }
        
        // Sign and promote the post
        printLog(`About to call API for post ${post.postId || post._id} with signed event:`, signedEvent);
        printLog(`Scheduled date: ${scheduledDate.toISOString()}`);
        
        const result = await ScheduledPostService.signAndPromotePost(
          post.postId || post._id,
          signedEvent,
          scheduledDate,
          post
        );
        
        printLog(`API response for post ${post.postId || post._id}:`, result);
        printLog(`=== NOSTR SIGNING DEBUG END ===`);
        
      } catch (error) {
        console.error(`Error signing post ${post.postId || post._id}:`, error);
        printLog(`Failed to sign post ${post.postId || post._id}: ${error}`);
        // Continue with next post even if one fails
      }
      
      // Small delay between posts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setShowSocialShareModal(false);
    setCurrentPost(null);
    setIsSigningAll(false);
    setSignAllProgress({ current: 0, total: 0 });
    setCancelSignAll(false); // Reset cancellation flag
    setUsedSlots(new Set()); // Reset for next batch
    
    printLog(cancelSignAll ? 'Sign All process cancelled' : 'Sign All process completed');
    
    // Refresh the list
    await loadPosts();
  };

  // Individual post signing handlers
  const handleSignIndividualPost = async (post: ScheduledPost) => {
    try {
      printLog(`🔥 BUTTON PRESSED! POST DATA: ${JSON.stringify(post, null, 2)}`);
      const postId = getPostId(post);
      printLog(`Starting individual sign for post: ${postId}`);
      
      // Check if Nostr extension is available
      if (!window.nostr) {
        throw new Error('Nostr extension not available. Please install/enable a NIP-07 extension.');
      }
      
      // 1. Access both the text and media url
      const baseContent = post.content.text || '';
      const mediaUrl = post.content.mediaUrl || '';
      
      printLog(`DEBUG: baseContent="${baseContent}"`);
      printLog(`DEBUG: mediaUrl="${mediaUrl}"`);
      
      // 2. Append the mediaurl to the text
      const finalContent = `${baseContent}\n\n${mediaUrl}`;
      
      printLog(`DEBUG: finalContent="${finalContent}"`);
      
      // 3. Sign using the user's extension assuming that that is the kind 1 event itself. Nothing else. Just that text
      const eventToSign = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: finalContent,
        tags: []
      };
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventToSign);
      printLog(`Successfully signed event for post ${postId}: ${signedEvent.id}`);
      
      // Determine scheduled date
      let scheduledDate = new Date(post.scheduledFor);
      const now = new Date();
      
      if (scheduledDate <= now) {
        // Date is in the past, use next available slot
        const nextSlot = getNextAvailableSlot(new Set());
        scheduledDate = nextSlot.date;
        printLog(`Post ${postId} rescheduled to ${scheduledDate.toISOString()}`);
      }
      
      // Sign and promote the post
      const result = await ScheduledPostService.signAndPromotePost(
        postId,
        signedEvent,
        scheduledDate,
        post
      );
      
      printLog(`Successfully signed and promoted individual post: ${result.postId}`);
      
      // Refresh the list
      await loadPosts();
      
    } catch (error) {
      console.error(`Error signing individual post:`, error);
      printLog(`Failed to sign individual post: ${error}`);
    }
  };

  const handleRejectIndividualPost = async (post: ScheduledPost) => {
    try {
      const postId = getPostId(post);
      printLog(`Rejecting individual post: ${postId}`);
      
      // For now, we'll delete the post (reject = delete)
      // TODO: Update this if there's a specific "reject" status
      await ScheduledPostService.deleteScheduledPost(postId);
      
      printLog(`Successfully rejected/deleted post: ${postId}`);
      
      // Refresh the list
      await loadPosts();
      
    } catch (error) {
      console.error(`Error rejecting individual post:`, error);
      printLog(`Failed to reject individual post: ${error}`);
    }
  };

  // Review Each navigation handlers
  const handleReviewNext = async (action: 'sign' | 'cancel' | 'dismiss') => {
    if (!currentPost || currentReviewIndex === -1) return;
    
    const postId = getPostId(currentPost);
    
    if (action === 'sign') {
      printLog(`User chose to sign post: ${postId}`);
      // TODO: Implement actual signing logic
    } else if (action === 'cancel') {
      printLog(`User chose to cancel/reject post: ${postId}`);
      // TODO: Implement rejection logic
    } else {
      printLog(`User dismissed post: ${postId}`);
    }
    
    // Move to next post or finish
    const nextIndex = currentReviewIndex + 1;
    if (nextIndex < reviewQueue.length) {
      setCurrentReviewIndex(nextIndex);
      setCurrentPost(reviewQueue[nextIndex]);
      // Modal stays open for next post
    } else {
      // Finished reviewing all posts
      setShowSocialShareModal(false);
      setCurrentPost(null);
      setIsReviewingEach(false);
      setCurrentReviewIndex(-1);
      setReviewQueue([]);
      
      printLog('Review Each process completed');
      
      // Refresh the list
      await loadPosts();
    }
  };

  // Handle social share modal close during review process
  const handleSocialShareModalClose = () => {
    if (isReviewingEach) {
      // Treat modal close as dismiss during review process
      handleReviewNext('dismiss');
    } else {
      setShowSocialShareModal(false);
      setCurrentPost(null);
    }
  };

  // Handle edit
  const handleEdit = (post: ScheduledPost) => {
    setSelectedPost(post);
    setIsEditModalOpen(true);
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedPost(null);
  };

  // Handle post update
  const handlePostUpdate = (updatedPost: ScheduledPost) => {
    // Update the post in the local state (optimistic update)
    setPosts(prevPosts => 
      prevPosts.map(post => 
        getPostId(post) === getPostId(updatedPost) ? updatedPost : post
      )
    );
    
    // Close the modal
    handleEditModalClose();
    
    // Optionally refresh the list to ensure consistency with server
    // loadPosts();
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-xl font-semibold text-white hidden md:block">Scheduled Posts</h2>
            {isSigningAll && (
              <div className="mt-1 flex items-center gap-2 text-purple-400 text-sm">
                <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Processing post {signAllProgress.current}/{signAllProgress.total}...
                <button
                  onClick={() => setCancelSignAll(true)}
                  className="ml-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
             {isReviewingEach && (
               <div className="mt-1 flex items-center gap-2 text-blue-400 text-sm">
                 <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                 Reviewing post {currentReviewIndex + 1}/{reviewQueue.length}...
                 <button
                   onClick={handleCancelReviewEach}
                   className="ml-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                 >
                   Cancel Series
                 </button>
               </div>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {filter === 'unsigned' && (
            <>
              <button
                onClick={handleSignAllUnsigned}
                disabled={loading || isSigningAll || posts.filter(p => p.status === 'unsigned').length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSigningAll && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isSigningAll ? 'Signing...' : `Sign All (${posts.filter(p => p.status === 'unsigned').length})`}
              </button>
              <button
                onClick={handleReviewEachUnsigned}
                disabled={loading || isSigningAll || isReviewingEach || posts.filter(p => p.status === 'unsigned').length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReviewingEach ? 'Reviewing...' : 'Review Each'}
              </button>
              <button
                onClick={handleRejectAllUnsigned}
                disabled={loading || isSigningAll || isReviewingEach || posts.filter(p => p.status === 'unsigned').length === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject All
              </button>
            </>
          )}
          <button
            onClick={loadPosts}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg">
        {(['all', 'scheduled', 'posted', 'failed', 'unsigned'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize
              ${filter === filterOption 
                ? (filterOption === 'unsigned' ? 'bg-purple-600 text-white' : 'bg-white text-black')
                : (filterOption === 'unsigned' ? 'text-purple-300 hover:text-purple-200 hover:bg-purple-800/30' : 'text-gray-400 hover:text-white hover:bg-gray-800')
              }`}
          >
            {filterOption}
          </button>
        ))}
      </div>

      {/* Content area */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-400">Loading scheduled posts...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={loadPosts}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No posts found</p>
          <p className="text-gray-500 text-sm">
            {filter === 'all' ? 'Create your first scheduled post!' : `No ${filter} posts yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={getPostId(post)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between">
                {/* Media Preview */}
                {post.content.mediaUrl && (
                  <div className="mr-4 flex-shrink-0">
                    <div
                      style={{
                        width: PREVIEW_WIDTH,
                        height: PREVIEW_HEIGHT,
                        position: 'relative',
                        background: '#222',
                        borderRadius: 6,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* Check if it's a video */}
                      {post.content.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                        <>
                          {/* Video thumbnail with play icon */}
                          <img
                            src={`${post.content.mediaUrl}?thumbnail=1`}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                            }}
                            onError={(e) => {
                              // Fallback to video element if thumbnail fails
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const video = target.nextElementSibling as HTMLVideoElement;
                              if (video) video.style.display = 'block';
                            }}
                          />
                          <video
                            src={post.content.mediaUrl}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              display: 'none',
                              background: '#222',
                            }}
                            muted
                            playsInline
                            preload="metadata"
                          />
                          {/* Play icon overlay */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                          }}>
                            <svg width={12} height={12} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="18" cy="18" r="18" fill="rgba(0,0,0,0.6)"/>
                              <polygon points="14,11 27,18 14,25" fill="#fff" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        /* Image preview */
                        <img
                          src={post.content.mediaUrl}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col" style={{ minHeight: post.content.mediaUrl ? PREVIEW_HEIGHT : 'auto' }}>
                  {/* Header with platform and status */}
                  <div className="flex items-center space-x-2 mb-2">
                    {getPlatformIcon(post.platform)}
                    <span className="text-base text-gray-400 capitalize">{post.platform}</span>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(post.status)}
                      <span className="text-base text-gray-400 capitalize">{post.status}</span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-white text-base mb-3 line-clamp-2">
                    {post.content.text || <span className="text-gray-500 italic">Media only post</span>}
                  </p>

                  {/* Spacer to push scheduled time to bottom */}
                  <div className="flex-grow"></div>

                  {/* Scheduled time - aligned to bottom */}
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Scheduled for {formatScheduledDate(post.scheduledFor)}</span>
                  </div>

                  {/* Error message for failed posts */}
                  {post.status === 'failed' && post.platformData?.errorMessage && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-sm text-red-300">
                      {post.platformData.errorMessage}
                    </div>
                  )}

                  {/* Success link for posted */}
                  {post.status === 'posted' && post.platformData?.twitterPostUrl && (
                    <div className="mt-2">
                      <a
                        href={post.platformData.twitterPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View on Twitter →
                      </a>
                    </div>
                  )}
                  {post.status === 'posted' && post.platformData?.nostrPostUrl && (
                    <div className="mt-2">
                      <a
                        href={post.platformData.nostrPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View on Primal →
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {post.status === 'scheduled' && (
                    <button
                      onClick={() => handleEdit(post)}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-300" />
                    </button>
                  )}
                  
                  {post.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(getPostId(post))}
                      className="p-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-colors"
                      title="Retry"
                    >
                      <RefreshCw className="w-4 h-4 text-white" />
                    </button>
                  )}

                  {post.status === 'unsigned' && (
                    <>
                      <button
                        onClick={() => handleSignIndividualPost(post)}
                        className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
                        title="Sign this post"
                      >
                        <PenTool className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => handleRejectIndividualPost(post)}
                        className="p-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
                        title="Reject this post"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </>
                  )}

                  {(post.status === 'scheduled' || post.status === 'failed') && (
                    <button
                      onClick={() => handleDeleteClick(post)}
                      className="p-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {selectedPost && (
        <SocialShareModal
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          fileUrl={selectedPost.content.mediaUrl || ''}
          itemName="scheduled post"
          onComplete={() => {}} // Not used in update mode
          platform={selectedPost.platform === 'twitter' ? SocialPlatform.Twitter : SocialPlatform.Nostr}
          updateContext={{
            scheduledPost: {
              ...selectedPost,
              postId: getPostId(selectedPost) // Ensure postId is set correctly
            },
            onUpdate: handlePostUpdate
          }}
        />
      )}

      {/* Sign All Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showSignAllModal}
        onClose={() => setShowSignAllModal(false)}
        onConfirm={handleSignAllConfirm}
        title="Sign All Unsigned Posts"
        message={`Are you sure you want to sign all ${posts.filter(p => p.status === 'unsigned').length} unsigned Nostr posts? They will be automatically scheduled using your available time slots.`}
        isDeleting={false}
        deleteButtonText="Sign All"
        itemType="unsigned posts"
        customStyling={{
          iconColor: 'text-purple-400',
          iconBg: 'bg-purple-900/20',
          confirmButtonBg: 'bg-purple-600 hover:bg-purple-700',
          confirmButtonText: 'text-white',
          useSignIcon: true
        }}
      />

      {/* Social Share Modal for signing individual posts */}
      {showSocialShareModal && currentPost && (
        <SocialShareModal
          isOpen={showSocialShareModal}
          onClose={handleSocialShareModalClose}
          fileUrl={currentPost.content.mediaUrl || ''}
          itemName="post"
          onComplete={(success, platform) => {
            if (isReviewingEach) {
              handleReviewNext(success ? 'sign' : 'cancel');
            } else {
              setShowSocialShareModal(false);
              setCurrentPost(null);
            }
          }}
          platform={currentPost.platform === 'twitter' ? SocialPlatform.Twitter : SocialPlatform.Nostr}
          renderUrl={currentPost.content.mediaUrl}
          lookupHash={undefined} // No Jamie Assist for unsigned posts
          auth={null} // Will be handled by the modal
          updateContext={{
            scheduledPost: currentPost,
            onUpdate: (updatedPost) => {
              // Update the post in our local state
              setPosts(prev => prev.map(p => 
                getPostId(p) === getPostId(updatedPost) ? updatedPost : p
              ));
            }
          }}
          showSignAllOverlay={isSigningAll}
          signAllProgress={signAllProgress}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Scheduled Post"
        message={
          postToDelete
            ? `Are you sure you want to delete this ${postToDelete.platform} post scheduled for ${formatShortDate(postToDelete.scheduledFor)}? This action cannot be undone.`
            : "Are you sure you want to delete this scheduled post? This action cannot be undone."
        }
        isDeleting={isDeleting}
        deleteButtonText="Delete Post"
        itemType="scheduled post"
      />
    </div>
  );
};

export default ScheduledPostsList;




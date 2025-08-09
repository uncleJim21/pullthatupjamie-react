import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Twitter, Edit, Trash2, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import ScheduledPostService from '../services/scheduledPostService.ts';
import { ScheduledPost, ScheduledPostsQuery } from '../types/scheduledPost.ts';
import SocialShareModal from './SocialShareModal.tsx';
import { SocialPlatform } from './SocialShareModal.tsx';

// Constants for preview sizing (matching SocialShareModal)
const ASPECT_RATIO = 16 / 9;
const PREVIEW_WIDTH = 160; // Smaller for list view
const PREVIEW_HEIGHT = (PREVIEW_WIDTH / ASPECT_RATIO) * 1.3; // Increased by 30%

interface ScheduledPostsListProps {
  className?: string;
}

const ScheduledPostsList: React.FC<ScheduledPostsListProps> = ({ className = '' }) => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'posted' | 'failed'>('all');
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Helper function to get the correct ID (handles both postId and _id)
  const getPostId = (post: ScheduledPost): string => {
    return post.postId || post._id || '';
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
        sortOrder: 'asc'
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

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status icon and color
  const getStatusIcon = (status: ScheduledPost['status']) => {
    switch (status) {
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

  // Handle delete
  const handleDelete = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }

    try {
      await ScheduledPostService.deleteScheduledPost(postId);
      await loadPosts(); // Refresh list
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    }
  };

  // Handle retry
  const handleRetry = async (postId: string) => {
    try {
      await ScheduledPostService.retryScheduledPost(postId);
      await loadPosts(); // Refresh list
    } catch (err) {
      console.error('Error retrying post:', err);
      alert('Failed to retry post. Please try again.');
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
          <h2 className="text-xl font-semibold text-white">Scheduled Posts</h2>
        </div>
        
        <button
          onClick={loadPosts}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg">
        {(['all', 'scheduled', 'posted', 'failed'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize
              ${filter === filterOption 
                ? 'bg-white text-black' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
              className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
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

                <div className="flex-1 min-w-0">
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
                  <p className="text-white text-base mb-3 line-clamp-3">
                    {post.content.text || <span className="text-gray-500 italic">Media only post</span>}
                  </p>

                  {/* Scheduled time */}
                  <div className="flex items-center space-x-2 text-sm text-gray-400 mt-10">
                    <Clock className="w-4 h-4" />
                    <span>Scheduled for {formatDate(post.scheduledFor)}</span>
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

                  {(post.status === 'scheduled' || post.status === 'failed') && (
                    <button
                      onClick={() => handleDelete(getPostId(post))}
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
    </div>
  );
};

export default ScheduledPostsList;




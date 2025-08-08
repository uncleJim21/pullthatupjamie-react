import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Twitter, Edit, Trash2, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import ScheduledPostService from '../services/scheduledPostService.ts';
import { ScheduledPost, ScheduledPostsQuery } from '../types/scheduledPost.ts';

interface ScheduledPostsListProps {
  className?: string;
}

const ScheduledPostsList: React.FC<ScheduledPostsListProps> = ({ className = '' }) => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'posted' | 'failed'>('all');

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
              key={post.postId}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header with platform and status */}
                  <div className="flex items-center space-x-2 mb-2">
                    {getPlatformIcon(post.platform)}
                    <span className="text-sm text-gray-400 capitalize">{post.platform}</span>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(post.status)}
                      <span className="text-sm text-gray-400 capitalize">{post.status}</span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-white text-sm mb-3 line-clamp-3">
                    {post.content.text || <span className="text-gray-500 italic">Media only post</span>}
                  </p>

                  {/* Scheduled time */}
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Scheduled for {formatDate(post.scheduledFor)}</span>
                  </div>

                  {/* Error message for failed posts */}
                  {post.status === 'failed' && post.platformData?.errorMessage && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
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
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
                      onClick={() => console.log('Edit post:', post.postId)} // TODO: Implement edit
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-300" />
                    </button>
                  )}
                  
                  {post.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(post.postId)}
                      className="p-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-colors"
                      title="Retry"
                    >
                      <RefreshCw className="w-4 h-4 text-white" />
                    </button>
                  )}

                  {(post.status === 'scheduled' || post.status === 'failed') && (
                    <button
                      onClick={() => handleDelete(post.postId)}
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
    </div>
  );


};

export default ScheduledPostsList;




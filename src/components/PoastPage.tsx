import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Twitter, Clock, Check, X, Loader2, AlertCircle, 
  Upload, Calendar, Send 
} from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { API_URL } from '../constants/constants.ts';
import UploadService from '../services/uploadService.ts';
import PlatformIntegrationService from '../services/platformIntegrationService.ts';

type Platform = 'twitter' | 'nostr';

interface ScheduledPost {
  _id: string;
  platform: Platform;
  scheduledFor: string;
  status: string;
  content: {
    text: string;
    mediaUrl?: string;
  };
}

const PLATFORM_STYLES = {
  twitter: {
    color: '#1d9bf0',
    bg: 'bg-[#1d9bf0]/10',
    border: 'border-[#1d9bf0]',
    borderSubtle: 'border-[#1d9bf0]/30',
    glow: '0 0 30px rgba(29, 155, 240, 0.3)',
    topBorder: 'before:from-[#1d9bf0] before:to-[#0d7bbf]'
  },
  nostr: {
    color: '#8b5cf6',
    bg: 'bg-[#8b5cf6]/10',
    border: 'border-[#8b5cf6]',
    borderSubtle: 'border-[#8b5cf6]/30',
    glow: '0 0 30px rgba(139, 92, 246, 0.3)',
    topBorder: 'before:from-[#8b5cf6] before:to-[#6d28d9]'
  }
};

const PoastPage: React.FC = () => {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Compose form state
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>(['twitter', 'nostr']);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState<string>('');

  // Platform connection state
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [nostrAvailable, setNostrAvailable] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Scheduled posts
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [filter, setFilter] = useState<'all' | Platform>('all');
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/app');
      return;
    }
    setIsAuthenticated(true);
  }, [navigate]);

  // Check platform connections
  useEffect(() => {
    const checkConnections = async () => {
      // Twitter connection
      const twitterStatus = await PlatformIntegrationService.checkTwitterAuth();
      setTwitterConnected(twitterStatus.authenticated);

      // Nostr extension
      setNostrAvailable(typeof window !== 'undefined' && !!window.nostr);
    };

    if (isAuthenticated) {
      checkConnections();
      loadScheduledPosts();
    }
  }, [isAuthenticated]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [text]);

  const loadScheduledPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = filter !== 'all' ? `?platform=${filter}` : '';
      const response = await fetch(`${API_URL}/api/user/social/posts${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadScheduledPosts();
    }
  }, [filter, isAuthenticated]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
  };

  const handleMediaRemove = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePlatform = (platform: Platform) => {
    if (platforms.includes(platform)) {
      setPlatforms(platforms.filter(p => p !== platform));
    } else {
      setPlatforms([...platforms, platform]);
    }
  };

  const handleConnectTwitter = async () => {
    const result = await PlatformIntegrationService.connectTwitter();
    if (result.success) {
      // Poll for connection completion
      const pollInterval = setInterval(async () => {
        const status = await PlatformIntegrationService.checkTwitterAuth();
        if (status.authenticated) {
          clearInterval(pollInterval);
          setTwitterConnected(true);
        }
      }, 2000);
      setTimeout(() => clearInterval(pollInterval), 300000); // 5 min timeout
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (!text.trim() && !mediaFile) {
      setError('Please enter some text or upload media');
      return;
    }

    if (platforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    // Check platform connections
    if (platforms.includes('twitter') && !twitterConnected) {
      setError('Please connect your Twitter account first');
      return;
    }

    if (platforms.includes('nostr') && !nostrAvailable) {
      setError('Please install a Nostr browser extension');
      return;
    }

    // Check Twitter character limit
    if (platforms.includes('twitter') && text.length > 280) {
      setError('Tweet text exceeds 280 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Upload media if present
      let uploadedMediaUrl = mediaUrl;
      if (mediaFile && !mediaUrl) {
        const result = await UploadService.processFileUpload(mediaFile, token!, true);
        uploadedMediaUrl = result.fileUrl;
        setMediaUrl(result.fileUrl);
      }

      // Create post
      const body: any = {
        text: text.trim(),
        platforms,
        timezone: 'America/Chicago'
      };

      if (uploadedMediaUrl) {
        body.mediaUrl = uploadedMediaUrl;
      }

      if (scheduleMode === 'later' && scheduledFor) {
        body.scheduledFor = new Date(scheduledFor).toISOString();
      }

      const response = await fetch(`${API_URL}/api/user/social/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create post');
      }

      setSuccess(scheduleMode === 'later' ? 'Post scheduled successfully!' : 'Post created successfully!');
      
      // Reset form
      setText('');
      handleMediaRemove();
      setScheduleMode('now');
      setScheduledFor('');
      
      // Reload posts
      loadScheduledPosts();

      // Clear success message after 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/user/social/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadScheduledPosts();
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24 && hours >= 0) {
      return `in ${hours}h`;
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const charCount = text.length;
  const isTwitterSelected = platforms.includes('twitter');
  const isOverLimit = isTwitterSelected && charCount > 280;
  const isWarning = isTwitterSelected && charCount > 250;

  if (!isAuthenticated) return null;

  const filteredPosts = filter === 'all' 
    ? scheduledPosts 
    : scheduledPosts.filter(p => p.platform === filter);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <PageBanner />

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 
            className="font-display text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            style={{
              color: '#f5f5f5',
              textShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15)'
            }}
          >
            X-POAST
          </h1>
          <p className="font-sans text-xl" style={{ color: '#c4c4c4' }}>
            Cross-post to Twitter and Nostr with style
          </p>
        </div>
      </section>

      {/* Compose Section */}
      <section className="pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <div 
            className="rounded-2xl p-6 lg:p-8 transition-all duration-300"
            style={{
              backgroundColor: '#1a1a1b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Textarea */}
            <div className="relative mb-6">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                className="w-full px-4 py-3 rounded-xl font-sans resize-none transition-all duration-300 focus:outline-none"
                style={{
                  backgroundColor: '#161617',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e5e5e5',
                  minHeight: '120px'
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                  e.target.style.backgroundColor = '#1a1a1b';
                  e.target.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                  e.target.style.backgroundColor = '#161617';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {isTwitterSelected && (
                <div 
                  className="absolute bottom-3 right-4 text-sm font-mono transition-all duration-300"
                  style={{
                    color: isOverLimit ? '#ef4444' : isWarning ? '#f59e0b' : '#82828c',
                    textShadow: isOverLimit 
                      ? '0 0 10px rgba(239, 68, 68, 0.4)'
                      : isWarning
                      ? '0 0 10px rgba(245, 158, 11, 0.3)'
                      : 'none'
                  }}
                >
                  {charCount}/280
                </div>
              )}
            </div>

            {/* Media Upload */}
            <div className="mb-6">
              {mediaPreview ? (
                <div className="relative inline-block">
                  <img 
                    src={mediaPreview} 
                    alt="Upload preview" 
                    className="max-w-[200px] max-h-[160px] rounded-xl object-cover"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}
                  />
                  <button
                    onClick={handleMediaRemove}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{ 
                      backgroundColor: '#333',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <X size={14} style={{ color: '#fff' }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200"
                  style={{
                    border: '1px dashed rgba(255, 255, 255, 0.25)',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}
                >
                  <Upload size={16} />
                  <span className="text-sm">Upload Media (optional)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Platform Selection */}
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#82828c' }}>
                Platforms
              </label>
              <div className="grid grid-cols-2 gap-4">
                {(['twitter', 'nostr'] as Platform[]).map(platform => {
                  const isSelected = platforms.includes(platform);
                  const isConnected = platform === 'twitter' ? twitterConnected : nostrAvailable;
                  const styles = PLATFORM_STYLES[platform];
                  const needsConnection = isSelected && !isConnected;

                  return (
                    <div key={platform} className="relative">
                      <button
                        onClick={() => !needsConnection && togglePlatform(platform)}
                        disabled={needsConnection}
                        className={`
                          relative w-full px-6 py-4 rounded-xl border-2 transition-all duration-300
                          ${isSelected ? `${styles.bg} ${styles.border}` : 'bg-[#1a1a1b]'}
                          ${!isConnected && 'opacity-50'}
                        `}
                        style={isSelected && isConnected ? { boxShadow: styles.glow } : {}}
                      >
                        <div className="flex items-center gap-3">
                          {platform === 'twitter' ? (
                            <Twitter 
                              className="w-5 h-5" 
                              style={{ 
                                color: styles.color,
                                filter: isSelected ? `drop-shadow(0 0 10px ${styles.color}40)` : 'none'
                              }} 
                            />
                          ) : (
                            <img 
                              src="/nostr-logo-square.png"
                              className="w-5 h-5"
                              style={{
                                filter: isSelected 
                                  ? `brightness(1.2) drop-shadow(0 0 10px ${styles.color}40)`
                                  : 'brightness(0.5)'
                              }}
                            />
                          )}
                          <span className={`font-display font-semibold ${isSelected ? 'text-[#f5f5f5]' : 'text-[#82828c]'}`}>
                            {platform === 'twitter' ? 'Twitter' : 'Nostr'}
                          </span>
                          {!isConnected && (
                            <span className="text-xs" style={{ color: '#4a4a4f' }}>(not connected)</span>
                          )}
                        </div>

                        {isSelected && isConnected && (
                          <div 
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: '#10b981',
                              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>

                      {needsConnection && (
                        <div 
                          className="absolute inset-0 backdrop-blur-sm rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                        >
                          <button
                            onClick={platform === 'twitter' ? handleConnectTwitter : undefined}
                            className={`px-4 py-2 rounded-lg font-display font-semibold transition-all duration-300 ${styles.bg} ${styles.border}`}
                            style={{ color: '#f5f5f5' }}
                          >
                            Connect {platform === 'twitter' ? 'Twitter' : 'Nostr'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Schedule */}
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#82828c' }}>
                Schedule
              </label>
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setScheduleMode('now')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300
                    ${scheduleMode === 'now' ? 'bg-white/10 border-white/30' : 'border-white/10'}
                  `}
                  style={{ 
                    border: `2px solid ${scheduleMode === 'now' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: scheduleMode === 'now' ? '#f5f5f5' : '#82828c'
                  }}
                >
                  <Send size={14} />
                  <span className="font-display">Post Now</span>
                </button>
                <button
                  onClick={() => setScheduleMode('later')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300
                    ${scheduleMode === 'later' ? 'bg-white/10 border-white/30' : 'border-white/10'}
                  `}
                  style={{ 
                    border: `2px solid ${scheduleMode === 'later' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: scheduleMode === 'later' ? '#f5f5f5' : '#82828c'
                  }}
                >
                  <Calendar size={14} />
                  <span className="font-display">Schedule</span>
                </button>
              </div>
              {scheduleMode === 'later' && (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 rounded-xl font-sans transition-all duration-300"
                  style={{
                    backgroundColor: '#161617',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e5e5e5',
                    colorScheme: 'dark'
                  }}
                />
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div 
                className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444'
                }}
              >
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div 
                className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981'
                }}
              >
                <Check size={16} />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isOverLimit || (!text.trim() && !mediaFile) || platforms.length === 0}
              className="relative overflow-hidden group w-full px-8 py-4 rounded-xl font-display font-semibold text-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#ffffff',
                color: '#0a0a0a',
                boxShadow: !isSubmitting && !isOverLimit ? '0 0 40px rgba(255, 255, 255, 0.3)' : 'none'
              }}
            >
              <span className="relative z-10">
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    POASTING...
                  </span>
                ) : (
                  'POAST'
                )}
              </span>
              <div 
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700"
              />
            </button>
          </div>
        </div>
      </section>

      {/* Scheduled Posts Section */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-3xl font-bold" style={{ color: '#f5f5f5', textShadow: '0 0 20px rgba(255, 255, 255, 0.2)' }}>
              Scheduled Posts
            </h2>

            {/* Platform Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm font-display transition-all duration-200 ${
                  filter === 'all' ? 'bg-[#1a1a1b] text-[#f5f5f5]' : 'text-[#82828c]'
                }`}
              >
                All
              </button>
              {(['twitter', 'nostr'] as Platform[]).map(platform => {
                const styles = PLATFORM_STYLES[platform];
                return (
                  <button
                    key={platform}
                    onClick={() => setFilter(platform)}
                    className={`
                      flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-display transition-all duration-200
                      ${filter === platform ? `${styles.bg} ${styles.borderSubtle} border` : 'text-[#82828c]'}
                    `}
                    style={filter === platform ? { color: styles.color } : {}}
                  >
                    {platform === 'twitter' ? <Twitter size={14} /> : '⚡'}
                    {platform === 'twitter' ? 'Twitter' : 'Nostr'}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoadingPosts ? (
            <div className="text-center py-12" style={{ color: '#82828c' }}>
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading posts...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20">
              <div 
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ 
                  backgroundColor: '#1a1a1b',
                  border: '2px dashed rgba(255, 255, 255, 0.1)'
                }}
              >
                <Clock className="w-10 h-10" style={{ color: '#4a4a4f' }} />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2" style={{ color: '#f5f5f5' }}>
                No scheduled posts yet
              </h3>
              <p style={{ color: '#82828c' }}>
                Create your first post above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map(post => {
                const styles = PLATFORM_STYLES[post.platform];
                return (
                  <div
                    key={post._id}
                    className={`
                      relative overflow-hidden rounded-2xl p-6 transition-all duration-300
                      ${styles.bg} ${styles.borderSubtle} border
                      hover:-translate-y-1
                      before:absolute before:top-0 before:left-0 before:right-0 before:h-1
                      before:bg-gradient-to-r ${styles.topBorder}
                    `}
                    style={{
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {post.platform === 'twitter' ? (
                          <Twitter 
                            className="w-5 h-5" 
                            style={{ 
                              color: styles.color,
                              filter: `drop-shadow(0 0 10px ${styles.color}40)`
                            }} 
                          />
                        ) : (
                          <img 
                            src="/nostr-logo-square.png"
                            className="w-5 h-5"
                            style={{
                              filter: `brightness(1.2) drop-shadow(0 0 10px ${styles.color}40)`
                            }}
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm mb-3 line-clamp-2" style={{ color: '#c4c4c4' }}>
                          {post.content.text || '(Media only)'}
                        </p>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5" style={{ color: '#82828c' }}>
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{formatDate(post.scheduledFor)}</span>
                          </div>

                          <span 
                            className="px-2 py-0.5 rounded font-mono"
                            style={{
                              backgroundColor: post.status === 'scheduled' ? 'rgba(130, 130, 140, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              border: `1px solid ${post.status === 'scheduled' ? 'rgba(130, 130, 140, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                              color: post.status === 'scheduled' ? '#82828c' : '#10b981'
                            }}
                          >
                            {post.status}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(post._id)}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
                        style={{
                          backgroundColor: '#1a1a1b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#82828c'
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PoastPage;

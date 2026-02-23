import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import { Upload, Clock, Check, X, Twitter, Loader2, AlertCircle } from 'lucide-react';
import UploadService from '../services/uploadService';
import PlatformIntegrationService from '../services/platformIntegrationService';
import AuthService from '../services/authService';
import { userTwitterService } from '../services/userTwitterService.ts';
import { API_URL } from '../constants/constants';

declare global {
  interface Window {
    nostr?: any;
  }
}

interface ScheduledPost {
  _id: string;
  platform: 'twitter' | 'nostr';
  scheduledFor: string;
  status: 'scheduled' | 'processing' | 'posted' | 'failed' | 'unsigned';
  content: {
    text?: string;
    mediaUrl?: string;
  };
  text?: string;
  platformData?: any;
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; border: string; text: string; icon: any }> = {
    scheduled: { bg: 'bg-[#82828c]/10', border: 'border-[#82828c]/20', text: 'text-[#82828c]', icon: Clock },
    processing: { bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/20', text: 'text-[#f59e0b]', icon: Loader2 },
    posted: { bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/20', text: 'text-[#10b981]', icon: Check },
    failed: { bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20', text: 'text-[#ef4444]', icon: AlertCircle }
  };
  const s = styles[status] || styles.scheduled;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${s.bg} border ${s.border} rounded-lg text-xs font-mono font-medium ${s.text}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
};

const PoastPage: React.FC = () => {
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [platforms, setPlatforms] = useState<('twitter' | 'nostr')[]>(['twitter', 'nostr']);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [nostrConnected, setNostrConnected] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [postsFilter, setPostsFilter] = useState<'all' | 'twitter' | 'nostr'>('all');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      navigate('/app');
    }
  }, [navigate]);

  useEffect(() => {
    const checkConnections = async () => {
      try {
        const twitterAuth = await PlatformIntegrationService.checkTwitterAuth();
        setTwitterConnected(twitterAuth);
      } catch {
        setTwitterConnected(false);
      }

      setNostrConnected(!!window.nostr);
    };

    checkConnections();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const connectTwitter = async () => {
    try {
      const authUrl = await AuthService.startUserTwitterAuth();
      window.open(authUrl, '_blank');
      startTokenPolling();
    } catch (error: any) {
      setError(error.message || 'Failed to start Twitter auth');
    }
  };

  const startTokenPolling = () => {
    const interval = setInterval(async () => {
      try {
        const status = await PlatformIntegrationService.checkTwitterAuth();
        if (status.authenticated) {
          setTwitterConnected(true);
          clearInterval(interval);
        }
      } catch (err) {
        // Continue polling
      }
    }, 2000);
    setPollingInterval(interval);
  };

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (postsFilter !== 'all') params.append('platform', postsFilter);
      
      const response = await fetch(`${API_URL}/api/user/social/posts?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      setScheduledPosts(data.posts || []);
    } catch (err) {
      console.error('Fetch posts error:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => { 
    fetchPosts(); 
  }, [postsFilter]);

  const handleDelete = async (postId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/user/social/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      await fetchPosts();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const charCount = text.length;
  const isTwitterSelected = platforms.includes('twitter');
  const isOverLimit = isTwitterSelected && charCount > 280;
  const isDisabled = (!text.trim() && !mediaUrl) || isOverLimit || platforms.length === 0;

  const getCharCountStyle = () => {
    if (!isTwitterSelected) return {};
    if (charCount > 280) {
      return {
        color: '#ef4444',
        textShadow: '0 0 10px rgba(239,68,68,0.4)'
      };
    }
    if (charCount >= 250) {
      return {
        color: '#f59e0b',
        textShadow: '0 0 10px rgba(245,158,11,0.3)'
      };
    }
    return { color: '#82828c' };
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');

      const uploadedUrl = await UploadService.processFileUpload(file, token, true);
      setMediaUrl(uploadedUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const togglePlatform = (platform: 'twitter' | 'nostr') => {
    if (platform === 'twitter' && !twitterConnected) return;
    if (platform === 'nostr' && !nostrConnected) return;

    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const publishToTwitter = async (): Promise<boolean> => {
    try {
      const response = await userTwitterService.postTweet(text, mediaUrl || '');
      
      if (response.success && response.tweet?.id) {
        return true;
      }
      
      if (response.error === 'TWITTER_AUTH_EXPIRED' || response.requiresReauth) {
        setTwitterConnected(false);
        setError('Twitter authentication expired. Please reconnect.');
        return false;
      }
      
      setError(response.message || response.error || 'Failed to post to Twitter');
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to post to Twitter');
      return false;
    }
  };

  const publishToNostr = async (): Promise<boolean> => {
    if (!window.nostr) {
      setError('Nostr extension not found');
      return false;
    }
    
    try {
      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: text
      };
      
      const signedEvent = await window.nostr.signEvent(event);
      console.log('Nostr event signed:', signedEvent.id);
      
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to post to Nostr');
      return false;
    }
  };

  const handleImmediatePost = async () => {
    const promises: Promise<boolean>[] = [];
    
    if (platforms.includes('twitter') && twitterConnected) {
      promises.push(publishToTwitter());
    }
    
    if (platforms.includes('nostr') && nostrConnected) {
      promises.push(publishToNostr());
    }
    
    if (promises.length === 0) {
      setError('Please connect at least one platform');
      setIsLoading(false);
      return;
    }
    
    try {
      const results = await Promise.allSettled(promises);
      const anySuccess = results.some(r => r.status === 'fulfilled' && r.value === true);
      
      if (anySuccess) {
        setText('');
        setMediaUrl('');
        setPlatforms(['twitter', 'nostr']);
        await fetchPosts();
      } else {
        setError('Failed to post to any platform');
      }
    } catch (err) {
      setError('Failed to post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduledPost = async () => {
    if (!scheduledFor) {
      setError('Please select a date and time');
      setIsLoading(false);
      return;
    }
    
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future');
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/user/social/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          mediaUrl: mediaUrl || undefined,
          platforms,
          scheduledFor,
          timezone: 'America/Chicago'
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        navigate('/app');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to schedule post');
      }

      setText('');
      setMediaUrl('');
      setPlatforms(['twitter', 'nostr']);
      setIsScheduled(false);
      setScheduledFor('');
      await fetchPosts();
    } catch (err: any) {
      if (err.message?.includes('401') || err.status === 401) {
        localStorage.removeItem('auth_token');
        navigate('/app');
        return;
      }
      setError(err.message || 'Failed to schedule post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    if (isScheduled) {
      await handleScheduledPost();
    } else {
      await handleImmediatePost();
    }
  };

  const filteredPosts = scheduledPosts.filter(p => postsFilter === 'all' || p.platform === postsFilter);

  return (
    <div className="min-h-screen bg-[#0e0e0f]">
      <PageBanner />

      {/* Hero Section */}
      <section className="pt-20 lg:pt-32 pb-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1
            className="font-display text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6"
            style={{
              textShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15)'
            }}
          >
            X-POAST
          </h1>
          <p className="font-sans text-xl text-[#c4c4c4]">
            Cross-post to Twitter and Nostr with style
          </p>
        </div>
      </section>

      {/* Compose Section */}
      <section className="pb-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-[#1a1a1b] border border-white/10 rounded-2xl p-6 lg:p-8">
            <div className="space-y-6">
              {/* Textarea + Character Counter */}
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full bg-[#161617] border border-white/10 rounded-xl min-h-[120px] px-4 py-3 text-white placeholder-[#82828c] resize-none focus:outline-none focus:border-white/30 focus:bg-[#1a1a1b] transition-all duration-300"
                  style={{
                    boxShadow: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = '0 0 20px rgba(255,255,255,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {isTwitterSelected && (
                  <div
                    className="absolute bottom-3 right-3 text-sm font-mono font-medium"
                    style={getCharCountStyle()}
                  >
                    {charCount}/280
                  </div>
                )}
              </div>

              {/* Media Upload */}
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 border-2 border-white/20 rounded-xl text-white hover:border-white/40 transition-all duration-300 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <span>{uploadingMedia ? 'Uploading...' : 'Add Media'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    disabled={uploadingMedia}
                    className="hidden"
                  />
                </label>

                {mediaUrl && (
                  <div className="relative inline-block">
                    <img
                      src={mediaUrl}
                      alt="Upload preview"
                      className="max-h-48 rounded-xl border border-white/10"
                    />
                    <button
                      onClick={() => setMediaUrl('')}
                      className="absolute -top-2 -right-2 bg-[#ef4444] hover:bg-[#dc2626] rounded-full p-1.5 transition-colors duration-300"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Platform Chips */}
              <div className="space-y-3">
                <div className="text-sm text-[#82828c] font-medium">Select Platforms</div>
                <div className="flex gap-3">
                  {/* Twitter Chip */}
                  <button
                    onClick={() => togglePlatform('twitter')}
                    disabled={!twitterConnected}
                    className={`relative px-6 py-3 rounded-xl border-2 flex items-center gap-2 transition-all duration-300 ${
                      platforms.includes('twitter')
                        ? 'bg-[#1d9bf0]/10 border-[#1d9bf0]'
                        : 'bg-[#1a1a1b] border-white/10 opacity-50'
                    } ${!twitterConnected ? 'cursor-not-allowed' : 'hover:opacity-100'}`}
                    style={platforms.includes('twitter') ? { boxShadow: '0 0 30px rgba(29, 155, 240, 0.3)' } : {}}
                  >
                    <Twitter className="w-5 h-5" style={{ color: '#1d9bf0' }} />
                    <span className="text-white font-medium">
                      Twitter {!twitterConnected && '(not connected)'}
                    </span>
                    {platforms.includes('twitter') && (
                      <div
                        className="absolute -top-2 -right-2 bg-[#10b981] rounded-full p-1"
                        style={{
                          boxShadow: '0 0 10px rgba(16,185,129,0.5)'
                        }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Nostr Chip */}
                  <button
                    onClick={() => togglePlatform('nostr')}
                    disabled={!nostrConnected}
                    className={`relative px-6 py-3 rounded-xl border-2 flex items-center gap-2 transition-all duration-300 ${
                      platforms.includes('nostr')
                        ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]'
                        : 'bg-[#1a1a1b] border-white/10 opacity-50'
                    } ${!nostrConnected ? 'cursor-not-allowed' : 'hover:opacity-100'}`}
                    style={platforms.includes('nostr') ? { boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' } : {}}
                  >
                    <div
                      className="w-5 h-5"
                      style={{
                        backgroundColor: platforms.includes('nostr') ? '#8b5cf6' : '#82828c',
                        mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                        WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                      }}
                    />
                    <span className="text-white font-medium">
                      Nostr {!nostrConnected && '(not connected)'}
                    </span>
                    {platforms.includes('nostr') && (
                      <div
                        className="absolute -top-2 -right-2 bg-[#10b981] rounded-full p-1"
                        style={{
                          boxShadow: '0 0 10px rgba(16,185,129,0.5)'
                        }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>

                {platforms.includes('twitter') && !twitterConnected && (
                  <div className="mt-2">
                    <button
                      onClick={connectTwitter}
                      className="text-sm px-4 py-2 bg-[#1d9bf0] text-white rounded-lg hover:bg-[#1a8cd8]"
                    >
                      Connect Twitter
                    </button>
                  </div>
                )}

                {(!twitterConnected || !nostrConnected) && (
                  <div className="text-sm text-[#f59e0b] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Connect platforms in settings to enable cross-posting
                    </span>
                  </div>
                )}
              </div>

              {/* Schedule Toggle */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsScheduled(false)}
                    className={`px-6 py-2 rounded-xl border-2 transition-all duration-300 ${
                      !isScheduled
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'bg-transparent border-white/10 text-[#82828c]'
                    }`}
                  >
                    Post now
                  </button>
                  <button
                    onClick={() => setIsScheduled(true)}
                    className={`px-6 py-2 rounded-xl border-2 flex items-center gap-2 transition-all duration-300 ${
                      isScheduled
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'bg-transparent border-white/10 text-[#82828c]'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Schedule
                  </button>
                </div>

                {isScheduled && (
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full bg-[#161617] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:bg-[#1a1a1b] transition-all duration-300"
                    style={{
                      colorScheme: 'dark',
                      boxShadow: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.boxShadow = '0 0 20px rgba(255,255,255,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/50 rounded-xl px-4 py-3 text-[#ef4444] flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* POAST Button */}
              <button
                onClick={handleSubmit}
                disabled={isDisabled || isLoading}
                className="relative w-full bg-white text-[#0e0e0f] font-display font-semibold text-lg rounded-xl px-8 py-4 transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isLoading) {
                    e.currentTarget.style.boxShadow = '0 0 40px rgba(255,255,255,0.3)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* Shine Effect */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                  style={{
                    pointerEvents: 'none'
                  }}
                />

                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      POASTING...
                    </>
                  ) : (
                    'POAST'
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Scheduled Posts Section */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-white mb-8">
            Scheduled Posts
          </h2>

          {/* Filter Pills */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setPostsFilter('all')}
              className={`px-6 py-2 rounded-xl border-2 transition-all duration-300 ${
                postsFilter === 'all'
                  ? 'bg-white/10 border-white/30 text-white'
                  : 'bg-[#1a1a1b] border-white/10 opacity-70 text-[#82828c]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setPostsFilter('twitter')}
              className={`px-6 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2 ${
                postsFilter === 'twitter'
                  ? 'bg-[#1d9bf0]/10 border-[#1d9bf0] text-white'
                  : 'bg-[#1a1a1b] border-white/10 opacity-70 text-[#82828c]'
              }`}
            >
              <Twitter className="w-4 h-4" style={{ color: postsFilter === 'twitter' ? '#1d9bf0' : '#82828c' }} />
              Twitter
            </button>
            <button
              onClick={() => setPostsFilter('nostr')}
              className={`px-6 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2 ${
                postsFilter === 'nostr'
                  ? 'bg-[#8b5cf6]/10 border-[#8b5cf6] text-white'
                  : 'bg-[#1a1a1b] border-white/10 opacity-70 text-[#82828c]'
              }`}
            >
              <div
                className="w-4 h-4"
                style={{
                  backgroundColor: postsFilter === 'nostr' ? '#8b5cf6' : '#82828c',
                  mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                  WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                }}
              />
              Nostr
            </button>
          </div>

          {/* Loading State */}
          {loadingPosts && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loadingPosts && filteredPosts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-[#4a4a4f]" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white mb-2">
                No scheduled posts yet
              </h3>
              <p className="text-[#82828c]">
                Create your first post above to get started
              </p>
            </div>
          )}

          {/* Posts Grid */}
          {!loadingPosts && filteredPosts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {filteredPosts.map((post) => {
                const isTwitter = post.platform === 'twitter';
                const isNostr = post.platform === 'nostr';
                const platformColor = isTwitter ? '#1d9bf0' : '#8b5cf6';
                const platformColorLight = isTwitter ? 'border-[#1d9bf0]/30' : 'border-[#8b5cf6]/30';
                const platformBg = isTwitter ? 'bg-[#1d9bf0]/10' : 'bg-[#8b5cf6]/10';
                const topBorderGradient = isTwitter
                  ? 'before:bg-gradient-to-r before:from-[#1d9bf0] before:to-[#0d7bbf]'
                  : 'before:bg-gradient-to-r before:from-[#8b5cf6] before:to-[#6d28d9]';

                return (
                  <div
                    key={post._id}
                    className={`relative ${platformBg} border ${platformColorLight} rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:rounded-t-xl ${topBorderGradient}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Platform Icon */}
                      <div className="flex-shrink-0">
                        {isTwitter ? (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `${platformColor}20`,
                              boxShadow: `0 0 20px ${platformColor}40`
                            }}
                          >
                            <Twitter className="w-5 h-5" style={{ color: platformColor }} />
                          </div>
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `${platformColor}20`,
                              boxShadow: `0 0 20px ${platformColor}40`
                            }}
                          >
                            <div
                              className="w-5 h-5"
                              style={{
                                backgroundColor: platformColor,
                                mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                                WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[#c4c4c4] text-sm mb-3 line-clamp-2">
                          {post.text}
                        </p>

                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Scheduled Time */}
                          <div className="flex items-center gap-2 text-xs text-[#82828c] font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(post.scheduledFor).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>

                          {/* Status Badge */}
                          <StatusBadge status={post.status} />
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(post._id)}
                        className="flex-shrink-0 p-2 rounded-lg text-[#82828c] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all duration-300"
                      >
                        <X className="w-5 h-5" />
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

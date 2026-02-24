import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import { Upload, Clock, Check, X, Twitter, Loader2, AlertCircle, ExternalLink, CheckCircle, Play, Pencil, Image } from 'lucide-react';
import UploadService from '../services/uploadService.ts';
import PlatformIntegrationService from '../services/platformIntegrationService.ts';
import AuthService from '../services/authService.ts';
import { userTwitterService } from '../services/userTwitterService.ts';
import { API_URL } from '../constants/constants.ts';
import { relayPool, buildRelayHintTags, publishToRelays, generatePrimalUrl } from '../utils/nostrUtils.ts';
import '../types/nostr.ts';

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
  const [successUrls, setSuccessUrls] = useState<{ twitter?: string; nostr?: string; scheduled?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const composeRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      navigate('/app');
    }
  }, [navigate]);

  useEffect(() => {
    const checkConnections = async () => {
      try {
        const twitterAuth = await PlatformIntegrationService.checkUserTwitterAuth();
        setTwitterConnected(twitterAuth.authenticated);
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
        const status = await PlatformIntegrationService.checkUserTwitterAuth();
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

  const processFile = async (file: File) => {
    setUploadingMedia(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');
      const result = await UploadService.processFileUpload(file, token, true, true);
      setMediaUrl(result.fileUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleEditPost = (post: ScheduledPost) => {
    setText(post.content?.text || post.text || '');
    setMediaUrl(post.content?.mediaUrl || '');
    setPlatforms([post.platform]);
    setIsScheduled(true);
    setScheduledFor(new Date(post.scheduledFor).toISOString().slice(0, 16));
    setEditingPostId(post._id);
    setError('');
    composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setText('');
    setMediaUrl('');
    setPlatforms(['twitter', 'nostr']);
    setIsScheduled(false);
    setScheduledFor('');
    setError('');
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
        const tweetUrl = `https://x.com/i/status/${response.tweet.id}`;
        setSuccessUrls(prev => ({ ...prev, twitter: tweetUrl }));
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
        tags: buildRelayHintTags(relayPool, 5),
        content: text
      };
      
      const signedEvent = await window.nostr.signEvent(event);
      console.log('Nostr event signed:', signedEvent.id);
      
      const result = await publishToRelays(signedEvent);
      console.log(`Nostr publish: ${result.successCount}/${result.totalRelays} relays accepted`);
      
      if (!result.success) {
        setError(`Only ${result.successCount} relays accepted the event (need 3+)`);
        return false;
      }
      
      setSuccessUrls(prev => ({ ...prev, nostr: result.primalUrl }));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to post to Nostr');
      return false;
    }
  };

  const handleImmediatePost = async () => {
    setSuccessUrls({});
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
        setShowSuccess(true);
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
      const isUpdate = !!editingPostId;
      const url = isUpdate
        ? `${API_URL}/api/user/social/posts/${editingPostId}`
        : `${API_URL}/api/user/social/posts`;
      
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
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
        throw new Error(error.message || `Failed to ${isUpdate ? 'update' : 'schedule'} post`);
      }

      setText('');
      setMediaUrl('');
      setPlatforms(['twitter', 'nostr']);
      setIsScheduled(false);
      setScheduledFor('');
      setEditingPostId(null);
      setSuccessUrls({ scheduled: 'true' });
      setShowSuccess(true);
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
      <section className="pt-8 lg:pt-12 pb-6">
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
      <section className="pb-12" ref={composeRef}>
        <div className="max-w-3xl mx-auto px-4">
          <div className={`bg-[#1a1a1b] border rounded-2xl p-6 lg:p-8 ${editingPostId ? 'border-[#f59e0b]/40' : 'border-white/10'}`}>
            {editingPostId && (
              <div className="flex items-center justify-between mb-4 px-3 py-2 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl">
                <div className="flex items-center gap-2 text-[#f59e0b] text-sm font-medium">
                  <Pencil className="w-4 h-4" />
                  Editing scheduled post
                </div>
                <button
                  onClick={cancelEdit}
                  className="text-xs text-[#82828c] hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
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
                {!mediaUrl && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative flex flex-col items-center justify-center gap-2 py-6 px-4 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer ${
                      isDragging
                        ? 'border-white/40 bg-white/5'
                        : 'border-white/15 hover:border-white/30'
                    }`}
                  >
                    <Upload className={`w-6 h-6 transition-colors ${isDragging ? 'text-white' : 'text-[#82828c]'}`} />
                    <p className="text-sm text-[#82828c]">
                      {uploadingMedia ? 'Uploading...' : 'Drag & drop an image or video'}
                    </p>
                    <label className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer underline underline-offset-2">
                      or browse files
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleMediaUpload}
                        disabled={uploadingMedia}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {mediaUrl && (() => {
                  const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);
                  return (
                    <div className="relative inline-block rounded-xl border border-white/10 overflow-hidden">
                      {isVideo ? (
                        <div className="relative max-h-32 w-48">
                          <video
                            src={mediaUrl}
                            className="max-h-32 w-full object-contain rounded-t-xl bg-black"
                            muted
                            preload="metadata"
                            onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5; }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={mediaUrl}
                          alt="Upload preview"
                          className="max-h-32 w-auto object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#161617]">
                        <Check className="w-4 h-4 text-[#10b981]" />
                        <span className="text-xs text-[#82828c] font-mono truncate max-w-[200px]">
                          {mediaUrl.split('/').pop()?.split('?')[0] || 'media attached'}
                        </span>
                      </div>
                      <button
                        onClick={() => setMediaUrl('')}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-[#ef4444] rounded-full p-1.5 transition-colors duration-300"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  );
                })()}
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
                      {editingPostId ? 'UPDATING...' : 'POASTING...'}
                    </>
                  ) : (
                    editingPostId ? 'UPDATE' : 'POAST'
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
                const platformColor = isTwitter ? '#1d9bf0' : '#8b5cf6';
                const platformColorLight = isTwitter ? 'border-[#1d9bf0]/30' : 'border-[#8b5cf6]/30';
                const platformBg = isTwitter ? 'bg-[#1d9bf0]/10' : 'bg-[#8b5cf6]/10';
                const topBorderGradient = isTwitter
                  ? 'before:bg-gradient-to-r before:from-[#1d9bf0] before:to-[#0d7bbf]'
                  : 'before:bg-gradient-to-r before:from-[#8b5cf6] before:to-[#6d28d9]';
                const postText = post.content?.text || post.text || '';
                const postMedia = post.content?.mediaUrl || '';
                const isEditing = editingPostId === post._id;
                const canEdit = post.status === 'scheduled';

                return (
                  <div
                    key={post._id}
                    className={`relative ${platformBg} border ${isEditing ? 'border-[#f59e0b]/50' : platformColorLight} rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:rounded-t-xl ${topBorderGradient}`}
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
                        {postText ? (
                          <p className="text-[#c4c4c4] text-sm mb-2 line-clamp-3">
                            {postText}
                          </p>
                        ) : (
                          <p className="text-[#82828c] text-sm italic mb-2">No text content</p>
                        )}

                        {postMedia && (
                          <div className="flex items-center gap-1.5 text-xs text-[#82828c] mb-2">
                            <Image className="w-3 h-3" />
                            <span>Media attached</span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 flex-wrap">
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
                          <StatusBadge status={post.status} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => handleEditPost(post)}
                            className="p-2 rounded-lg text-[#82828c] hover:text-white hover:bg-white/10 transition-all duration-300"
                            title="Edit post"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(post._id)}
                          className="p-2 rounded-lg text-[#82828c] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all duration-300"
                          title="Delete post"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] border border-white/10 rounded-2xl p-8 w-full max-w-md relative">
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-4 right-4 text-[#82828c] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center mx-auto mb-4"
                style={{ boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}
              >
                <CheckCircle className="w-8 h-8 text-[#10b981]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                {successUrls.scheduled ? 'Post Scheduled!' : 'Posted Successfully!'}
              </h2>
              <p className="text-[#82828c] text-sm mt-2">
                {successUrls.scheduled
                  ? 'Your post has been queued and will go out at the scheduled time.'
                  : 'Your cross-post is live on the platforms below.'}
              </p>
            </div>

            {!successUrls.scheduled && (
              <div className="space-y-3 mb-6">
                {successUrls.twitter && (
                  <a
                    href={successUrls.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-[#1d9bf0]/10 border border-[#1d9bf0]/30 rounded-xl hover:border-[#1d9bf0]/60 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3">
                      <Twitter className="w-5 h-5 text-[#1d9bf0]" />
                      <span className="text-white text-sm font-medium group-hover:text-[#1d9bf0] transition-colors">
                        View on Twitter
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#82828c] group-hover:text-[#1d9bf0] transition-colors" />
                  </a>
                )}

                {successUrls.nostr && (
                  <a
                    href={successUrls.nostr}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-xl hover:border-[#8b5cf6]/60 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5"
                        style={{
                          backgroundColor: '#8b5cf6',
                          mask: 'url(/nostr-logo-square.png) center/contain no-repeat',
                          WebkitMask: 'url(/nostr-logo-square.png) center/contain no-repeat'
                        }}
                      />
                      <span className="text-white text-sm font-medium group-hover:text-[#8b5cf6] transition-colors">
                        View on Primal
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#82828c] group-hover:text-[#8b5cf6] transition-colors" />
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-white text-[#0e0e0f] font-display font-semibold rounded-xl px-6 py-3 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoastPage;

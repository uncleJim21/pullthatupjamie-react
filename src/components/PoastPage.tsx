import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip, X, Twitter, Loader2, Check, AlertCircle, Clock, Send } from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { API_URL } from '../constants/constants.ts';
import { getPulseHeader } from '../services/pulseService.ts';

type Platform = 'twitter' | 'nostr';

interface PoastState {
  text: string;
  mediaFile: File | null;
  mediaPreview: string | null;
  platforms: Platform[];
  scheduledFor: Date | null;
  timezone: string;
}

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getPulseHeader(),
  };
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const TWITTER_CHAR_LIMIT = 280;

const PoastPage: React.FC = () => {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<PoastState>({
    text: '',
    mediaFile: null,
    mediaPreview: null,
    platforms: ['twitter', 'nostr'],
    scheduledFor: null,
    timezone: 'America/Chicago',
  });

  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/');
      return;
    }
    setIsAuthenticated(true);
  }, [navigate]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [state.text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState(prev => ({ ...prev, text: e.target.value }));
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setState(prev => ({ ...prev, mediaFile: file, mediaPreview: previewUrl }));
  };

  const handleMediaRemove = () => {
    if (state.mediaPreview) {
      URL.revokeObjectURL(state.mediaPreview);
    }
    setState(prev => ({ ...prev, mediaFile: null, mediaPreview: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePlatform = (platform: Platform) => {
    setState(prev => {
      const platforms = prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms };
    });
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    setState(prev => ({ ...prev, scheduledFor: date }));
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...getPulseHeader(),
      },
      body: formData,
    });

    if (!response.ok) throw new Error('Media upload failed');
    const data = await response.json();
    return data.url || data.mediaUrl || null;
  };

  const handleSubmit = useCallback(async () => {
    if (submitStatus === 'loading') return;
    if (!state.text.trim() && !state.mediaFile) return;
    if (state.platforms.length === 0) return;

    setSubmitStatus('loading');
    setErrorMessage('');

    try {
      let mediaUrl: string | null = null;

      if (state.mediaFile) {
        mediaUrl = await uploadMedia(state.mediaFile);
      }

      const body = {
        text: state.text,
        mediaUrl,
        platforms: state.platforms,
        scheduledFor: scheduleMode === 'later' && state.scheduledFor
          ? state.scheduledFor.toISOString()
          : null,
        timezone: state.timezone,
      };

      const response = await fetch(`${API_URL}/api/social/posts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
      }

      setSubmitStatus('success');
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [state, scheduleMode, submitStatus]);

  const handleReset = () => {
    if (state.mediaPreview) {
      URL.revokeObjectURL(state.mediaPreview);
    }
    setState({
      text: '',
      mediaFile: null,
      mediaPreview: null,
      platforms: ['twitter', 'nostr'],
      scheduledFor: null,
      timezone: 'America/Chicago',
    });
    setScheduleMode('now');
    setSubmitStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isDisabled = (!state.text.trim() && !state.mediaFile) || state.platforms.length === 0;
  const charCount = state.text.length;
  const isOverLimit = state.platforms.includes('twitter') && charCount > TWITTER_CHAR_LIMIT;

  if (!isAuthenticated) return null;

  return (
    <div style={styles.page}>
      <style>{neonAnimations}</style>
      <PageBanner />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>X-POAST</h1>
          <p style={styles.subtitle}>by Jamie</p>
        </div>

        {submitStatus === 'success' ? (
          <div style={styles.successCard}>
            <Check size={48} color="#fff" style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.8))' }} />
            <h2 style={styles.successTitle}>Poasted!</h2>
            <p style={styles.successText}>
              {scheduleMode === 'later' ? 'Your post has been scheduled.' : 'Your post is live.'}
            </p>
            <button
              style={{
                ...styles.poastButton,
                ...(hoveredButton === 'another' ? styles.poastButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton('another')}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={handleReset}
            >
              POAST ANOTHER
            </button>
          </div>
        ) : (
          <div style={styles.form}>
            {/* Textarea */}
            <div style={styles.textareaWrapper}>
              <textarea
                ref={textareaRef}
                style={styles.textarea}
                value={state.text}
                onChange={handleTextChange}
                placeholder="What's happening?"
                rows={4}
              />
              {state.platforms.includes('twitter') && (
                <div style={{
                  ...styles.charCount,
                  color: isOverLimit ? '#ff6b6b' : charCount > TWITTER_CHAR_LIMIT * 0.9 ? '#ffaa44' : 'rgba(255,255,255,0.4)',
                }}>
                  {charCount}/{TWITTER_CHAR_LIMIT}
                </div>
              )}
            </div>

            {/* Media Upload */}
            <div style={styles.mediaSection}>
              {state.mediaPreview ? (
                <div style={styles.mediaPreviewWrapper}>
                  <img src={state.mediaPreview} alt="Upload preview" style={styles.mediaPreviewImg} />
                  <button
                    style={{
                      ...styles.mediaRemoveBtn,
                      ...(hoveredButton === 'removeMedia' ? styles.mediaRemoveBtnHover : {}),
                    }}
                    onMouseEnter={() => setHoveredButton('removeMedia')}
                    onMouseLeave={() => setHoveredButton(null)}
                    onClick={handleMediaRemove}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  style={{
                    ...styles.uploadButton,
                    ...(hoveredButton === 'upload' ? styles.uploadButtonHover : {}),
                  }}
                  onMouseEnter={() => setHoveredButton('upload')}
                  onMouseLeave={() => setHoveredButton(null)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                  <span>Upload Media (optional)</span>
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
            <div style={styles.section}>
              <label style={styles.sectionLabel}>Platform</label>
              <div style={styles.platformRow}>
                {(['twitter', 'nostr'] as Platform[]).map(platform => {
                  const isActive = state.platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      style={{
                        ...styles.platformChip,
                        ...(isActive ? styles.platformChipActive : {}),
                        ...(hoveredButton === platform ? styles.platformChipHover : {}),
                      }}
                      onMouseEnter={() => setHoveredButton(platform)}
                      onMouseLeave={() => setHoveredButton(null)}
                      onClick={() => togglePlatform(platform)}
                    >
                      {platform === 'twitter' ? <Twitter size={16} /> : <NostrIcon />}
                      <span style={{ textTransform: 'capitalize' }}>{platform === 'twitter' ? 'Twitter' : 'Nostr'}</span>
                    </button>
                  );
                })}
              </div>
              {state.platforms.length === 0 && (
                <p style={styles.validationHint}>Select at least one platform</p>
              )}
            </div>

            {/* Schedule */}
            <div style={styles.section}>
              <label style={styles.sectionLabel}>Schedule</label>
              <div style={styles.scheduleRow}>
                <button
                  style={{
                    ...styles.scheduleOption,
                    ...(scheduleMode === 'now' ? styles.scheduleOptionActive : {}),
                  }}
                  onClick={() => { setScheduleMode('now'); setState(prev => ({ ...prev, scheduledFor: null })); }}
                >
                  <Send size={14} />
                  <span>Post Now</span>
                </button>
                <button
                  style={{
                    ...styles.scheduleOption,
                    ...(scheduleMode === 'later' ? styles.scheduleOptionActive : {}),
                  }}
                  onClick={() => setScheduleMode('later')}
                >
                  <Clock size={14} />
                  <span>Schedule</span>
                </button>
              </div>
              {scheduleMode === 'later' && (
                <input
                  type="datetime-local"
                  style={styles.dateInput}
                  onChange={handleScheduleChange}
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}
            </div>

            {/* Error */}
            {submitStatus === 'error' && (
              <div style={styles.errorBanner}>
                <AlertCircle size={16} />
                <span>{errorMessage || 'Failed to post. Please try again.'}</span>
              </div>
            )}

            {/* Submit */}
            <button
              style={{
                ...styles.poastButton,
                ...(isDisabled || isOverLimit ? styles.poastButtonDisabled : {}),
                ...(hoveredButton === 'submit' && !isDisabled && !isOverLimit ? styles.poastButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton('submit')}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={handleSubmit}
              disabled={isDisabled || isOverLimit || submitStatus === 'loading'}
            >
              {submitStatus === 'loading' ? (
                <span style={styles.loadingInner}>
                  <Loader2 size={20} className="spin" />
                  POASTING...
                </span>
              ) : (
                'POAST'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* Small inline Nostr icon */
const NostrIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
    <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zm40.3 186.5c-7 2.8-14.5 4.2-22.3 4.2-20.1 0-37.2-9.3-47.5-19.6-10.3 10.3-27.4 19.6-47.5 19.6-7.8 0-15.3-1.4-22.3-4.2C17 181 8.7 170.2 8.7 157.8c0-8.5 3.4-16.2 9-21.8-5.6-5.6-9-13.3-9-21.8 0-12.4 8.3-23.2 20-28.7 7-2.8 14.5-4.2 22.3-4.2 20.1 0 37.2 9.3 47.5 19.6 10.3-10.3 27.4-19.6 47.5-19.6 7.8 0 15.3 1.4 22.3 4.2 11.7 5.5 20 16.3 20 28.7 0 8.5-3.4 16.2-9 21.8 5.6 5.6 9 13.3 9 21.8 0 12.4-8.3 23.2-20 28.7z" />
  </svg>
);

/* CSS animations that can't be done inline */
const neonAnimations = `
  @keyframes neonPulse {
    0%, 100% {
      text-shadow:
        0 0 10px rgba(255, 255, 255, 0.8),
        0 0 20px rgba(255, 255, 255, 0.6),
        0 0 30px rgba(255, 255, 255, 0.4);
    }
    50% {
      text-shadow:
        0 0 15px rgba(255, 255, 255, 0.9),
        0 0 30px rgba(255, 255, 255, 0.7),
        0 0 45px rgba(255, 255, 255, 0.5);
    }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  /* Datetime-local input styling for dark theme */
  input[type="datetime-local"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
  }
  @media (max-width: 600px) {
    .poast-container {
      padding: 16px !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
  },
  container: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '32px 24px 64px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
    paddingTop: 16,
  },
  title: {
    fontSize: '4rem',
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: '0.2em',
    margin: 0,
    animation: 'neonPulse 3s ease-in-out infinite',
    textShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.6), 0 0 30px rgba(255,255,255,0.4)',
  },
  subtitle: {
    fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
    fontSize: '1.5rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
    margin: '-4px 0 0 0',
  },

  /* Form */
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  textareaWrapper: {
    position: 'relative',
  },
  textarea: {
    width: '100%',
    minHeight: 120,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    color: '#fff',
    fontSize: '1.1rem',
    padding: 16,
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  charCount: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    fontSize: '0.8rem',
    fontVariantNumeric: 'tabular-nums',
  },

  /* Media */
  mediaSection: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px dashed rgba(255,255,255,0.25)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.6)',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  uploadButtonHover: {
    borderColor: 'rgba(255,255,255,0.5)',
    color: '#fff',
  },
  mediaPreviewWrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  mediaPreviewImg: {
    maxWidth: 200,
    maxHeight: 160,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    objectFit: 'cover',
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#333',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'background 0.2s',
  },
  mediaRemoveBtnHover: {
    background: '#ff4444',
  },

  /* Sections */
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionLabel: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
  },

  /* Platforms */
  platformRow: {
    display: 'flex',
    gap: 10,
  },
  platformChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
  },
  platformChipActive: {
    borderColor: '#fff',
    color: '#fff',
    background: 'rgba(255,255,255,0.08)',
    boxShadow: '0 0 8px rgba(255,255,255,0.15)',
  },
  platformChipHover: {
    borderColor: 'rgba(255,255,255,0.5)',
  },
  validationHint: {
    color: '#ff6b6b',
    fontSize: '0.8rem',
    margin: 0,
  },

  /* Schedule */
  scheduleRow: {
    display: 'flex',
    gap: 10,
  },
  scheduleOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  scheduleOptionActive: {
    borderColor: '#fff',
    color: '#fff',
    background: 'rgba(255,255,255,0.08)',
    boxShadow: '0 0 8px rgba(255,255,255,0.15)',
  },
  dateInput: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    color: '#fff',
    padding: '10px 14px',
    fontSize: '0.9rem',
    outline: 'none',
    marginTop: 4,
    colorScheme: 'dark',
  },

  /* Error */
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(255,70,70,0.1)',
    border: '1px solid rgba(255,70,70,0.3)',
    color: '#ff6b6b',
    fontSize: '0.9rem',
  },

  /* POAST button */
  poastButton: {
    background: '#000',
    border: '2px solid #fff',
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    letterSpacing: '0.15em',
    padding: '14px 48px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center',
    marginTop: 8,
  },
  poastButtonHover: {
    boxShadow: '0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.4)',
    transform: 'translateY(-2px)',
  },
  poastButtonDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  loadingInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  /* Success */
  successCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: '48px 24px',
    textAlign: 'center',
  },
  successTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: 0,
    textShadow: '0 0 10px rgba(255,255,255,0.6)',
  },
  successText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1rem',
    margin: 0,
  },
};

export default PoastPage;

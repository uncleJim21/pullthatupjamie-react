import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { DEBUG_MODE, FRONTEND_URL } from '../../constants/constants.ts';
import { PodcastSearchResultItem, PresentationContext } from './PodcastSearchResultItem.tsx';
import SubscribeSection from './SubscribeSection.tsx'
import { SubscribeLinks } from './SubscribeSection.tsx';
import { Copy, Check, QrCodeIcon, MessageSquare, History, Link, Upload, ExternalLink, ChevronDown, Share, Shield, Settings, Calendar } from 'lucide-react';
import QRCodeModal from '../QRCodeModal.tsx';
import AuthService from '../../services/authService.ts';
import { SocialPlatform } from '../SocialShareModal.tsx';
import PodcastFeedService, { 
  Episode, 
  PodcastFeedData, 
  RunHistory, 
  RunHistoryRecommendation 
} from '../../services/podcastFeedService.ts';
import { JamieChat } from './JamieChat.tsx';
import UploadModal from '../UploadModal.tsx';
import ShareModal from '../ShareModal.tsx';
import SignInModal from '../SignInModal.tsx';
import CheckoutModal from '../CheckoutModal.tsx';
import UploadService, { UploadItem, PaginationData } from '../../services/uploadService.ts';
import { createFeedShareUrl } from '../../utils/urlUtils.ts';
import PageBanner from '../PageBanner.tsx';
import SocialShareModal from '../SocialShareModal.tsx';
import TutorialModal from '../TutorialModal.tsx';
import WelcomeModal from '../WelcomeModal.tsx';
import ScheduledPostsList from '../ScheduledPostsList.tsx';

interface SubscriptionSuccessPopupProps {
  onClose: () => void;
  isJamiePro?: boolean;
}

const SubscriptionSuccessPopup = ({ onClose, isJamiePro = false }: SubscriptionSuccessPopupProps) => (
  <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-lg font-bold mb-4">
        {isJamiePro ? 'Welcome to Jamie Pro!' : 'Your subscription was successful!'}
      </h2>
      <p className="text-gray-400 mb-4">
        {isJamiePro ? (
          'A team member will be in contact with you within 1 business day to complete your onboarding. \nIn the meantime enjoy additional on demand episode runs.'
        ) : (
          <>
            Enjoy unlimited access to Jamie and other{' '}
            <a
              href="https://cascdr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              CASCDR apps
            </a>
            .
          </>
        )}
      </p>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
      >
        Close
      </button>
    </div>
  </div>
);

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe' | 'Jamie Pro' | 'Uploads';
type JamieProView = 'chat' | 'history' | 'settings' | 'scheduled-posts';

const PodcastFeedPage: React.FC<{ initialView?: string; defaultTab?: string }> = ({ initialView, defaultTab }) => {
    const { feedId, episodeId } = useParams<{ feedId: string; episodeId?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [feedData, setFeedData] = useState<PodcastFeedData | null>(null);
    const [featuredEpisode, setFeaturedEpisode] = useState<Episode | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('Episodes');
    const [isLoading, setIsLoading] = useState(true);
    const [copied,setCopied] = useState(false);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [jamieProView, setJamieProView] = useState<JamieProView>('history');
    
    // Initialize jamieProView from URL parameter
    useEffect(() => {
      const viewParam = searchParams.get('view');
      console.log('URL view parameter:', viewParam);
      if (viewParam && ['chat', 'history', 'settings', 'scheduled-posts'].includes(viewParam)) {
        console.log('Setting jamieProView to:', viewParam);
        setJamieProView(viewParam as JamieProView);
        // Also set the active tab to Jamie Pro if we have a view parameter
        setActiveTab('Jamie Pro');
      }
    }, [searchParams, feedData]);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isLoadingUploads, setIsLoadingUploads] = useState(false);
    const [isLoadingMoreUploads, setIsLoadingMoreUploads] = useState(false);
    const [uploadsError, setUploadsError] = useState<string | null>(null);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [paginationData, setPaginationData] = useState<PaginationData | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [currentShareUrl, setCurrentShareUrl] = useState<string | null>(null);
    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
    const [error, setError] = useState<{ status: number; message: string } | null>(null);
    const [isUserSignedIn, setIsUserSignedIn] = useState(false);
    const [isProDashboardModalOpen, setIsProDashboardModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [autoShare, setAutoShare] = useState(() => {
        const settings = localStorage.getItem('userSettings');
        return settings ? JSON.parse(settings).autoStartCrosspost : false;
    });
    const [isSocialShareModalOpen, setIsSocialShareModalOpen] = useState(false);
    const [isUpgradeSuccessPopUpOpen, setIsUpgradeSuccessPopUpOpen] = useState(false);

    // Settings state
    const [settingsData, setSettingsData] = useState(() => {
        const settings = localStorage.getItem('userSettings');
        const parsed = settings ? JSON.parse(settings) : {};
        return {
            autoStartCrosspost: parsed.autoStartCrosspost || false,
            crosspostSignature: parsed.crosspostSignature || ''
        };
    });

    // Settings handlers
    const handleSettingChange = (key: string, value: boolean | string) => {
        const newSettings = { ...settingsData, [key]: value };
        setSettingsData(newSettings);
        
        // Update localStorage
        const existingSettings = localStorage.getItem('userSettings');
        const currentSettings = existingSettings ? JSON.parse(existingSettings) : {};
        localStorage.setItem('userSettings', JSON.stringify({
            ...currentSettings,
            ...newSettings
        }));
    };

    const handleAutoShareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked;
        setAutoShare(newValue);
        handleSettingChange('autoStartCrosspost', newValue);
    };

    const handleCrosspostSignatureChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleSettingChange('crosspostSignature', e.target.value);
    };

    // Add these handlers:
    const handlePlayPause = (id: string) => {
    if (currentlyPlayingId === id) {
        setCurrentlyPlayingId(null);
    } else {
        setCurrentlyPlayingId(id);
    }
    };

    const handleEnded = (id: string) => {
    setCurrentlyPlayingId(null);
    };

  const copyToClipboard = () => {
    const lna = feedData?.lightningAddress
    console.log(`lna:${lna}`)
    if(!lna){return}
    navigator.clipboard.writeText(lna);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openQRModal = () => {
    setQrModalOpen(true);
  }

  const fetchRunHistory = async () => {
    if (!feedId) return;
    
    try {
      setIsLoadingHistory(true);
      setError(null);
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        // Only prompt for sign-in if we're specifically in the jamiePro view
        if (initialView === 'jamiePro') {
          setIsSignInModalOpen(true);
        } else {
          // For regular feed views, just show empty state without prompting
          setRunHistory([]);
        }
        setIsLoadingHistory(false);
        return;
      }

      const response = await PodcastFeedService.getRunHistory(feedId, authToken);
      if (response.success) {
        setRunHistory(response.data);
      } else if (response.error) {
        // Check for specific error messages that indicate unauthorized access
        if (response.error.startsWith('401:') || response.error.includes('Authentication required')) {
          if (initialView === 'jamiePro') {
            setIsSignInModalOpen(true);
          } else {
            // For regular feed views, just show empty state without prompting
            setRunHistory([]);
          }
        } else if (response.error.startsWith('403:') || response.error.includes('Permission') || response.error.includes('Forbidden')) {
          setError({ status: 403, message: 'You do not have permission to access this content' });
        } else {
          console.error('Error fetching run history:', response.error);
        }
      }
    } catch (error) {
      console.error('Error fetching run history:', error);
      
      // Try to parse error status from the error message
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.startsWith('401:') || errorMessage.includes('Authentication required')) {
          if (initialView === 'jamiePro') {
            setIsSignInModalOpen(true);
          } else {
            // For regular feed views, just show empty state without prompting
            setRunHistory([]);
          }
        } else if (errorMessage.startsWith('403:') || errorMessage.includes('Permission') || errorMessage.includes('Forbidden')) {
          setError({ status: 403, message: 'You do not have permission to access this content' });
        } else {
          setError({ status: 500, message: 'Failed to load run history' });
        }
      } else {
        setError({ status: 500, message: 'An unknown error occurred' });
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchUploads = async (page: number = 1, append: boolean = false) => {
    if (!feedId) return;
    
    try {
      if (page === 1) {
        setIsLoadingUploads(true);
        setUploadsError(null);
      } else {
        setIsLoadingMoreUploads(true);
      }
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        setUploadsError('Authentication required');
        return;
      }

      const response = await UploadService.getUploadsList(authToken, page);
      
      // Sort uploads by date from latest to oldest
      const sortedUploads = [...response.uploads].sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      
      if (append) {
        // When appending, merge with existing uploads and re-sort to ensure correct order
        setUploads(prevUploads => {
          const combinedUploads = [...prevUploads, ...sortedUploads];
          return combinedUploads.sort(
            (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
          );
        });
      } else {
        setUploads(sortedUploads);
      }
      
      setPaginationData(response.pagination);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      setUploadsError('Failed to load uploads. Please try again.');
    } finally {
      setIsLoadingUploads(false);
      setIsLoadingMoreUploads(false);
    }
  };

  const loadMoreUploads = () => {
    if (paginationData && paginationData.hasNextPage) {
      fetchUploads(currentPage + 1, true);
    }
  };

  useEffect(() => {
    if (activeTab === 'Jamie Pro') {
      fetchRunHistory();
    }
    
    if (activeTab === 'Uploads') {
      // Reset to first page when tab changes to Uploads
      setCurrentPage(1);
      fetchUploads();
    }
  }, [activeTab]);

  // This useEffect is removed - using the one below that properly checks isUserSignedIn dependency 

  useEffect(() => {
    const fetchFeedData = async () => {
      if (!feedId) return;
      
      try {
        setIsLoading(true);
        const data = await PodcastFeedService.getFeedData(feedId);
        setFeedData(data);

        // If we have an episodeId, find and set the featured episode
        if (episodeId && data.episodes) {
          const featured = data.episodes.find(ep => ep.id === episodeId);
          if (featured) {
            setFeaturedEpisode(featured);
          }
        }
      } catch (error) {
        console.error('Error fetching podcast feed:', error);
        setFeedData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedData();
  }, [feedId, episodeId]);

  useEffect(() => {
    if (feedData && initialView === 'jamiePro') {
      setActiveTab('Jamie Pro');
      // Only set jamieProView to 'history' if no URL parameter is present
      const viewParam = searchParams.get('view');
      if (defaultTab === 'history' && !viewParam) {
        setJamieProView('history');
      }
      // Let the fetchRunHistory function handle unauthorized access
    } else if (feedData && initialView === 'uploads') {
      if (isAdmin) {
        setActiveTab('Uploads');
      } else {
        setActiveTab('Episodes');
        console.log('Non-admin user attempted to access Uploads tab, falling back to Episodes tab');
      }
    }
  }, [feedData, initialView, defaultTab, isAdmin, searchParams]);

  // Add a useEffect to ensure activeTab is never 'Jamie Pro' for non-admin users
  useEffect(() => {
    // Don't forcibly change the tab for Jamie Pro since we want to allow users to view it
    // but see an error message if they're not authorized
    if (activeTab === 'Uploads' && !isAdmin) {
      setActiveTab('Episodes');
      console.log('Non-admin user attempted to access restricted tab, falling back to Episodes tab');
    }
  }, [activeTab, isAdmin]);

  const openUploadModal = () => {
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    // Refresh uploads list after modal closes
    if (activeTab === 'Uploads') {
      setCurrentPage(1);
      fetchUploads(1, false);
    }
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    // Refresh the uploads list
    if (activeTab === 'Uploads') {
      setCurrentPage(1);
      fetchUploads();
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const cleanFileName = (fileName: string) => {
    // Remove timestamp prefix if it exists (like "1742402062188-")
    const timestampPattern = /^\d{10,13}-/;
    return fileName.replace(timestampPattern, '');
  };

  const handleCopyFileUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedLinkId(key);
        setTimeout(() => setCopiedLinkId(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy file URL:', err);
      });
  };

  const openShareModal = (url: string) => {
    setCurrentShareUrl(url);
    setIsShareModalOpen(true);
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setCurrentShareUrl(null);
  };

  // Load authentication state from localStorage
  useEffect(() => {
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      setIsUserSignedIn(hasToken && hasSquareId);
    };
  
    // Add a slight delay before checking localStorage
    const timeout = setTimeout(checkSignedIn, 50); // 50ms delay
  
    return () => clearTimeout(timeout); // Cleanup timeout
  }, []);

  // Handle sign in modal open from PageBanner
  const handleOpenSignInModal = () => {
    setIsSignInModalOpen(true);
  };
  
  // Handle sign in success
  const handleSignInSuccess = () => {
    setIsSignInModalOpen(false);
    setIsUserSignedIn(true);
    
    // Check privileges after sign-in
    if (feedId) {
      checkPrivileges(feedId);
    }
    
    // Refresh run history or uploads if needed
    if (activeTab === 'Jamie Pro') {
      fetchRunHistory();
    } else if (activeTab === 'Uploads') {
      fetchUploads();
    }
  };
  
  // Handle sign out
  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('squareId');
    localStorage.removeItem('isSubscribed');
    setIsUserSignedIn(false);
    setIsAdmin(false);
    
    // Reset any authenticated-only data
    setRunHistory([]);
    setUploads([]);
  };

  // Check admin privileges
  const checkPrivileges = async (feedId: string) => {
    try {
      const token = localStorage.getItem("auth_token") as string;
      if(!token){
          setIsAdmin(false);
          return;
      }
      const response = await AuthService.checkPrivs(token);
      console.log(`checkPrivs response:${JSON.stringify(response,null,2)}`);
      if (response && response.privs.privs && response.privs.privs.feedId === feedId) {
          console.log(`Admin privileges granted`);
          setIsAdmin(response.privs.privs.access === 'admin');
      } else {
          setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error checking privileges:", error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log(`feedId: ${feedId}`);
    if (feedId && isUserSignedIn) {
      checkPrivileges(feedId);
    } else {
      setIsAdmin(false);
    }
  }, [feedId, isUserSignedIn]); 

  // Handle URL parameter for showing Pro Dashboard modal
  useEffect(() => {
    const showProModal = searchParams.get('showProModal');
    if (showProModal === 'true' && !isAdmin) {
      setIsProDashboardModalOpen(true);
      // Clean up URL parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('showProModal');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, isAdmin, setSearchParams]);

  const handleProDashboardUpgrade = () => {
    setIsProDashboardModalOpen(false);
    setIsCheckoutModalOpen(true);
  };

  const handleUpgrade = () => {
    setIsCheckoutModalOpen(true);
  };

  const handleUpgradeSuccess = () => {
    setIsCheckoutModalOpen(false);
    setIsUpgradeSuccessPopUpOpen(true); // Show the popup
    // Optionally refresh admin privileges after successful upgrade
    if (feedId) {
      checkPrivileges(feedId);
    }
  };

  // Handle PageBanner upgrade success (from AccountButton)
  const handlePageBannerUpgradeSuccess = () => {
    setIsUpgradeSuccessPopUpOpen(true); // Show the popup
    // Optionally refresh admin privileges after successful upgrade
    if (feedId) {
      checkPrivileges(feedId);
    }
  };

  const handleUploadShare = (fileUrl: string) => {
    const settings = localStorage.getItem('userSettings');
    const autoCrosspost = settings ? JSON.parse(settings).autoStartCrosspost : false;
    setCurrentShareUrl(fileUrl);
    if (autoCrosspost) {
      setIsSocialShareModalOpen(true);
      setIsShareModalOpen(false);
    } else {
      setIsShareModalOpen(true);
      setIsSocialShareModalOpen(false);
    }
  };

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!feedData) {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
            <div className='text-4xl'>
                <h1>404</h1>
            </div>
            <div className="w-12 h-px bg-gray-600"></div>
            <div className="text-lg">
                Podcast not found
            </div>
        </div>
    );
}

  return (
    <div className="min-h-screen pb-12 bg-black text-white">
      {/* Page Banner */}
      <PageBanner 
        logoText="Pull That Up Jamie!" 
        onSignIn={handleOpenSignInModal}
        onSignOut={handleSignOut}
        onUpgrade={handlePageBannerUpgradeSuccess}
        onTutorialClick={handleTutorialClick}
        isUserSignedIn={isUserSignedIn}
        setIsUserSignedIn={setIsUserSignedIn}
      />
      
      {/* Header Section */}
      <div 
        className="w-full py-8 px-4"
        style={{ backgroundColor: feedData.headerColor }}
      >
        <div className="max-w-4xl mx-auto flex items-start gap-6">
          {/* Podcast Logo */}
          <img 
            src={feedData.logoUrl} 
            alt={feedData.title}
            className="sm:w-32 sm:h-32 w-24 w-24 rounded-lg shadow-lg border border-gray-700"
          />
          
          {/* Podcast Info with tinted background */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="bg-black bg-opacity-30 px-4 py-3 rounded-lg" 
              style={{ 
                display: "inline-block",
                maxWidth: "calc(100% - 4px)"
              }}
            >
              <h1 className="sm:text-3xl text-xl font-bold mb-2">{feedData.title}</h1>
              <p className="text-lg text-white opacity-80">by {feedData.creator}</p>
              {feedData.lightningAddress && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="sm:text-sm text-xs text-white opacity-80 no-select truncate max-w-[180px] sm:max-w-none">
                    {`⚡ ${feedData.lightningAddress}`}
                  </p>
                  <div className="flex items-center">
                    <button 
                      className="text-white hover:text-gray-800 opacity-80 mr-2"
                      onClick={copyToClipboard}
                    >
                      {!copied ? <Copy size={16} /> : <Check size={16} />}
                    </button>
                    <button 
                      className="text-white hover:text-gray-800 opacity-80"
                      onClick={openQRModal}
                    >
                      <QrCodeIcon size={16} />
                    </button>
                  </div>

                  {isAdmin && (
                      <div className="absolute top-4 right-4 bg-white text-black text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                          Admin
                      </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-800" style={{ backgroundColor: feedData.headerColor }}>
        <div className="max-w-4xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-8 min-w-max">
            {([
                'Episodes', 
                // 'Home', 
                // 'Top Clips', 
                'Subscribe',
                ...(isAdmin ? ['Jamie Pro', 'Uploads'] : [])
            ] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 relative ${
                  activeTab === tab 
                    ? 'text-white font-medium' 
                    : 'text-white opacity-80 hover:text-gray-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Ensure non-admin users can't see Jamie Pro or Uploads tab content even if activeTab is somehow set to it */}
        {(activeTab === 'Jamie Pro' || activeTab === 'Uploads') && !isAdmin ? (
          // Render Episodes tab content as fallback
          <>
            {featuredEpisode && (
              <div className="py-8">
                <h2 className="text-xl font-bold mb-6">Featured Episode</h2>
                <PodcastSearchResultItem
                  id={featuredEpisode.id}
                  quote={featuredEpisode.description || ''}
                  episode={featuredEpisode.title}
                  creator={feedData?.creator || ''}
                  audioUrl={featuredEpisode.audioUrl}
                  date={featuredEpisode.date}
                  timeContext={{
                    start_time: 0,
                    end_time: 3600
                  }}
                  similarity={{ combined: 1, vector: 1 }}
                  episodeImage={feedData?.logoUrl || ''}
                  listenLink={featuredEpisode.audioUrl}
                  isPlaying={currentlyPlayingId === featuredEpisode.id}
                  onPlayPause={handlePlayPause}
                  onEnded={handleEnded}
                  shareUrl={createFeedShareUrl(feedId || '')}
                  shareLink=""
                />
              </div>
            )}
            <div className="py-8">
              <h2 className="text-xl font-bold mb-6">All Episodes</h2>
              <div className="space-y-6">
                {feedData.episodes.map(episode => (
                  <PodcastSearchResultItem
                    id={episode.id}
                    quote={episode.description || ''}
                    episode={episode.title}
                    creator={feedData?.creator || ''}
                    audioUrl={episode.audioUrl}
                    date={episode.date}
                    timeContext={{
                      start_time: 0,
                      end_time: 3600
                    }}
                    similarity={{ combined: 1, vector: 1 }}
                    episodeImage={feedData?.logoUrl || ''}
                    listenLink={episode.audioUrl}
                    isPlaying={currentlyPlayingId === episode.id}
                    onPlayPause={handlePlayPause}
                    onEnded={handleEnded}
                    shareUrl={createFeedShareUrl(feedId || '')}
                    shareLink=""
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {activeTab === 'Episodes' && (
              <>
                {featuredEpisode && (
                  <div className="py-8">
                    <h2 className="text-xl font-bold mb-6">Featured Episode</h2>
                    <PodcastSearchResultItem
                      id={featuredEpisode.id}
                      quote={featuredEpisode.description || ''}
                      episode={featuredEpisode.title}
                      creator={feedData?.creator || ''}
                      audioUrl={featuredEpisode.audioUrl}
                      date={featuredEpisode.date}
                      timeContext={{
                        start_time: 0,
                        end_time: 3600
                      }}
                      similarity={{ combined: 1, vector: 1 }}
                      episodeImage={feedData?.logoUrl || ''}
                      listenLink={featuredEpisode.audioUrl}
                      isPlaying={currentlyPlayingId === featuredEpisode.id}
                      onPlayPause={handlePlayPause}
                      onEnded={handleEnded}
                      shareUrl={createFeedShareUrl(feedId || '')}
                      shareLink=""
                    />
                  </div>
                )}
                <div className="py-8">
                  <h2 className="text-xl font-bold mb-6">All Episodes</h2>
                  <div className="space-y-6">
                    {feedData.episodes.map(episode => (
                      <PodcastSearchResultItem
                        id={episode.id}
                        quote={episode.description || ''}
                        episode={episode.title}
                        creator={feedData?.creator || ''}
                        audioUrl={episode.audioUrl}
                        date={episode.date}
                        timeContext={{
                          start_time: 0,
                          end_time: 3600
                        }}
                        similarity={{ combined: 1, vector: 1 }}
                        episodeImage={feedData?.logoUrl || ''}
                        listenLink={episode.audioUrl}
                        isPlaying={currentlyPlayingId === episode.id}
                        onPlayPause={handlePlayPause}
                        onEnded={handleEnded}
                        shareUrl={createFeedShareUrl(feedId || '')}
                        shareLink=""
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'Subscribe' && (
              <div className="py-8">
                <SubscribeSection 
                  spotifyLink={feedData?.subscribeLinks?.spotifyLink || null}
                  appleLink={feedData?.subscribeLinks?.appleLink || null}
                  youtubeLink={feedData?.subscribeLinks?.youtubeLink || null}
                />
              </div>
            )}

            {activeTab === 'Uploads' && (
              <div className="py-8">
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold">Your Uploads</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        id="globalAutoShare"
                        checked={autoShare}
                        onChange={handleAutoShareChange}
                        className="rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                      />
                      <label htmlFor="globalAutoShare">Start Auto Share after Upload</label>
                    </div>
                  </div>
                  <button
                    onClick={openUploadModal}
                    className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center font-medium"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </button>
                </div>
                
                {isLoadingUploads ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : uploadsError ? (
                  <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
                    {uploadsError}
                  </div>
                ) : uploads.length === 0 ? (
                  <div className="p-8 bg-[#111111] border border-gray-800 rounded-lg text-center">
                    <p className="text-gray-400">No uploads found. Click the Upload button to add files.</p>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-3 mb-4">
                      {/* Uploads already sorted from latest to oldest */}
                      {uploads.map((upload) => (
                        <div 
                          key={upload.key}
                          className="bg-[#111111] border border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate" title={cleanFileName(upload.fileName)}>
                              {cleanFileName(upload.fileName)}
                            </p>
                            <div className="flex flex-wrap text-gray-400 text-sm mt-1 gap-4">
                              <p>Uploaded {formatDate(upload.lastModified)}</p>
                              <p>{formatBytes(upload.size)}</p>
                            </div>
                          </div>
                          <div className="flex space-x-3 self-end sm:self-center">
                            <button
                              onClick={() => handleCopyFileUrl(upload.publicUrl, upload.key)}
                              className="flex items-center justify-center h-9 w-9 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                              title="Copy link"
                            >
                              {copiedLinkId === upload.key ? 
                                <Check className="w-5 h-5 text-green-500" /> : 
                                <Link className="w-5 h-5" />
                              }
                            </button>
                            <button
                              onClick={() => openShareModal(upload.publicUrl)}
                              className="flex items-center justify-center h-9 w-9 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                              title="Share file"
                            >
                              <Share className="w-5 h-5" />
                            </button>
                            <a 
                              href={upload.publicUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center h-9 w-9 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                              title="Open file"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination - Load More button */}
                    {paginationData && paginationData.hasNextPage && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={loadMoreUploads}
                          disabled={isLoadingMoreUploads}
                          className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#252525] text-white px-6 py-3 rounded-md border border-gray-700 transition-colors font-medium"
                        >
                          {isLoadingMoreUploads ? (
                            <>
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-5 h-5" />
                              <span>Load More</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Pagination information */}
                    {paginationData && (
                      <div className="text-center text-gray-500 text-sm mt-4">
                        Showing {uploads.length} of {paginationData.totalCount} uploads
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Jamie Pro' && isAdmin && (
              <div className="py-8">
                {/* Add the Jamie Pro header similar to the batch clips mode */}
                <div className="flex flex-col items-center mb-8">
                  <img
                    src="/jamie-pro-banner.png"
                    alt="Jamie Pro Banner"
                    className="max-w-full h-auto"
                  />
                  <p className="text-gray-400 text-xl font-medium mt-2">AI Curated Clips for You</p>
                </div>

                <div className="flex items-center justify-center mb-8">
                  <div className="inline-flex rounded-lg border border-gray-800 p-1.5">
                    <button
                      onClick={() => setJamieProView('chat')}
                      className={`inline-flex items-center px-3 sm:px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'chat'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare size={26} className="sm:mr-2.5 sm:!w-5 sm:!h-5" />
                      <span className="hidden sm:inline">Chat with Jamie</span>
                    </button>
                    <button
                      onClick={() => setJamieProView('history')}
                      className={`inline-flex items-center px-3 sm:px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'history'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <History size={26} className="sm:mr-2.5 sm:!w-5 sm:!h-5" />
                      <span className="hidden sm:inline">AI Curations</span>
                    </button>
                    <button
                      onClick={() => setJamieProView('scheduled-posts')}
                      className={`inline-flex items-center px-3 sm:px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'scheduled-posts'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Calendar size={26} className="sm:mr-2.5 sm:!w-5 sm:!h-5" />
                      <span className="hidden sm:inline">Scheduled Posts</span>
                    </button>
                    <button
                      onClick={() => setJamieProView('settings')}
                      className={`inline-flex items-center px-3 sm:px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'settings'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Settings size={26} className="sm:mr-2.5 sm:!w-5 sm:!h-5" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>
                  </div>
                </div>

                {jamieProView === 'chat' ? (
                  feedId ? <JamieChat feedId={feedId} /> : (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-lg">Unable to load chat. Please try again.</p>
                    </div>
                  )
                ) : jamieProView === 'scheduled-posts' ? (
                  <div className="max-w-4xl mx-auto">
                    <ScheduledPostsList />
                  </div>
                ) : jamieProView === 'settings' ? (
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-6">Settings</h3>
                      
                      <div className="space-y-6">
                        {/* Auto Start Crosspost Setting */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-1">Auto Start Crosspost</h4>
                            <p className="text-gray-400 text-sm">
                              Automatically start the crosspost process after uploading files
                            </p>
                          </div>
                          <div className="ml-4">
                            <input
                              type="checkbox"
                              id="autoStartCrosspost"
                              checked={settingsData.autoStartCrosspost}
                              onChange={handleAutoShareChange}
                              className="rounded border-gray-600 bg-gray-800 text-white focus:ring-white focus:ring-2"
                            />
                          </div>
                        </div>

                        {/* Crosspost Signature Setting */}
                        <div className="space-y-2">
                          <div>
                            <h4 className="text-white font-medium mb-1">Crosspost Signature</h4>
                            <p className="text-gray-400 text-sm">
                              Text that appears at the bottom of all crossposts (e.g., "Check out my pod at https://podhome.com/pullthatupjamie")
                            </p>
                          </div>
                          <textarea
                            value={settingsData.crosspostSignature}
                            onChange={handleCrosspostSignatureChange}
                            placeholder="Enter your crosspost signature..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isLoadingHistory ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : error && error.status === 403 ? (
                  <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden p-6 max-w-3xl mx-auto">
                    <div className="flex flex-col items-center text-center">
                      <Shield className="w-12 h-12 text-gray-400 mb-4" />
                      <h3 className="text-xl font-medium text-white mb-3">Access Restricted</h3>
                      <p className="text-gray-400 mb-4">
                        You don't have permission to view this content. Please contact the feed administrator.
                      </p>
                    </div>
                  </div>
                ) : runHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-lg">No AI curations available.</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto">
                    {runHistory.map((run, index) => (
                      <div 
                        key={index}
                        className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors cursor-pointer"
                        onClick={() => {
                          if (run._id && feedId) {
                            window.location.href = `/app/feed/${feedId}/clipBatch/${run._id}`;
                          }
                        }}
                      >
                        {run.recommendations.length > 0 && (
                          <PodcastSearchResultItem
                            id={run.recommendations[0].paragraph_ids[0]}
                            quote={run.recommendations[0].text}
                            episode={run.recommendations[0].title}
                            creator={`${run.recommendations[0].feed_title} - ${run.recommendations[0].episode_title}`}
                            audioUrl={run.recommendations[0].audio_url}
                            date={run.run_date}
                            timeContext={{
                              start_time: run.recommendations[0].start_time,
                              end_time: run.recommendations[0].end_time
                            }}
                            similarity={{ combined: run.recommendations[0].relevance_score / 100, vector: run.recommendations[0].relevance_score / 100 }}
                            episodeImage={run.recommendations[0].episode_image}
                            isPlaying={currentlyPlayingId === run.recommendations[0].paragraph_ids[0]}
                            onPlayPause={handlePlayPause}
                            onEnded={handleEnded}
                            shareUrl={createFeedShareUrl(feedId || '')}
                            shareLink={run.recommendations[0].paragraph_ids[0]}
                            authConfig={null}
                            presentationContext={PresentationContext.runHistoryPreview}
                            runId={run._id}
                            feedId={feedId}
                            onSignInClick={() => setIsSignInModalOpen(true)}
                            error={error || undefined}
                            shareable={run.recommendations[0].shareable}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {qrModalOpen && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          lightningAddress={feedData?.lightningAddress || ''}
          title={feedData?.title || ''}
        />
      )}

      {uploadModalOpen && (
        <UploadModal 
          onClose={closeUploadModal} 
          onShareRequest={handleUploadShare}
        />
      )}

      {isShareModalOpen && currentShareUrl && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={closeShareModal}
          fileUrl={currentShareUrl}
          itemName="upload"
          showCopy={true}
          showDownload={true}
          showTwitter={true}
          showNostr={true}
          onOpenChange={(open) => { if (!open) setIsShareModalOpen(false); }}
        />
      )}

      {isSocialShareModalOpen && currentShareUrl && (
        <SocialShareModal
          isOpen={isSocialShareModalOpen}
          onClose={() => setIsSocialShareModalOpen(false)}
          fileUrl={currentShareUrl}
          itemName="upload"
          onComplete={() => setIsSocialShareModalOpen(false)}
          platform={SocialPlatform.Twitter}
        />
      )}

      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={() => {
          setIsSignInModalOpen(false);
          setIsUserSignedIn(true);
          
          // Check privileges after sign-up
          if (feedId) {
            checkPrivileges(feedId);
          }
        }}
      />

      {/* Pro Dashboard Modal */}
      {isProDashboardModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
            <h2 className="text-white text-xl font-bold mb-4">
              Pro Dashboard Access Required
            </h2>
            <p className="text-gray-400 mb-6">
              The Pro Dashboard is exclusively for Jamie Pro subscribers. Upgrade now to access advanced podcast management features, analytics, and premium tools.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsProDashboardModalOpen(false)}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleProDashboardUpgrade}
                className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal for internal upgrade buttons */}
      <CheckoutModal 
        isOpen={isCheckoutModalOpen} 
        onClose={() => setIsCheckoutModalOpen(false)} 
        onSuccess={handleUpgradeSuccess}
        productName="jamie-pro"
        customDescription="Unlock advanced podcast management features and the Pro Dashboard"
        customFeatures={[
          "Pro Dashboard Access",
          "Advanced Analytics",
          "Premium Podcast Tools",
          "Priority Support"
        ]}
        customPrice="49.99"
      />

      {/* Subscription Success Popup */}
      {isUpgradeSuccessPopUpOpen && (
        <SubscriptionSuccessPopup onClose={() => {
          setIsUpgradeSuccessPopUpOpen(false);
          setIsCheckoutModalOpen(false);
        }} />
      )}

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={handleTutorialClose}
        defaultSection={2} // Jamie Pro section for dashboard pages
      />
    </div>
  );
};

export default PodcastFeedPage;
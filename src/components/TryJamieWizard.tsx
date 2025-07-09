import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants/constants.ts';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import rssService, { PodcastFeed, PodcastEpisode, FeedInfo } from '../services/rssService.ts';
import TryJamieService, { OnDemandRunRequest } from '../services/tryJamieService.ts';
import SignInModal from './SignInModal.tsx';
import CheckoutModal from './CheckoutModal.tsx';
import JamieLoadingScreen from './JamieLoadingScreen.tsx';
import TutorialModal from './TutorialModal.tsx';

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
          'A team member will be in contact with you within 1 business day to complete your onboarding.'
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

// Step indicator interface
interface StepIndicatorProps {
  currentStep: number;
  hasQuotaInfo?: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, hasQuotaInfo = false }) => {
  const steps = [
    { number: 1, label: 'Select Feed' },
    { number: 2, label: 'Select Episode' },
    { number: 3, label: 'Confirm' },
    { number: 4, label: 'Process' },
    { number: 5, label: 'Enjoy!' },
  ];

  return (
    <div className={`w-full max-w-2xl mx-auto mb-8 ${hasQuotaInfo ? 'mt-44 sm:mt-32' : 'mt-20'} flex items-center px-8`}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200
                ${currentStep === step.number
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-gray-700 text-white border-gray-700'}
              `}
              style={{ minWidth: 32, minHeight: 32 }}
            >
              <span className="text-sm sm:text-lg font-bold">{step.number}</span>
            </div>
            <span
              className={`text-xs mt-1 ${
                currentStep === step.number ? 'text-white font-bold' : 'text-gray-400 font-normal'
              }`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {step.label}
            </span>
          </div>
          {idx !== steps.length - 1 && (
            <div className="flex-1 h-[1.5px] bg-gray-700 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Add SelectedPodcast type
export interface SelectedPodcast {
  feedId: number;
  feedGuid: string;
  feedTitle: string;
  feedUrl: string;
  podcastImage: string;
}

const TryJamieWizard: React.FC = () => {
  const isDebug = false;
  const debugFeed : SelectedPodcast = {
    "feedUrl": "https://serve.podhome.fm/rss/a7d58130-6f1d-4ff3-9c5a-aee3b8cc07cc",
    "feedTitle": "Trust Revolution",
    "feedId": 7246395,
    "podcastImage": "https://assets.podhome.fm/77ae8d2c-0dcb-407e-93e7-08dd5a75ee77/638769544435807117TrustRevolution_Cover.jpg",
    "feedGuid": "a7d58130-6f1d-4ff3-9c5a-aee3b8cc07cc"
  }
  // const debugFeed : SelectedPodcast = {
  //     feedId: 6786106,
  //     feedTitle: "The Joe Rogan Experience",
  //     feedUrl: "https://feeds.megaphone.fm/GLT1412515089",
  //     podcastImage: "https://megaphone.imgix.net/podcasts/8e5bcebc-ca16-11ee-89f0-0fa0b9bdfc7c/image/c2c595e6e3c2a64e6ea18fb6c6da8860.jpg",
  //     feedGuid: "a7d58130-6f1d-4ff3-9c5a-aee3b8cc07cc",
  //   }
  const [currentStep, setCurrentStep] = useState(isDebug ? 5 : 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastFeed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPodcast, setSelectedPodcast] = useState<SelectedPodcast | null>(isDebug ? debugFeed : null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingFailed, setProcessingFailed] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isQuotaExceededModalOpen, setIsQuotaExceededModalOpen] = useState(false);
  const [isUpgradeSuccessPopUpOpen, setIsUpgradeSuccessPopUpOpen] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{
    eligible: boolean;
    remainingRuns: number;
    totalLimit: number;
    usedThisPeriod: number;
    periodStart: string;
    nextResetDate: string;
    daysUntilReset: number;
    authType?: 'ip' | 'user';
    userEmail?: string;
    clientIp?: string;
  } | null>(null);
  const [imageLoadedStates, setImageLoadedStates] = useState<Record<string, boolean>>({});
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSigningInForUpgrade, setIsSigningInForUpgrade] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const navigate = useNavigate();

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
  };

  // Check eligibility on component mount and when user signs in/out
  useEffect(() => {
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      setIsUserSignedIn(hasToken && hasSquareId);
    };
    
    checkSignedIn();
    // Always check eligibility regardless of sign-in status
    checkQuotaEligibility();
  }, []);

  // Auto-show quota exceeded modal when user is over quota
  useEffect(() => {
    // Auto-show quota exceeded modal if user loads page and is over quota
    if (
      quotaInfo &&
      !quotaInfo.eligible &&
      currentStep === 1 &&
      !isQuotaExceededModalOpen &&
      !isUpgrading
    ) {
      setIsQuotaExceededModalOpen(true);
    }
  }, [quotaInfo, isQuotaExceededModalOpen, currentStep, isUpgrading]);

  // Function to check on-demand run eligibility
  const checkQuotaEligibility = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add JWT token if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/on-demand/checkEligibility`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Handle both new and old API response formats
          const quotaData = data.quotaInfo || data.eligibility || data;
          setQuotaInfo({
            eligible: data.eligible !== undefined ? data.eligible : (quotaData?.eligible || true),
            remainingRuns: quotaData?.remainingRuns || 0,
            totalLimit: quotaData?.totalLimit || 0,
            usedThisPeriod: quotaData?.usedThisPeriod || 0,
            periodStart: quotaData?.periodStart || '',
            nextResetDate: quotaData?.nextResetDate || '',
            daysUntilReset: parseInt(quotaData?.daysUntilReset, 10) || 0,
            authType: data.authType || 'user',
            userEmail: data.userEmail,
            clientIp: data.clientIp
          });
        }
      }
    } catch (error) {
      console.error('Error checking quota eligibility:', error);
    }
  };

  // Handle upgrade functions
  const handleUpgrade = () => {
    if (!isUserSignedIn) {
      setIsSigningInForUpgrade(true);
      setIsSignInModalOpen(true);
    } else {
      setIsCheckoutModalOpen(true);
    }
  };

  const handleUpgradeSuccess = () => {
    setIsCheckoutModalOpen(false);
    setIsUpgradeSuccessPopUpOpen(true); // Show the popup
    // Refresh quota after successful upgrade
    checkQuotaEligibility();
  };



  // Static feeds for default display
  const staticFeeds = [
    {
      id: "550168",
      title: "The Joe Rogan Experience",
      url: "https://feeds.megaphone.fm/GLT1412515089",
      description: "The official podcast of comedian Joe Rogan.",
      author: "Joe Rogan",
      image: "https://megaphone.imgix.net/podcasts/8e5bcebc-ca16-11ee-89f0-0fa0b9bdfc7c/image/c2c595e6e3c2a64e6ea18fb6c6da8860.jpg"
    },
    {
      id: "229239",
      title: "Modern Wisdom",
      url: "https://feeds.megaphone.fm/modernwisdom",
      description: "Conversations with the world's most interesting thinkers about philosophy, psychology, and human optimization.",
      author: "Chris Williamson",
      ownerName: "Chris Williamson",
      image: "https://megaphone.imgix.net/podcasts/a62f84c0-f8b6-11ed-a4fc-fb9e7841d45b/image/76ed638554a4be965517200d1cd5f30d.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress"
    },
    {
      id: "226249",
      title: "TFTC: A Bitcoin Podcast",
      url: "https://feeds.fountain.fm/ZwwaDULvAj0yZvJ5kdB9",
      description: "A Bitcoin podcast exploring the future of money and freedom.",
      author: "Marty Bent",
      ownerName: "TFTC",
      image: "https://feeds.fountain.fm/ZwwaDULvAj0yZvJ5kdB9/files/COVER_ART---DEFAULT---e571338c-758b-45db-b083-0a16c49169b1.jpg"
    },
    {
      id: "1365694",
      title: "The \"What is Money?\" Show",
      url: "https://feeds.simplecast.com/MLdpYXYI",
      link: "https://whatismoneypodcast.com",
      description: "\"What is Money?\" is the rabbit that leads us down the proverbial rabbit hole. It is the most important question for finding truth in the world.",
      author: "Robert Breedlove",
      ownerName: "Robert Breedlove",
      image: "https://image.simplecastcdn.com/images/8862bce3-8814-46a6-9b72-a533960bbd50/fc74b5de-5bf7-4b92-8bab-4c8eb0ed805e/3000x3000/wim-podcast-profile-6.jpg?aid=rss_feed"
    },
    {
      id: "7181269",
      title: "Early Days",
      url: "https://anchor.fm/s/100230220/podcast/rss",
      description: "Exploring the early days of Bitcoin and the builders creating the future.",
      author: "Car",
      ownerName: "PlebLab",
      image: "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/42872616/42872616-1737246678005-991fe8ccc838e.jpg"
    },
    {
      id: "3498055",
      title: "Convos On The Pedicab",
      url: "https://anchor.fm/s/3dc3ba58/podcast/rss",
      description: "Conversations about culture, politics, and society from a unique perspective.",
      author: "Alex Strenger",
      ownerName: "Alex Strenger",
      image: "https://d3t3ozftmdmh3i.cloudfront.net/production/podcast_uploaded_nologo/10262374/10262374-1603995280202-46e057c35b6d3.jpg"
    }
  ];

  // Search for podcasts when the query changes (after 500ms debounce)
  useEffect(() => {
    // Reset hasSearched when query changes
    setHasSearched(false);
    
    // Clear search results if query is too short
    if (searchQuery.length < 2) {
      setSearchResults([]);
    }
    
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchFeeds();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Function to search for feeds
  const searchFeeds = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await rssService.searchFeeds(searchQuery);
      console.log('Search response:', response);
      if (response.data && response.data.status === 'true' && response.data.feeds) {
        setSearchResults(response.data.feeds);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching feeds:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle feed selection
  const handleSelectFeed = async (feed: PodcastFeed) => {
    setIsLoading(true);
    try {
      const response = await rssService.getFeed(feed.url, feed.id);
      console.log('Feed episodes response:', response);
      if (response.episodes && response.episodes.feedInfo) {
        const info = response.episodes.feedInfo;
        console.log('Selected podcast:', JSON.stringify(info,null,2));
        
        // Prioritize image from search results over feed info
        // Use feed.image first, then feed.artwork, then fallback to info.podcastImage
        const podcastImage = feed.image || (feed as any).artwork || info.podcastImage;
        
        setSelectedPodcast({
          feedId: info.feedId,
          feedGuid: info.feedGuid,
          feedTitle: info.feedTitle,
          feedUrl: info.feedUrl,
          podcastImage: podcastImage,
        });
        setEpisodes(response.episodes.episodes);
        setCurrentStep(2); // Move to the next step
      }
    } catch (error) {
      console.error('Error fetching feed episodes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle episode selection
  const handleSelectEpisode = (episode: PodcastEpisode) => {
    setSelectedEpisode(episode);
    setCurrentStep(3); // Move to the next step
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Step 4: Processing logic
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    const pollIntervalTime = 15000;
    let pollCount = 0;
    const maxPolls = 100; // 5 minutes at 10s intervals

    const startProcessing = async () => {
      if (currentStep !== 4 || !selectedPodcast || !selectedEpisode) return;
      setProcessing(true);
      setJobId(null);
      try {
        // Submit job
        const req: OnDemandRunRequest = {
          message: 'On-demand Jamie run',
          parameters: {},
          episodes: [
            {
              guid: selectedEpisode.episodeGUID,
              feedGuid: selectedPodcast.feedGuid,
              feedId: selectedPodcast.feedId,
            },
          ],
          skipCleanGuid: true,
        };
        const res = await TryJamieService.submitOnDemandRun(req);
        setJobId(res.jobId);
        // Refresh quota after successful submission
        checkQuotaEligibility();
        // Start polling
        pollInterval = setInterval(async () => {
          pollCount++;
          if (!res.jobId) return;
          try {
            const status = await TryJamieService.getOnDemandJobStatus(res.jobId);
            if (status.status === 'complete' || status.status === 'failed' || pollCount >= maxPolls) {
              clearInterval(pollInterval);
              setProcessing(false);
              
              // Check if processing completed but all episodes failed
              const allEpisodesFailed = status.status === 'complete' && 
                status.stats && 
                status.stats.episodesProcessed === 0 && 
                status.stats.episodesFailed > 0;
              
              if (allEpisodesFailed) {
                setProcessingFailed(true);
                setTimeout(() => setCurrentStep(5), 500); // Move to step 5 but show failure UI
              } else {
                setTimeout(() => setCurrentStep(5), 500); // Move to Enjoy step
              }
            }
          } catch (e) {
            // Ignore polling errors, keep polling
          }
        }, pollIntervalTime);
      } catch (e) {
        console.error('Job submission error:', e);
        setProcessing(false);
        
        // Check if the error is due to quota exceeded or authentication
        if (e instanceof Error) {
          if (e.message.includes('limit exceeded') || e.message.includes('quota')) {
            // Show notification modal first for quota exceeded
            setIsQuotaExceededModalOpen(true);
            // Go back to step 3 so user can try again after upgrade
            setCurrentStep(3);
          } else if (e.message.includes('Authentication failed')) {
            // Handle authentication failure
            setIsUserSignedIn(false);
            setIsSignInModalOpen(true);
            // Go back to step 3 so user can try again after sign in
            setCurrentStep(3);
          } else {
            // For other errors, proceed to end step
            setTimeout(() => setCurrentStep(5), 500);
          }
        } else {
          // For unknown errors, proceed to end step
          setTimeout(() => setCurrentStep(5), 500);
        }
      }
    };
    if (currentStep === 4) {
      startProcessing();
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Render processing success
  const renderProcessingSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-16">
      <h1 className="text-3xl font-bold mb-8">Processing Complete!</h1>
      <p className="text-gray-400 mb-8">Start searching, clipping and sharing your podcast now with Jamie!</p>
      <button
        onClick={() => {
          // Store the selected feed as the default source for SearchInterface
          if (selectedPodcast) {
            const feedId = selectedPodcast.feedId.toString();
            localStorage.setItem('selectedPodcastSources', JSON.stringify([String(feedId)]));
          }
          // Extract first 12 words from episode description
          const getQueryFromDescription = (description: string): string => {
            // Strip HTML tags and clean up the text
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            const cleanText = tempDiv.textContent || tempDiv.innerText || '';
            
            // Split into words and take first 12
            const words = cleanText.trim().split(/\s+/).filter(word => word.length > 0);
            return words.slice(0, 12).join(' ');
          };
          
          const query = selectedEpisode ? getQueryFromDescription(selectedEpisode.description) : "artificial intelligence";
          // Navigate to SearchInterface with auto-search parameters
          navigate(`/app?mode=podcast-search&q=${encodeURIComponent(query)}`);
        }}
        className="bg-white text-black hover:bg-gray-200 py-3 px-6 rounded-lg font-medium text-lg transition-colors"
      >
        See Results
      </button>
    </div>
  );

  // Render processing failure
  const renderProcessingFailure = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-16">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-4 text-red-400">Processing Failed</h1>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        We weren't able to process this episode. This could be due to audio quality issues, 
        unavailable audio files, or technical difficulties with the podcast feed.
      </p>
      <div className="flex space-x-4">
        <button
          onClick={() => {
            setProcessingFailed(false);
            setCurrentStep(1);
          }}
          className="bg-gray-800 text-white hover:bg-gray-700 py-3 px-6 rounded-lg font-medium text-lg transition-colors border border-gray-600"
        >
          Try Another Episode
        </button>
        <button
          onClick={() => navigate('/app')}
          className="bg-white text-black hover:bg-gray-200 py-3 px-6 rounded-lg font-medium text-lg transition-colors"
        >
          Go to Jamie Search
        </button>
      </div>
    </div>
  );

  // Render appropriate content based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 1:
        return renderFeedSelection();
      case 2:
        return renderEpisodeSelection();
      case 3:
        return renderConfirmation();
      case 4:
        return renderProcessing();
      case 5:
        return processingFailed ? renderProcessingFailure() : renderProcessingSuccess();
      default:
        return renderFeedSelection();
    }
  };

  // Render feed selection step
  const renderFeedSelection = () => {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Transform Any Podcast Into Searchable, Shareable Clips</h1>
          <div className="max-w-2xl mx-auto space-y-3">
            <p className="text-gray-300 text-lg">
              Get instant semantic search through full episodes, clips for social sharing, and timestamped links for relevant content.
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Instant Search
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Clips Studio
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Nostr/Twitter Cross Posting
              </div>
            </div>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 100k+ podcasts..."
              className="w-full bg-[#111111] border border-gray-800 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 shadow-lg text-lg"
            />
            <button 
              className="absolute right-4 top-1/2 transform -translate-y-1/2"
              aria-label="Search"
              onClick={searchFeeds}
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : searchResults.length > 0 ? (
          /* Search Results */
          <div className="space-y-4">
            {searchResults.map((feed) => (
              <div 
                key={feed.id}
                className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center">
                  {!imageLoadedStates[`search-${feed.id}`] && (
                    <div className="w-14 h-14 rounded-md border border-gray-700 mr-4 bg-gray-800 animate-pulse flex-shrink-0" />
                  )}
                  <img 
                    src={feed.image} 
                    alt="" 
                    className={`w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800 ${imageLoadedStates[`search-${feed.id}`] ? 'block' : 'hidden'}`}
                    onLoad={() => setImageLoadedStates(prev => ({...prev, [`search-${feed.id}`]: true}))}
                    onError={() => setImageLoadedStates(prev => ({...prev, [`search-${feed.id}`]: false}))}
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">{feed.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">{feed.author || feed.ownerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSelectFeed(feed)}
                  className="bg-white text-black hover:bg-gray-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        ) : searchQuery.length >= 2 && hasSearched && !isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No podcasts found. Try a different search term.</p>
          </div>
        ) : (
          /* Default State with Example Pills */
          <div>
            <p className="text-center text-gray-400 mb-6">Recently Searched Podcasts:</p>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
               {staticFeeds.map((feed) => (
                 <div
                   key={feed.id}
                   className="bg-[#111111] border border-gray-800 rounded-xl p-6 flex items-center cursor-pointer hover:border-gray-700 transition-colors"
                   onClick={() => window.open(`/app/feed/${feed.id}`, '_blank')}
                 >
                   <div className="flex-shrink-0 mr-6">
                     {!imageLoadedStates[`static-${feed.id}`] && (
                       <div className="w-16 h-16 rounded-lg bg-gray-800 animate-pulse flex-shrink-0" />
                     )}
                     <img 
                       src={feed.image} 
                       alt="" 
                       className={`w-16 h-16 rounded-lg object-cover bg-gray-800 ${imageLoadedStates[`static-${feed.id}`] ? 'block' : 'hidden'}`}
                       onLoad={() => setImageLoadedStates(prev => ({...prev, [`static-${feed.id}`]: true}))}
                       onError={() => setImageLoadedStates(prev => ({...prev, [`static-${feed.id}`]: false}))}
                     />
                   </div>
                   <div className="flex-1 min-w-0">
                     <h3 className="text-white font-medium text-base line-clamp-1">{feed.title}</h3>
                     <p className="text-gray-400 text-sm line-clamp-1 mt-1">{feed.author || feed.ownerName}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </>
    );
  };

  // Render episode selection step
  const renderEpisodeSelection = () => {
    if (!selectedPodcast || episodes.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No episodes found for this podcast.</p>
          <button 
            onClick={() => setCurrentStep(1)}
            className="mt-4 bg-white text-black hover:bg-gray-200 py-2 px-4 rounded-lg text-sm"
          >
            Go Back
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Select the Content to Process</h1>
          <p className="text-gray-400">
            Choose which episodes to transcribe and add to the Jamie search index for easy access!
          </p>
        </div>

        {/* Podcast Info */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => setCurrentStep(1)}
            className="mr-4 p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          {!imageLoadedStates['podcast-main'] && (
            <div className="w-20 h-20 rounded-md border border-gray-700 mr-4 bg-gray-800 animate-pulse flex-shrink-0" />
          )}
          <img 
            src={selectedPodcast.podcastImage} 
            alt="" 
            className={`w-20 h-20 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800 flex-shrink-0 ${imageLoadedStates['podcast-main'] ? 'block' : 'hidden'}`}
            onLoad={() => setImageLoadedStates(prev => ({...prev, 'podcast-main': true}))}
            onError={() => setImageLoadedStates(prev => ({...prev, 'podcast-main': false}))}
          />
          <div>
            <h2 className="text-2xl font-bold">{selectedPodcast.feedTitle}</h2>
          </div>
        </div>

        {/* Episodes List */}
        <div className="space-y-4">
          {episodes.map((episode) => (
            <div 
              key={episode.episodeGUID}
              className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between hover:border-gray-700 transition-colors p-4"
            >
              <div className="flex items-center flex-1">
                {!imageLoadedStates[`episode-${episode.episodeGUID}`] && (
                  <div className="w-16 h-16 rounded-md border border-gray-700 mr-4 bg-gray-800 animate-pulse flex-shrink-0" />
                )}
                <img 
                  src={episode.episodeImage || selectedPodcast.podcastImage} 
                  alt="" 
                  className={`w-16 h-16 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800 flex-shrink-0 ${imageLoadedStates[`episode-${episode.episodeGUID}`] ? 'block' : 'hidden'}`}
                  onLoad={() => setImageLoadedStates(prev => ({...prev, [`episode-${episode.episodeGUID}`]: true}))}
                  onError={() => setImageLoadedStates(prev => ({...prev, [`episode-${episode.episodeGUID}`]: false}))}
                />
                <div className="flex-1 mr-4 min-w-0">
                  <div className="flex items-center mb-1">
                    <span className="text-gray-400 text-sm mr-2">#{episode.episodeNumber}</span>
                    <span className="text-gray-400 text-sm">{formatDate(episode.publishedDate)}</span>
                  </div>
                  <h3 className="text-white font-medium text-base line-clamp-1">{episode.itemTitle}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-gray-400 text-sm mr-2">Creator: {episode.creator}</span>
                    <span className="text-gray-400 text-sm">{formatDuration(episode.length)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleSelectEpisode(episode)}
                className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </>
    );
  };

  // Render confirmation step
  const renderConfirmation = () => {
    if (!selectedPodcast || !selectedEpisode) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">Please select a feed and episode first.</p>
          <button 
            onClick={() => setCurrentStep(1)}
            className="mt-4 bg-white text-black hover:bg-gray-200 py-2 px-4 rounded-lg text-sm"
          >
            Go Back
          </button>
        </div>
      );
    }

    // Utility to strip HTML and truncate to N words
    function getShortDescription(html: string, wordLimit = 60): string {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent || tmp.innerText || '';
      const words = text.split(/\s+/);
      if (words.length <= wordLimit) return text;
      return words.slice(0, wordLimit).join(' ') + '...';
    }

    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Confirm Your Selection</h1>
          <p className="text-gray-400">
            You've selected the following episode to process. Please confirm your selection.
          </p>
        </div>

        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center mb-6">
            <button
              onClick={() => setCurrentStep(2)}
              className="mr-4 p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            {!imageLoadedStates['confirm-episode'] && (
              <div className="w-24 h-24 rounded-md border border-gray-700 mr-6 bg-gray-800 animate-pulse flex-shrink-0" />
            )}
            <img 
              src={selectedEpisode.episodeImage || selectedPodcast.podcastImage} 
              alt="" 
              className={`w-24 h-24 rounded-md border border-gray-700 mr-6 object-cover bg-gray-800 flex-shrink-0 ${imageLoadedStates['confirm-episode'] ? 'block' : 'hidden'}`}
              onLoad={() => setImageLoadedStates(prev => ({...prev, 'confirm-episode': true}))}
              onError={() => setImageLoadedStates(prev => ({...prev, 'confirm-episode': false}))}
            />
            <div>
              <h2 className="text-2xl font-bold mb-1">{selectedEpisode.itemTitle}</h2>
              <p className="text-gray-400 mb-1">{selectedPodcast.feedTitle}</p>
              <div className="flex items-center">
                <span className="text-gray-400 text-sm mr-2">#{selectedEpisode.episodeNumber}</span>
                <span className="text-gray-400 text-sm mr-2">•</span>
                <span className="text-gray-400 text-sm mr-2">{formatDate(selectedEpisode.publishedDate)}</span>
                <span className="text-gray-400 text-sm mr-2">•</span>
                <span className="text-gray-400 text-sm">{formatDuration(selectedEpisode.length)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded p-4 mb-4">
            <h3 className="text-sm font-medium mb-2">Episode Description</h3>
            <div className="text-sm text-gray-400 break-words w-full max-w-xl">
              {getShortDescription(selectedEpisode.description, 60)}
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              onClick={() => {
                if (quotaInfo && !quotaInfo.eligible) {
                  // User is out of runs, show notification modal first
                  setIsQuotaExceededModalOpen(true);
                } else if (!isUserSignedIn) {
                  // User is not signed in but has quota, proceed to processing
                  setProcessingFailed(false); // Reset failure state
                  setCurrentStep(4);
                } else {
                  // User is signed in and has quota, proceed to processing
                  setProcessingFailed(false); // Reset failure state
                  setCurrentStep(4);
                }
              }}
              className="bg-white text-black hover:bg-gray-200 py-2 px-6 rounded-lg font-medium"
            >
              Process This Episode
            </button>
          </div>
        </div>
      </>
    );
  };

  // Render processing step (Step 4)
  const renderProcessing = () => (
    <JamieLoadingScreen defaultInterval={5000} />
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page Banner */}
      <PageBanner logoText="Pull That Up Jamie!" onTutorialClick={handleTutorialClick} onUpgrade={handleUpgrade} />
      
      {/* Quota Display */}
      {quotaInfo && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 sm:left-auto sm:right-6 sm:transform-none flex flex-col items-center sm:items-end space-y-2 mb-8">
          <div className="text-white text-sm bg-black/50 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-700 shadow-lg">
            <div className="flex items-center space-x-2">
              <span>{quotaInfo.remainingRuns}/{quotaInfo.totalLimit} Free Runs left</span>
              <span className="text-gray-400">•</span>
              <span>{quotaInfo.daysUntilReset} Days Until Reset</span>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-white text-black hover:bg-gray-200 px-2 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
          >
            {isUserSignedIn ? 'Upgrade for Full Pro Experience' : 'Sign Up for More Runs'}
            </button>
        </div>
      )}
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} hasQuotaInfo={!!quotaInfo} />
      
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {renderContent()}
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInModalOpen} 
        onClose={() => {
          setIsSignInModalOpen(false);
          setIsSigningInForUpgrade(false); // Reset the flag when modal is closed
        }}
        onSignInSuccess={() => {
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          checkQuotaEligibility(); // Refresh quota after sign in
          
          if (isSigningInForUpgrade) {
            // User signed in for upgrade, show checkout modal
            setIsSigningInForUpgrade(false);
            setIsCheckoutModalOpen(true);
          } else {
            // User signed in for processing, check if they have quota
            if (quotaInfo && !quotaInfo.eligible) {
              setIsQuotaExceededModalOpen(true);
            } else {
              setProcessingFailed(false); // Reset failure state
              setCurrentStep(4); // Proceed to processing step after sign in
            }
          }
        }}
        onSignUpSuccess={() => {
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          checkQuotaEligibility(); // Refresh quota after sign up
          
          if (isSigningInForUpgrade) {
            // User signed up for upgrade, show checkout modal
            setIsSigningInForUpgrade(false);
            setIsCheckoutModalOpen(true);
          } else {
            // User signed up for processing, check if they have quota
            if (quotaInfo && !quotaInfo.eligible) {
              setIsQuotaExceededModalOpen(true);
            } else {
              setProcessingFailed(false); // Reset failure state
              setCurrentStep(4); // Proceed to processing step after sign up
            }
          }
        }}
        customTitle="Let's get a good email for ya"
        initialMode="signup"
      />

      {/* Checkout Modal for internal upgrade buttons */}
      <CheckoutModal 
        isOpen={isCheckoutModalOpen} 
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setIsUpgrading(false);
        }} 
        onSuccess={() => {
          handleUpgradeSuccess();
          setIsUpgrading(false);
        }}
        productName="jamie-pro"
      />

      {/* Quota Exceeded Notification Modal */}
      {isQuotaExceededModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
            <h2 className="text-white text-xl font-bold mb-4">
              {isUserSignedIn ? "You've Used Your Free Episodes!" : "You've Used Your Free Episodes!"}
            </h2>
            <p className="text-gray-400 mb-6">
              {isUserSignedIn ? (
                `You've processed ${quotaInfo?.usedThisPeriod || 0} out of ${quotaInfo?.totalLimit || 0} free episodes this month. Upgrade to Jamie Pro for unlimited episode processing and instant access to all your favorite podcasts.`
              ) : (
                `You've processed ${quotaInfo?.usedThisPeriod || 0} out of ${quotaInfo?.totalLimit || 0} free episodes this week. Sign up for an account to get more free episodes or upgrade to Jamie Pro for unlimited processing.`
              )}
            </p>
            <button
              onClick={() => {
                setIsUpgrading(true);
                setIsQuotaExceededModalOpen(false);
                setTimeout(() => {
                  handleUpgrade();
                }, 100);
              }}
              className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              {isUserSignedIn ? 'Upgrade Now' : 'Sign Up for More'}
            </button>
          </div>
        </div>
      )}

      {/* Subscription Success Popup */}
      {isUpgradeSuccessPopUpOpen && (
        <SubscriptionSuccessPopup 
          isJamiePro={true}
          onClose={() => {
          setIsUpgradeSuccessPopUpOpen(false);
          setIsCheckoutModalOpen(false);
        }} />
      )}

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={handleTutorialClose}
        defaultSection={0} // Start with Podcast Search section
      />
    </div>
  );
};

export default TryJamieWizard; 
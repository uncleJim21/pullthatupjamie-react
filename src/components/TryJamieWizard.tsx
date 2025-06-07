import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import rssService, { PodcastFeed, PodcastEpisode, FeedInfo } from '../services/rssService.ts';
import TryJamieService, { OnDemandRunRequest } from '../services/tryJamieService.ts';
import SignInModal from './SignInModal.tsx';
import CheckoutModal from './CheckoutModal.tsx';

// Step indicator interface
interface StepIndicatorProps {
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Select Feed' },
    { number: 2, label: 'Select Episode' },
    { number: 3, label: 'Confirm' },
    { number: 4, label: 'Process' },
    { number: 5, label: 'Enjoy!' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 mt-16 flex items-center px-8">
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
  const [selectedPodcast, setSelectedPodcast] = useState<SelectedPodcast | null>(isDebug ? debugFeed : null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isQuotaExceededModalOpen, setIsQuotaExceededModalOpen] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{
    eligible: boolean;
    remainingRuns: number;
    totalLimit: number;
    usedThisPeriod: number;
    periodStart: string;
    nextResetDate: string;
    daysUntilReset: number;
  } | null>(null);
  const navigate = useNavigate();

  // Check if user is signed in and auto-show quota modal
  useEffect(() => {
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      setIsUserSignedIn(hasToken && hasSquareId);
      
      // If user is signed in, check their quota
      if (hasToken && hasSquareId) {
        checkQuotaEligibility();
      }
    };
    
    checkSignedIn();
  }, []);

  // Auto-show quota exceeded modal when user is over quota
  useEffect(() => {
    // Auto-show quota exceeded modal if user loads page and is over quota
    if (isUserSignedIn && quotaInfo && !quotaInfo.eligible && currentStep === 1 && !isQuotaExceededModalOpen) {
      setIsQuotaExceededModalOpen(true);
    }
  }, [isUserSignedIn, quotaInfo, isQuotaExceededModalOpen, currentStep]);

  // Function to check on-demand run eligibility
  const checkQuotaEligibility = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_JAMIE_API_URL || 'http://localhost:4111'}/api/check-ondemand-eligibility`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.eligibility) {
          setQuotaInfo(data.eligibility);
        }
      }
    } catch (error) {
      console.error('Error checking quota eligibility:', error);
    }
  };

  // Handle upgrade functions
  const handleUpgrade = () => {
    setIsCheckoutModalOpen(true);
  };

  const handleUpgradeSuccess = () => {
    setIsCheckoutModalOpen(false);
    // Refresh quota after successful upgrade
    checkQuotaEligibility();
  };

  // Static feeds for default display
  const staticFeeds = [
    {
      id: "6786106",
      title: "The Joe Rogan Experience",
      url: "https://feeds.megaphone.fm/GLT1412515089",
      description: "The official podcast of comedian Joe Rogan.",
      author: "Joe Rogan",
      image: "https://megaphone.imgix.net/podcasts/8e5bcebc-ca16-11ee-89f0-0fa0b9bdfc7c/image/c2c595e6e3c2a64e6ea18fb6c6da8860.jpg"
    },
    {
      id: "5015946",
      title: "Green Candle Investments Podcast with Brandon Keys",
      url: "https://anchor.fm/s/8168b150/podcast/rss",
      originalUrl: "https://anchor.fm/s/8168b150/podcast/rss",
      link: "https://podcasters.spotify.com/pod/show/greencandleit",
      description: "I bring viewers easy-to-digest information about investing, both in traditional equities and in Bitcoin.\nTune in every Monday for new Macro Insights podcasts and Friday for new State of Bitcoin podcasts, offering deep dives into current developments, emerging trends, and expert analyses. Stay connected with us on Twitter and Instagram @GreenCandleit for real-time updates, and engage with host, Brandon, at @bkeys1010 on Twitter.\nDon't miss out – share, subscribe, and actively participate in the conversation! Spread the word about our podcast! Support this podcast: https://podcasters.spotify.com/pod/show/greencandleit/support",
      author: "Green Candle Investments",
      ownerName: "Green Candle Investments",
      image: "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/21611220/21611220-1732893316589-fb33705d325d1.jpg"
    },
    {
      id: "3955537",
      title: "Thriller \"A Bitcoin Zine\"",
      url: "https://feeds.transistor.fm/thriller-premium",
      originalUrl: "https://api.substack.com/feed/podcast/9895.rss",
      link: "https://www.thrillerbitcoin.com",
      description: "Thriller is a local austin bitcoin zine. | Listen to the pod http://thriller.transistor.fm | ⚡️thriller@getalby.com",
      author: "Thriller X Recordings",
      ownerName: "Thriller X Recordings",
      image: "https://img.transistor.fm/flZJC8zviqt7OAbY5RXG072wag-t6IvdBZKEzHUCfgI/rs:fill:3000:3000:1/q:60/aHR0cHM6Ly9pbWct/dXBsb2FkLXByb2R1/Y3Rpb24udHJhbnNp/c3Rvci5mbS9zaG93/LzIzMjQwLzE2NjQ1/NTE2NjItYXJ0d29y/ay5qcGc.jpg"
    },
    {
      id: "1000839",
      title: "Bitcoin Audible",
      url: "https://feeds.castos.com/mj96z",
      originalUrl: "https://anchor.fm/s/80d5cfc/podcast/rss",
      link: "https://bitcoinaudible.com/",
      description: "The Best in Bitcoin made Audible.",
      author: "Guy Swann",
      ownerName: "Guy Swann",
      image: "https://episodes.castos.com/6626b866f2af87-36468692/images/podcast/covers/c1a-9mg94-o87n4gnwav1j-6d2xb6.jpg"
    },
    {
      id: "7246395",
      title: "Trust Revolution",  
      url: "https://serve.podhome.fm/rss/a7d58130-6f1d-4ff3-9c5a-aee3b8cc07cc",
      originalUrl: "https://serve.podhome.fm/rss/a7d58130-6f1d-4ff3-9c5a-aee3b8cc07cc",
      link: "https://podcast.trustrevolution.co",
      description: "Trust is unraveling—institutions falter, headlines deceive, and centralized power's grip is weakening. A new reality's emerging: decentralized protocols like Bitcoin and Nostr, along with privacy-preserving technologies, are rewriting the rules.",
      author: "Shawn Yeager",
      ownerName: "Shawn Yeager", 
      image: "https://assets.podhome.fm/77ae8d2c-0dcb-407e-93e7-08dd5a75ee77/638769544435807117TrustRevolution_Cover.jpg"
    }
  ];

  // Search for podcasts when the query changes (after 500ms debounce)
  useEffect(() => {
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
        setSelectedPodcast({
          feedId: info.feedId,
          feedGuid: info.feedGuid,
          feedTitle: info.feedTitle,
          feedUrl: info.feedUrl,
          podcastImage: info.podcastImage,
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
    let pollCount = 0;
    const maxPolls = 30; // 5 minutes at 10s intervals

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
              setTimeout(() => setCurrentStep(5), 500); // Move to Enjoy step
            }
          } catch (e) {
            // Ignore polling errors, keep polling
          }
        }, 10000);
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
        return (
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
      default:
        return renderFeedSelection();
    }
  };

  // Render feed selection step
  const renderFeedSelection = () => {
    return (
      <>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Let's Get Started</h1>
          <p className="text-gray-400">
            Select your podcast feed so we can get it ready for searches, shares and clips!
          </p>
        </div>
        
        {/* Search Input */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 100k+ Podcast Feeds"
              className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 shadow-lg"
            />
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              aria-label="Search"
              onClick={searchFeeds}
            >
              <svg
                className="w-5 h-5 text-gray-400"
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
        
        {/* Feed Results Area */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((feed) => (
              <div 
                key={feed.id}
                className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4"
              >
                <div className="flex items-center">
                  <img 
                    src={feed.image} 
                    alt={feed.title} 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg';
                    }}
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">{feed.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">{feed.author || feed.ownerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSelectFeed(feed)}
                  className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors"
                >
                  Select
                </button>
              </div>
            ))
          ) : searchQuery.length >= 2 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No podcasts found. Try a different search term.</p>
            </div>
          ) : (
            staticFeeds.map((feed) => (
              <div 
                key={feed.id}
                className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4"
              >
                <div className="flex items-center">
                  <img 
                    src={feed.image} 
                    alt={feed.title} 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg';
                    }}
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">{feed.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">{feed.author || feed.ownerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSelectFeed(feed)}
                  className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors"
                >
                  Select
                </button>
              </div>
            ))
          )}
        </div>
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
            Choose which podcasts to transcribe and add to the Jamie search index for easy access!
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
          <img 
            src={selectedPodcast.podcastImage} 
            alt={selectedPodcast.feedTitle} 
            className="w-20 h-20 rounded-md mr-4"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
            }}
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
                <img 
                  src={episode.episodeImage || selectedPodcast.podcastImage} 
                  alt={episode.itemTitle} 
                  className="w-16 h-16 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg';
                  }}
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
            <img 
              src={selectedEpisode.episodeImage || selectedPodcast.podcastImage} 
              alt={selectedEpisode.itemTitle} 
              className="w-24 h-24 rounded-md mr-6"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
              }}
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
                if (!isUserSignedIn) {
                  setIsSignInModalOpen(true);
                } else if (quotaInfo && !quotaInfo.eligible) {
                  // User is out of runs, show notification modal first
                  setIsQuotaExceededModalOpen(true);
                } else {
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
    <div className="flex flex-col items-center justify-center min-h-[300px] py-16">
      <h1 className="text-3xl font-bold mb-8">Processing</h1>
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page Banner */}
      <PageBanner logoText="Pull That Up Jamie!" />
      
      {/* Quota Display */}
      {isUserSignedIn && quotaInfo && (
        <div className="absolute top-24 right-6 text-white text-sm bg-black/50 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-700 shadow-lg">
          <div>{quotaInfo.totalLimit - quotaInfo.usedThisPeriod}/{quotaInfo.totalLimit} Free Runs left for this {quotaInfo.daysUntilReset} Day Period</div>
        </div>
      )}
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {renderContent()}
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInModalOpen} 
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          checkQuotaEligibility(); // Refresh quota after sign in
          setCurrentStep(4); // Proceed to processing step after sign in
        }}
        onSignUpSuccess={() => {
          setIsUserSignedIn(true);
          setIsSignInModalOpen(false);
          checkQuotaEligibility(); // Refresh quota after sign up
          setCurrentStep(4); // Proceed to processing step after sign up
        }}
        customTitle="Let's get a good email for ya"
        initialMode="signup"
      />

      {/* Quota Exceeded Notification Modal */}
      {isQuotaExceededModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
            <h2 className="text-white text-xl font-bold mb-4">
              You've Used Your Free Episodes!
            </h2>
            <p className="text-gray-400 mb-6">
              You've processed {quotaInfo?.usedThisPeriod || 2} out of {quotaInfo?.totalLimit || 2} free episodes this month. 
              Upgrade to Jamie Pro for unlimited episode processing and instant access to all your favorite podcasts.
            </p>
            <button
              onClick={() => {
                setIsQuotaExceededModalOpen(false);
                setIsCheckoutModalOpen(true);
              }}
              className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutModalOpen} 
        onClose={() => setIsCheckoutModalOpen(false)} 
        onSuccess={handleUpgradeSuccess}
        productName="jamie-pro"
        customDescription="Unlock unlimited on-demand runs and access to all Jamie features"
        customFeatures={[
          "Pods Transcribed & Searchable",
          "AI Curated Clips & Email Alerts",
          "AI Assist for Social Media"
        ]}
        customPrice="49.99"
      />
    </div>
  );
};

export default TryJamieWizard; 
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import rssService, { PodcastFeed, PodcastEpisode, FeedInfo } from '../services/rssService.ts';
import TryJamieService, { OnDemandRunRequest } from '../services/tryJamieService.ts';

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
    <div className="w-full max-w-2xl mx-auto mb-8 mt-8 flex items-center">
      {steps.map((step, idx) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200
                ${currentStep === step.number
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-gray-700 text-white border-gray-700'}
              `}
              style={{ minWidth: 48, minHeight: 48 }}
            >
              <span className="text-lg font-bold">{step.number}</span>
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

const TryJamieWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastFeed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<PodcastFeed | null>(null);
  const [feedInfo, setFeedInfo] = useState<FeedInfo | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisode | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

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
    setSelectedFeed(feed);
    setIsLoading(true);
    
    try {
      const response = await rssService.getFeed(feed.url, feed.id);
      console.log('Feed episodes response:', response);
      if (response.episodes) {
        setFeedInfo(response.episodes.feedInfo);
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
      if (currentStep !== 4 || !selectedFeed || !selectedEpisode) return;
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
              feedGuid: selectedFeed.id,
              feedId: Number(selectedFeed.id),
            },
          ],
        };
        const res = await TryJamieService.submitOnDemandRun(req);
        setJobId(res.jobId);
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
        setProcessing(false);
        setTimeout(() => setCurrentStep(5), 500); // Move to Enjoy step
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
            <h1 className="text-3xl font-bold mb-8">Enjoy!</h1>
            <p className="text-gray-400">Your Jamie job is complete. (Placeholder)</p>
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
            <>
              <div className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4">
                <div className="flex items-center">
                  <img 
                    src="https://storage.googleapis.com/jamie-casts/podcast-logos/jre.jpg" 
                    alt="Joe Rogan Experience" 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">The Joe Rogan Experience</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">Joe Rogan</p>
                  </div>
                </div>
                <button className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors">
                  Select
                </button>
              </div>
              <div className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4">
                <div className="flex items-center">
                  <img 
                    src="https://storage.googleapis.com/jamie-casts/podcast-logos/green-candle.jpg" 
                    alt="Green Candle Investments" 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">Green Candle Investments Podcast with Brandon Keys</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">Green Candle Investments</p>
                  </div>
                </div>
                <button className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors">
                  Select
                </button>
              </div>
              <div className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4">
                <div className="flex items-center">
                  <img 
                    src="https://storage.googleapis.com/jamie-casts/podcast-logos/thriller.jpg" 
                    alt="Thriller - A Netflix Zone" 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">Thriller "A Blizzic Zone"</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">Thriller X Recordings</p>
                  </div>
                </div>
                <button className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors">
                  Select
                </button>
              </div>
              <div className="bg-[#111111] border border-gray-800 rounded-lg flex items-center justify-between p-4">
                <div className="flex items-center">
                  <img 
                    src="https://storage.googleapis.com/jamie-casts/podcast-logos/blizzic.jpg" 
                    alt="Blizzic Audible" 
                    className="w-14 h-14 rounded-md border border-gray-700 mr-4 object-cover bg-gray-800"
                  />
                  <div>
                    <h3 className="text-white font-medium text-base line-clamp-1">Blizzic Audible</h3>
                    <p className="text-gray-400 text-sm line-clamp-1">Guy Sweeney</p>
                  </div>
                </div>
                <button className="bg-black hover:border-white text-white py-2 px-4 rounded-lg text-sm border border-gray-700 font-medium transition-colors">
                  Select
                </button>
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  // Render episode selection step
  const renderEpisodeSelection = () => {
    if (!feedInfo || episodes.length === 0) {
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
            src={feedInfo.podcastImage} 
            alt={feedInfo.feedTitle} 
            className="w-20 h-20 rounded-md mr-4"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
            }}
          />
          <div>
            <h2 className="text-2xl font-bold">{feedInfo.feedTitle}</h2>
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
                  src={episode.episodeImage || feedInfo.podcastImage} 
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
    if (!selectedFeed || !selectedEpisode || !feedInfo) {
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

    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Confirm Your Selection</h1>
          <p className="text-gray-400">
            You've selected the following episode to process. Please confirm your selection.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center mb-6">
            <button
              onClick={() => setCurrentStep(2)}
              className="mr-4 p-2 hover:bg-gray-700 rounded-full transition-colors"
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
              src={selectedEpisode.episodeImage || feedInfo.podcastImage} 
              alt={selectedEpisode.itemTitle} 
              className="w-24 h-24 rounded-md mr-6"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
              }}
            />
            <div>
              <h2 className="text-2xl font-bold mb-1">{selectedEpisode.itemTitle}</h2>
              <p className="text-gray-400 mb-1">{feedInfo.feedTitle}</p>
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
            <p className="text-gray-400 text-sm">{selectedEpisode.description}</p>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              onClick={() => setCurrentStep(4)}
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
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default TryJamieWizard; 
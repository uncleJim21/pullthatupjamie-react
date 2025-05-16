import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import rssService, { PodcastFeed, PodcastEpisode, FeedInfo } from '../services/rssService.ts';

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
    <div className="relative w-full max-w-3xl mx-auto mb-10 mt-8">
      {/* Connecting Line */}
      <div className="absolute top-7 left-0 w-full h-[2px] bg-gray-700"></div>
      
      {/* Steps */}
      <div className="flex justify-between relative">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center">
            {/* Circle with number */}
            <div 
              className={`w-14 h-14 rounded-full flex items-center justify-center z-10 mb-2 ${
                currentStep === step.number 
                  ? 'bg-white text-black' 
                  : currentStep > step.number 
                    ? 'bg-white text-black' 
                    : 'bg-gray-700 text-white'
              }`}
            >
              <span className="text-xl font-bold">{step.number}</span>
            </div>
            
            {/* Step Label */}
            <span 
              className={`text-sm ${
                currentStep === step.number ? 'text-white font-medium' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
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

  // Render appropriate content based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 1:
        return renderFeedSelection();
      case 2:
        return renderEpisodeSelection();
      case 3:
        return renderConfirmation();
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
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Feed Results */}
        {!isLoading && searchResults.length > 0 && (
          <div className="space-y-4">
            {searchResults.map((feed) => (
              <div 
                key={feed.id}
                className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <img 
                    src={feed.image} 
                    alt={feed.title} 
                    className="w-12 h-12 rounded mr-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
                    }}
                  />
                  <div>
                    <h3 className="font-medium">{feed.title}</h3>
                    <p className="text-gray-400 text-sm">{feed.author || feed.ownerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSelectFeed(feed)}
                  className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* No Results State */}
        {!isLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No podcasts found. Try a different search term.</p>
          </div>
        )}
        
        {/* Default/Sample Feed List */}
        {!isLoading && searchQuery.length < 2 && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src="https://storage.googleapis.com/jamie-casts/podcast-logos/jre.jpg" 
                  alt="Joe Rogan Experience" 
                  className="w-12 h-12 rounded mr-4"
                />
                <div>
                  <h3 className="font-medium">The Joe Rogan Experience</h3>
                  <p className="text-gray-400 text-sm">Joe Rogan</p>
                </div>
              </div>
              <button className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm">
                Select
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src="https://storage.googleapis.com/jamie-casts/podcast-logos/green-candle.jpg" 
                  alt="Green Candle Investments" 
                  className="w-12 h-12 rounded mr-4"
                />
                <div>
                  <h3 className="font-medium">Green Candle Investments Podcast with Brandon Keys</h3>
                  <p className="text-gray-400 text-sm">Green Candle Investments</p>
                </div>
              </div>
              <button className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm">
                Select
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src="https://storage.googleapis.com/jamie-casts/podcast-logos/thriller.jpg" 
                  alt="Thriller - A Netflix Zone" 
                  className="w-12 h-12 rounded mr-4"
                />
                <div>
                  <h3 className="font-medium">Thriller "A Blizzic Zone"</h3>
                  <p className="text-gray-400 text-sm">Thriller X Recordings</p>
                </div>
              </div>
              <button className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm">
                Select
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src="https://storage.googleapis.com/jamie-casts/podcast-logos/blizzic.jpg" 
                  alt="Blizzic Audible" 
                  className="w-12 h-12 rounded mr-4"
                />
                <div>
                  <h3 className="font-medium">Blizzic Audible</h3>
                  <p className="text-gray-400 text-sm">Guy Sweeney</p>
                </div>
              </div>
              <button className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm">
                Select
              </button>
            </div>
          </div>
        )}
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
            <button
              onClick={() => setCurrentStep(1)}
              className="text-sm text-gray-400 hover:text-white"
            >
              ← Change Feed
            </button>
          </div>
        </div>

        {/* Episodes List */}
        <div className="space-y-4">
          {episodes.map((episode) => (
            <div 
              key={episode.episodeGUID}
              className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center flex-1">
                <img 
                  src={episode.episodeImage || feedInfo.podcastImage} 
                  alt={episode.itemTitle} 
                  className="w-16 h-16 rounded mr-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://storage.googleapis.com/jamie-casts/podcast-logos/default.jpg";
                  }}
                />
                <div className="flex-1 mr-4">
                  <div className="flex items-center mb-1">
                    <span className="text-gray-400 text-sm mr-2">#{episode.episodeNumber}</span>
                    <span className="text-gray-400 text-sm">{formatDate(episode.publishedDate)}</span>
                  </div>
                  <h3 className="font-medium">{episode.itemTitle}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-gray-400 text-sm mr-2">Creator: {episode.creator}</span>
                    <span className="text-gray-400 text-sm">{formatDuration(episode.length)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleSelectEpisode(episode)}
                className="bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg text-sm"
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

          <div className="flex justify-between mt-6">
            <button 
              onClick={() => setCurrentStep(2)}
              className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg"
            >
              Back
            </button>
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page Banner */}
      <PageBanner logoText="Pull That Up Jamie!" />
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default TryJamieWizard; 
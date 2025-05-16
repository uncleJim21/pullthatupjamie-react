import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import rssService, { PodcastFeed } from '../services/rssService.ts';

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
  const navigate = useNavigate();

  // Set a demo token for API access
  useEffect(() => {
    rssService.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImppbS5jYXJ1Y2NpK3RmdGNAcHJvdG9ubWFpbC5jb20iLCJpYXQiOjE3NDUyNTQ5NTAsImV4cCI6MTc3Njc5MDk1MH0.wlI2cQi9mjs2mt3oFinq8nkDUNvYUn9PePNCsJzp90A');
  }, []);

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
      if (response.status === 'true' && response.feeds) {
        setSearchResults(response.feeds);
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
  const handleSelectFeed = (feed: PodcastFeed) => {
    setSelectedFeed(feed);
    setCurrentStep(2); // Move to the next step
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page Banner */}
      <PageBanner logoText="Pull That Up Jamie!" />
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
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
      </div>
    </div>
  );
};

export default TryJamieWizard; 
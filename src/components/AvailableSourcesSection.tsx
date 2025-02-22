import React, { useState, useEffect, useRef } from 'react';
import { Check, Filter, Search, Save } from 'lucide-react';
import { API_URL, printLog } from '../constants/constants.ts';
import { FeedbackForm } from './FeedbackForm.tsx';

interface PodcastSource {
    feedImage: string;
    title: string;
    description: string;
    feedId: string;  
}

interface AvailableSourcesProps {
  className?: string;
  hasSearched: boolean;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
  sizeOverride?: string;
  isSendingFeedback: boolean;
  setIsSendingFeedback: React.Dispatch<React.SetStateAction<boolean>>;
}

const STORAGE_KEY = 'selectedPodcastSources';

const AvailableSourcesSection: React.FC<AvailableSourcesProps> = ({ 
  className, 
  hasSearched, 
  selectedSources, 
  setSelectedSources, 
  sizeOverride, 
  isSendingFeedback, 
  setIsSendingFeedback 
}) => {  
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<PodcastSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!hasSearched);
  const [isMobile, setIsMobile] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const hasLoadedDefault = useRef(false);


  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth <= 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch(`${API_URL}/api/get-available-feeds`);
        const data = await response.json();
        setSources(data.results);
        setFilteredSources(data.results);

        // Only load saved selection from localStorage on initial mount
        if (!hasLoadedDefault.current) {
          const savedSelection = localStorage.getItem(STORAGE_KEY);
          if (savedSelection) {
            setSelectedSources(new Set(JSON.parse(savedSelection)));
          }
          hasLoadedDefault.current = true;
        }
      } catch (err) {
        setError('Failed to load podcast sources');
        console.error('Error fetching podcast sources:', err);
      }
    };

    fetchSources();
  }, [setSelectedSources]);

  useEffect(() => {
    if (!isExpanded) {
      setSearchQuery('');
    }
  }, [isExpanded]);

  useEffect(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    setFilteredSources(
      sources.filter(source =>
        source.title.toLowerCase().includes(lowerCaseQuery) ||
        source.description.toLowerCase().includes(lowerCaseQuery)
      )
    );
  }, [searchQuery, sources]);

  const toggleSource = (feedId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      printLog(`newSet:${JSON.stringify(Array.from(newSet))}`);
      return newSet;
    });
  };

  const selectAll = () => {
    const allFeedIds = new Set(filteredSources.map(source => source.feedId));
    setSelectedSources(allFeedIds);
  };

  const deselectAll = () => {
    setSelectedSources(new Set());
  };

  const saveFilter = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedSources)));
    printLog('Saved selected podcast sources to localStorage');
    setIsSavingDefault(true);
    setInterval(() => (setIsSavingDefault(false)),2000);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (error) {
    return (
      <div className="text-red-500 p-4">
        {error}
      </div>
    );
  }

  const getFeedbackForm = () => {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-[#0A0A0A]rounded-lg shadow-lg max-w-lg w-full relative">
          <FeedbackForm 
            mode="request-pod" 
            stylingClasses="w-full" 
            title="Our team will consider indexing the podcast for search & clips on your request. Please provide details." 
            placeholder="Please name the podcast and your reason for request (are you an owner, producer, or fan?)" 
            onClose={() => setIsSendingFeedback(false)}
          />
        </div>
      </div>
    );
  }
  

  

  return (
    <div onClick={!isExpanded ? () => setIsExpanded(true) : undefined} className={`mx-auto max-w-4xl mt-4 pt-4 px-6 relative rounded-lg mb-2 ${!isExpanded ? 'pb-1 hover:bg-gray-800' : ''}`}>
      {(isSendingFeedback) ? getFeedbackForm() : ''}
      <button 
        className="text-white text-xl font-medium mb-4 flex items-center gap-2 border-white-800 rounded-lg hover:border-gray-700 transition-colors"
        onClick={toggleExpanded}
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          ▼
        </span>
        Podcast Feeds <Filter className='w-5 h-5' /> 
        <p className="text-sm text-gray-400">
          ({selectedSources.size > 0 
            ? `${selectedSources.size} of ${sources.length}` 
            : `${sources.length}`} Feeds)
        </p>
      </button>

      {isExpanded && sources.length > 0 && (
        <>
          {/* Search Bar */}
          <div className="relative mb-4 flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feeds..."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
              />
              <Search className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
            </div>
            <button 
              onClick={() => setIsSendingFeedback(true)}
              className="mt-2 md:mt-0 px-6 py-2 text-black font-medium bg-white rounded-lg hover:bg-gray-400 md:shrink-0"
            >
              Request a Podcast
            </button>
          </div>

          <div className="relative border border-gray-800 pt-4 pb-4 rounded-lg">
            <div className="overflow-x-auto px-4">
              <div className="flex space-x-4">
                {filteredSources.map((source, index) => (
                  <div
                    key={index}
                    className={`flex-shrink-0 w-24 lg:w-${sizeOverride ?? '36'} group cursor-pointer`}
                    onClick={() => toggleSource(source.feedId)}
                  >
                    <div className={`relative aspect-square rounded-lg overflow-hidden border group-hover:border-2 transition-colors ${selectedSources.has(source.feedId) ? 'border-gray-300' : 'border-gray-600'}`}>
                      <img
                        src={source.feedImage}
                        alt={source.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/podcast-placeholder.png';
                        }}
                      />
                      {selectedSources.has(source.feedId) && (
                        <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 border border-black">
                          <Check className="w-4 h-4 text-black" />
                        </div>
                      )}
                    </div>
                    <p className="my-4 text-sm md:text-lg text-gray-100 text-center line-clamp-2 transition-colors select-none">
                      {source.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-sm flex justify-center mt-4 space-x-2">
            <button
              className="font-bold px-4 py-2 text-black bg-white border border-gray-800 rounded hover:bg-gray-200"
              onClick={selectAll}
            >
              Select All
            </button>
            <button
              className="font-bold px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800"
              onClick={deselectAll}
            >
              Deselect All
            </button>
            <button
              className="font-bold px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800"
              onClick={saveFilter}
            >
              <span>{!isMobile ? 'Save as Default' : ''} {isSavingDefault ? '✅' : '💾'} </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AvailableSourcesSection;

import React, { useState, useEffect } from 'react';
import { Check, Filter } from 'lucide-react';
import { API_URL, printLog } from '../constants/constants.ts';

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
  sizeOverride?:string;
}

const AvailableSourcesSection: React.FC<AvailableSourcesProps> = ({ className, hasSearched, selectedSources, setSelectedSources, sizeOverride }) => {
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!hasSearched);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch(`${API_URL}/api/get-available-feeds`);
        const data = await response.json();
        setSources(data.results);
      } catch (err) {
        setError('Failed to load podcast sources');
        console.error('Error fetching podcast sources:', err);
      }
    };

    fetchSources();
  }, []);

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
    const allFeedIds = new Set(sources.map(source => source.feedId));
    setSelectedSources(allFeedIds);
  };

  const deselectAll = () => {
    setSelectedSources(new Set());
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

  return (
    <div onClick={ !isExpanded ? () => setIsExpanded(true) : (() => (console.log('')))} className={`mx-auto max-w-4xl mt-4 pt-4 px-6 relative rounded-lg mb-2 ${!isExpanded ? 'pb-1 hover:bg-gray-800' : ''}`}>
      <button 
        className="text-white text-xl font-medium mb-4 flex items-center gap-2 border-white-800 rounded-lg hover:border-gray-700 transition-colors"
        onClick={toggleExpanded}
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          ▼
        </span>
        Podcast Feeds <Filter className='w-5 h-5' /> <p className='text-sm text-gray-400 '>(18 Feeds)</p>
      </button>

      {isExpanded && sources.length > 0 && (
        <>
          <div className="relative border border-gray-800 pt-4 pb-4 rounded-lg">
            <div className="overflow-x-auto px-4">
              <div className="flex space-x-4">
                {sources.map((source, index) => (
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

          <div className="flex justify-center mt-4 space-x-2">
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
          </div>
        </>
      )}
    </div>
  );
};

export default AvailableSourcesSection;

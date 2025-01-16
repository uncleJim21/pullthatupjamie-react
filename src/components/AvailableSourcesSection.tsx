import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
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
}

const AvailableSourcesSection: React.FC<AvailableSourcesProps> = ({ className, hasSearched,selectedSources, setSelectedSources  }) => {
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!hasSearched);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch(`${API_URL}/api/get-available-feeds`);
        const data = await response.json();
        setSources(data.results);
        // Create a Set of all feedIds from the results
        const allFeedIds = new Set(data.results.map(source => (source.feedId)));
        printLog(`All Feed IDs:${JSON.stringify(allFeedIds,null,2)}`); // Debug log
        setSelectedSources(allFeedIds);
      } catch (err) {
        setError('Failed to load podcast sources');
        console.error('Error fetching podcast sources:', err);
      }
    };
  
    fetchSources();
  }, [setSelectedSources]);

  const toggleSource = (feedId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      printLog(`newSet:${JSON.stringify(Array.from(newSet))}`)
      return newSet;
    });
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
    <div className="mx-auto max-w-4xl mt-4 pt-4 px-6">
      <button 
        className="text-white text-xl font-medium mb-4 flex items-center gap-2 border-white-800 rounded-lg hover:border-gray-700 transition-colors"
        onClick={toggleExpanded}
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          ▼
        </span>
        Available Sources
      </button>
      
      {isExpanded && (
        <div className="relative border border-gray-800 pt-4 pb-4 rounded-lg">
          <div className="overflow-x-auto">
            <div className="flex space-x-4 px-4">
              {sources.map((source, index) => (
                <div
                key={index}
                className="flex-shrink-0 w-24 lg:w-36 group cursor-pointer"
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
                      <div className={`absolute bottom-1 right-1 bg-white rounded-full p-0.5 border border-black`}>
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </div>
                  <p className="my-4 text-lg text-gray-100 text-center truncate transition-colors">
                    {source.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableSourcesSection;
import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface PodcastSource {
  feedImage: string;
  title: string;
  description: string;
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
        const response = await fetch('http://localhost:3131/api/get-available-feeds');
        const data = await response.json();
        setSources(data.results);
        const allIndices = new Set(Array.from({ length: data.results.length }, (_, i) => i));
        setSelectedSources(allIndices);
      } catch (err) {
        setError('Failed to load podcast sources');
        console.error('Error fetching podcast sources:', err);
      }
    };

    fetchSources();
  }, []);

  const toggleSource = (index: number) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
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
        className="text-white text-xl font-medium mb-4 flex items-center gap-2 hover:text-gray-300 transition-colors"
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
                  className="flex-shrink-0 w-28 sm:w-12 lg:w-48 group cursor-pointer"
                  onClick={() => toggleSource(index)}
                >
                  <div className={`relative aspect-square rounded-lg overflow-hidden border group-hover:border-2 transition-colors ${selectedSources.has(index) ? 'border-gray-300' : 'border-gray-600'}`}>
                    <img
                      src={source.feedImage}
                      alt={source.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/podcast-placeholder.png';
                      }}
                    />
                    {selectedSources.has(index) && (
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
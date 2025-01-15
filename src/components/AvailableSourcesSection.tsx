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

const AvailableSourcesSection: React.FC<AvailableSourcesProps> = ({ className, hasSearched }) => {
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
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
    <div className={`${className} ${hasSearched ? 'mt-2' : 'mt-8'} max-w-3xl mx-auto pl-4 pr-4`}>
      <button 
        className="text-white text-2xl font-medium mb-4 flex items-center gap-2 hover:text-gray-300 transition-colors"
        onClick={toggleExpanded}
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          ▼
        </span>
        Available Sources
      </button>
      
      {isExpanded && (
        <div className="relative border border-gray-800 pt-4 pb-4 rounded-lg">
          <div className="overflow-x-auto pb-4 mask-fade-edges">
            <div className="flex space-x-4 pl-4 mr-4">
              {sources.map((source, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-24 group cursor-pointer"
                  onClick={() => toggleSource(index)}
                >
                  <div className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${selectedSources.has(index) ? 'border-gray-300' : 'border-gray-600'}`}>
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
                      <div className={`absolute bottom-1 right-1 bg-white rounded-full p-0.5`}>
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-400 text-center truncate group-hover:text-white transition-colors">
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
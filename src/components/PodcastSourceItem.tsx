import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PodcastSource } from '../services/podcastSourceService.ts';

interface PodcastSourceItemProps {
  source: PodcastSource;
  isSelected: boolean;
  onClick: (feedId: string) => void;
  sizeClass?: string;
  showCheckmark?: boolean;
  imageOnly?: boolean;
  customImageClass?: string;
  customTitleClass?: string;
}

const PodcastSourceItem: React.FC<PodcastSourceItemProps> = ({
  source,
  isSelected,
  onClick,
  sizeClass = 'w-24 lg:w-36',
  showCheckmark = true,
  imageOnly = false,
  customImageClass = '',
  customTitleClass = '',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className={`flex-shrink-0 ${sizeClass} group cursor-pointer select-none`}
      onClick={() => onClick(source.feedId)}
    >
      <div className={`relative aspect-square rounded-lg overflow-hidden border group-hover:border-2 transition-colors ${isSelected ? 'border-gray-300' : 'border-gray-600'} ${customImageClass}`}>
        {!imageLoaded && (
          <div className="w-full h-full bg-gray-800 animate-pulse" />
        )}
        <img
          src={source.feedImage}
          alt={source.title}
          className={`w-full h-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/podcast-logo.png';
            setImageLoaded(true);
          }}
        />
        {isSelected && showCheckmark && (
          <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 border border-black">
            <Check className="w-4 h-4 text-black" />
          </div>
        )}
      </div>
      {!imageOnly && (
        <p className={`my-2 py-1 px-1 text-gray-100 text-center line-clamp-2 transition-colors font-medium select-none ${customTitleClass}`}>
          {source.title}
        </p>
      )}
    </div>
  );
};

export default PodcastSourceItem; 
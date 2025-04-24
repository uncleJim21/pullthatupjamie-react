import React from 'react';
import { Check } from 'lucide-react';

export interface PodcastSource {
  feedImage: string;
  title: string;
  description: string;
  feedId: string;
}

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
  return (
    <div
      className={`flex-shrink-0 ${sizeClass} group cursor-pointer`}
      onClick={() => onClick(source.feedId)}
    >
      <div className={`relative aspect-square rounded-lg overflow-hidden border group-hover:border-2 transition-colors ${isSelected ? 'border-gray-300' : 'border-gray-600'} ${customImageClass}`}>
        <img
          src={source.feedImage}
          alt={source.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/podcast-logo.png';
          }}
        />
        {isSelected && showCheckmark && (
          <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 border border-black">
            <Check className="w-4 h-4 text-black" />
          </div>
        )}
      </div>
      {!imageOnly && (
        <p className={`my-4 text-sm md:text-lg text-gray-100 text-center line-clamp-2 transition-colors select-none ${customTitleClass}`}>
          {source.title}
        </p>
      )}
    </div>
  );
};

export default PodcastSourceItem; 
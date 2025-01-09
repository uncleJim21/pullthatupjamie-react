import React from 'react';
import { Podcast } from 'lucide-react';

export default function PodcastLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center w-full py-16">
      <h2 className="text-gray-500 text-xl mb-8 text-center">
        Searching Through
        <br />
        Top Podcasts...
      </h2>
      <div className="relative">
        {/* Expanding rings */}
        <div className="absolute inset-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]">
          <Podcast 
            size={120} 
            className="text-gray-600 opacity-30"
            strokeWidth={1.5}
          />
        </div>
        <div className="absolute inset-0 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_infinite_1s]">
          <Podcast 
            size={120} 
            className="text-gray-600 opacity-30"
            strokeWidth={1.5}
          />
        </div>
        {/* Main icon */}
        <Podcast 
          size={120} 
          className="text-gray-600 relative"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
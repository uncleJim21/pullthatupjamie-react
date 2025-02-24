import React from 'react';
import { Youtube, Music } from 'lucide-react';

const SubscribeSection = () => {
  return (
    <div className="py-8">
      <h2 className="text-xl font-bold mb-6">Listen & Subscribe</h2>
      <div className="bg-[#111111] rounded-lg p-6 border border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Spotify */}
          <a
            href="https://creators.spotify.com/pod/show/earlydayspod/episodes/Shopstr-e2ttnqi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#1DB954] text-black rounded-lg hover:opacity-90 transition-opacity"
          >
            <Music size={24} />
            <span className="font-medium">Listen on Spotify</span>
          </a>

          {/* Apple Podcasts */}
          <a
            href="https://podcasts.apple.com/us/podcast/early-days/id1792360751"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#872EC4] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Music size={24} />
            <span className="font-medium">Apple Podcasts</span>
          </a>

          {/* YouTube */}
          <a
            href="https://www.youtube.com/watch?v=u2vmnmy3HgI&list=PLvxf1TpXqCAID5M_k5VkwrURU2M8YYGpZ&index=1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#FF0000] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Youtube size={24} />
            <span className="font-medium">Watch on YouTube</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default SubscribeSection;
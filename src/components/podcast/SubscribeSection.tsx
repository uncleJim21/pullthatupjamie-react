import React from 'react';
import { Youtube, Music } from 'lucide-react';//force deploy lol

export interface SubscribeLinks {
  spotifyLink?:string | null;
  appleLink?:string | null;
  youtubeLink?:string | null;
}

const SubscribeSection = (props:SubscribeLinks) => {
  return (
    <div className="py-8">
      <h2 className="text-xl font-bold mb-6">Listen & Subscribe</h2>
      <div className="bg-[#111111] rounded-lg p-6 border border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Spotify */}
          {props.spotifyLink && (<a
            href={props.spotifyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#1DB954] text-black rounded-lg hover:opacity-90 transition-opacity"
          >
            <Music size={24} />
            <span className="font-medium">Listen on Spotify</span>
          </a>)}

          {/* Apple Podcasts */}
          {props.appleLink && (<a
            href={props.appleLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#872EC4] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Music size={24} />
            <span className="font-medium">Apple Podcasts</span>
          </a>)}

          {/* YouTube */}
          {props.youtubeLink && (<a
            href={props.youtubeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 p-4 bg-[#FF0000] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Youtube size={24} />
            <span className="font-medium">Watch on YouTube</span>
          </a>)}
        </div>
      </div>
    </div>
  );
};

export default SubscribeSection;
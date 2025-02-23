import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../../constants/constants.ts';
import { PodcastSearchResultItem, PresentationContext } from './PodcastSearchResultItem.tsx';
interface PodcastFeedData {
  id: string;
  headerColor: string;
  logoUrl: string;
  title: string;
  creator: string;
  lightningAddress?: string;
  description: string;
  episodes: Array<{
    id: string;
    title: string;
    date: string;
    duration: string;
    audioUrl: string;
  }>;
}

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe';

const PodcastFeedPage: React.FC = () => {
  const { feedId } = useParams<{ feedId: string }>();
  const [feedData, setFeedData] = useState<PodcastFeedData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Episodes');
  const [isLoading, setIsLoading] = useState(true);
  const [copied,setCopied] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

    // Add these handlers:
    const handlePlayPause = (id: string) => {
    if (currentlyPlayingId === id) {
        setCurrentlyPlayingId(null);
    } else {
        setCurrentlyPlayingId(id);
    }
    };

    const handleEnded = (id: string) => {
    setCurrentlyPlayingId(null);
    };

  const copyToClipboard = () => {
    const lna = feedData?.lightningAddress
    console.log(`lna:${lna}`)
    if(!lna){return}
    navigator.clipboard.writeText(lna);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    console.log(`feedId:${feedId}`)
  }, []);

  useEffect(() => {
    const fetchFeedData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/podcast-feed/${feedId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setFeedData(data);
      } catch (error) {
        console.error('Error fetching podcast feed:', error);
        setFeedData(null); // Explicitly set to null on error
      } finally {
        setIsLoading(false);
      }
    };
  
    if (feedId) {
      fetchFeedData();
    }
  }, [feedId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!feedData) {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
            <div className='text-4xl'>
                <h1>404</h1>
            </div>
            <div className="w-12 h-px bg-gray-600"></div>
            <div className="text-lg">
                Podcast not found
            </div>
        </div>
    );
}

  return (
    <div className="min-h-screen pb-12 bg-black text-white">
      {/* Header Section */}
      <div 
        className="w-full py-8 px-4"
        style={{ backgroundColor: feedData.headerColor }}
      >
        <div className="max-w-4xl mx-auto flex items-start gap-6 ">
          {/* Podcast Logo */}
          <img 
            src={feedData.logoUrl} 
            alt={feedData.title}
            className="w-32 h-32 rounded-lg shadow-lg border border-gray-700"
          />
          
          {/* Podcast Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{feedData.title}</h1>
            <p className="text-lg text-gray-300">by {feedData.creator}</p>
            {feedData.lightningAddress && (
              <p 
              className="text-sm text-gray-400 mt-1 underline no-select hover:text-gray-200 cursor-pointer" 
              onClick={()=>(copyToClipboard())}>
                {copied ? 'Copied!' : `⚡${feedData.lightningAddress}`}
            </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-800" style={{ backgroundColor: feedData.headerColor }}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-8">
            {([
                'Episodes', 
                // 'Home', 
                // 'Top Clips', 
                'Subscribe'
            ] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 relative ${
                  activeTab === tab 
                    ? 'text-white font-medium' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-300 leading-relaxed">
          {feedData.description}
        </p>
      </div>
      {/* Latest Episodes Section */}
        <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-xl font-bold mb-6">Latest Episodes</h2>
            <div className="space-y-4">
                {Array.isArray(feedData.episodes) && feedData.episodes.map((episode) => (
                <PodcastSearchResultItem
                    key={episode.id}
                    id={episode.id}
                    quote={episode.description || ''} // Use empty string if no description
                    episode={episode.title}
                    creator={feedData.creator}
                    audioUrl={episode.audioUrl}
                    date={episode.date}
                    timeContext={{
                    start_time: 0,
                    end_time: 3600 // Default to 1 hour, or calculate from duration
                    }}
                    similarity={{ combined: 1, vector: 1 }}
                    episodeImage={feedData.logoUrl} // Use podcast logo as episode image
                    isPlaying={currentlyPlayingId === episode.id}
                    onPlayPause={handlePlayPause}
                    onEnded={handleEnded}
                    shareUrl={`/feed/${feedId}/episode/${episode.id}`}
                    shareLink={episode.id}
                    authConfig={null}
                    presentationContext={PresentationContext.landingPage}
                />
                ))}
            </div>
        </div>
    </div>
  );
};

export default PodcastFeedPage;
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../../constants/constants.ts';

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

// // In your podcast feed page component:
// interface Episode {
//     id: string;
//     title: string;
//     date: string;
//     duration: string;
//     audioUrl: string;
//     episodeImage: string;
//     description: string;
//   }
  
//   const PodcastFeedEpisodeList: React.FC<{ episodes: Episode[] }> = ({ episodes }) => {
//     const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  
//     const handlePlayPause = (id: string) => {
//       if (currentlyPlayingId === id) {
//         setCurrentlyPlayingId(null);
//       } else {
//         setCurrentlyPlayingId(id);
//       }
//     };
  
//     const handleEnded = (id: string) => {
//       setCurrentlyPlayingId(null);
//     };
  
//     return (
//       <div className="space-y-4">
//         {episodes.map((episode) => (
//           <PodcastSearchResultItem
//             key={episode.id}
//             id={episode.id}
//             quote={episode.description}
//             episode={episode.title}
//             creator="Early Days"
//             audioUrl={episode.audioUrl}
//             date={episode.date}
//             timeContext={{
//               start_time: 0,
//               end_time: 0 // We'll need to convert duration to seconds
//             }}
//             similarity={{ combined: 1, vector: 1 }} // Not relevant for episodes but required by interface
//             episodeImage={episode.episodeImage}
//             isPlaying={currentlyPlayingId === episode.id}
//             onPlayPause={handlePlayPause}
//             onEnded={handleEnded}
//             shareUrl=""
//             shareLink={episode.id}
//             onClipProgress={() => {}}
//             authConfig={null}
//           />
//         ))}
//       </div>
//     );
//   };

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe';

const PodcastFeedPage: React.FC = () => {
  const { feedId } = useParams<{ feedId: string }>();
  const [feedData, setFeedData] = useState<PodcastFeedData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Home');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log(`feedId:${feedId}`)
  }, []);

  useEffect(() => {
    const fetchFeedData = async () => {
      try {
        // Replace with your actual API endpoint
        const response = await fetch(`${API_URL}/api/podcast-feed/${feedId}`);
        const data = await response.json();
        setFeedData(data);
      } catch (error) {
        console.error('Error fetching podcast feed:', error);
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
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <div 
        className="w-full py-8 px-4"
        style={{ backgroundColor: feedData.headerColor }}
      >
        <div className="max-w-4xl mx-auto flex items-start gap-6">
          {/* Podcast Logo */}
          <img 
            src={feedData.logoUrl} 
            alt={feedData.title}
            className="w-32 h-32 rounded-lg shadow-lg"
          />
          
          {/* Podcast Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{feedData.title}</h1>
            <p className="text-lg text-gray-300">by {feedData.creator}</p>
            {feedData.lightningAddress && (
              <p className="text-sm text-gray-400 mt-1">{feedData.lightningAddress}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-8">
            {(['Home', 'Episodes', 'Top Clips', 'Subscribe'] as TabType[]).map((tab) => (
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
          {feedData.episodes.map((episode) => (
            <div 
              key={episode.id}
              className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4">
                <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 5v10l8-5-8-5z"/>
                  </svg>
                </button>
                <div className="flex-1">
                  <h3 className="font-medium">{episode.title}</h3>
                  <p className="text-sm text-gray-400">
                    {episode.date} · {episode.duration}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button className="text-gray-400 hover:text-white">
                    Link
                  </button>
                  <button className="text-gray-400 hover:text-white">
                    Listen
                  </button>
                  <button className="text-gray-400 hover:text-white">
                    Clip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PodcastFeedPage;
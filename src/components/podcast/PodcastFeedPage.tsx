import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL, FRONTEND_URL } from '../../constants/constants.ts';
import { PodcastSearchResultItem, PresentationContext } from './PodcastSearchResultItem.tsx';
import SubscribeSection from './SubscribeSection.tsx'
import { Copy , Check, QrCodeIcon} from 'lucide-react';
import QRCodeModal from '../QRCodeModal.tsx';


interface Episode {
    id: string;
    title: string;
    date: string;
    duration: string;
    audioUrl: string;
    description?: string;
    episodeNumber?: string;
    episodeImage?: string;
    listenLink?: string;
  }
  
  interface PodcastFeedData {
    id: string;
    headerColor: string;
    logoUrl: string;
    title: string;
    creator: string;
    lightningAddress?: string;
    description: string;
    episodes: Episode[];
  }

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe';

const PodcastFeedPage: React.FC = () => {
    const { feedId, episodeId } = useParams<{ feedId: string; episodeId?: string }>();
    const [feedData, setFeedData] = useState<PodcastFeedData | null>(null);
    const [featuredEpisode, setFeaturedEpisode] = useState<Episode | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('Episodes');
    const [isLoading, setIsLoading] = useState(true);
    const [copied,setCopied] = useState(false);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);

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

  const openQRModal = () => {
    setQrModalOpen(true);
  }

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

        // If we have an episodeId, find and set the featured episode
        if (episodeId && data.episodes) {
          const featured = data.episodes.find(ep => ep.id === episodeId);
          if (featured) {
            setFeaturedEpisode(featured);
          }
        }
      } catch (error) {
        console.error('Error fetching podcast feed:', error);
        setFeedData(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (feedId) {
      fetchFeedData();
    }
  }, [feedId, episodeId]);

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
          
          {/* Podcast Info with tinted background */}
          <div className="flex-1">
            <div className="bg-black bg-opacity-20 px-4 py-3 rounded-lg inline-block">
              <h1 className="text-3xl font-bold mb-2">{feedData.title}</h1>
              <p className="text-lg text-white opacity-80">by {feedData.creator}</p>
              {feedData.lightningAddress && (
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-white opacity-80 no-select">
                    {`⚡ ${feedData.lightningAddress}`}
                    </p>
                    <button 
                    className="text-white hover:text-gray-800 opacity-80"
                    onClick={copyToClipboard}
                    >
                    {!copied ? <Copy size={16} /> : <Check size={16} />}
                    </button>
                    <button 
                    className="text-white hover:text-gray-800 opacity-80"
                    onClick={openQRModal}
                    >
                    <QrCodeIcon size={16} />
                    </button>
                </div>
              )}
            </div>
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

      <div className="max-w-4xl mx-auto px-4">
        {activeTab === 'Episodes' && (
            <>
            {featuredEpisode && (
                <div className="py-8">
                <h2 className="text-xl font-bold mb-6">Featured Episode</h2>
                <PodcastSearchResultItem
                    key={featuredEpisode.id}
                    id={featuredEpisode.id}
                    quote={featuredEpisode.description || ''}
                    episode={featuredEpisode.title}
                    creator={feedData?.creator || ''}
                    audioUrl={featuredEpisode.audioUrl}
                    date={featuredEpisode.date}
                    timeContext={{
                    start_time: 0,
                    end_time: 3600
                    }}
                    similarity={{ combined: 1, vector: 1 }}
                    episodeImage={feedData?.logoUrl || ''}
                    isPlaying={currentlyPlayingId === featuredEpisode.id}
                    onPlayPause={handlePlayPause}
                    onEnded={handleEnded}
                    shareUrl={`${FRONTEND_URL}/feed/${feedId}/episode/${featuredEpisode.id}`}
                    shareLink={featuredEpisode.id}
                    authConfig={null}
                    presentationContext={PresentationContext.landingPage}
                />
                </div>
            )}

            {!featuredEpisode && (
                <div className="py-8">
                <p className="text-gray-300 leading-relaxed">
                    {feedData?.description}
                </p>
                </div>
            )}

            <h2 className="text-xl font-bold mb-6">Latest Episodes</h2>
            <div className="space-y-4">
                {Array.isArray(feedData.episodes) && feedData.episodes.map((episode) => (
                <PodcastSearchResultItem
                    key={episode.id}
                    id={episode.id}
                    quote={episode.description || ''}
                    episode={episode.title}
                    creator={feedData.creator}
                    audioUrl={episode.audioUrl}
                    date={episode.date}
                    timeContext={{
                    start_time: 0,
                    end_time: 3600
                    }}
                    similarity={{ combined: 1, vector: 1 }}
                    episodeImage={feedData.logoUrl}
                    isPlaying={currentlyPlayingId === episode.id}
                    onPlayPause={handlePlayPause}
                    onEnded={handleEnded}
                    shareUrl={`${FRONTEND_URL}/feed/${feedId}/episode/${episode.id}`}
                    listenLink={episode.listenLink}
                    shareLink={episode.id}
                    authConfig={null}
                    presentationContext={PresentationContext.landingPage}
                />
                ))}
            </div>
            </>
        )}

            {activeTab === 'Subscribe' && <SubscribeSection />}

        </div>

        {qrModalOpen && (
        <QRCodeModal
            isOpen={qrModalOpen}
            onClose={() => setQrModalOpen(false)}
            lightningAddress={feedData?.lightningAddress || ''}
            title={feedData?.title || ''}
        />
        )}
    </div>
  );
};

export default PodcastFeedPage;
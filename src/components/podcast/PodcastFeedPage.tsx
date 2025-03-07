import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL, FRONTEND_URL } from '../../constants/constants.ts';
import { PodcastSearchResultItem, PresentationContext } from './PodcastSearchResultItem.tsx';
import SubscribeSection from './SubscribeSection.tsx'
import { SubscribeLinks } from './SubscribeSection.tsx';
import { Copy , Check, QrCodeIcon} from 'lucide-react';
import QRCodeModal from '../QRCodeModal.tsx';
import AuthService from '../../services/authService.ts';

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
    subscribeLinks:SubscribeLinks
  }
  

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe' | 'Jamie Pro';

interface RunHistoryRecommendation {
  title: string;
  text: string;
  start_time: number;
  end_time: number;
  episode_title: string;
  feed_title: string;
  audio_url: string;
  relevance_score: number;
  episode_image: string;
  duration: number;
  paragraph_ids: string[];
  expanded_context: boolean;
  first_word_index: number;
  last_word_index: number;
}

interface RunHistory {
  feed_id: string;
  run_date: string;
  filter_scope: {
    feed_id: string;
    episode_guid: string;
  };
  recommendations: RunHistoryRecommendation[];
}

const PodcastFeedPage: React.FC = () => {
    const { feedId, episodeId } = useParams<{ feedId: string; episodeId?: string }>();
    const [feedData, setFeedData] = useState<PodcastFeedData | null>(null);
    const [featuredEpisode, setFeaturedEpisode] = useState<Episode | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('Episodes');
    const [isLoading, setIsLoading] = useState(true);
    const [copied,setCopied] = useState(false);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  const fetchRunHistory = async () => {
    if (!feedId || !isAdmin) return;
    
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`${API_URL}/api/podcast-runs/${feedId}/recent`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch run history');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setRunHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching run history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Jamie Pro' && isAdmin) {
      fetchRunHistory();
    }
  }, [activeTab, isAdmin, feedId]);

  useEffect(() => {
      console.log(`feedId: ${feedId}`);

      const checkPrivileges = async () => {
          try {
              const token = localStorage.getItem("auth_token") as string;
              if(!token){return}
              const response = await AuthService.checkPrivs(token);
              console.log(`checkPrivs response:${JSON.stringify(response,null,2)}`)
              if (response && response.privs.privs && response.privs.privs.feedId === feedId) {
                  console.log(`Admin privileges granted`);
                  setIsAdmin(response.privs.privs.access === 'admin');
              } else {
                  setIsAdmin(false);
              }
          } catch (error) {
              console.error("Error checking privileges:", error);
              setIsAdmin(false);
          }
      };

      if (feedId) {
          checkPrivileges();
      }
  }, [feedId]); 


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
        <div className="max-w-4xl mx-auto flex items-start gap-6">
          {/* Podcast Logo */}
          <img 
            src={feedData.logoUrl} 
            alt={feedData.title}
            className="sm:w-32 sm:h-32 w-24 w-24 rounded-lg shadow-lg border border-gray-700"
          />
          
          {/* Podcast Info with tinted background */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="bg-black bg-opacity-30 px-4 py-3 rounded-lg" 
              style={{ 
                display: "inline-block",
                maxWidth: "calc(100% - 4px)"
              }}
            >
              <h1 className="sm:text-3xl text-xl font-bold mb-2">{feedData.title}</h1>
              <p className="text-lg text-white opacity-80">by {feedData.creator}</p>
              {feedData.lightningAddress && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="sm:text-sm text-xs text-white opacity-80 no-select truncate max-w-[180px] sm:max-w-none">
                    {`⚡ ${feedData.lightningAddress}`}
                  </p>
                  <div className="flex items-center">
                    <button 
                      className="text-white hover:text-gray-800 opacity-80 mr-2"
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

                  {isAdmin && (
                      <div className="absolute top-4 right-4 bg-white text-black text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                          Admin
                      </div>
                  )}
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
                'Subscribe',
                ...(isAdmin ? ['Jamie Pro'] : [])
            ] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 relative ${
                  activeTab === tab 
                    ? 'text-white font-medium' 
                    : 'text-white opacity-80 hover:text-gray-300'
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

          {activeTab === 'Subscribe' && (
            <SubscribeSection 
              spotifyLink={feedData?.subscribeLinks?.spotifyLink || null} 
              appleLink={feedData?.subscribeLinks?.appleLink || null}
              youtubeLink={feedData?.subscribeLinks?.youtubeLink || null}
            />
          )}

          {activeTab === 'Jamie Pro' && isAdmin && (
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Run History</h2>
              </div>

              {isLoadingHistory ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              ) : runHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No run history available.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {runHistory.map((run, index) => (
                    <div 
                      key={index}
                      className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors cursor-pointer"
                      onClick={() => console.log(`run history id: ${run.feed_id} tapped`)}
                    >
                      {run.recommendations.length > 0 && (
                        <PodcastSearchResultItem
                          id={run.recommendations[0].paragraph_ids[0]}
                          quote={run.recommendations[0].text}
                          episode={run.recommendations[0].title}
                          creator={`${run.recommendations[0].feed_title} - ${run.recommendations[0].episode_title}`}
                          audioUrl={run.recommendations[0].audio_url}
                          date={run.run_date}
                          timeContext={{
                            start_time: run.recommendations[0].start_time,
                            end_time: run.recommendations[0].end_time
                          }}
                          similarity={{ combined: run.recommendations[0].relevance_score / 100, vector: run.recommendations[0].relevance_score / 100 }}
                          episodeImage={run.recommendations[0].episode_image}
                          isPlaying={currentlyPlayingId === run.recommendations[0].paragraph_ids[0]}
                          onPlayPause={handlePlayPause}
                          onEnded={handleEnded}
                          shareUrl={`${window.location.origin}/feed/${feedId}`}
                          shareLink={run.recommendations[0].paragraph_ids[0]}
                          authConfig={null}
                          presentationContext={PresentationContext.landingPage}
                        />
                      )}
                      <div className="px-4 py-2 border-t border-gray-800">
                        <div className="text-sm text-gray-400">
                          Run Date: {new Date(run.run_date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
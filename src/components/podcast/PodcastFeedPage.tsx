import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DEBUG_MODE, FRONTEND_URL } from '../../constants/constants.ts';
import { PodcastSearchResultItem, PresentationContext } from './PodcastSearchResultItem.tsx';
import SubscribeSection from './SubscribeSection.tsx'
import { SubscribeLinks } from './SubscribeSection.tsx';
import { Copy, Check, QrCodeIcon, MessageSquare, History, Link, Upload, ExternalLink, ChevronDown } from 'lucide-react';
import QRCodeModal from '../QRCodeModal.tsx';
import AuthService from '../../services/authService.ts';
import PodcastFeedService, { 
  Episode, 
  PodcastFeedData, 
  RunHistory, 
  RunHistoryRecommendation 
} from '../../services/podcastFeedService.ts';
import { JamieChat } from './JamieChat.tsx';
import UploadModal from '../UploadModal.tsx';
import UploadService, { UploadItem, PaginationData } from '../../services/uploadService.ts';

type TabType = 'Home' | 'Episodes' | 'Top Clips' | 'Subscribe' | 'Jamie Pro' | 'Uploads';
type JamieProView = 'chat' | 'history';

const PodcastFeedPage: React.FC<{ initialView?: string; defaultTab?: string }> = ({ initialView, defaultTab }) => {
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
    const [jamieProView, setJamieProView] = useState<JamieProView>('history');
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isLoadingUploads, setIsLoadingUploads] = useState(false);
    const [isLoadingMoreUploads, setIsLoadingMoreUploads] = useState(false);
    const [uploadsError, setUploadsError] = useState<string | null>(null);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [paginationData, setPaginationData] = useState<PaginationData | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);

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
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;

      const response = await PodcastFeedService.getRunHistory(feedId, authToken);
      if (response.success) {
        setRunHistory(response.data);
      }
    } catch (error) {
      console.error('Error fetching run history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchUploads = async (page: number = 1, append: boolean = false) => {
    if (!feedId) return;
    
    try {
      if (page === 1) {
        setIsLoadingUploads(true);
        setUploadsError(null);
      } else {
        setIsLoadingMoreUploads(true);
      }
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        setUploadsError('Authentication required');
        return;
      }

      const response = await UploadService.getUploadsList(authToken, page);
      
      // Sort uploads by date from latest to oldest
      const sortedUploads = [...response.uploads].sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      
      if (append) {
        // When appending, merge with existing uploads and re-sort to ensure correct order
        setUploads(prevUploads => {
          const combinedUploads = [...prevUploads, ...sortedUploads];
          return combinedUploads.sort(
            (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
          );
        });
      } else {
        setUploads(sortedUploads);
      }
      
      setPaginationData(response.pagination);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      setUploadsError('Failed to load uploads. Please try again.');
    } finally {
      setIsLoadingUploads(false);
      setIsLoadingMoreUploads(false);
    }
  };

  const loadMoreUploads = () => {
    if (paginationData && paginationData.hasNextPage) {
      fetchUploads(currentPage + 1, true);
    }
  };

  useEffect(() => {
    if (activeTab === 'Jamie Pro' && isAdmin) {
      fetchRunHistory();
    }
    
    if (activeTab === 'Uploads') {
      // Reset to first page when tab changes to Uploads
      setCurrentPage(1);
      fetchUploads(1, false);
    }
  }, [activeTab, isAdmin, feedId]);

  useEffect(() => {
      console.log(`feedId: ${feedId}`);
      if(DEBUG_MODE){
        setIsAdmin(true);
        return;
      }
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
      if (!feedId) return;
      
      try {
        setIsLoading(true);
        const data = await PodcastFeedService.getFeedData(feedId);
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

    fetchFeedData();
  }, [feedId, episodeId]);

  useEffect(() => {
    if (feedData && initialView === 'jamiePro') {
      if (isAdmin) {
        setActiveTab('Jamie Pro');
        if (defaultTab === 'history') {
          setJamieProView('history');
        }
      } else {
        setActiveTab('Episodes');
        console.log('Non-admin user attempted to access Jamie Pro tab, falling back to Episodes tab');
      }
    }
  }, [feedData, initialView, defaultTab, isAdmin]);

  // Add a useEffect to ensure activeTab is never 'Jamie Pro' for non-admin users
  useEffect(() => {
    if (activeTab === 'Jamie Pro' && !isAdmin) {
      setActiveTab('Episodes');
      console.log('Non-admin user attempted to access Jamie Pro tab, falling back to Episodes tab');
    }
  }, [activeTab, isAdmin]);

  const openUploadModal = () => {
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    // Refresh uploads list after modal closes
    if (activeTab === 'Uploads') {
      setCurrentPage(1);
      fetchUploads(1, false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const cleanFileName = (fileName: string) => {
    // Remove timestamp prefix if it exists (like "1742402062188-")
    const timestampPattern = /^\d{10,13}-/;
    return fileName.replace(timestampPattern, '');
  };

  const handleCopyFileUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedLinkId(key);
        setTimeout(() => setCopiedLinkId(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy file URL:', err);
      });
  };

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
        <div className="max-w-4xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-8 min-w-max">
            {([
                'Episodes', 
                // 'Home', 
                // 'Top Clips', 
                'Subscribe',
                ...(isAdmin ? ['Jamie Pro'] : []),
                'Uploads'
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
        {/* Ensure non-admin users can't see Jamie Pro tab content even if activeTab is somehow set to it */}
        {activeTab === 'Jamie Pro' && !isAdmin ? (
          // Render Episodes tab content as fallback
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
                  listenLink={featuredEpisode.audioUrl}
                  isPlaying={currentlyPlayingId === featuredEpisode.id}
                  onPlayPause={handlePlayPause}
                  onEnded={handleEnded}
                  shareUrl=""
                  shareLink=""
                />
              </div>
            )}
            <div className="py-8">
              <h2 className="text-xl font-bold mb-6">All Episodes</h2>
              <div className="space-y-6">
                {feedData.episodes.map(episode => (
                  <PodcastSearchResultItem
                    key={episode.id}
                    id={episode.id}
                    quote={episode.description || ''}
                    episode={episode.title}
                    creator={feedData?.creator || ''}
                    audioUrl={episode.audioUrl}
                    date={episode.date}
                    timeContext={{
                      start_time: 0,
                      end_time: 3600
                    }}
                    similarity={{ combined: 1, vector: 1 }}
                    episodeImage={feedData?.logoUrl || ''}
                    listenLink={episode.audioUrl}
                    isPlaying={currentlyPlayingId === episode.id}
                    onPlayPause={handlePlayPause}
                    onEnded={handleEnded}
                    shareUrl=""
                    shareLink=""
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
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
                      listenLink={featuredEpisode.audioUrl}
                      isPlaying={currentlyPlayingId === featuredEpisode.id}
                      onPlayPause={handlePlayPause}
                      onEnded={handleEnded}
                      shareUrl=""
                      shareLink=""
                    />
                  </div>
                )}
                <div className="py-8">
                  <h2 className="text-xl font-bold mb-6">All Episodes</h2>
                  <div className="space-y-6">
                    {feedData.episodes.map(episode => (
                      <PodcastSearchResultItem
                        key={episode.id}
                        id={episode.id}
                        quote={episode.description || ''}
                        episode={episode.title}
                        creator={feedData?.creator || ''}
                        audioUrl={episode.audioUrl}
                        date={episode.date}
                        timeContext={{
                          start_time: 0,
                          end_time: 3600
                        }}
                        similarity={{ combined: 1, vector: 1 }}
                        episodeImage={feedData?.logoUrl || ''}
                        listenLink={episode.audioUrl}
                        isPlaying={currentlyPlayingId === episode.id}
                        onPlayPause={handlePlayPause}
                        onEnded={handleEnded}
                        shareUrl=""
                        shareLink=""
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'Subscribe' && (
              <div className="py-8">
                <SubscribeSection 
                  spotifyLink={feedData?.subscribeLinks?.spotifyLink || null}
                  appleLink={feedData?.subscribeLinks?.appleLink || null}
                  youtubeLink={feedData?.subscribeLinks?.youtubeLink || null}
                />
              </div>
            )}

            {activeTab === 'Uploads' && (
              <div className="py-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Your Uploads</h2>
                  <button
                    onClick={openUploadModal}
                    className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center font-medium"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </button>
                </div>
                
                {isLoadingUploads ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : uploadsError ? (
                  <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
                    {uploadsError}
                  </div>
                ) : uploads.length === 0 ? (
                  <div className="p-8 bg-[#111111] border border-gray-800 rounded-lg text-center">
                    <p className="text-gray-400">No uploads found. Click the Upload button to add files.</p>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-3 mb-4">
                      {/* Uploads already sorted from latest to oldest */}
                      {uploads.map((upload) => (
                        <div 
                          key={upload.key}
                          className="bg-[#111111] border border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-gray-700 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate" title={cleanFileName(upload.fileName)}>
                              {cleanFileName(upload.fileName)}
                            </p>
                            <div className="flex flex-wrap text-gray-400 text-sm mt-1 gap-4">
                              <p>Uploaded {formatDate(upload.lastModified)}</p>
                              <p>{formatBytes(upload.size)}</p>
                            </div>
                          </div>
                          <div className="flex space-x-3 self-end sm:self-center">
                            <button
                              onClick={() => handleCopyFileUrl(upload.publicUrl, upload.key)}
                              className="flex items-center justify-center h-9 w-9 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                              title="Copy link"
                            >
                              {copiedLinkId === upload.key ? 
                                <Check className="w-5 h-5 text-green-500" /> : 
                                <Link className="w-5 h-5" />
                              }
                            </button>
                            <a 
                              href={upload.publicUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center h-9 w-9 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                              title="Open file"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination - Load More button */}
                    {paginationData && paginationData.hasNextPage && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={loadMoreUploads}
                          disabled={isLoadingMoreUploads}
                          className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#252525] text-white px-6 py-3 rounded-md border border-gray-700 transition-colors font-medium"
                        >
                          {isLoadingMoreUploads ? (
                            <>
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-5 h-5" />
                              <span>Load More</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Pagination information */}
                    {paginationData && (
                      <div className="text-center text-gray-500 text-sm mt-4">
                        Showing {uploads.length} of {paginationData.totalCount} uploads
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Jamie Pro' && isAdmin && (
              <div className="py-8">
                {/* Add the Jamie Pro header similar to the batch clips mode */}
                <div className="flex flex-col items-center mb-8">
                  <img
                    src="/jamie-pro-banner.png"
                    alt="Jamie Pro Banner"
                    className="max-w-full h-auto"
                  />
                  <p className="text-gray-400 text-xl font-medium mt-2">AI Curated Clips for You</p>
                </div>

                <div className="flex items-center justify-center mb-8">
                  <div className="inline-flex rounded-lg border border-gray-800 p-1.5">
                    <button
                      onClick={() => setJamieProView('chat')}
                      className={`inline-flex items-center px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'chat'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare size={20} className="mr-2.5" />
                      Chat with Jamie
                    </button>
                    <button
                      onClick={() => setJamieProView('history')}
                      className={`inline-flex items-center px-6 py-3 rounded-md text-base sm:text-lg ${
                        jamieProView === 'history'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <History size={20} className="mr-2.5" />
                      Run History
                    </button>
                  </div>
                </div>

                {jamieProView === 'chat' ? (
                  feedId ? <JamieChat feedId={feedId} /> : (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-lg">Unable to load chat. Please try again.</p>
                    </div>
                  )
                ) : isLoadingHistory ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                  </div>
                ) : runHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-lg">No run history available.</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto">
                    {runHistory.map((run, index) => (
                      <div 
                        key={index}
                        className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors cursor-pointer"
                        onClick={() => console.log(`run history id: ${run._id} tapped`)}
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
                            presentationContext={PresentationContext.runHistoryPreview}
                            runId={run._id}
                            feedId={feedId}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
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

      {uploadModalOpen && (
        <UploadModal onClose={closeUploadModal} />
      )}
    </div>
  );
};

export default PodcastFeedPage;
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PodcastSearchResultItem, PresentationContext } from '../podcast/PodcastSearchResultItem.tsx';
import { getRecommendedClips, ClipItem } from '../../services/dashboardService.ts';
import { FRONTEND_URL } from '../../constants/constants.ts';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import PageBanner from '../PageBanner.tsx';
import TutorialModal from '../TutorialModal.tsx';
import WelcomeModal from '../WelcomeModal.tsx';

// Default podcast image to use when none is provided
const DEFAULT_PODCAST_IMAGE = '/podcast-logo.png'; // Update with your default image path

const DashboardPage: React.FC = () => {
  const { feedId } = useParams<{ feedId: string }>();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [enableFieldFiltering, setEnableFieldFiltering] = useState(false);
  
  // Tutorial and welcome modal states
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);

  useEffect(() => {
    fetchRecommendedClips();
    
    // Check if user is signed in
    const token = localStorage.getItem('auth_token');
    setIsUserSignedIn(!!token);
  }, [feedId, enableFieldFiltering]);

  const fetchRecommendedClips = async () => {
    if (!feedId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getRecommendedClips(feedId, enableFieldFiltering);
      
      if (result.success) {
        setClips(result.clips);
      } else {
        throw new Error(result.error || 'Failed to fetch recommended clips');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching clips:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = (id: string) => {
    if (currentlyPlayingId === id) {
      setCurrentlyPlayingId(null);
    } else {
      setCurrentlyPlayingId(id);
    }
  };

  const handleEnded = () => {
    setCurrentlyPlayingId(null);
  };

  const toggleFieldFiltering = () => {
    setEnableFieldFiltering(!enableFieldFiltering);
  };

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('squareId');
    setIsUserSignedIn(false);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page Banner */}
      <PageBanner 
        logoText="Pull That Up Jamie!" 
        onConnect={() => {}}
        onSignIn={() => {}}
        onUpgrade={() => {}}
        onSignOut={handleSignOut}
        onTutorialClick={handleTutorialClick}
        isUserSignedIn={isUserSignedIn}
        setIsUserSignedIn={setIsUserSignedIn}
      />

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={handleTutorialClose}
        defaultSection={2} // Jamie Pro section for dashboard
      />

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onQuickTour={() => {
          setIsWelcomeOpen(false);
          setIsTutorialOpen(true);
        }}
        onGetStarted={() => setIsWelcomeOpen(false)}
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Recommended Clips for {feedId}</h1>
          
          <div className="flex items-center">
            <span className="mr-3 text-sm text-gray-400">
              {enableFieldFiltering ? 'Using dynamic filters' : 'Using user preferences'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={enableFieldFiltering}
                onChange={toggleFieldFiltering}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-md p-4 text-center">
            {error}
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>No clips found. Try again later.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {clips.map((clip, index) => (
              <div key={index}>
                <PodcastSearchResultItem
                  id={clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`}
                  quote={clip.text}
                  episode={clip.title}
                  creator={`${clip.feed_title} - ${clip.episode_title}`}
                  audioUrl={clip.audio_url}
                  date=""
                  timeContext={{
                    start_time: clip.start_time,
                    end_time: clip.end_time
                  }}
                  similarity={{ combined: clip.relevance_score / 100, vector: clip.relevance_score / 100 }}
                  episodeImage={clip.episodeImage || DEFAULT_PODCAST_IMAGE}
                  isPlaying={currentlyPlayingId === (clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`)}
                  onPlayPause={handlePlayPause}
                  onEnded={handleEnded}
                  shareUrl={createClipShareUrl(clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`)}
                  shareLink={clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`}
                  presentationContext={PresentationContext.dashboard}
                />
                
                {/* Display clip duration and expansion status */}
                {(clip.duration || clip.expanded_context) && (
                  <div className="mt-2 pl-4 text-xs text-gray-500 flex justify-between">
                    <div>
                      {clip.duration && <span>Duration: {clip.duration.toFixed(1)}s</span>}
                      {clip.expanded_context && (
                        <span className="ml-4 text-blue-400">
                          Context expanded ({clip.paragraph_ids?.length || 1} paragraphs)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400">
                        Relevance: {clip.relevance_score}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
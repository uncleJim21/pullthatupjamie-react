import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PodcastSearchResultItem, PresentationContext } from '../podcast/PodcastSearchResultItem.tsx';
import { getRecommendedClips, ClipItem } from '../../services/dashboardService.ts';

const DashboardPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendedClips();
  }, [userId]);

  const fetchRecommendedClips = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getRecommendedClips(userId);
      
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Recommended Clips for {userId}</h1>
        
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
                  episode={clip.episode_title}
                  creator={clip.feed_title}
                  audioUrl={clip.audio_url}
                  date=""
                  timeContext={{
                    start_time: clip.start_time,
                    end_time: clip.end_time
                  }}
                  similarity={{ combined: clip.relevance_score / 100, vector: clip.relevance_score / 100 }}
                  episodeImage=""
                  isPlaying={currentlyPlayingId === (clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`)}
                  onPlayPause={handlePlayPause}
                  onEnded={handleEnded}
                  shareUrl={`${window.location.origin}/clip/${clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`}`}
                  shareLink={clip.paragraph_ids ? clip.paragraph_ids[0] : `clip-${index}`}
                  presentationContext={PresentationContext.dashboard}
                />
                
                {/* Simple display of clip duration and expansion status */}
                {(clip.duration || clip.expanded_context) && (
                  <div className="mt-2 pl-4 text-xs text-gray-500">
                    {clip.duration && <span>Duration: {clip.duration.toFixed(1)}s</span>}
                    {clip.expanded_context && (
                      <span className="ml-4 text-blue-400">
                        Context expanded ({clip.paragraph_ids?.length || 1} paragraphs)
                      </span>
                    )}
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
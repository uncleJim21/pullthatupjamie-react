import { API_URL } from '../constants/constants.ts';

export interface Episode {
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

export interface PodcastFeedData {
  id: string;
  headerColor: string;
  logoUrl: string;
  title: string;
  creator: string;
  lightningAddress?: string;
  description: string;
  episodes: Episode[];
  subscribeLinks: {
    spotifyLink: string | null;
    appleLink: string | null;
    youtubeLink: string | null;
  };
}

export interface RunHistoryRecommendation {
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

export interface RunHistory {
  _id: string;
  feed_id: string;
  run_date: string;
  filter_scope: {
    feed_id: string;
    episode_guid: string;
  };
  recommendations: RunHistoryRecommendation[];
}

export interface RunHistoryResponse {
  success: boolean;
  data: RunHistory[];
  error?: string;
}

export interface ClipBatchResponse {
  success: boolean;
  data?: RunHistory;
  error?: string;
}

class PodcastFeedService {
  static async getFeedData(feedId: string): Promise<PodcastFeedData> {
    try {
      const response = await fetch(`${API_URL}/api/podcast-feed/${feedId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching podcast feed:', error);
      throw error;
    }
  }

  static async getRunHistory(feedId: string, authToken: string): Promise<RunHistoryResponse> {
    try {
      const response = await fetch(`${API_URL}/api/podcast-runs/${feedId}/recent`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`401: Authentication required`);
        } else if (response.status === 403) {
          throw new Error(`403: You do not have permission to access this content`);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching run history:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  }

  static async getClipBatchByRunId(feedId: string, runId: string, authToken: string): Promise<ClipBatchResponse> {
    try {
      const response = await fetch(`${API_URL}/api/podcast-runs/${feedId}/run/${runId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`401: Authentication required`);
        } else if (response.status === 403) {
          throw new Error(`403: You do not have permission to access this content`);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching clip batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  }
}

export default PodcastFeedService; 
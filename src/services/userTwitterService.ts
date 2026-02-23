import { API_URL } from '../constants/constants.ts';

const TWITTER_API_BASE = `${API_URL}/api/user/twitter`;

interface TwitterTweetResponse {
  success: boolean;
  message?: string;
  error?: string;
  requiresReauth?: boolean;
  tweet?: {
    text: string;
    id: string;
    edit_history_tweet_ids: string[];
  };
}

export const userTwitterService = {
  postTweet: async (text: string, mediaUrl?: string): Promise<TwitterTweetResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      const response = await fetch(`${TWITTER_API_BASE}/tweet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, mediaUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to post tweet',
          message: errorData.message,
          requiresReauth: errorData.error === 'TWITTER_AUTH_EXPIRED'
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
};

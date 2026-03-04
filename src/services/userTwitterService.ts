import { API_URL } from '../constants/constants.ts';
import { parseQuotaExceededResponse } from '../types/errors.ts';
import { QuotaExceededError } from '../types/errors.ts';

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

      if (response.status === 429) {
        const data = await parseQuotaExceededResponse(response, 'twitter-post');
        throw new QuotaExceededError(data);
      }

      if (!response.ok) {
        const errorData = await response.json();
        const is401 = response.status === 401
          || errorData.error === 'TWITTER_AUTH_EXPIRED'
          || errorData.message?.includes('401');
        return {
          success: false,
          error: errorData.error || 'Failed to post tweet',
          message: errorData.message,
          requiresReauth: is401
        };
      }

      return await response.json();
    } catch (error) {
      if (error instanceof QuotaExceededError) throw error;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
};

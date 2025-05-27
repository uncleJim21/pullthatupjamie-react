import { API_URL, printLog } from '../constants/constants.ts';

const TWITTER_API_BASE = `${API_URL}/api/twitter`;

export interface TwitterAuthResponse {
  success: boolean;
  error?: string;
}

export interface TwitterTweetResponse {
  success: boolean;
  error?: string;
}

export const twitterService = {
  // Start the OAuth flow
  startAuth: (): void => {
    printLog(`Starting Twitter OAuth flow with URL: ${TWITTER_API_BASE}/x-oauth`);
    window.open(`${TWITTER_API_BASE}/x-oauth`, '_blank');
  },

  // Post a tweet
  postTweet: async (text: string): Promise<TwitterTweetResponse> => {
    try {
      printLog(`Attempting to post tweet to: ${TWITTER_API_BASE}/tweet`);
      const response = await fetch(`${TWITTER_API_BASE}/tweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        credentials: 'include'
      });
      const data = await response.json();
      printLog(`Tweet response: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      printLog(`Error posting tweet: ${error}`);
      console.error('Error posting tweet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}; 
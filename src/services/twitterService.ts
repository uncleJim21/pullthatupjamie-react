import { API_URL, printLog } from '../constants/constants.ts';

const TWITTER_API_BASE = `${API_URL}/api/twitter`;

export interface TwitterAuthResponse {
  success: boolean;
  error?: string;
}

export interface TwitterTweetResponse {
  success: boolean;
  error?: string;
  message?: string;
  requiresReauth?: boolean;
  details?: string;
  tweet?: {
    text: string;
    id: string;
    edit_history_tweet_ids: string[];
  };
}

export interface TwitterRevokeResponse {
  success?: boolean;
  error?: string;
  message: string;
  warning?: string;
  status?: {
    tokensCleared: boolean;
    sessionCleared: boolean;
    requiresReauth: boolean;
  };
  nextSteps?: {
    reconnect: string;
    checkStatus: string;
  };
}

export const twitterService = {
  // Start the OAuth flow
  startAuth: (): void => {
    printLog(`Starting Twitter OAuth flow with URL: ${TWITTER_API_BASE}/x-oauth`);
    window.open(`${TWITTER_API_BASE}/x-oauth`, '_blank');
  },

  // Revoke Twitter access
  revoke: async (confirmRevoke: boolean = false): Promise<TwitterRevokeResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      printLog(`Attempting to revoke Twitter access with confirmation: ${confirmRevoke}`);
      
      const response = await fetch(`${TWITTER_API_BASE}/revoke`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        body: JSON.stringify({ confirmRevoke }),
        credentials: 'include',
        mode: 'cors'
      });
      const data = await response.json();
      printLog(`Revoke response: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      printLog(`Error revoking Twitter access: ${error}`);
      console.error('Error revoking Twitter access:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to revoke Twitter access'
      };
    }
  },

  // Post a tweet
  postTweet: async (text: string, mediaUrl?: string): Promise<TwitterTweetResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const requestBody: { text: string; mediaUrl?: string } = { text };
      if (mediaUrl && mediaUrl.trim()) {
        requestBody.mediaUrl = mediaUrl.trim();
      }

      printLog(`Attempting to post tweet to: ${TWITTER_API_BASE}/tweet`);
      printLog(`Request body: ${JSON.stringify(requestBody)}`);
      
      const response = await fetch(`${TWITTER_API_BASE}/tweet`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
        mode: 'cors'
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
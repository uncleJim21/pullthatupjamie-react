import { API_URL, printLog } from '../constants/constants.ts';
import { 
  MentionSearchRequest, 
  MentionSearchResponse, 
  MentionResult 
} from '../types/mention.ts';

const MENTION_API_BASE = `${API_URL}/api/mentions`;

interface MentionSearchError {
  error: string;
  message: string;
  code?: string;
  retryAfter?: number;
}

interface MentionSearchServiceResponse {
  success: boolean;
  results?: MentionResult[];
  error?: string;
  message?: string;
  code?: string;
  retryAfter?: number;
}

export const mentionService = {
  // Search for mentions across platforms
  searchMentions: async (
    query: string, 
    options: Omit<MentionSearchRequest, 'query'> = {}
  ): Promise<MentionSearchServiceResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Validate query
      if (!query?.trim()) {
        return {
          success: false,
          error: 'Query cannot be empty'
        };
      }

      if (query.trim().length > 50) {
        return {
          success: false,
          error: 'Query must be 50 characters or less',
          code: 'INVALID_QUERY_LENGTH'
        };
      }

      // Build request with defaults
      const requestBody: MentionSearchRequest = {
        query: query.trim(),
        platforms: options.platforms || ['twitter', 'nostr'],
        includePersonalPins: options.includePersonalPins ?? true,
        includeCrossPlatformMappings: options.includeCrossPlatformMappings ?? true,
        limit: options.limit || 10
      };

      printLog(`Searching mentions with query: "${requestBody.query}", platforms: [${requestBody.platforms?.join(', ')}]`);
      
      const response = await fetch(`${MENTION_API_BASE}/search`, {
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
      
      if (!response.ok) {
        printLog(`Mention search failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: data.error || 'Search failed',
          message: data.message || `HTTP ${response.status}`,
          code: data.code,
          retryAfter: data.retryAfter
        };
      }
      
      printLog(`Mention search response: ${JSON.stringify(data)}`);
      
      return {
        success: true,
        results: data.results || []
      };
    } catch (error) {
      printLog(`Error searching mentions: ${error}`);
      console.error('Error searching mentions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

export type { MentionSearchServiceResponse }; 
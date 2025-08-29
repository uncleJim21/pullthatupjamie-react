import { API_URL, printLog } from '../constants/constants.ts';
import { 
  MentionSearchRequest, 
  MentionSearchResponse, 
  MentionResult,
  PersonalPin,
  CreatePinRequest,
  UpdatePinRequest,
  PinsResponse,
  PinResponse
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

interface PinServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
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
  },

  // Get all personal pins
  getPins: async (): Promise<PinServiceResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      printLog('Fetching personal pins');
      
      const response = await fetch(`${MENTION_API_BASE}/pins`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        printLog(`Get pins failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: data.error || 'Failed to fetch pins',
          message: data.message || `HTTP ${response.status}`
        };
      }
      
      printLog(`Get pins response: ${JSON.stringify(data)}`);
      
      return {
        success: true,
        data: data.pins || []
      };
    } catch (error) {
      printLog(`Error fetching pins: ${error}`);
      console.error('Error fetching pins:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // Create or update personal pin (upsert)
  createPin: async (pinData: CreatePinRequest): Promise<PinServiceResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      printLog(`Creating pin: ${JSON.stringify(pinData)}`);
      
      const response = await fetch(`${MENTION_API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        body: JSON.stringify(pinData),
        credentials: 'include',
        mode: 'cors'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        printLog(`Create pin failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: data.error || 'Failed to create pin',
          message: data.message || `HTTP ${response.status}`
        };
      }
      
      printLog(`Create pin response: ${JSON.stringify(data)}`);
      
      return {
        success: true,
        data: data.pin
      };
    } catch (error) {
      printLog(`Error creating pin: ${error}`);
      console.error('Error creating pin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // Update specific pin
  updatePin: async (pinId: string, updates: UpdatePinRequest): Promise<PinServiceResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      printLog(`Updating pin ${pinId}: ${JSON.stringify(updates)}`);
      
      const response = await fetch(`${MENTION_API_BASE}/pins/${pinId}`, {
        method: 'PUT',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        body: JSON.stringify(updates),
        credentials: 'include',
        mode: 'cors'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        printLog(`Update pin failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: data.error || 'Failed to update pin',
          message: data.message || `HTTP ${response.status}`
        };
      }
      
      printLog(`Update pin response: ${JSON.stringify(data)}`);
      
      return {
        success: true,
        data: data.pin
      };
    } catch (error) {
      printLog(`Error updating pin: ${error}`);
      console.error('Error updating pin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // Delete personal pin
  deletePin: async (pinId: string): Promise<PinServiceResponse> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      printLog(`Deleting pin ${pinId}`);
      
      const response = await fetch(`${MENTION_API_BASE}/pins/${pinId}`, {
        method: 'DELETE',
        headers: {
          'Accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      if (!response.ok) {
        const data = await response.json();
        printLog(`Delete pin failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: data.error || 'Failed to delete pin',
          message: data.message || `HTTP ${response.status}`
        };
      }
      
      printLog(`Delete pin successful`);
      
      return {
        success: true
      };
    } catch (error) {
      printLog(`Error deleting pin: ${error}`);
      console.error('Error deleting pin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  // Toggle pin for a mention (create if not exists, delete if exists)
  togglePin: async (mention: MentionResult): Promise<PinServiceResponse> => {
    try {
      // If already pinned, delete the pin
      if (mention.isPinned && mention.pinId) {
        return await mentionService.deletePin(mention.pinId);
      }

      // If not pinned, create a pin with profile data
      const pinData: CreatePinRequest = {
        platform: mention.platform,
        username: mention.platform === 'twitter' ? mention.username : mention.npub,
        notes: `Pinned ${mention.platform} user`,
        profileData: mention.platform === 'twitter' ? {
          id: mention.id,
          username: mention.username,
          name: mention.name,
          verified: mention.verified,
          verified_type: mention.verified_type,
          profile_image_url: mention.profile_image_url,
          description: mention.description,
          public_metrics: mention.public_metrics,
          protected: mention.protected
        } : {
          npub: mention.npub,
          nprofile: mention.nprofile, // Include nprofile for proper mentions!
          pubkey: mention.pubkey,
          displayName: mention.displayName,
          name: mention.name,
          nip05: mention.nip05,
          about: mention.about,
          profile_image_url: mention.profile_image_url || mention.picture, // Priority: profile_image_url > picture
          banner: mention.banner,
          website: mention.website,
          lud16: mention.lud16
        }
        // Note: targetPlatform and targetUsername are now optional and only needed for cross-platform mappings
      };

      return await mentionService.createPin(pinData);
    } catch (error) {
      printLog(`Error toggling pin: ${error}`);
      console.error('Error toggling pin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

export type { MentionSearchServiceResponse, PinServiceResponse }; 
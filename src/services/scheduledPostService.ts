import { 
  ScheduledPost, 
  CreateScheduledPostRequest, 
  UpdateScheduledPostRequest, 
  ScheduledPostsResponse, 
  ScheduledPostsQuery,
  ScheduledPostStats 
} from '../types/scheduledPost';
import { API_URL, printLog } from '../constants/constants.ts';
import { generatePrimalUrl, relayPool } from '../utils/nostrUtils.ts';

export class ScheduledPostService {
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No auth token found');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        // Clear invalid token and throw auth error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('squareId');
        throw new Error('Authentication failed. Please sign in again.');
      }
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }
    return response.json();
  }

  /**
   * Create a new scheduled post for one or more platforms
   */
  static async createScheduledPost(request: CreateScheduledPostRequest): Promise<ScheduledPost[]> {
    try {
      printLog(`Creating scheduled post for platforms: ${request.platforms.join(', ')}`);
      
      const response = await fetch(`${API_URL}/api/social/posts`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      const data = await this.handleResponse<{ posts: ScheduledPost[] }>(response);
      printLog(`Successfully created ${data.posts.length} scheduled posts`);
      
      return data.posts;
    } catch (error) {
      printLog(`Error creating scheduled post: ${error}`);
      throw error;
    }
  }

  /**
   * Get list of scheduled posts with optional filtering
   */
  static async getScheduledPosts(query: ScheduledPostsQuery = {}): Promise<ScheduledPostsResponse> {
    try {
      const searchParams = new URLSearchParams();
      
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });

      const url = `${API_URL}/api/social/posts?${searchParams.toString()}`;
      printLog(`Fetching scheduled posts: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse<ScheduledPostsResponse>(response);
      printLog(`Fetched ${data.posts.length} scheduled posts`);
      
      return data;
    } catch (error) {
      printLog(`Error fetching scheduled posts: ${error}`);
      throw error;
    }
  }

  /**
   * Get a specific scheduled post by ID
   */
  static async getScheduledPost(postId: string): Promise<ScheduledPost> {
    try {
      printLog(`Fetching scheduled post: ${postId}`);
      
      const response = await fetch(`${API_URL}/api/social/posts/${postId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse<{ post: ScheduledPost }>(response);
      printLog(`Successfully fetched scheduled post: ${postId}`);
      
      return data.post;
    } catch (error) {
      printLog(`Error fetching scheduled post ${postId}: ${error}`);
      throw error;
    }
  }

  /**
   * Update a scheduled post (only works for status: 'scheduled')
   */
  static async updateScheduledPost(postId: string, updates: UpdateScheduledPostRequest): Promise<ScheduledPost> {
    try {
      printLog(`🚨🚨🚨 WRONG FUNCTION CALLED: updateScheduledPost for ${postId} 🚨🚨🚨`);
      printLog(`Updating scheduled post: ${postId}`);
      
      const response = await fetch(`${API_URL}/api/social/posts/${postId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates)
      });

      const data = await this.handleResponse<{ post: ScheduledPost }>(response);
      printLog(`Successfully updated scheduled post: ${postId}`);
      
      return data.post;
    } catch (error) {
      printLog(`Error updating scheduled post ${postId}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete/cancel a scheduled post
   */
  static async deleteScheduledPost(postId: string): Promise<void> {
    try {
      printLog(`Deleting scheduled post: ${postId}`);
      
      const response = await fetch(`${API_URL}/api/social/posts/${postId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      await this.handleResponse<{}>(response);
      printLog(`Successfully deleted scheduled post: ${postId}`);
    } catch (error) {
      printLog(`Error deleting scheduled post ${postId}: ${error}`);
      throw error;
    }
  }

  /**
   * Retry a failed post
   */
  static async retryScheduledPost(postId: string): Promise<ScheduledPost> {
    try {
      printLog(`Retrying scheduled post: ${postId}`);
      
      const response = await fetch(`${API_URL}/api/social/posts/${postId}/retry`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse<{ post: ScheduledPost }>(response);
      printLog(`Successfully retried scheduled post: ${postId}`);
      
      return data.post;
    } catch (error) {
      printLog(`Error retrying scheduled post ${postId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get statistics about scheduled posts
   */
  static async getStats(): Promise<ScheduledPostStats> {
    try {
      printLog('Fetching scheduled posts statistics');
      
      const response = await fetch(`${API_URL}/api/social/stats`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse<ScheduledPostStats>(response);
      printLog('Successfully fetched scheduled posts statistics');
      
      return data;
    } catch (error) {
      printLog(`Error fetching scheduled posts statistics: ${error}`);
      throw error;
    }
  }

  /**
   * Get posts scheduled for a specific date range (useful for calendar view)
   */
  static async getPostsForDateRange(startDate: Date, endDate: Date, platforms?: ('twitter' | 'nostr')[]): Promise<ScheduledPost[]> {
    try {
      const query: ScheduledPostsQuery = {
        limit: 1000, // Get all posts in range
        sortBy: 'scheduledFor',
        sortOrder: 'desc'
      };

      const response = await this.getScheduledPosts(query);
      
      // Filter by date range on the client side for now
      // In production, you might want to add date range parameters to the API
      const filtered = response.posts.filter(post => {
        const postDate = new Date(post.scheduledFor);
        const isInRange = postDate >= startDate && postDate <= endDate;
        const isPlatformMatch = !platforms || platforms.includes(post.platform);
        return isInRange && isPlatformMatch;
      });

      printLog(`Found ${filtered.length} posts in date range ${startDate.toISOString()} - ${endDate.toISOString()}`);
      return filtered;
    } catch (error) {
      printLog(`Error fetching posts for date range: ${error}`);
      throw error;
    }
  }

  /**
   * Sign and promote an unsigned Nostr post to scheduled status
   */
  static async signAndPromotePost(
    postId: string, 
    signedEvent: any, 
    newScheduledDate?: Date,
    originalPost?: ScheduledPost
  ): Promise<ScheduledPost> {
    try {
      // CACHE BUST 12345 - NEW CODE RUNNING
      printLog(`🔥🔥🔥 signAndPromotePost CALLED - POST ID: ${postId} 🔥🔥🔥`);
      printLog(`🔥🔥🔥 SIGNED EVENT CONTENT: "${signedEvent.content}" 🔥🔥🔥`);
      
      printLog(`=== signAndPromotePost DEBUG START ===`);
      printLog(`Post ID: ${postId}`);
      printLog(`Signed event received:`, JSON.stringify(signedEvent, null, 2));
      printLog(`New scheduled date: ${newScheduledDate?.toISOString()}`);
      
      // Create Primal URL using proper bech32 encoding (shared utility)
      const primalUrl = generatePrimalUrl(signedEvent.id);
      printLog(`Generated Primal URL: ${primalUrl}`);
      
      // 4. Submit that in the PUT request as the "text" argument
      const completeText = signedEvent.content;
      
      const requestBody: any = {
        text: completeText, // Complete content with media URL that was signed
        platformData: {
          nostrEventId: signedEvent.id,
          nostrSignature: signedEvent.sig,
          nostrPubkey: signedEvent.pubkey,
          nostrCreatedAt: signedEvent.created_at,
          nostrRelays: relayPool,
          nostrPostUrl: primalUrl,
          signedEvent: signedEvent // Include complete signed event for backend validation
        }
      };

      // FORCE DEBUG: Log every single field
      printLog(`=== REQUEST BODY CONSTRUCTION DEBUG ===`);
      printLog(`signedEvent.content: "${signedEvent.content}"`);
      printLog(`requestBody.text: "${requestBody.text}"`);
      printLog(`=== END REQUEST BODY CONSTRUCTION DEBUG ===`);

      if (newScheduledDate) {
        requestBody.newScheduledDate = newScheduledDate.toISOString();
        requestBody.timezone = "America/Chicago";
      }

      printLog(`Making PUT request to ${API_URL}/api/social/posts/${postId}`);
      printLog(`CRITICAL: Updated text content being sent: "${signedEvent.content}"`);
      printLog(`🚨 CRITICAL DEBUG - TEXT FIELD: ${requestBody.text}`);

      const response = await fetch(`${API_URL}/api/social/posts/${postId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      printLog(`Response status: ${response.status}`);

      const data = await this.handleResponse<{ post: ScheduledPost }>(response);
      printLog(`Successfully signed and promoted post: ${postId}`);
      printLog(`=== signAndPromotePost DEBUG END ===`);
      
      return data.post;
    } catch (error) {
      printLog(`Error signing and promoting post ${postId}: ${error}`);
      throw error;
    }
  }

  /**
   * Batch sign and promote multiple unsigned Nostr posts
   */
  static async batchSignAndPromotePosts(
    postsData: Array<{
      postId: string;
      signedEvent: any;
      newScheduledDate?: Date;
    }>
  ): Promise<{
    success: boolean;
    message: string;
    totalPosts: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      success: boolean;
      postId: string;
      message: string;
      eventId?: string;
      primalUrl?: string;
    }>;
  }> {
    try {
      printLog(`Batch signing ${postsData.length} posts`);
      
      const requestBody = {
        posts: postsData.map(({ postId, signedEvent, newScheduledDate }) => {
          const primalUrl = generatePrimalUrl(signedEvent.id);
          
          return {
            postId,
            platformData: {
              nostrEventId: signedEvent.id,
              nostrSignature: signedEvent.sig,
              nostrPubkey: signedEvent.pubkey,
              nostrCreatedAt: signedEvent.created_at,
              nostrRelays: relayPool,
              nostrPostUrl: primalUrl
            },
            ...(newScheduledDate && {
              newScheduledDate: newScheduledDate.toISOString(),
              timezone: "America/Chicago"
            })
          };
        })
      };

      const response = await fetch(`${API_URL}/api/social/posts/batch-sign`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = await this.handleResponse<{
        success: boolean;
        message: string;
        totalPosts: number;
        successCount: number;
        failureCount: number;
        results: Array<{
          success: boolean;
          postId: string;
          message: string;
          eventId?: string;
          primalUrl?: string;
        }>;
      }>(response);
      
      printLog(`Batch signing completed: ${data.successCount}/${data.totalPosts} successful`);
      return data;
    } catch (error) {
      printLog(`Error in batch signing: ${error}`);
      throw error;
    }
  }
}

export default ScheduledPostService;



// Cache bust 1757717498

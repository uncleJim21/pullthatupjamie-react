// Interface for podcast feed item
export interface PodcastFeed {
  id: number;
  title: string;
  author: string;
  description: string;
  image: string;
  ownerName: string;
  url: string;
}

// Interface for search response
export interface SearchFeedsResponse {
  status: string;  // Will be "true" or "false" as a string
  feeds: PodcastFeed[];
}

// Default API endpoint
const API_URL = 'https://rss-extractor-app-yufbq.ondigitalocean.app';

/**
 * Service for handling RSS/podcast feed operations
 */
class RssService {
  private token: string = '';
  
  /**
   * Set the authentication token
   * @param token JWT token for authentication
   */
  setToken(token: string) {
    this.token = token;
  }
  
  /**
   * Get the current token
   */
  getToken(): string {
    return this.token;
  }

  /**
   * Search for podcast feeds with the given query
   * @param query Search term to find podcasts
   * @returns Promise with search results
   */
  async searchFeeds(query: string): Promise<SearchFeedsResponse> {
    try {
      const response = await fetch(`${API_URL}/searchFeeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer: ${this.token}`,
        },
        body: JSON.stringify({ podcastName: query }),
      });
      
      if (!response.ok) {
        throw new Error(`Error searching feeds: ${response.status}`);
      }
      
      const data: SearchFeedsResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to search feeds:', error);
      // Return empty result on error
      return { status: 'false', feeds: [] };
    }
  }
  
  /**
   * Get detailed information for a specific podcast feed
   * @param feedId ID of the podcast feed to fetch
   * @returns Promise with feed details
   */
  async getFeedDetails(feedId: number): Promise<PodcastFeed | null> {
    try {
      const response = await fetch(`${API_URL}/getFeed/${feedId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer: ${this.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching feed details: ${response.status}`);
      }
      
      const data = await response.json();
      return data.feed;
    } catch (error) {
      console.error('Failed to get feed details:', error);
      return null;
    }
  }
}

// Create and export a singleton instance
const rssService = new RssService();
export default rssService; 
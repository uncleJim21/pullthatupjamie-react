// Interface for podcast feed item
export interface PodcastFeed {
  id: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  author?: string;
  ownerName?: string;
  ownerEmail?: string;
  language?: string;
  explicit?: boolean;
  categories?: string[];
  totalEpisodes?: number;
}

// Interface for podcast episode
export interface PodcastEpisode {
  episodeGUID: string;
  itemTitle: string;
  itemLink: string;
  publishedDate: number;
  length: number; // duration in seconds
  episodeNumber?: number;
  seasonNumber?: number;
  episodeType?: string;
  episodeImage?: string;
  description: string;
  contentEncoded?: string;
  creator?: string;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number;
}

// Interface for feed info details
export interface FeedInfo {
  feedId: number;
  feedGuid: string;
  feedTitle: string;
  feedDescription: string;
  podcastImage: string;
  podcastAuthor: string;
  lastBuildDate: number;
  language: string;
  link: string;
  feedUrl: string;
}

// Response type for getFeed
export interface GetFeedResponse {
  episodes: {
    feedInfo: FeedInfo;
    episodes: PodcastEpisode[];
  };
}

// Response type for searchFeeds
export interface SearchFeedsResponse {
  data: {
    status: string;  // Will be "true" or "false" as a string
    count?: number;
    query?: string;
    description?: string;
    feeds: PodcastFeed[];
  };
}

/**
 * Base URL for the RSS API
 */
const API_URL = 'https://rss-extractor-app-yufbq.ondigitalocean.app';

/**
 * Service for handling RSS/podcast related functions
 */
class RssService {
  /**
   * Search for podcast feeds by query
   * @param query Search term
   * @returns Promise with search results
   */
  async searchFeeds(query: string): Promise<SearchFeedsResponse> {
    try {
      const response = await fetch(`${API_URL}/searchFeeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ podcastName: query })
      });
      
      if (!response.ok) {
        throw new Error(`Error searching feeds: ${response.status}`);
      }
      
      const data: SearchFeedsResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching feeds:', error);
      throw error;
    }
  }
  
  /**
   * Get feed episodes for a podcast
   * @param feedUrl URL of the RSS feed
   * @param feedId ID of the feed
   * @param limit Max number of episodes to retrieve
   * @returns Promise with feed details and episodes
   */
  async getFeed(feedUrl: string, feedId: string, limit: number = 50): Promise<GetFeedResponse> {
    try {
      const response = await fetch(`${API_URL}/getFeed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedUrl,
          feedId,
          limit
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error getting feed: ${response.status}`);
      }
      
      const data: GetFeedResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting feed:', error);
      throw error;
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
          'Content-Type': 'application/json'
        }
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

const rssService = new RssService();
export default rssService; 
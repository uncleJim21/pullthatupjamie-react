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

// Interface for RSS video items
export interface RssVideoItem {
  title: string;
  videoUrl: string;
  publishedDate?: string;
  description?: string;
  episodeGuid?: string;
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
   * @param skipCleanGuid Whether to preserve original GUID format
   * @returns Promise with feed details and episodes
   */
  async getFeed(feedUrl: string, feedId: string, limit: number = 50, skipCleanGuid: boolean = true): Promise<GetFeedResponse> {
    try {
      const response = await fetch(`${API_URL}/getFeed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedUrl,
          feedId,
          limit,
          skipCleanGuid
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

  /**
   * Extract video URLs from RSS feed using Podcasting 2.0 namespace
   * Looks for <podcast:alternateEnclosure> elements with video/mpegURL types
   * and extracts <podcast:source uri="..."> URLs
   * 
   * @param feedUrl URL of the RSS feed (defaults to TFTC feed)
   * @returns Promise with array of video items
   * 
   * TODO: Make feedUrl dynamic based on user's podcast feed
   */
  async getVideoUrlsFromFeed(feedUrl: string = "https://feeds.fountain.fm/ZwwaDULvAj0yZvJ5kdB9"): Promise<RssVideoItem[]> {
    try {
      // Fetch the RSS feed XML
      const response = await fetch(feedUrl);
      
      if (!response.ok) {
        throw new Error(`Error fetching RSS feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const results: RssVideoItem[] = [];
      
      // Get all <item> elements
      const items = xmlDoc.querySelectorAll('channel > item');
      
      items.forEach((item) => {
        // Get title
        const titleEl = item.querySelector('title');
        const title = titleEl?.textContent || 'Unknown Title';
        
        // Get published date
        const pubDateEl = item.querySelector('pubDate');
        const publishedDate = pubDateEl?.textContent || undefined;
        
        // Get description
        const descriptionEl = item.querySelector('description');
        const description = descriptionEl?.textContent || undefined;
        
        // Get GUID
        const guidEl = item.querySelector('guid');
        const episodeGuid = guidEl?.textContent || undefined;
        
        // Find all <podcast:alternateEnclosure> elements
        // Need to handle namespace properly
        const alternateEnclosures = item.querySelectorAll('alternateEnclosure');
        
        alternateEnclosures.forEach((alt) => {
          const altType = alt.getAttribute('type') || '';
          
          // Check if it's a video type (HLS/mpegURL or video)
          if (altType.includes('mpegURL') || altType.includes('video')) {
            // Find <podcast:source uri="...">
            const sources = alt.querySelectorAll('source');
            
            sources.forEach((src) => {
              const url = src.getAttribute('uri');
              if (url) {
                results.push({
                  title,
                  videoUrl: url,
                  publishedDate,
                  description,
                  episodeGuid
                });
              }
            });
          }
        });
      });
      
      return results;
    } catch (error) {
      console.error('Error extracting video URLs from feed:', error);
      throw error;
    }
  }
}

const rssService = new RssService();
export default rssService; 
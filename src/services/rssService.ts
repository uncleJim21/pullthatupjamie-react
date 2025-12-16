import { TFTC_FEED_URL } from '../constants/constants.ts';

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
  audioUrl?: string; // The audio/mpeg enclosure URL (for clip editing)
  publishedDate?: string;
  description?: string;
  episodeGuid?: string;
  thumbnailUrl?: string; // Episode thumbnail/cover art
}

// Helper function for logging (imported from constants if available)
const debugLog = (message: string) => {
  if (typeof console !== 'undefined') {
    console.log(message);
  }
};

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
   * Extract video URLs from RSS feed using Podcasting 2.0 namespace
   * Looks for <podcast:alternateEnclosure> elements with video/mpegURL types
   * and extracts <podcast:source uri="..."> URLs
   * 
   * Deduplicates by episode title - only returns one video per unique title
   * 
   * @param feedUrl URL of the RSS feed (defaults to TFTC feed)
   * @returns Promise with array of video items (deduplicated by title)
   * 
   * TODO: Make feedUrl dynamic based on user's podcast feed
   */
  async getVideoUrlsFromFeed(feedUrl: string = TFTC_FEED_URL): Promise<RssVideoItem[]> {
    try {
      // Fetch the RSS feed XML - cache: 'no-store' prevents caching without triggering CORS preflight
      const response = await fetch(feedUrl, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching RSS feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const allVideos: RssVideoItem[] = [];
      
      // Get all <item> elements
      const items = xmlDoc.querySelectorAll('channel > item');
      console.log(`[RSS Service] Found ${items.length} items in RSS feed`);
      
      items.forEach((item) => {
        // Get title
        const titleEl = item.querySelector('title');
        const title = titleEl?.textContent || 'Unknown Title';
        
        // Get GUID
        const guidEl = item.querySelector('guid');
        const episodeGuid = guidEl?.textContent || undefined;
        
        // Get published date
        const pubDateEl = item.querySelector('pubDate');
        const publishedDate = pubDateEl?.textContent || undefined;
        
        // Get description
        const descriptionEl = item.querySelector('description');
        const description = descriptionEl?.textContent || undefined;
        
        // Get thumbnail/cover art (try both with and without namespace)
        console.log(`[RSS Service] Looking for thumbnail in item: "${title.substring(0, 30)}..."`);
        
        let itunesImageEl: Element | null = item.querySelector('image');
        console.log(`[RSS Service] querySelector('image') result:`, itunesImageEl);
        
        if (!itunesImageEl) {
          // Try without namespace - querySelector doesn't handle namespaces well
          const images = item.getElementsByTagName('itunes:image');
          console.log(`[RSS Service] getElementsByTagName('itunes:image') found ${images.length} images`);
          if (images.length > 0) {
            itunesImageEl = images[0];
            console.log(`[RSS Service] Using first itunes:image element:`, itunesImageEl);
          }
        }
        
        const thumbnailUrl = itunesImageEl?.getAttribute('href') || undefined;
        console.log(`[RSS Service] ===== Thumbnail URL for "${title.substring(0, 30)}...": ${thumbnailUrl || 'NOT FOUND'} =====`);
        
        // Get audio URL from <enclosure> tag (for clip editing)
        const enclosureEl = item.querySelector('enclosure[type="audio/mpeg"]');
        const audioUrl = enclosureEl?.getAttribute('url') || undefined;
        console.log(`[RSS Service] Audio URL for "${title.substring(0, 30)}...": ${audioUrl || 'NOT FOUND'}`);
        
        // Find all video sources for this item
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
                allVideos.push({
                  title,
                  videoUrl: url,
                  audioUrl,
                  publishedDate,
                  description,
                  episodeGuid,
                  thumbnailUrl
                });
              }
            });
          }
        });
      });
      
      console.log(`[RSS Service] Found ${allVideos.length} total video sources before deduplication`);
      
      // Deduplicate using a simple filter approach
      const seen = new Set<string>();
      const uniqueVideos = allVideos.filter((video) => {
        const titleKey = video.title.substring(0, 20);
        
        if (seen.has(titleKey)) {
          console.log(`[RSS Service] FILTERING OUT duplicate: "${video.title}" (key: "${titleKey}")`);
          return false;
        }
        
        console.log(`[RSS Service] KEEPING unique: "${video.title}" (key: "${titleKey}")`);
        seen.add(titleKey);
        return true;
      });
      
      console.log(`[RSS Service] ===== DEDUPLICATION COMPLETE =====`);
      console.log(`[RSS Service] Started with ${allVideos.length} videos`);
      console.log(`[RSS Service] Returning ${uniqueVideos.length} unique episodes`);
      console.log(`[RSS Service] Removed ${allVideos.length - uniqueVideos.length} duplicates`);
      
      return uniqueVideos;
    } catch (error) {
      console.error('Error extracting video URLs from feed:', error);
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

}

const rssService = new RssService();
export default rssService; 
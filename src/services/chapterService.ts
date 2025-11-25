import { API_URL, printLog } from '../constants/constants.ts';

export interface ChapterMetadata {
  headline: string;
  summary?: string;
  keywords: string[];
  startTime: number;
  endTime: number;
  duration: number;
  chapterNumber: number;
  [key: string]: any;
}

export interface Chapter {
  id: string;
  metadata: ChapterMetadata;
  chapterNumber: number;
  headline: string;
  startTime: number;
  endTime: number;
}

export interface EpisodeMetadata {
  title: string;
  description?: string;
  audioUrl?: string;
  duration?: number;
  feedId?: string;
  imageUrl?: string;
  [key: string]: any;
}

export interface Episode {
  id: string;
  guid: string;
  metadata: EpisodeMetadata;
}

export interface EpisodeWithChaptersResponse {
  success: boolean;
  guid: string;
  episode: Episode;
  chapters: Chapter[];
  chapterCount: number;
}

interface CachedEpisodeChapters {
  episodeId: string;
  lastUpdated: number;
  chapters: Chapter[];
  episode: Episode;
  chapterCount: number;
}

const CACHE_KEY_PREFIX = 'episode_chapters_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

class ChapterService {
  private getCacheKey(episodeId: string): string {
    return `${CACHE_KEY_PREFIX}${episodeId}`;
  }

  private getCachedData(episodeId: string): CachedEpisodeChapters | null {
    try {
      const cacheKey = this.getCacheKey(episodeId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data: CachedEpisodeChapters = JSON.parse(cached);
      
      // Check if cache is expired
      const now = Date.now();
      if (now - data.lastUpdated > CACHE_EXPIRY_MS) {
        printLog(`Cache expired for episode ${episodeId}`);
        localStorage.removeItem(cacheKey);
        return null;
      }

      printLog(`Cache hit for episode ${episodeId}`);
      return data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  private setCachedData(episodeId: string, response: EpisodeWithChaptersResponse): void {
    try {
      const cacheKey = this.getCacheKey(episodeId);
      const data: CachedEpisodeChapters = {
        episodeId,
        lastUpdated: Date.now(),
        chapters: response.chapters,
        episode: response.episode,
        chapterCount: response.chapterCount
      };

      localStorage.setItem(cacheKey, JSON.stringify(data));
      printLog(`Cached data for episode ${episodeId}`);
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  async fetchEpisodeWithChapters(episodeGuid: string): Promise<EpisodeWithChaptersResponse> {
    printLog(`ChapterService: Fetching episode with chapters for ${episodeGuid}`);

    // Check cache first
    const cached = this.getCachedData(episodeGuid);
    if (cached) {
      return {
        success: true,
        guid: episodeGuid,
        episode: cached.episode,
        chapters: cached.chapters,
        chapterCount: cached.chapterCount
      };
    }

    // Fetch from API
    try {
      const response = await fetch(`${API_URL}/api/episode-with-chapters/${episodeGuid}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch episode chapters: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data: EpisodeWithChaptersResponse = await response.json();
      printLog(`ChapterService: Fetched ${data.chapterCount} chapters for ${episodeGuid}`);

      // Cache the result
      this.setCachedData(episodeGuid, data);

      return data;
    } catch (error) {
      printLog(`ChapterService: Error fetching episode chapters for ${episodeGuid}: ${error}`);
      throw error;
    }
  }

  clearCache(episodeId?: string): void {
    if (episodeId) {
      localStorage.removeItem(this.getCacheKey(episodeId));
      printLog(`Cleared cache for episode ${episodeId}`);
    } else {
      // Clear all episode chapter caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      printLog('Cleared all episode chapter caches');
    }
  }
}

export default new ChapterService();


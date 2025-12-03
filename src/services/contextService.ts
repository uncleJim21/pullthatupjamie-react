import { API_URL, printLog } from '../constants/constants.ts';

export interface AdjacentParagraph {
  id: string;
  metadata: {
    audioUrl: string;
    creator: string;
    end_time: number;
    episode: string;
    episodeImage: string;
    feedId: number;
    guid: string;
    listenLink: string;
    num_words: number;
    sequence: number;
    start_time: number;
    text: string;
    type: string;
  };
  text: string;
  start_time: number;
  end_time: number;
  episode: string;
  creator: string;
}

export interface AdjacentParagraphsResponse {
  requestedId: string;
  adjacentSteps: number;
  range: {
    start: number;
    end: number;
  };
  paragraphs: AdjacentParagraph[];
  found: number;
  missing: string[];
  totalRequested: number;
}

export interface ChapterMetadata {
  chapterNumber: number;
  headline: string;
  summary: string;
  startTime: number;
  endTime: number;
  duration: number;
  keywords: string[];
  paragraphCount: number;
  wordCount: number;
  totalChapterCount: number;
  model: string;
  processingMethod: string;
  episodeTitle: string;
  feedTitle: string;
  guid: string;
  feedId: number;
  type: string;
}

export interface EpisodeMetadata {
  title: string;
  description: string;
  creator: string;
  duration: number;
  audioUrl: string;
  imageUrl: string;
  publishedDate: string;
  publishedTimestamp: number;
  guests: string[];
  episodeNumber: string;
  guid: string;
  feedId: string;
  type: string;
}

export interface FeedMetadata {
  title: string;
  author: string;
  description: string;
  feedUrl: string;
  imageUrl: string;
  podcastGuid: string;
  episodeCount: number;
  language: string;
  explicit: boolean;
  lastUpdateTime: number;
  feedId: string;
  type: string;
}

export interface HierarchyResponse {
  paragraphId: string | null;
  hierarchy: {
    paragraph: {
      id: string;
      metadata: AdjacentParagraph['metadata'];
    } | null;
    chapter: {
      id: string;
      metadata: ChapterMetadata;
    } | null;
    episode: {
      id: string;
      metadata: EpisodeMetadata;
    } | null;
    feed: {
      id: string;
      metadata: FeedMetadata;
    } | null;
  };
  path: string;
}

class ContextService {
  /**
   * Fetch adjacent paragraphs surrounding a given paragraph ID
   * @param paragraphId - The paragraph ID (e.g., "guid_p24")
   * @param adjacentSteps - Number of paragraphs before and after (default: 3)
   */
  async fetchAdjacentParagraphs(
    paragraphId: string,
    adjacentSteps: number = 3
  ): Promise<AdjacentParagraphsResponse> {
    try {
      const url = `${API_URL}/api/fetch-adjacent-paragraphs?paragraphId=${encodeURIComponent(paragraphId)}&adjacentSteps=${adjacentSteps}`;
      console.log(`[ContextService] Fetching adjacent paragraphs from: ${url}`);
      printLog(`Fetching adjacent paragraphs: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`[ContextService] Response status: ${response.status}`);
      printLog(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        console.error(`[ContextService] Error response:`, errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[ContextService] Fetched ${data.found} adjacent paragraphs`);
      printLog(`Fetched ${data.found} adjacent paragraphs`);
      return data;
    } catch (error) {
      console.error('[ContextService] Error fetching adjacent paragraphs:', error);
      throw error;
    }
  }

  /**
   * Fetch the complete hierarchy (feed > episode > chapter > paragraph)
   * starting from a paragraphId.
   */
  async fetchHierarchyByParagraph(paragraphId: string): Promise<HierarchyResponse> {
    try {
      const url = `${API_URL}/api/get-hierarchy?paragraphId=${encodeURIComponent(paragraphId)}`;
      console.log(`[ContextService] Fetching hierarchy (paragraph) from: ${url}`);
      printLog(`Fetching hierarchy (paragraph): ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`[ContextService] Hierarchy (paragraph) response status: ${response.status}`);
      printLog(`Hierarchy (paragraph) response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        console.error(`[ContextService] Hierarchy (paragraph) error response:`, errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[ContextService] Fetched hierarchy (paragraph):`, data.path);
      printLog(`Fetched hierarchy (paragraph): ${data.path}`);
      return data;
    } catch (error) {
      console.error('[ContextService] Error fetching hierarchy (paragraph):', error);
      throw error;
    }
  }

  /**
   * Fetch the complete hierarchy (feed > episode > chapter) starting
   * from a chapterId (no specific paragraph context).
   */
  async fetchHierarchyByChapter(chapterId: string): Promise<HierarchyResponse> {
    try {
      const url = `${API_URL}/api/get-hierarchy?chapterId=${encodeURIComponent(chapterId)}`;
      console.log(`[ContextService] Fetching hierarchy (chapter) from: ${url}`);
      printLog(`Fetching hierarchy (chapter): ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`[ContextService] Hierarchy (chapter) response status: ${response.status}`);
      printLog(`Hierarchy (chapter) response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        console.error(`[ContextService] Hierarchy (chapter) error response:`, errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[ContextService] Fetched hierarchy (chapter):`, data.path);
      printLog(`Fetched hierarchy (chapter): ${data.path}`);
      return data;
    } catch (error) {
      console.error('[ContextService] Error fetching hierarchy (chapter):', error);
      throw error;
    }
  }
}

export default new ContextService();


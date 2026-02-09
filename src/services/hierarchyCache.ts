/**
 * HierarchyCache - Caches hierarchy data for instant navigation between search results.
 * 
 * Usage:
 * - Import and use `HierarchyCache.getHierarchy(paragraphId)` instead of ContextService directly
 * - Call `HierarchyCache.prefetchHierarchies(ids)` to pre-warm cache for adjacent results
 * - Call `HierarchyCache.clearCache()` when a new search is performed
 */

import ContextService, { HierarchyResponse, AdjacentParagraphsResponse } from './contextService.ts';
import { printLog } from '../constants/constants.ts';

class HierarchyCacheService {
  private hierarchyCache = new Map<string, HierarchyResponse>();
  private adjacentCache = new Map<string, AdjacentParagraphsResponse>();
  private pendingHierarchyFetches = new Map<string, Promise<HierarchyResponse>>();
  private pendingAdjacentFetches = new Map<string, Promise<AdjacentParagraphsResponse>>();

  /**
   * Get hierarchy data for a paragraph, using cache when available.
   */
  async getHierarchy(paragraphId: string): Promise<HierarchyResponse> {
    // Return from cache if available
    const cached = this.hierarchyCache.get(paragraphId);
    if (cached) {
      printLog(`[HierarchyCache] Cache HIT for hierarchy: ${paragraphId}`);
      return cached;
    }

    // Check if there's already a pending fetch (deduplication)
    const pending = this.pendingHierarchyFetches.get(paragraphId);
    if (pending) {
      printLog(`[HierarchyCache] Waiting for pending hierarchy fetch: ${paragraphId}`);
      return pending;
    }

    // Fetch and cache
    printLog(`[HierarchyCache] Cache MISS for hierarchy: ${paragraphId}, fetching...`);
    const fetchPromise = ContextService.fetchHierarchyByParagraph(paragraphId)
      .then(data => {
        this.hierarchyCache.set(paragraphId, data);
        this.pendingHierarchyFetches.delete(paragraphId);
        printLog(`[HierarchyCache] Cached hierarchy for: ${paragraphId}`);
        return data;
      })
      .catch(err => {
        this.pendingHierarchyFetches.delete(paragraphId);
        throw err;
      });

    this.pendingHierarchyFetches.set(paragraphId, fetchPromise);
    return fetchPromise;
  }

  /**
   * Get adjacent paragraphs, using cache when available.
   */
  async getAdjacentParagraphs(
    paragraphId: string,
    adjacentSteps: number = 3
  ): Promise<AdjacentParagraphsResponse> {
    const cacheKey = `${paragraphId}:${adjacentSteps}`;
    
    // Return from cache if available
    const cached = this.adjacentCache.get(cacheKey);
    if (cached) {
      printLog(`[HierarchyCache] Cache HIT for adjacent: ${cacheKey}`);
      return cached;
    }

    // Check if there's already a pending fetch
    const pending = this.pendingAdjacentFetches.get(cacheKey);
    if (pending) {
      printLog(`[HierarchyCache] Waiting for pending adjacent fetch: ${cacheKey}`);
      return pending;
    }

    // Fetch and cache
    printLog(`[HierarchyCache] Cache MISS for adjacent: ${cacheKey}, fetching...`);
    const fetchPromise = ContextService.fetchAdjacentParagraphs(paragraphId, adjacentSteps)
      .then(data => {
        this.adjacentCache.set(cacheKey, data);
        this.pendingAdjacentFetches.delete(cacheKey);
        printLog(`[HierarchyCache] Cached adjacent for: ${cacheKey}`);
        return data;
      })
      .catch(err => {
        this.pendingAdjacentFetches.delete(cacheKey);
        throw err;
      });

    this.pendingAdjacentFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Pre-fetch hierarchy data for multiple paragraphs in the background.
   * Errors are silently ignored (it's just a cache warm-up).
   */
  prefetchHierarchies(paragraphIds: string[]): void {
    const toPrefetch = paragraphIds.filter(
      id => !this.hierarchyCache.has(id) && !this.pendingHierarchyFetches.has(id)
    );

    if (toPrefetch.length === 0) return;

    printLog(`[HierarchyCache] Prefetching ${toPrefetch.length} hierarchies`);
    
    for (const id of toPrefetch) {
      this.getHierarchy(id).catch(() => {
        // Silently ignore prefetch errors - it's just a cache warm-up
      });
    }
  }

  /**
   * Pre-fetch adjacent paragraphs for multiple paragraph IDs in the background.
   */
  prefetchAdjacentParagraphs(paragraphIds: string[], adjacentSteps: number = 3): void {
    for (const id of paragraphIds) {
      const cacheKey = `${id}:${adjacentSteps}`;
      if (!this.adjacentCache.has(cacheKey) && !this.pendingAdjacentFetches.has(cacheKey)) {
        this.getAdjacentParagraphs(id, adjacentSteps).catch(() => {
          // Silently ignore prefetch errors
        });
      }
    }
  }

  /**
   * Clear all cached data. Call this when a new search is performed.
   */
  clearCache(): void {
    const hierarchyCount = this.hierarchyCache.size;
    const adjacentCount = this.adjacentCache.size;
    
    this.hierarchyCache.clear();
    this.adjacentCache.clear();
    // Note: Don't clear pending fetches - let them complete to avoid wasted requests
    
    printLog(`[HierarchyCache] Cache cleared (${hierarchyCount} hierarchies, ${adjacentCount} adjacent)`);
  }

  /**
   * Check if a hierarchy is already cached.
   */
  hasHierarchy(paragraphId: string): boolean {
    return this.hierarchyCache.has(paragraphId);
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): { hierarchies: number; adjacent: number; pendingHierarchies: number; pendingAdjacent: number } {
    return {
      hierarchies: this.hierarchyCache.size,
      adjacent: this.adjacentCache.size,
      pendingHierarchies: this.pendingHierarchyFetches.size,
      pendingAdjacent: this.pendingAdjacentFetches.size,
    };
  }
}

const HierarchyCache = new HierarchyCacheService();
export default HierarchyCache;

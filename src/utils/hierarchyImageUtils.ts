/**
 * Utility functions for consistently extracting images from hierarchical data structures.
 * 
 * The podcast data hierarchy has different field names for images at each level:
 * - Paragraph: metadata.episodeImage
 * - Chapter: (no direct image, inherits from episode)
 * - Episode: metadata.imageUrl
 * - Feed: metadata.imageUrl
 * 
 * This utility provides a consistent interface for extracting the appropriate image
 * regardless of the hierarchy level or data source.
 */

import type { HierarchyResponse, AdjacentParagraph } from '../services/contextService';
import type { ResearchSessionItem } from '../services/researchSessionService';

/**
 * Generic type for objects that might have various image field names
 */
type ImageSource = 
  | { episodeImage?: string }
  | { imageUrl?: string }
  | { podcastImage?: string }
  | { episode_image?: string }
  | { tooltipImage?: string };

/**
 * Extract image URL from any hierarchical object, checking all possible field names.
 * Returns the first non-empty image URL found, or undefined if none exist.
 */
export function extractImageFromAny(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  // Check all possible image field names in order of preference
  const imageFields = [
    'tooltipImage',      // Explicit tooltip override (highest priority)
    'episodeImage',      // Common in paragraph/search results
    'imageUrl',          // Common in episode/feed metadata
    'episode_image',     // Backend API format
    'podcastImage',      // Alternative naming
    'image',             // Generic fallback
  ];

  for (const field of imageFields) {
    const value = obj[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * Get image URL from a full hierarchy response, prioritizing from most specific
 * to least specific level (paragraph > episode > feed).
 */
export function getImageFromHierarchy(hierarchy: HierarchyResponse | null): string | undefined {
  if (!hierarchy?.hierarchy) {
    return undefined;
  }

  const { paragraph, episode, feed } = hierarchy.hierarchy;

  // 1. Try paragraph metadata first (most specific)
  if (paragraph?.metadata) {
    const paragraphImage = extractImageFromAny(paragraph.metadata);
    if (paragraphImage) return paragraphImage;
  }

  // 2. Try episode metadata
  if (episode?.metadata) {
    const episodeImage = extractImageFromAny(episode.metadata);
    if (episodeImage) return episodeImage;
  }

  // 3. Fall back to feed metadata (least specific)
  if (feed?.metadata) {
    const feedImage = extractImageFromAny(feed.metadata);
    if (feedImage) return feedImage;
  }

  return undefined;
}

/**
 * Get image URL from a paragraph object (either standalone or from hierarchy).
 */
export function getImageFromParagraph(paragraph: AdjacentParagraph | null | undefined): string | undefined {
  if (!paragraph) {
    return undefined;
  }

  // Check both the top-level and metadata fields
  return extractImageFromAny(paragraph) || extractImageFromAny(paragraph.metadata);
}

/**
 * Get image URL from a research session item.
 */
export function getImageFromResearchItem(item: ResearchSessionItem | null | undefined): string | undefined {
  if (!item) {
    return undefined;
  }

  return extractImageFromAny(item);
}

/**
 * Get image URL from any hierarchical object with fallback chain.
 * This is the main convenience function that handles most use cases.
 * 
 * @param primary - The primary object to check for images
 * @param fallback - Optional fallback object if primary has no image
 * @returns Image URL or undefined
 */
export function getHierarchyImage(primary: any, fallback?: any): string | undefined {
  const primaryImage = extractImageFromAny(primary);
  if (primaryImage) {
    return primaryImage;
  }

  if (fallback) {
    return extractImageFromAny(fallback);
  }

  return undefined;
}

/**
 * Normalize research session item to ensure it has a proper episodeImage field.
 * This mutates the item to add episodeImage if it's missing but can be derived.
 */
export function normalizeResearchItemImage(item: ResearchSessionItem): ResearchSessionItem {
  if (!item.episodeImage) {
    item.episodeImage = extractImageFromAny(item);
  }
  return item;
}

/**
 * Get image for a specific hierarchy level from search results or API data.
 * Handles the different field names used at different levels.
 */
export function getImageForHierarchyLevel(
  data: any,
  level: 'feed' | 'episode' | 'chapter' | 'paragraph'
): string | undefined {
  if (!data) return undefined;

  switch (level) {
    case 'paragraph':
      // Paragraphs typically reference episode image
      return extractImageFromAny(data);

    case 'chapter':
      // Chapters don't have their own images, inherit from episode
      return extractImageFromAny(data);

    case 'episode':
      // Episodes have imageUrl in metadata
      return extractImageFromAny(data) || extractImageFromAny(data.metadata);

    case 'feed':
      // Feeds have imageUrl in metadata
      return extractImageFromAny(data) || extractImageFromAny(data.metadata);

    default:
      return extractImageFromAny(data);
  }
}

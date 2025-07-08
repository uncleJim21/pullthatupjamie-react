import { FRONTEND_URL, printLog, DEBUG_MODE } from '../constants/constants.ts';

/**
 * DIRECT OVERRIDE: Creates a properly formatted share URL for the application
 * @param path The path component (should start with a slash)
 * @param params Optional URL parameters to append
 * @returns Fully formatted URL using the correct frontend URL base
 */
export const createShareUrl = (path: string, params: Record<string, string> = {}) => {
  // HARD OVERRIDE - Force localhost in dev mode
  // Skip all the FRONTEND_URL logic and enforce localhost during development
  const baseUrlOverride = DEBUG_MODE ? 'http://localhost:3000' : 'https://pullthatupjamie.ai';
  
  // Ensure path starts with a slash
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Ensure /app prefix is included when needed
  if (!normalizedPath.startsWith('/app/')) {
    if (normalizedPath.startsWith('/share')) {
      normalizedPath = `/app${normalizedPath}`;
    } else if (normalizedPath.startsWith('/feed')) {
      normalizedPath = `/app${normalizedPath}`;
    }
  }
  
  // Construct the base URL with our override
  const baseUrl = `${baseUrlOverride}${normalizedPath}`;
  
  // Add URL parameters if any exist
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });
  
  const queryString = queryParams.toString();
  const fullUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
  
  return fullUrl;
};

/**
 * Creates a share URL for a specific clip
 * @param clipId The ID of the clip to share
 * @returns Properly formatted share URL
 */
export const createClipShareUrl = (clipId: string) => {
  // Always use /app/share to ensure correct path formatting
  return createShareUrl('/app/share', { clip: clipId });
};

/**
 * Creates a share URL for a podcast feed
 * @param feedId The ID of the feed to share
 * @returns Properly formatted share URL
 */
export const createFeedShareUrl = (feedId: string) => {
  // Always use /app/feed to ensure correct path formatting
  return createShareUrl(`/app/feed/${feedId}`);
}; 
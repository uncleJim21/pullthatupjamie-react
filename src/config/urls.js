/**
 * Shared URL configuration for both client and server environments
 * Works in both React (browser) and Node.js (Vercel serverless functions)
 */

// Debug mode - set this to false for production
const DEBUG_MODE = true;

/**
 * Get the frontend URL based on environment
 * Uses Vercel's automatic VERCEL_URL when available
 */
function getFrontendUrl() {
  // Force localhost in debug mode
  if (DEBUG_MODE) {
    return 'http://localhost:3000';
  }

  // Server-side (Node.js / Vercel Functions)
  if (typeof window === 'undefined') {

    // Fallback to custom env var or production
    return 'https://pullthatupjamie.ai';
  }

  // Client-side (Browser)
  // In production, use the actual origin
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return window.location.origin;
  }

  // Development fallback
  return 'http://localhost:3000';
}

/**
 * Get the backend API URL
 */
function getBackendUrl() {
  if (DEBUG_MODE) {
    return 'http://localhost:4132';
  }
  
  return 'https://pullthatupjamie-nsh57.ondigitalocean.app';
}

/**
 * Get the auth server URL
 */
function getAuthUrl() {
  if (DEBUG_MODE) {
    return 'http://localhost:6111';
  }
  
  return 'https://cascdr-auth-backend-cw4nk.ondigitalocean.app';
}

// Export for ES6 modules (React)
export const FRONTEND_URL = getFrontendUrl();
export const API_URL = getBackendUrl();
export const AUTH_URL = getAuthUrl();
export { DEBUG_MODE };

// Export for CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FRONTEND_URL: getFrontendUrl(),
    API_URL: getBackendUrl(),
    AUTH_URL: getAuthUrl(),
    DEBUG_MODE
  };
}

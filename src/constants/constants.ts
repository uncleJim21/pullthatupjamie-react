// Import shared URL configuration
import { FRONTEND_URL, API_URL, AUTH_URL, DEBUG_MODE } from '../config/urls.js';
export const DEBUG_TRANSCRIPTION = false;
export { DEBUG_MODE, FRONTEND_URL, API_URL, AUTH_URL };
export const DISABLE_CLIPPING = true; // Set to false to re-enable clipping features
export const DEBUG_AUTH = false;


// Debug output to verify the configuration
console.log('Constants loaded:', { 
  DEBUG_MODE, 
  FRONTEND_URL,
  API_URL,
  currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'not in browser',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'not in browser'
});
export const MONTHLY_PRICE_STRING = "$9.99"

export const printLog = (log:string) =>{
  if(DEBUG_MODE){
    console.log(log)
  }
}

export interface AuthConfig {
  type: RequestAuthMethod;
  credentials: {
    username?: string;
    password?: string;
    preimage?: string;
    paymentHash?: string;
  };
}


export enum NavigationMode {
  STANDARD = 'standard', // Current behavior - show Search Podcasts/Web in header
  CLEAN = 'clean'        // Hide header nav, move to AccountButton dropdown
}

export enum AIClipsViewStyle {
  GRID = 'grid',
  LIST = 'list'
}

export enum SearchViewStyle {
  CLASSIC = 'classic',
  SPLIT_SCREEN = 'split-screen'
}

export enum SearchResultViewStyle {
  LIST = 'list',
  GALAXY = 'galaxy'
}

// Numerical hierarchy levels (higher = broader scope)
export const HIERARCHY_LEVEL_FEED = 3;
export const HIERARCHY_LEVEL_EPISODE = 2;
export const HIERARCHY_LEVEL_CHAPTER = 1;
export const HIERARCHY_LEVEL_PARAGRAPH = 0;

export const HIERARCHY_COLORS = {
  ALL_PODS: '#3366ff',  // deeper blue (more saturated, visible)
  FEED: '#b8cbff',      // medium blue-white (interpolated between ALL_PODS and EPISODE)
  EPISODE: '#ffffff',   // pure white (center anchor)
  CHAPTER: '#f08b47',   // distinct peachy-orange (30% closer to paragraph)
  PARAGRAPH: '#cc4400'  // deep reddish-orange (deepest nebula tone)
};

// Search result limits
export const SEARCH_LIMITS = {
  LIST_VIEW: 20,      // List view limit (2D search)
  GALAXY_VIEW: 100,   // Galaxy view limit (3D search)
};
// Share modal context - defines the source/type of content being shared
export enum ShareModalContext {
  AUDIO_CLIP = 'audio_clip',              // Generated audio clip from podcast search
  CDN_VIDEO_CLIP = 'cdn_video_clip',      // Clip from CDN-hosted video
  CDN_VIDEO_FULL = 'cdn_video_full',      // Full CDN-hosted video
  RSS_VIDEO_CLIP = 'rss_video_clip',      // Clip from RSS feed video
  RSS_VIDEO_FULL = 'rss_video_full',      // Full RSS feed video
  UPLOAD = 'upload',                       // User-uploaded content
  OTHER = 'other'                          // Default/unknown context
}

export enum RequestAuthMethod {
  LIGHTNING = 'lightning',
  SQUARE = 'square',
  FREE = 'free',
  FREE_EXPENDED = 'free-expended',        // means they're in limbo and have to choose
  ADMIN = 'admin'                          // Add admin auth method
}

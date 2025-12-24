export const DEBUG_MODE = false;
export const DEBUG_TRANSCRIPTION = false;

export const DISABLE_CLIPPING = true; // Set to false to re-enable clipping features
export const DEBUG_AUTH = false;

// More explicit approach to determine FRONTEND_URL
export const FRONTEND_URL = (() => {
  // Force localhost in development mode regardless of actual origin
  if (DEBUG_MODE) {
    return 'http://localhost:3000';
  }
  
  // In production, use the actual origin or default to the production URL
  const result = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? 'https://pullthatupjamie.ai' 
    : 'http://localhost:3000';
  
  return result;
})();

// Debug output to verify the configuration
console.log('Constants loaded:', { 
  DEBUG_MODE, 
  FRONTEND_URL,
  currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'not in browser',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'not in browser'
});

export const API_URL = DEBUG_MODE ? "http://localhost:4132" : "https://pullthatupjamie-nsh57.ondigitalocean.app";
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
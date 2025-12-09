export const DEBUG_MODE = false;
export const DISABLE_CLIPPING = true; // Set to false to re-enable clipping features

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

export const API_URL = DEBUG_MODE ? "http://localhost:4132" : "https://pullthatupjamie-explore-alpha-xns9k.ondigitalocean.app";
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

export enum RequestAuthMethod {
  LIGHTNING = 'lightning',
  SQUARE = 'square',
  FREE = 'free',
  FREE_EXPENDED = 'free-expended'//means they're in limbo and have to choose
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
export const DEBUG_MODE = false;

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
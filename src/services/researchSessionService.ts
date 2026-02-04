import { API_URL, printLog } from "../constants/constants.ts";
import { getOrCreateClientId, getCurrentClientId as getClientIdFromUtil } from "../utils/clientId.ts";

const SESSION_ID_KEY = 'research_session_id';
const SESSION_TIMESTAMP_KEY = 'research_session_timestamp';
const SESSION_VERSION_KEY = 'research_session_version'; // For optimistic locking

// Maximum items per research session
export const MAX_RESEARCH_ITEMS = 50;

// Session expiry time in milliseconds (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Types for research session
export interface ResearchSessionItem {
  shareLink: string;
  quote?: string;
  summary?: string;
  headline?: string;
  episode: string;
  creator: string;
  episodeImage?: string;
  date: string;
  hierarchyLevel: 'feed' | 'episode' | 'chapter' | 'paragraph';
  addedAt?: Date; // Optional since it's used by UI but not sent to API
  coordinates3d?: { x: number; y: number; z: number }; // Optional 3D coordinates for galaxy layout
}

// Backend schema types
export interface ResearchSessionItemPayload {
  pineconeId: string;
  metadata: {
    title?: string;
    quote?: string;
    summary?: string;
    headline?: string;
    episode: string;
    creator: string;
    episodeImage?: string;
    date: string;
    hierarchyLevel: string;
  };
}

export interface LastItemMetadata {
  title: string;
  episode: string;
  creator: string;
  publishedDate?: string;
  feedId?: number;
  guid?: string;
  start_time?: number | null;
  end_time?: number | null;
  summary?: string;
  headline?: string;
  episodeImage?: string;
}

export interface ResearchSession {
  id?: string;
  ownerType?: 'user' | 'client';
  userId?: string | null;
  clientId?: string;
  pineconeIds: string[];
  items?: ResearchSessionItemPayload[];
  pineconeIdsCount?: number;
  title?: string | null;
  lastItemMetadata?: LastItemMetadata;
  createdAt?: string;
  updatedAt?: string;
  __v?: number; // MongoDB version number for optimistic locking
}

export interface ResearchSessionResponse {
  success: boolean;
  data?: ResearchSession;
  message?: string;
}


/**
 * Get the current session ID if it exists and is not expired
 */
function getSessionId(): string | null {
  const sessionId = localStorage.getItem(SESSION_ID_KEY);
  const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  
  if (!sessionId || !timestamp) {
    printLog(
      `[ResearchSession] getSessionId(): missing ${!sessionId ? 'sessionId' : ''}${!sessionId && !timestamp ? ' + ' : ''}${!timestamp ? 'timestamp' : ''}`,
    );
    return null;
  }
  
  // Check if session has expired (24 hours)
  const now = Date.now();
  const sessionTime = parseInt(timestamp, 10);
  
  if (now - sessionTime > SESSION_EXPIRY_MS) {
    printLog('[ResearchSession] Research session expired (24h), will clear local session');
    clearSessionId();
    return null;
  }
  
  return sessionId;
}

/**
 * Store the session ID after creation with current timestamp
 */
function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
  printLog(`[ResearchSession] setSessionId(): ${sessionId}`);
}

/**
 * Get the current session version
 */
function getSessionVersion(): number | null {
  const version = localStorage.getItem(SESSION_VERSION_KEY);
  return version ? parseInt(version, 10) : null;
}

/**
 * Store the session version after successful save
 */
function setSessionVersion(version: number): void {
  localStorage.setItem(SESSION_VERSION_KEY, version.toString());
}

/**
 * Clear the session ID (e.g., after clearing all items)
 */
function clearSessionId(): void {
  const prevSessionId = localStorage.getItem(SESSION_ID_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(SESSION_TIMESTAMP_KEY);
  localStorage.removeItem(SESSION_VERSION_KEY);
  printLog(`[ResearchSession] clearSessionId(): prev=${prevSessionId || 'null'}`);
}

/**
 * Build authorization headers
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Convert research session items to pinecone IDs (using shareLink as ID)
 */
function itemsToPineconeIds(items: ResearchSessionItem[]): string[] {
  return items.map(item => item.shareLink);
}

/**
 * Convert research session items to backend item format with metadata
 */
function itemsToPayload(items: ResearchSessionItem[]): ResearchSessionItemPayload[] {
  return items.map(item => ({
    pineconeId: item.shareLink,
    metadata: {
      title: item.headline || item.quote || 'Research Item',
      quote: item.quote,
      summary: item.summary,
      headline: item.headline,
      episode: item.episode,
      creator: item.creator,
      episodeImage: item.episodeImage,
      date: item.date,
      hierarchyLevel: item.hierarchyLevel,
    }
  }));
}

/**
 * Build last item metadata from the most recent item
 */
function buildLastItemMetadata(items: ResearchSessionItem[]): LastItemMetadata | undefined {
  if (items.length === 0) return undefined;
  
  // Get the most recently added item
  const lastItem = items[items.length - 1];
  
  return {
    title: lastItem.headline || lastItem.quote || 'Research Item',
    episode: lastItem.episode,
    creator: lastItem.creator,
    publishedDate: lastItem.date,
    summary: lastItem.summary || lastItem.quote,
    episodeImage: lastItem.episodeImage,
  };
}

/**
 * Build coordinatesById object from items with coordinates
 */
function buildCoordinatesById(items: ResearchSessionItem[]): Record<string, { x: number; y: number; z: number }> | undefined {
  const coordinatesById: Record<string, { x: number; y: number; z: number }> = {};
  let hasCoordinates = false;
  
  items.forEach(item => {
    if (item.coordinates3d) {
      coordinatesById[item.shareLink] = item.coordinates3d;
      hasCoordinates = true;
    }
  });
  
  return hasCoordinates ? coordinatesById : undefined;
}

/**
 * Create a new research session (POST)
 */
export async function createResearchSession(items: ResearchSessionItem[]): Promise<ResearchSessionResponse> {
  const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout
  
  try {
    // Enforce 50 item limit
    if (items.length > MAX_RESEARCH_ITEMS) {
      throw new Error(`Maximum ${MAX_RESEARCH_ITEMS} items allowed per session`);
    }
    
    const clientId = getOrCreateClientId(); // Always send for session migration
    const pineconeIds = itemsToPineconeIds(items);
    const itemsPayload = itemsToPayload(items);
    const lastItemMetadata = buildLastItemMetadata(items);
    const coordinatesById = buildCoordinatesById(items);
    
    const payload: Record<string, unknown> = {
      pineconeIds,
      items: itemsPayload,
      lastItemMetadata,
      clientId, // Always include for migration support
    };
    
    // Add coordinates if available
    if (coordinatesById) {
      payload.coordinatesById = coordinatesById;
    }
    
    printLog(`[ResearchSession] createResearchSession(): POSTing ${items.length} items (pineconeIds: ${pineconeIds.length})`);
    
    // Add timeout to prevent indefinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    try {
      const response = await fetch(`${API_URL}/api/research-sessions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store the session ID and version for future updates
      if (data.success && data.data?.id) {
        printLog(`[ResearchSession] createResearchSession(): received id=${data.data.id}`);
        setSessionId(data.data.id);
        if (typeof data.data.__v === 'number') {
          setSessionVersion(data.data.__v);
        }
      }
      
      return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Create research session error:', error);
    throw error;
  }
}

/**
 * Create a new research session without persisting it as the "current" session in localStorage.
 * Useful for one-off analysis of transient sets (e.g. "current search results").
 */
export async function createEphemeralResearchSession(items: ResearchSessionItem[]): Promise<ResearchSessionResponse> {
  try {
    // Enforce 50 item limit
    if (items.length > MAX_RESEARCH_ITEMS) {
      throw new Error(`Maximum ${MAX_RESEARCH_ITEMS} items allowed per session`);
    }

    const clientId = getOrCreateClientId(); // Always send for session migration
    const pineconeIds = itemsToPineconeIds(items);
    const itemsPayload = itemsToPayload(items);
    const lastItemMetadata = buildLastItemMetadata(items);
    const coordinatesById = buildCoordinatesById(items);

    const payload: Record<string, unknown> = {
      pineconeIds,
      items: itemsPayload,
      lastItemMetadata,
      clientId, // Always include for migration support
    };

    if (coordinatesById) {
      payload.coordinatesById = coordinatesById;
    }

    const response = await fetch(`${API_URL}/api/research-sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data?.id) {
      printLog(`[ResearchSession] createEphemeralResearchSession(): received id=${data.data.id}`);
    }
    return data;
  } catch (error) {
    console.error('Create ephemeral research session error:', error);
    throw error;
  }
}

/**
 * Update an existing research session (PATCH) with optimistic locking
 */
export async function updateResearchSession(
  sessionId: string,
  items: ResearchSessionItem[],
  retryOnConflict = true
): Promise<ResearchSessionResponse> {
  try {
    // Enforce 50 item limit
    if (items.length > MAX_RESEARCH_ITEMS) {
      throw new Error(`Maximum ${MAX_RESEARCH_ITEMS} items allowed per session`);
    }
    
    const clientId = getOrCreateClientId(); // Always send for session migration
    const pineconeIds = itemsToPineconeIds(items);
    const itemsPayload = itemsToPayload(items);
    const lastItemMetadata = buildLastItemMetadata(items);
    const coordinatesById = buildCoordinatesById(items);
    const currentVersion = getSessionVersion();
    
    const payload: Record<string, unknown> = {
      pineconeIds,
      items: itemsPayload,
      lastItemMetadata,
      clientId, // Always include for migration support
    };
    
    // Add expected version for optimistic locking
    if (currentVersion !== null) {
      payload.expectedVersion = currentVersion;
    }
    
    // Add coordinates if available
    if (coordinatesById) {
      payload.coordinatesById = coordinatesById;
    }
    
    const response = await fetch(`${API_URL}/api/research-sessions/${sessionId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    // Handle version conflict (409)
    if (response.status === 409 && retryOnConflict) {
      console.warn('[ResearchSession] Version conflict detected, reloading session...');
      
      // Fetch latest version from server
      const latestSession = await fetchResearchSession(sessionId);
      if (latestSession) {
        // Update our local version
        if (typeof latestSession.__v === 'number') {
          setSessionVersion(latestSession.__v);
        }
        
        // Retry the update with new version (but don't retry again to avoid infinite loop)
        return updateResearchSession(sessionId, items, false);
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update stored version after successful save
    if (data.success && typeof data.data?.__v === 'number') {
      setSessionVersion(data.data.__v);
    }
    
    return data;
  } catch (error) {
    console.error('Update research session error:', error);
    throw error;
  }
}

/**
 * Save research session - creates new or updates existing
 */
export async function saveResearchSession(items: ResearchSessionItem[]): Promise<ResearchSessionResponse> {
  const sessionId = getSessionId();
  
  if (sessionId) {
    // Update existing session
    return updateResearchSession(sessionId, items);
  } else {
    // Create new session
    return createResearchSession(items);
  }
}

/**
 * Save research session with retry logic for network failures
 */
export async function saveResearchSessionWithRetry(
  items: ResearchSessionItem[],
  maxRetries = 3
): Promise<ResearchSessionResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await saveResearchSession(items);
      if (attempt > 1) {
        console.log(`[ResearchSession] Saved successfully on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        console.error('[ResearchSession] Save failed after all retries');
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[ResearchSession] Save failed, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // TypeScript exhaustiveness check
  throw new Error('Unexpected: retry loop completed without return');
}

/**
 * Clear the local session (called when user clears all items)
 */
export function clearLocalSession(): void {
  clearSessionId();
}

/**
 * Get the current client ID (useful for debugging)
 */
export function getCurrentClientId(): string | null {
  return getClientIdFromUtil();
}

/**
 * Get the current session ID (useful for debugging)
 */
export function getCurrentSessionId(): string | null {
  return getSessionId();
}

/**
 * Set a session as the current active session
 * (useful when restoring from history)
 */
export function setCurrentSessionId(sessionId: string): void {
  setSessionId(sessionId);
}

/**
 * Fetch a research session by ID
 */
export async function fetchResearchSession(sessionId: string): Promise<ResearchSession | null> {
  try {
    const response = await fetch(`${API_URL}/api/research-sessions/${sessionId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('Research session not found, clearing local session ID');
        clearSessionId();
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Fetch research session error:', error);
    return null;
  }
}

/**
 * Convert backend items to frontend format
 */
export function backendItemsToFrontend(backendItems: ResearchSessionItemPayload[]): ResearchSessionItem[] {
  return backendItems
    .filter(item => item && item.pineconeId) // Filter out null/invalid items
    .map(item => {
      // Handle cases where metadata might be null or missing fields
      const metadata = item.metadata || {};
      
      return {
    shareLink: item.pineconeId,
        quote: metadata.quote,
        summary: metadata.summary,
        headline: metadata.headline,
        episode: metadata.episode || 'Unknown Episode',
        creator: metadata.creator || 'Unknown Creator',
        episodeImage: metadata.episodeImage,
        date: metadata.date || new Date().toISOString(),
        hierarchyLevel: (metadata.hierarchyLevel as 'feed' | 'episode' | 'chapter' | 'paragraph') || 'paragraph',
    addedAt: new Date(), // We don't have the original timestamp, use current
      };
    });
}

/**
 * Load the current session from backend and return items
 */
export async function loadCurrentSession(): Promise<ResearchSessionItem[]> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    return [];
  }
  
  const session = await fetchResearchSession(sessionId);
  
  if (!session || !session.items || session.items.length === 0) {
    return [];
  }
  
  return backendItemsToFrontend(session.items);
}

/**
 * Fetch all research sessions for the current owner (user or clientId)
 */
export async function fetchAllResearchSessions(): Promise<ResearchSession[]> {
  try {
    const clientId = getOrCreateClientId(); // Always send for session migration
    
    // Always include clientId for migration support
    const url = `${API_URL}/api/research-sessions?clientId=${encodeURIComponent(clientId)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success && data.data ? data.data : [];
  } catch (error) {
    console.error('Fetch all research sessions error:', error);
    return [];
  }
}

/**
 * Enriched metadata returned from the enrich endpoint
 */
export interface EnrichedMetadata {
  quote?: string;
  summary?: string;
  headline?: string;
  episode?: string;
  creator?: string;
  episodeImage?: string;
  audioUrl?: string;
  date?: string;
  feedId?: number;
  guid?: string;
  timeContext?: { start_time: number; end_time: number };
  hierarchyLevel?: string;
}

/**
 * Enrich items with full metadata from the backend.
 * Used to backfill "Quote unavailable" placeholders.
 */
export async function enrichResearchItems(
  pineconeIds: string[]
): Promise<Record<string, EnrichedMetadata>> {
  if (pineconeIds.length === 0) return {};
  
  try {
    printLog(`[ResearchSession] Enriching ${pineconeIds.length} items`);
    
    const response = await fetch(`${API_URL}/api/research-sessions/enrich`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pineconeIds }),
    });
    
    if (!response.ok) {
      console.error(`Enrich failed with status ${response.status}`);
      return {};
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      printLog(`[ResearchSession] Enriched ${Object.keys(data.data).length} items`);
      return data.data;
    }
    
    return {};
  } catch (error) {
    console.error('Enrich research items error:', error);
    return {};
  }
}

import { API_URL } from "../constants/constants.ts";
import { v4 as uuidv4 } from 'uuid';

// Storage key for client ID
const CLIENT_ID_KEY = 'research_client_id';
const SESSION_ID_KEY = 'research_session_id';

// Maximum items per research session
export const MAX_RESEARCH_ITEMS = 50;

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
}

export interface ResearchSession {
  id?: string;
  ownerType?: 'user' | 'client';
  userId?: string | null;
  clientId?: string;
  pineconeIds: string[];
  items?: ResearchSessionItemPayload[];
  pineconeIdsCount?: number;
  lastItemMetadata?: LastItemMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResearchSessionResponse {
  success: boolean;
  data?: ResearchSession;
  message?: string;
}

/**
 * Get or create a client ID for anonymous users
 */
function getOrCreateClientId(): string {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  
  if (!clientId) {
    clientId = `client_${uuidv4()}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  
  return clientId;
}

/**
 * Get the current session ID if it exists
 */
function getSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

/**
 * Store the session ID after creation
 */
function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

/**
 * Clear the session ID (e.g., after clearing all items)
 */
function clearSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
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
  };
}

/**
 * Create a new research session (POST)
 */
export async function createResearchSession(items: ResearchSessionItem[]): Promise<ResearchSessionResponse> {
  try {
    // Enforce 50 item limit
    if (items.length > MAX_RESEARCH_ITEMS) {
      throw new Error(`Maximum ${MAX_RESEARCH_ITEMS} items allowed per session`);
    }
    
    const token = localStorage.getItem('auth_token');
    const clientId = token ? undefined : getOrCreateClientId();
    const pineconeIds = itemsToPineconeIds(items);
    const itemsPayload = itemsToPayload(items);
    const lastItemMetadata = buildLastItemMetadata(items);
    
    const payload: Record<string, unknown> = {
      pineconeIds,
      items: itemsPayload,
      lastItemMetadata,
    };
    
    // Add clientId only if not authenticated
    if (clientId) {
      payload.clientId = clientId;
    }
    
    const response = await fetch(`${API_URL}/api/research-sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store the session ID for future updates
    if (data.success && data.data?.id) {
      setSessionId(data.data.id);
    }
    
    return data;
  } catch (error) {
    console.error('Create research session error:', error);
    throw error;
  }
}

/**
 * Update an existing research session (PATCH)
 */
export async function updateResearchSession(
  sessionId: string,
  items: ResearchSessionItem[]
): Promise<ResearchSessionResponse> {
  try {
    // Enforce 50 item limit
    if (items.length > MAX_RESEARCH_ITEMS) {
      throw new Error(`Maximum ${MAX_RESEARCH_ITEMS} items allowed per session`);
    }
    
    const token = localStorage.getItem('auth_token');
    const clientId = token ? undefined : getOrCreateClientId();
    const pineconeIds = itemsToPineconeIds(items);
    const itemsPayload = itemsToPayload(items);
    const lastItemMetadata = buildLastItemMetadata(items);
    
    const payload: Record<string, unknown> = {
      pineconeIds,
      items: itemsPayload,
      lastItemMetadata,
    };
    
    // Add clientId only if not authenticated
    if (clientId) {
      payload.clientId = clientId;
    }
    
    const response = await fetch(`${API_URL}/api/research-sessions/${sessionId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
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
 * Clear the local session (called when user clears all items)
 */
export function clearLocalSession(): void {
  clearSessionId();
}

/**
 * Get the current client ID (useful for debugging)
 */
export function getCurrentClientId(): string | null {
  return localStorage.getItem(CLIENT_ID_KEY);
}

/**
 * Get the current session ID (useful for debugging)
 */
export function getCurrentSessionId(): string | null {
  return getSessionId();
}

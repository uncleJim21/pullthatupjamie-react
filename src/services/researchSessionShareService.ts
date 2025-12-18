import { API_URL } from "../constants/constants.ts";
import { getCurrentSessionId } from './researchSessionService.ts';

// Types for sharing a research session
export interface ShareNode {
  pineconeId: string;
  x: number;
  y: number;
  z: number;
  color: string; // #RRGGBB or #RRGGBBAA
}

export interface ShareCamera {
  distance: number;
  tilt: number;
  rotation: number;
}

export interface ShareResearchSessionRequest {
  title?: string;
  visibility?: 'public' | 'unlisted';
  nodes: ShareNode[];
  camera?: ShareCamera;
}

export interface ShareResearchSessionResponse {
  success: boolean;
  data?: {
    shareId: string;
    shareUrl: string;
    previewImageUrl: string;
  };
  message?: string;
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

  // Send frontend origin so backend knows which URL to use for shareUrl
  if (typeof window !== 'undefined') {
    headers['X-Requested-With'] = window.location.origin;
  }

  return headers;
}

/**
 * Get client ID if not authenticated
 */
function getClientId(): string | null {
  const token = localStorage.getItem('auth_token');
  if (token) {
    return null; // Authenticated, don't need clientId
  }
  return localStorage.getItem('research_client_id');
}

/**
 * Share a research session - creates an immutable snapshot with layout
 */
export async function shareResearchSession(
  sessionId: string,
  request: ShareResearchSessionRequest
): Promise<ShareResearchSessionResponse> {
  try {
    const clientId = getClientId();
    
    // Build URL with clientId query param if needed
    let url = `${API_URL}/api/research-sessions/${sessionId}/share`;
    if (clientId) {
      url += `?clientId=${encodeURIComponent(clientId)}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Share research session error:', error);
    throw error;
  }
}

/**
 * Share the current research session with galaxy view data
 */
export async function shareCurrentSession(
  title: string | undefined,
  nodes: ShareNode[],
  camera?: ShareCamera
): Promise<ShareResearchSessionResponse> {
  const sessionId = getCurrentSessionId();
  
  if (!sessionId) {
    throw new Error('No active research session to share. Please save your session first.');
  }
  
  if (nodes.length === 0) {
    throw new Error('Cannot share an empty research session.');
  }
  
  const request: ShareResearchSessionRequest = {
    title,
    visibility: 'public',
    nodes,
    camera
  };
  
  return shareResearchSession(sessionId, request);
}

/**
 * Fetch a shared research session by shareId (public access)
 */
export async function fetchSharedResearchSession(shareId: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/shared-research-sessions/${shareId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Shared session not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Fetch shared research session error:', error);
    throw error;
  }
}

/**
 * Fetch research session with 3D coordinates (for warp speed animation)
 * Calls POST /api/fetch-research-id to get session data with coordinates
 */
export async function fetchResearchSessionWith3D(researchSessionId: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/fetch-research-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        researchSessionId,
        fastMode: false, // Set to false to ensure proper 3D coordinate calculation
        extractAxisLabels: true
      })
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Research session not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch research session 3D error:', error);
    throw error;
  }
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    textArea.remove();
    
    return successful;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

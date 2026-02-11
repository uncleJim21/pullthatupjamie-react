import { API_URL, AuthConfig } from "../constants/constants.ts";
import { ClipRequestResponse } from "../types/clips.ts";
import { throwIfQuotaExceeded } from "../types/errors.ts";
import { getAnalyticsHeader } from "./pulseService.ts";

/**
 * Build authorization headers using JWT Bearer token
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAnalyticsHeader()
  };
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function fetchClipById(clipId: string) {
  try {
    const response = await fetch(`${API_URL}/api/clip/${clipId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.clip;
  } catch (error) {
    console.error('Clip fetch error:', error);
    throw error;
  }
}

export async function makeClip(clipId: string, 
  auth: AuthConfig,  // Kept for backward compatibility, but auth now uses JWT from localStorage
  startTime:number|null,
  endTime:number|null
): Promise<ClipRequestResponse> {
  try {
    const headers = getAuthHeaders();

    let body = JSON.stringify({
      clipId: clipId
    })
    if(startTime && endTime){
      body = JSON.stringify({
        clipId: clipId,
        timestamps:[startTime,endTime]
      })
    }

    const response = await fetch(`${API_URL}/api/make-clip`, {
      method: 'POST',
      headers,
      body: body
    });
  
    // Check for quota exceeded (429) - throws QuotaExceededError
    await throwIfQuotaExceeded(response, 'make-clip');
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('make clip error:', error);
    throw error;
  }
}


export async function checkClipStatus(endpointString:string){
  try {
    const response = await fetch(`${API_URL}${endpointString}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Clip fetch error:', error);
    throw error;
  }
}
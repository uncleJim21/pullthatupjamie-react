import { API_URL } from "../constants/constants.ts";
import { ClipRequestResponse } from "../types/clips.ts";

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

export async function makeClip(clipId: string): Promise<ClipRequestResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_URL}/api/make-clip`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        clipId: clipId
      })
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('quote search error:', error);
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
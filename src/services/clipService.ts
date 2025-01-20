import { API_URL } from "../constants/constants.ts";

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
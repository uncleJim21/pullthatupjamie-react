// src/services/dashboardService.ts

// import { API_URL } from '../constants/constants.ts';
//TODO: route this proper deployment
const API_URL = 'http://localhost:3000'// for test only

export interface ClipItem {
  title: string;
  text: string;
  start_time: number;
  end_time: number;
  episode_title: string;
  feed_title: string;
  audio_url: string;
  relevance_score: number;
  duration?: number;
  paragraph_ids?: string[];
  expanded_context?: boolean;
  episodeImage?: string;
}

export interface ClipResponse {
  success: boolean;
  clips: ClipItem[];
  error?: string;
}

export async function getRecommendedClips(
  feedId: string, 
  enableFieldFiltering: boolean = false
): Promise<ClipResponse> {
  try {
    const response = await fetch(`${API_URL}/clips/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: "find clips i might like",
        maxClips: 5,
        feedId: feedId,
        minDuration: 60,
        maxDuration: 120,
        expandContext: true,
        enable_field_filtering: enableFieldFiltering // This ensures we use user preferences when false
      }),
    });

    if (!response.ok) {
      throw new Error(`Error fetching clips: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      clips: data.clips || []
    };
  } catch (err) {
    console.error('Error in getRecommendedClips:', err);
    return {
      success: false,
      clips: [],
      error: err instanceof Error ? err.message : 'An unknown error occurred'
    };
  }
}
import { API_URL } from '../constants/constants.ts';

export interface PodcastSource {
  feedImage: string;
  title: string;
  description: string;
  feedId: string;  
}

interface PodcastRequestData {
  email: string;
  podcastName: string;
  podcastUrl?: string;
  role: 'fan' | 'podcaster';
  paymentIntent: 'vote' | 'pay' | 'business';
}

/**
 * Fetches all available podcast sources
 * @returns {Promise<PodcastSource[]>} Array of podcast sources
 */
export async function fetchAvailableSources(): Promise<PodcastSource[]> {
  try {
    const response = await fetch(`${API_URL}/api/get-available-feeds`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch podcast sources: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching podcast sources:', error);
    throw error;
  }
}

/**
 * Submits a podcast request
 * @param {PodcastRequestData} data - The podcast request data
 * @returns {Promise<any>} Response from the API
 */
export async function submitPodcastRequest(data: PodcastRequestData): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        feedback: `Podcast Request: ${data.podcastName} ${data.podcastUrl ? `(${data.podcastUrl})` : ''}`,
        timestamp: new Date().toISOString(),
        mode: 'request-pod',
        userRole: data.role,
        paymentIntent: data.paymentIntent
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit podcast request: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting podcast request:', error);
    throw error;
  }
} 
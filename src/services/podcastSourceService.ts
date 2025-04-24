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
 * Sorts podcast sources with selected sources first, then alphabetically by title
 * @param {PodcastSource[]} sources - Array of podcast sources
 * @param {Set<string>} selectedSources - Set of selected source IDs
 * @returns {PodcastSource[]} Sorted array of podcast sources
 */
export function sortPodcastSources(sources: PodcastSource[], selectedSources: Set<string>): PodcastSource[] {
  return [...sources].sort((a, b) => {
    // First criterion: Selected sources come first
    const aSelected = selectedSources.has(a.feedId);
    const bSelected = selectedSources.has(b.feedId);
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    
    // Second criterion: Alphabetical order by title
    return a.title.localeCompare(b.title);
  });
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
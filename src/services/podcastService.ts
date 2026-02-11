import { API_URL, AuthConfig, SEARCH_LIMITS } from "../constants/constants.ts";
import { throwIfQuotaExceeded } from "../types/errors.ts";
import { getPulseHeader } from "./pulseService.ts";

/**
 * Build authorization headers using JWT Bearer token
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getPulseHeader()
  };
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export interface PodcastSearchParams {
  query: string;
  limit?: number;
  feedIds?: string[];
  guid?: string;
  minDate?: string;
  maxDate?: string;
  episodeName?: string;
  hierarchyLevels?: string[]; // Filter by hierarchy levels: ['chapter', 'paragraph', etc.]
}

export const handleQuoteSearch = async (
  queryToUse: string,
  auth: AuthConfig,  // Kept for backward compatibility, but auth now uses JWT from localStorage
  selectedFeedIds?: string[],
  minDate?: string,
  maxDate?: string,
  episodeName?: string,
  hierarchyLevels?: string[],
  guid?: string
) => {
  try{
    const headers = getAuthHeaders();

    const body: PodcastSearchParams = { 
      query: queryToUse,
      limit: SEARCH_LIMITS.LIST_VIEW,
      feedIds: selectedFeedIds || []
    };

    // Add optional filters if provided
    if (guid && guid.trim() !== '') {
      body.guid = guid.trim();
    }
    if (minDate) {
      body.minDate = minDate;
    }
    if (maxDate) {
      body.maxDate = maxDate;
    }
    if (episodeName && episodeName.trim() !== '') {
      body.episodeName = episodeName.trim();
    }
    if (hierarchyLevels && hierarchyLevels.length > 0) {
      body.hierarchyLevels = hierarchyLevels;
    }

    const response = await fetch(`${API_URL}/api/search-quotes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  
    // Check for quota exceeded (429) - throws QuotaExceededError
    await throwIfQuotaExceeded(response, 'search-quotes');
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const data = await response.json();
    return data;
  }
  catch(error){
    console.error('quote search error:', error);
    throw error;
  }
  
};

export const handleQuoteSearch3D = async (
  queryToUse: string,
  auth: AuthConfig,  // Kept for backward compatibility, but auth now uses JWT from localStorage
  selectedFeedIds?: string[],
  minDate?: string,
  maxDate?: string,
  episodeName?: string,
  hierarchyLevels?: string[],
  extractAxisLabels?: boolean,
  guid?: string
) => {
  try {
    const headers = getAuthHeaders();

    const body: any = {
      query: queryToUse,
      limit: SEARCH_LIMITS.GALAXY_VIEW,
      feedIds: selectedFeedIds || []
    };

    // Add optional filters if provided
    if (guid && guid.trim() !== '') {
      body.guid = guid.trim();
    }
    if (minDate) {
      body.minDate = minDate;
    }
    if (maxDate) {
      body.maxDate = maxDate;
    }
    if (episodeName && episodeName.trim() !== '') {
      body.episodeName = episodeName.trim();
    }
    if (extractAxisLabels) {
      body.extractAxisLabels = true;
    }
    if (hierarchyLevels && hierarchyLevels.length > 0) {
      body.hierarchyLevels = hierarchyLevels;
    }

    console.log(`[3D Search Request] Sending to API with limit: ${body.limit}, feedIds: ${body.feedIds?.length || 0}`);

    const response = await fetch(`${API_URL}/api/search-quotes-3d`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // Check for quota exceeded (429) - throws QuotaExceededError
    await throwIfQuotaExceeded(response, 'search-quotes-3d');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[3D Search Response] Received ${data.results?.length || 0} results from backend`);
    return data;
  } catch (error) {
    console.error('3D quote search error:', error);
    throw error;
  }
};
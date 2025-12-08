import { API_URL, AuthConfig, RequestAuthMethod, SEARCH_LIMITS } from "../constants/constants.ts";

export interface PodcastSearchParams {
  query: string;
  limit?: number;
  feedIds?: string[];
  minDate?: string;
  maxDate?: string;
  episodeName?: string;
  hierarchyLevels?: string[]; // Filter by hierarchy levels: ['chapter', 'paragraph', etc.]
}

export const handleQuoteSearch = async (
  queryToUse: string,
  auth:AuthConfig, 
  selectedFeedIds?: string[],
  minDate?: string,
  maxDate?: string,
  episodeName?: string,
  hierarchyLevels?: string[]
) => {
  try{
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Only add Authorization header for LIGHTNING and SQUARE auth
    if (auth.type === RequestAuthMethod.LIGHTNING) {
      const { preimage, paymentHash } = auth.credentials;
      headers.Authorization = `${preimage}:${paymentHash}`;
    } else if (auth.type === RequestAuthMethod.SQUARE) {
      const { username } = auth.credentials;
      headers.Authorization = `Basic ${btoa(`${username}:`)}`;
    }
    // FREE tier doesn't need an auth header

    const body: PodcastSearchParams = { 
      query: queryToUse,
      limit: SEARCH_LIMITS.LIST_VIEW,
      feedIds: selectedFeedIds || []
    };

    // Add optional filters if provided
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
  auth: AuthConfig,
  selectedFeedIds?: string[],
  minDate?: string,
  maxDate?: string,
  episodeName?: string,
  hierarchyLevels?: string[],
  extractAxisLabels?: boolean
) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Only add Authorization header for LIGHTNING and SQUARE auth
    if (auth.type === RequestAuthMethod.LIGHTNING) {
      const { preimage, paymentHash } = auth.credentials;
      headers.Authorization = `${preimage}:${paymentHash}`;
    } else if (auth.type === RequestAuthMethod.SQUARE) {
      const { username } = auth.credentials;
      headers.Authorization = `Basic ${btoa(`${username}:`)}`;
    }
    // FREE tier doesn't need an auth header

    const body: any = {
      query: queryToUse,
      limit: SEARCH_LIMITS.GALAXY_VIEW,
      feedIds: selectedFeedIds || []
    };

    // Add optional filters if provided
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
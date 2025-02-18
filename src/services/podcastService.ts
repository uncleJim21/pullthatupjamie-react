import { API_URL, AuthConfig, RequestAuthMethod } from "../constants/constants.ts";

export const handleQuoteSearch = async (
  queryToUse: string,
  auth:AuthConfig, 
  selectedFeedIds?: string[]
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

    const response = await fetch(`${API_URL}/api/search-quotes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        query: queryToUse,
        limit: 20,
        feedIds: selectedFeedIds || []
      })
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
import { API_URL, AuthConfig, RequestAuthMethod } from "../constants/constants.ts";

export async function performSearch(query: string, auth: AuthConfig) {
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

    const response = await fetch(`${API_URL}/api/stream-search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('SearXNG search error:', error);
    throw error;
  }
}
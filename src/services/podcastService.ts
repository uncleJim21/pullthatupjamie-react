import { API_URL } from "../constants/constants.ts";

export const handleQuoteSearch = async (queryToUse: string) => {

    const response = await fetch(`${API_URL}/api/search-quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: queryToUse,
        limit: 5
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  };
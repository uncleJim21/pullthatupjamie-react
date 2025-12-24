import { printLog } from '../constants/constants.ts';

/**
 * Service for interacting with Fountain API
 */

/**
 * Lookup Fountain episode link by GUID
 * @param episodeGuid - The episode GUID from RSS feed
 * @returns Fountain episode URL or null if not found
 */
export async function getFountainLink(episodeGuid: string | undefined): Promise<string | null> {
  try {
    if (!episodeGuid) {
      printLog('getFountainLink: No episodeGuid provided');
      return null;
    }

    printLog(`getFountainLink: Looking up episode with GUID: ${episodeGuid}`);
    
    // Call Fountain API to lookup episode
    const response = await fetch(`https://api.fountain.fm/v1/search/lookup?type=episode&guid=${encodeURIComponent(episodeGuid)}`);
    
    if (!response.ok) {
      printLog(`getFountainLink: API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data?.success && data?.ids?.episode?.fountain) {
      const fountainUrl = `https://fountain.fm/episode/${data.ids.episode.fountain}`;
      printLog(`getFountainLink: Found Fountain URL: ${fountainUrl}`);
      return fountainUrl;
    }
    
    printLog('getFountainLink: No Fountain episode ID found in response');
    return null;
  } catch (error) {
    console.error('Error fetching Fountain link:', error);
    printLog(`getFountainLink: Error - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Default export
 */
const FountainService = {
  getFountainLink
};

export default FountainService;


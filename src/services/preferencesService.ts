import { API_URL } from '../constants/constants.ts';

export interface UserPreferences {
  jamieFullAutoEnabled?: boolean;
  autoStartCrosspost?: boolean;
  crosspostSignature?: string;
  scheduledPostSlots?: ScheduledSlot[];
  randomizePostTime?: boolean;
  jamieAssistDefaults?: string; // Jamie Assist preferences (tone, style, hashtags, etc.)
  
  // UI View Preferences
  searchViewStyle?: 'classic' | 'split_screen';
  searchResultViewStyle?: 'list' | 'galaxy';
  preferredAIClipsViewStyle?: 'list' | 'grid';
  showAxisLabels?: boolean; // Display axis labels in galaxy view
  
  // Admin Settings
  adminFeedId?: string;
  isFirstVisit?: boolean;
  
  // Add other user preferences as needed
  [key: string]: any;
}

export interface ScheduledSlot {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday = 0)
  time: string; // HH:MM format in user's timezone
  enabled: boolean;
}

export interface PreferencesResponse {
  preferences: UserPreferences;
  schemaVersion: number;
}

export interface PreferencesRequest {
  preferences: UserPreferences;
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 20250812001;

/**
 * Generate default scheduled slots (9:45 AM and 4:45 PM, Monday-Friday)
 */
export function generateDefaultScheduledSlots(): ScheduledSlot[] {
  const slots: ScheduledSlot[] = [];
  
  // Monday through Friday (1-5)
  for (let day = 1; day <= 5; day++) {
    // Morning slot: 9:45 AM
    slots.push({
      id: `default-${day}-morning`,
      dayOfWeek: day,
      time: '09:45',
      enabled: true
    });
    
    // Afternoon slot: 4:45 PM
    slots.push({
      id: `default-${day}-afternoon`,
      dayOfWeek: day,
      time: '16:45',
      enabled: true
    });
  }
  
  return slots;
}

class PreferencesService {
  private static readonly BASE_URL = API_URL;

  /**
   * Get user preferences from the backend
   */
  static async getPreferences(authToken: string): Promise<PreferencesResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/api/preferences`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 404) {
          // No preferences found, return empty preferences
          return {
            preferences: {},
            schemaVersion: CURRENT_SCHEMA_VERSION
          };
        }
        throw new Error(`Failed to fetch preferences: ${response.status}`);
      }

      const data = await response.json();
      return {
        preferences: data.preferences || {},
        schemaVersion: data.schemaVersion || CURRENT_SCHEMA_VERSION
      };
    } catch (error) {
      console.error('Error fetching preferences:', error);
      throw error;
    }
  }

  /**
   * Update user preferences in the backend
   */
  static async updatePreferences(
    authToken: string, 
    preferences: UserPreferences
  ): Promise<PreferencesResponse> {
    try {
      const requestData: PreferencesRequest = {
        preferences,
        schemaVersion: CURRENT_SCHEMA_VERSION
      };

      const response = await fetch(`${this.BASE_URL}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        throw new Error(`Failed to update preferences: ${response.status}`);
      }

      const data = await response.json();
      return {
        preferences: data.preferences,
        schemaVersion: data.schemaVersion || CURRENT_SCHEMA_VERSION
      };
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get current schema version
   */
  static getCurrentSchemaVersion(): number {
    return CURRENT_SCHEMA_VERSION;
  }
}

export default PreferencesService;

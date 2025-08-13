import { API_URL } from '../constants/constants.ts';

export interface UserPreferences {
  autoStartCrosspost?: boolean;
  crosspostSignature?: string;
  scheduledPostSlots?: ScheduledSlot[];
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

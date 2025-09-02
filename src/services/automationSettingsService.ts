import { API_URL } from "../constants/constants.ts";
import { ScheduledSlot } from "./preferencesService.ts";

// Types for automation settings
export interface CurationSettings {
  topics: string[];
  feedId: string;
}

export interface PostingStyle {
  prompt: string;
}

export interface PostingSchedule {
  scheduledPostSlots: ScheduledSlot[];
  randomizePostTime: boolean;
}

export interface AutomationSettings {
  curationSettings: CurationSettings;
  postingStyle: PostingStyle;
  postingSchedule: PostingSchedule;
  automationEnabled: boolean;
}

export interface AutomationSettingsResponse {
  success: boolean;
  data?: AutomationSettings;
  message?: string;
}

// Get automation settings
export async function getAutomationSettings(feedId: string): Promise<AutomationSettingsResponse> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}/api/automation-settings?feedId=${feedId}`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get automation settings error:', error);
    throw error;
  }
}

// Save automation settings
export async function saveAutomationSettings(settings: AutomationSettings): Promise<AutomationSettingsResponse> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}/api/automation-settings`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Save automation settings error:', error);
    throw error;
  }
}

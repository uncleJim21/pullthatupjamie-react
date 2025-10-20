import { printLog } from '../constants/constants.ts';

// Base API URL - will use same backend as other services
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4132';

// Interfaces
export interface CreateEditRequest {
  cdnUrl: string;
  startTime: number;
  endTime: number;
  useSubtitles?: boolean;
}

export interface CreateEditResponse {
  status: string;
  lookupHash: string;
  pollUrl: string;
}

export interface EditStatus {
  status: 'processing' | 'completed' | 'failed' | 'queued';
  lookupHash: string;
  url?: string;
  error?: string;
}

export interface ChildEdit {
  lookupHash: string;
  status: string;
  url: string | null;
  editRange: string;
  duration: number;
  createdAt: string;
  originalUrl: string;
}

export interface ChildEditsResponse {
  parentFileName: string;
  parentFileBase: string;
  childCount: number;
  children: ChildEdit[];
}

// Get auth token from localStorage
const getAuthToken = (): string => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

// Create a new video edit
export const createVideoEdit = async (request: CreateEditRequest): Promise<CreateEditResponse> => {
  printLog('Creating video edit: ' + JSON.stringify(request));
  
  const token = getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/api/edit-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to create video edit' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  printLog('Video edit creation response: ' + JSON.stringify(data));
  
  return data;
};

// Check edit status
export const checkEditStatus = async (lookupHash: string): Promise<EditStatus> => {
  printLog('Checking edit status: ' + lookupHash);
  
  const response = await fetch(`${API_BASE_URL}/api/edit-status/${lookupHash}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to check edit status' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  printLog('Edit status response: ' + JSON.stringify(data));
  
  return data;
};

// Get all child edits for a parent file
export const getChildEdits = async (parentFileName: string): Promise<ChildEdit[]> => {
  printLog('Getting child edits for: ' + parentFileName);
  
  const token = getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}/api/edit-children/${encodeURIComponent(parentFileName)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to get child edits' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data: ChildEditsResponse = await response.json();
  printLog('Child edits response: ' + JSON.stringify(data));
  
  return data.children || [];
};

// Poll for edit completion with exponential backoff
export const pollForCompletion = async (
  lookupHash: string,
  onProgress?: (status: EditStatus) => void,
  maxAttempts: number = 60, // 60 attempts
  initialDelayMs: number = 2000 // Start with 2 seconds
): Promise<string> => {
  printLog('Starting polling for edit: ' + lookupHash);
  
  let attempts = 0;
  let currentDelay = initialDelayMs;
  
  while (attempts < maxAttempts) {
    try {
      const status = await checkEditStatus(lookupHash);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(status);
      }
      
      // Check if completed
      if (status.status === 'completed') {
        if (!status.url) {
          throw new Error('Edit completed but no URL provided');
        }
        printLog('Edit completed successfully: ' + status.url);
        return status.url;
      }
      
      // Check if failed
      if (status.status === 'failed') {
        const errorMsg = status.error || 'Edit processing failed';
        printLog('Edit failed: ' + errorMsg);
        throw new Error(errorMsg);
      }
      
      // Still processing or queued - wait before next check
      printLog(`Edit ${status.status}, attempt ${attempts + 1}/${maxAttempts}, waiting ${currentDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Exponential backoff with cap at 10 seconds
      currentDelay = Math.min(currentDelay * 1.5, 10000);
      attempts++;
      
    } catch (error) {
      printLog('Polling error: ' + error);
      throw error;
    }
  }
  
  throw new Error('Edit processing timeout - exceeded maximum polling attempts');
};

// Default export object with all functions
const VideoEditService = {
  createVideoEdit,
  checkEditStatus,
  getChildEdits,
  pollForCompletion
};

export default VideoEditService;


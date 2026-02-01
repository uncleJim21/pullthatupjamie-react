import { API_URL } from "../constants/constants.ts";
import { throwIfQuotaExceeded } from "../types/errors.ts";

const BASE_URL = API_URL;

// Entitlement quota info for a single entitlement type
export interface EntitlementQuota {
  eligible: boolean;
  used: number;
  max: number;
  remaining: number;
  isUnlimited: boolean;
  periodLengthDays: number;
  periodStart: string;
  nextResetDate: string;
  daysUntilReset: number;
}

// Response from /api/on-demand/checkEligibility
export interface CheckEligibilityResponse {
  success: boolean;
  tier: 'anonymous' | 'registered' | 'subscriber' | 'admin';
  identifier?: string;
  identifierType?: string;
  hasUser: boolean;
  entitlements: {
    'search-quotes': EntitlementQuota;
    'search-quotes-3d': EntitlementQuota;
    'make-clip': EntitlementQuota;
    'jamie-assist': EntitlementQuota;
    'ai-analyze': EntitlementQuota;
    'submit-on-demand-run': EntitlementQuota;
    [key: string]: EntitlementQuota;
  };
}

export interface OnDemandRunRequest {
  message: string;
  parameters?: Record<string, any>;
  episodes: Array<{
    guid: string;
    feedGuid: string;
    feedId: number;
  }>;
  skipCleanGuid?: boolean;
}

export interface OnDemandRunResponse {
  success: boolean;
  jobId: string;
  totalEpisodes: number;
  totalFeeds: number;
  message: string;
  awsResponse?: any;
}

export interface OnDemandJobStatus {
  success: boolean;
  jobId: string;
  status: 'pending' | 'complete' | 'failed';
  stats: {
    totalEpisodes: number;
    totalFeeds: number;
    episodesProcessed: number;
    episodesSkipped: number;
    episodesFailed: number;
  };
  episodes: Array<{
    guid: string;
    feedGuid: string;
    feedId: number;
    status: string;
  }>;
  startedAt: string;
  completedAt: string | null;
}

class TryJamieService {
  static async submitOnDemandRun(request: OnDemandRunRequest): Promise<OnDemandRunResponse> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${BASE_URL}/api/on-demand/submitOnDemandRun`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    
    // Check for quota exceeded (429) - throws QuotaExceededError with structured data
    await throwIfQuotaExceeded(res, 'submit-on-demand-run');
    
    if (!res.ok) {
      // Handle different error cases
      if (res.status === 401) {
        // Clear invalid token and throw auth error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('squareId');
        throw new Error('Authentication failed. Please sign in again.');
      }
      
      // Try to get error details from response
      let errorMessage = 'Failed to submit on-demand run';
      try {
        const errorData = await res.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        // If we can't parse the error response, use status-based messages
        if (res.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (res.status === 403) {
          errorMessage = 'Access denied. You may not have permission to perform this action.';
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return res.json();
  }

  static async getOnDemandJobStatus(jobId: string): Promise<OnDemandJobStatus> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${BASE_URL}/api/on-demand/getOnDemandJobStatus/${jobId}`, {
      headers,
    });
    
    if (!res.ok) {
      // Handle different error cases
      if (res.status === 401) {
        // Clear invalid token and throw auth error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('squareId');
        throw new Error('Authentication failed. Please sign in again.');
      }
      
      // Try to get error details from response
      let errorMessage = 'Failed to get job status';
      try {
        const errorData = await res.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        // If we can't parse the error response, use status-based messages
        if (res.status === 404) {
          errorMessage = 'Job not found. It may have been deleted or never existed.';
        } else if (res.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (res.status === 403) {
          errorMessage = 'Access denied. You may not have permission to view this job.';
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return res.json();
  }

  /**
   * Check eligibility for on-demand features.
   * Returns quota info for all entitlements including 'submit-on-demand-run'.
   */
  static async checkEligibility(): Promise<CheckEligibilityResponse | null> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const res = await fetch(`${BASE_URL}/api/on-demand/checkEligibility`, {
        headers,
      });
      
      if (!res.ok) {
        console.error(`checkEligibility failed with status ${res.status}`);
        return null;
      }
      
      return await res.json();
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return null;
    }
  }
}

export default TryJamieService; 
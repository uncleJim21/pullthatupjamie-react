// types/errors.ts
// Centralized error types for the application

import type { UserTier, QuotaExceededData } from '../components/QuotaExceededModal.tsx';

/**
 * Error thrown when a 429 quota exceeded response is received from the API.
 * Contains structured data for displaying the QuotaExceededModal.
 */
export class QuotaExceededError extends Error {
  public readonly data: QuotaExceededData;
  public readonly status: number = 429;

  constructor(data: QuotaExceededData, message?: string) {
    super(message || `Quota exceeded: ${data.used}/${data.max} ${data.entitlementType || 'requests'} used`);
    this.name = 'QuotaExceededError';
    this.data = data;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QuotaExceededError);
    }
  }
}

/**
 * Parse a 429 response body into QuotaExceededData
 */
export async function parseQuotaExceededResponse(
  response: Response,
  entitlementType?: string
): Promise<QuotaExceededData> {
  try {
    const errorData = await response.json();
    return {
      tier: errorData.tier || 'anonymous',
      used: errorData.used ?? 0,
      max: errorData.max ?? 0,
      resetDate: errorData.resetDate,
      daysUntilReset: errorData.daysUntilReset,
      entitlementType: entitlementType || errorData.entitlementType,
    };
  } catch {
    // If we can't parse the response, return minimal data
    return {
      tier: 'anonymous',
      used: 0,
      max: 0,
      entitlementType,
    };
  }
}

/**
 * Check if a response is a 429 quota exceeded error and throw QuotaExceededError if so.
 * Call this after checking response.ok but before parsing the success response.
 */
export async function throwIfQuotaExceeded(
  response: Response,
  entitlementType?: string
): Promise<void> {
  if (response.status === 429) {
    const data = await parseQuotaExceededResponse(response, entitlementType);
    throw new QuotaExceededError(data);
  }
}

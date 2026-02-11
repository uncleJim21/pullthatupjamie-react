/**
 * Centralized hook for subscription status management.
 * Provides consistent subscription detection across all components.
 */

import { useState, useEffect, useCallback } from 'react';
import { printLog } from '../constants/constants.ts';

export type SubscriptionTier = 'anonymous' | 'registered' | 'amber' | 'admin';

export interface SubscriptionStatus {
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has any paid subscription (Plus or Pro) */
  isSubscribed: boolean;
  /** Whether user is Plus subscriber */
  isPlus: boolean;
  /** Whether user is Pro subscriber */
  isPro: boolean;
  /** User identifier (email or npub) */
  identifier: string | null;
}

export interface UseSubscriptionStatusReturn extends SubscriptionStatus {
  /** Refresh subscription status from storage/JWT */
  refresh: () => void;
  /** Get the correct product name for upgrade flow */
  getUpgradeProduct: () => 'jamie-plus' | 'jamie-pro' | null;
  /** Check if user should see upgrade option */
  shouldShowUpgrade: () => boolean;
}

/**
 * Decode JWT payload without validation (client-side only)
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
}

/**
 * Get subscription status from all available sources
 */
function getSubscriptionStatusFromSources(): SubscriptionStatus {
  const token = localStorage.getItem('auth_token');
  const squareId = localStorage.getItem('squareId');
  const storedSubscriptionType = localStorage.getItem('subscriptionType');
  const storedIsSubscribed = localStorage.getItem('isSubscribed') === 'true';

  // Default: anonymous
  let status: SubscriptionStatus = {
    tier: 'anonymous',
    isAuthenticated: false,
    isSubscribed: false,
    isPlus: false,
    isPro: false,
    identifier: null,
  };

  // Check if user has a token
  if (!token || !squareId) {
    return status;
  }

  // User is at least registered
  status.isAuthenticated = true;
  status.identifier = squareId;
  status.tier = 'registered';

  // Try to get subscription info from localStorage first
  let effectiveSubscriptionType = storedSubscriptionType;
  let effectiveIsSubscribed = storedIsSubscribed;

  // Fallback to JWT if localStorage doesn't have subscription info
  if (!effectiveSubscriptionType) {
    const jwtPayload = decodeJwtPayload(token);
    if (jwtPayload) {
      printLog(`[useSubscriptionStatus] JWT payload: ${JSON.stringify(jwtPayload)}`);
      effectiveSubscriptionType = jwtPayload.subscriptionType || null;
      effectiveIsSubscribed = effectiveIsSubscribed || jwtPayload.subscriptionValid === true;
    }
  }

  // Determine tier based on subscription type
  // Pro can be: 'admin' or 'jamie-pro'
  // Plus can be: 'amber', 'subscriber', or 'jamie-plus'
  if (effectiveSubscriptionType === 'admin' || effectiveSubscriptionType === 'jamie-pro') {
    status.tier = 'admin';
    status.isPro = true;
    status.isSubscribed = true;
  } else if (effectiveSubscriptionType === 'amber' || effectiveSubscriptionType === 'subscriber' || effectiveSubscriptionType === 'jamie-plus') {
    status.tier = 'amber';
    status.isPlus = true;
    status.isSubscribed = true;
  } else if (effectiveIsSubscribed) {
    // Has subscription but type unknown - assume Plus
    status.tier = 'amber';
    status.isPlus = true;
    status.isSubscribed = true;
  }

  printLog(`[useSubscriptionStatus] Final status: tier=${status.tier}, isPlus=${status.isPlus}, isPro=${status.isPro}`);

  return status;
}

/**
 * Hook for managing subscription status across the app.
 * Provides consistent subscription detection and upgrade logic.
 */
export function useSubscriptionStatus(): UseSubscriptionStatusReturn {
  const [status, setStatus] = useState<SubscriptionStatus>(() => getSubscriptionStatusFromSources());

  const refresh = useCallback(() => {
    const newStatus = getSubscriptionStatusFromSources();
    setStatus(newStatus);
  }, []);

  // Refresh on mount and when storage/auth changes
  useEffect(() => {
    refresh();

    // Listen for storage changes (e.g., sign in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'subscriptionType' || e.key === 'isSubscribed' || e.key === 'squareId') {
        refresh();
      }
    };

    // Listen for custom auth change event (same tab)
    const handleAuthChange = () => {
      refresh();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, [refresh]);

  /**
   * Get the correct product for upgrade flow based on current subscription.
   * - Anonymous/Registered → Jamie Plus
   * - Plus → Jamie Pro
   * - Pro → null (already at max)
   */
  const getUpgradeProduct = useCallback((): 'jamie-plus' | 'jamie-pro' | null => {
    if (status.isPro) {
      // Already Pro, no upgrade available
      return null;
    }
    if (status.isPlus) {
      // Plus user should upgrade to Pro
      return 'jamie-pro';
    }
    // Free user should upgrade to Plus
    return 'jamie-plus';
  }, [status]);

  /**
   * Check if user should see the upgrade option.
   * Pro users should not see upgrade (they're at the top tier).
   */
  const shouldShowUpgrade = useCallback((): boolean => {
    return !status.isPro;
  }, [status]);

  return {
    ...status,
    refresh,
    getUpgradeProduct,
    shouldShowUpgrade,
  };
}

/**
 * Dispatch auth state changed event to notify all hook instances.
 * Call this after updating localStorage with auth data.
 */
export function notifyAuthStateChanged(): void {
  window.dispatchEvent(new Event('auth-state-changed'));
}

// Export utility functions for use outside React components
export { getSubscriptionStatusFromSources, decodeJwtPayload };

// services/analyticsService.ts
// Analytics service for tracking user journeys and feature usage
// See docs/specs/ANALYTICS_SPEC.md for full documentation

import { API_URL, printLog } from '../constants/constants.ts';

// ============================================================
// Types
// ============================================================

export type Tier = 'anonymous' | 'registered' | 'subscriber' | 'admin';
export type Environment = 'dev' | 'staging' | 'prod';

interface AnalyticsSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

interface AnalyticsEvent {
  type: string;
  session_id: string;
  timestamp: string;
  tier: Tier;
  environment: Environment;
  properties: Record<string, unknown>;
}

// ============================================================
// Constants
// ============================================================

const SESSION_KEY = 'jamie_analytics_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ANALYTICS_ENDPOINT = `${API_URL}/api/analytics`;

// Allowed event types for validation
const ALLOWED_EVENTS = [
  // Auth events
  'auth_modal_opened',
  'auth_completed',
  'auth_abandoned',
  // Checkout events
  'checkout_opened',
  'checkout_completed',
  'checkout_abandoned',
  // Quota events
  'quota_exceeded_shown',
  'quota_exceeded_action',
  // Journey events
  'wizard_step_reached',
  'processing_completed',
] as const;

export type AnalyticsEventType = typeof ALLOWED_EVENTS[number];

// ============================================================
// Session Management
// ============================================================

/**
 * Get or create an analytics session.
 * Sessions persist for 30 days and are NOT rotated on auth changes
 * to preserve the full user journey.
 */
export function getOrCreateSession(): AnalyticsSession {
  const stored = localStorage.getItem(SESSION_KEY);

  if (stored) {
    try {
      const session = JSON.parse(stored) as AnalyticsSession;
      if (new Date(session.expiresAt) > new Date()) {
        return session; // Still valid
      }
      printLog('[Analytics] Session expired, creating new one');
    } catch {
      printLog('[Analytics] Corrupted session data, creating new one');
    }
  }

  // Create new session
  const now = new Date();
  const newSession: AnalyticsSession = {
    sessionId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  printLog(`[Analytics] Created new session: ${newSession.sessionId.substring(0, 8)}...`);
  return newSession;
}

/**
 * Get the current session ID (creates session if needed)
 */
export function getSessionId(): string {
  return getOrCreateSession().sessionId;
}

// ============================================================
// Environment & Tier Detection
// ============================================================

/**
 * Detect the current environment based on hostname
 */
export function getEnvironment(): Environment {
  if (typeof window === 'undefined') return 'prod';
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'dev';
  if (hostname.includes('staging') || hostname.includes('preview')) return 'staging';
  return 'prod';
}

/**
 * Get the current user tier from cached state or auth data
 */
export function getCurrentTier(): Tier {
  // Check for cached tier from recent eligibility check
  const cachedTier = sessionStorage.getItem('jamie_user_tier');
  if (cachedTier && ['anonymous', 'registered', 'subscriber', 'admin'].includes(cachedTier)) {
    return cachedTier as Tier;
  }

  // Infer from auth state
  const hasToken = !!localStorage.getItem('auth_token');
  const hasSquareId = !!localStorage.getItem('squareId');
  const isSubscribed = localStorage.getItem('isSubscribed') === 'true';
  const subscriptionType = localStorage.getItem('subscriptionType');

  if (!hasToken || !hasSquareId) {
    return 'anonymous';
  }

  if (subscriptionType === 'admin') {
    return 'admin';
  }

  if (isSubscribed || subscriptionType) {
    return 'subscriber';
  }

  return 'registered';
}

/**
 * Cache the user tier (call this after eligibility checks)
 */
export function cacheUserTier(tier: Tier): void {
  sessionStorage.setItem('jamie_user_tier', tier);
}

// ============================================================
// Event Tracking
// ============================================================

interface TrackEventOptions {
  type: AnalyticsEventType;
  properties?: Record<string, unknown>;
}

/**
 * Track an analytics event.
 * Uses sendBeacon for reliability on page unload.
 * Never throws - analytics should not break the app.
 */
export async function trackEvent({ type, properties = {} }: TrackEventOptions): Promise<void> {
  // Validate event type
  if (!ALLOWED_EVENTS.includes(type)) {
    printLog(`[Analytics] Invalid event type: ${type}`);
    return;
  }

  const payload: AnalyticsEvent = {
    type,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    tier: getCurrentTier(),
    environment: getEnvironment(),
    properties,
  };

  printLog(`[Analytics] Tracking: ${type} ${JSON.stringify(properties)}`);

  try {
    // Use sendBeacon for reliability (works even on page unload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const success = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
      if (!success) {
        // Fallback to fetch if sendBeacon fails
        await fetchFallback(payload);
      }
    } else {
      await fetchFallback(payload);
    }
  } catch (error) {
    // Analytics should never break the app
    printLog(`[Analytics] Failed to track event: ${error}`);
  }
}

/**
 * Fallback fetch for environments without sendBeacon
 */
async function fetchFallback(payload: AnalyticsEvent): Promise<void> {
  await fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

// ============================================================
// Convenience Functions for Common Events
// ============================================================

// --- Auth Events ---

export type AuthSource = 'wizard' | 'banner' | 'quota_exceeded' | 'account_button' | 'paywall';
export type AuthIntent = 'signup' | 'upgrade';
export type AuthMethod = 'email' | 'nostr' | 'twitter';

export function trackAuthModalOpened(intent: AuthIntent, source: AuthSource): void {
  trackEvent({
    type: 'auth_modal_opened',
    properties: { intent, source },
  });
}

export function trackAuthCompleted(method: AuthMethod, hadUpgradeIntent: boolean): void {
  trackEvent({
    type: 'auth_completed',
    properties: { method, had_upgrade_intent: hadUpgradeIntent },
  });
}

export function trackAuthAbandoned(intent: AuthIntent, timeOpenMs: number): void {
  trackEvent({
    type: 'auth_abandoned',
    properties: { intent, time_open_ms: timeOpenMs },
  });
}

// --- Checkout Events ---

export type CheckoutProduct = 'jamie-plus' | 'jamie-pro';

export function trackCheckoutOpened(product: CheckoutProduct, fromTier: Tier): void {
  trackEvent({
    type: 'checkout_opened',
    properties: { product, from_tier: fromTier },
  });
}

export function trackCheckoutCompleted(product: CheckoutProduct, fromTier: Tier): void {
  trackEvent({
    type: 'checkout_completed',
    properties: { product, from_tier: fromTier },
  });
}

export function trackCheckoutAbandoned(product: CheckoutProduct, timeOpenMs: number): void {
  trackEvent({
    type: 'checkout_abandoned',
    properties: { product, time_open_ms: timeOpenMs },
  });
}

// --- Quota Events ---

export type QuotaAction = 'signup' | 'upgrade_plus' | 'upgrade_pro' | 'dismissed';

export function trackQuotaExceededShown(entitlementType: string, used: number, max: number): void {
  trackEvent({
    type: 'quota_exceeded_shown',
    properties: { entitlement_type: entitlementType, used, max },
  });
}

export function trackQuotaExceededAction(action: QuotaAction): void {
  trackEvent({
    type: 'quota_exceeded_action',
    properties: { action },
  });
}

// --- Journey Events ---

export type WizardStep = 1 | 2 | 3 | 4 | 5;
const WIZARD_STEP_NAMES: Record<WizardStep, string> = {
  1: 'Select Feed',
  2: 'Select Episode',
  3: 'Confirm',
  4: 'Process',
  5: 'Enjoy',
};

export function trackWizardStepReached(step: WizardStep): void {
  trackEvent({
    type: 'wizard_step_reached',
    properties: { step, step_name: WIZARD_STEP_NAMES[step] },
  });
}

export function trackProcessingCompleted(success: boolean, jobId: string | null): void {
  trackEvent({
    type: 'processing_completed',
    properties: { success, job_id: jobId || 'unknown' },
  });
}

// ============================================================
// Header Helper for API Requests
// ============================================================

/**
 * Get the X-Analytics-Session header value for API requests.
 * Include this header on entitlement-gated endpoints so the backend
 * can emit server-side analytics events with session context.
 */
export function getAnalyticsHeader(): Record<string, string> {
  return {
    'X-Analytics-Session': getSessionId(),
  };
}

export default {
  getSessionId,
  getCurrentTier,
  cacheUserTier,
  trackEvent,
  trackAuthModalOpened,
  trackAuthCompleted,
  trackAuthAbandoned,
  trackCheckoutOpened,
  trackCheckoutCompleted,
  trackCheckoutAbandoned,
  trackQuotaExceededShown,
  trackQuotaExceededAction,
  trackWizardStepReached,
  trackProcessingCompleted,
  getAnalyticsHeader,
};

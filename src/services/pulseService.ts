// services/pulseService.ts
// Pulse service for recording user journeys and feature usage
// See docs/specs/ANALYTICS_SPEC.md for full documentation

import { API_URL, printLog } from '../constants/constants.ts';

// ============================================================
// Types
// ============================================================

export type Tier = 'anonymous' | 'registered' | 'subscriber' | 'admin';
export type Environment = 'dev' | 'staging' | 'prod';

interface PulseSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

interface PulseEvent {
  type: string;
  sid: string;
  timestamp: string;
  tier: Tier;
  environment: Environment;
  properties: Record<string, unknown>;
}

// ============================================================
// Constants
// ============================================================

const SESSION_KEY = 'jamie_pulse_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PULSE_ENDPOINT = `${API_URL}/api/pulse`;

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
  // Engagement events
  'visit_shared_session',
] as const;

export type PulseEventType = typeof ALLOWED_EVENTS[number];

// ============================================================
// Session Management
// ============================================================

/**
 * Get or create a pulse session.
 * Sessions persist for 30 days and are NOT rotated on auth changes
 * to preserve the full user journey.
 */
export function getOrCreateSession(): PulseSession {
  // Migrate from legacy key if present
  const legacyKey = 'jamie_analytics_session';
  const legacy = localStorage.getItem(legacyKey);
  if (legacy) {
    localStorage.setItem(SESSION_KEY, legacy);
    localStorage.removeItem(legacyKey);
  }

  const stored = localStorage.getItem(SESSION_KEY);

  if (stored) {
    try {
      const session = JSON.parse(stored) as PulseSession;
      if (new Date(session.expiresAt) > new Date()) {
        return session; // Still valid
      }
      printLog('[Pulse] Session expired, creating new one');
    } catch {
      printLog('[Pulse] Corrupted session data, creating new one');
    }
  }

  // Create new session
  const now = new Date();
  const newSession: PulseSession = {
    sessionId: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  printLog(`[Pulse] Created new session: ${newSession.sessionId.substring(0, 8)}...`);
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
// Event Recording
// ============================================================

interface EmitOptions {
  type: PulseEventType;
  properties?: Record<string, unknown>;
}

/**
 * Record a pulse event.
 * Uses fetch with keepalive for reliability on page unload.
 * Never throws - pulse should not break the app.
 */
export function emit({ type, properties = {} }: EmitOptions): void {
  // Validate event type
  if (!ALLOWED_EVENTS.includes(type)) {
    printLog(`[Pulse] Invalid event type: ${type}`);
    return;
  }

  const payload: PulseEvent = {
    type,
    sid: getSessionId(),
    timestamp: new Date().toISOString(),
    tier: getCurrentTier(),
    environment: getEnvironment(),
    properties,
  };

  printLog(`[Pulse] Recording: ${type} ${JSON.stringify(properties)}`);

  fetch(PULSE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then(res => {
    if (!res.ok && import.meta.env.DEV) {
      console.debug('[Pulse] Signal failed:', res.status);
    }
  }).catch(() => {
    if (import.meta.env.DEV) console.debug('[Pulse] Signal unavailable');
  });
}

// ============================================================
// Convenience Functions for Common Events
// ============================================================

// --- Auth Events ---

export type AuthSource = 'wizard' | 'banner' | 'quota_exceeded' | 'account_button' | 'paywall';
export type AuthIntent = 'signup' | 'upgrade';
export type AuthMethod = 'email' | 'nostr' | 'twitter';

export function emitAuthModalOpened(intent: AuthIntent, source: AuthSource): void {
  emit({
    type: 'auth_modal_opened',
    properties: { intent, source },
  });
}

export function emitAuthCompleted(method: AuthMethod, hadUpgradeIntent: boolean): void {
  emit({
    type: 'auth_completed',
    properties: { method, had_upgrade_intent: hadUpgradeIntent },
  });
}

export function emitAuthAbandoned(intent: AuthIntent, timeOpenMs: number): void {
  emit({
    type: 'auth_abandoned',
    properties: { intent, time_open_ms: timeOpenMs },
  });
}

// --- Checkout Events ---

export type CheckoutProduct = 'jamie-plus' | 'jamie-pro';

export function emitCheckoutOpened(product: CheckoutProduct, fromTier: Tier): void {
  emit({
    type: 'checkout_opened',
    properties: { product, from_tier: fromTier },
  });
}

export function emitCheckoutCompleted(product: CheckoutProduct, fromTier: Tier): void {
  emit({
    type: 'checkout_completed',
    properties: { product, from_tier: fromTier },
  });
}

export function emitCheckoutAbandoned(product: CheckoutProduct, timeOpenMs: number): void {
  emit({
    type: 'checkout_abandoned',
    properties: { product, time_open_ms: timeOpenMs },
  });
}

// --- Quota Events ---

export type QuotaAction = 'signup' | 'upgrade_plus' | 'upgrade_pro' | 'dismissed';

export function emitQuotaExceededShown(entitlementType: string, used: number, max: number): void {
  emit({
    type: 'quota_exceeded_shown',
    properties: { entitlement_type: entitlementType, used, max },
  });
}

export function emitQuotaExceededAction(action: QuotaAction): void {
  emit({
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

export function emitWizardStepReached(step: WizardStep): void {
  emit({
    type: 'wizard_step_reached',
    properties: { step, step_name: WIZARD_STEP_NAMES[step] },
  });
}

export function emitProcessingCompleted(success: boolean, jobId: string | null): void {
  emit({
    type: 'processing_completed',
    properties: { success, job_id: jobId || 'unknown' },
  });
}

// --- Engagement Events ---

export type SharedSessionSource = 'carousel' | 'shared_link' | 'embed';

export function emitVisitSharedSession(shareId: string, source: SharedSessionSource, title?: string): void {
  emit({
    type: 'visit_shared_session',
    properties: { 
      share_id: shareId, 
      source,
      title: title || 'unknown',
    },
  });
}

// ============================================================
// Header Helper for API Requests
// ============================================================

/**
 * Get the X-Pulse-Session header value for API requests.
 * Include this header on entitlement-gated endpoints so the backend
 * can emit server-side pulse events with session context.
 */
export function getPulseHeader(): Record<string, string> {
  return {
    'X-Pulse-Session': getSessionId(),
  };
}

export default {
  getSessionId,
  getCurrentTier,
  cacheUserTier,
  emit,
  emitAuthModalOpened,
  emitAuthCompleted,
  emitAuthAbandoned,
  emitCheckoutOpened,
  emitCheckoutCompleted,
  emitCheckoutAbandoned,
  emitQuotaExceededShown,
  emitQuotaExceededAction,
  emitWizardStepReached,
  emitProcessingCompleted,
  emitVisitSharedSession,
  getPulseHeader,
};

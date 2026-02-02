/**
 * Centralized sign-out utility for clearing all user-specific data.
 * 
 * This ensures consistent cleanup across all sign-out handlers,
 * preventing stale data from persisting between different user sessions.
 */

/**
 * User-specific localStorage keys to clear on sign-out.
 * These are tied to the user's identity/subscription and should not persist.
 */
const USER_SPECIFIC_KEYS = [
  // Auth & Identity
  'auth_token',
  'squareId',
  'authProvider',
  
  // Subscription
  'isSubscribed',
  'subscriptionType',
  'admin_privs',
  
  // Lightning (deprecated but may still exist)
  'bc:config',
  'lightning_invoice',
  
  // Automation
  'scheduleMode',
  'recommendedScheduleConfirmed',
] as const;

/**
 * User-specific keys within the userSettings object.
 * These are cleared while preserving device-specific preferences.
 */
const USER_SPECIFIC_SETTINGS_KEYS = [
  'adminFeedId',
  'adminFeedUrl',
  'jamieFullAutoEnabled',
  'autoStartCrosspost',
  'crosspostSignature',
  'scheduledPostSlots',
  'randomizePostTime',
  'jamieAssistDefaults',
] as const;

/**
 * Device-specific keys that are PRESERVED on sign-out.
 * These are preferences about how the device/browser displays content,
 * not tied to user identity.
 * 
 * Preserved keys:
 * - showAxisLabels (galaxy view UI pref)
 * - autoPlayOnStarClick (autoplay UI pref)
 * - searchViewStyle (classic vs split view)
 * - searchResultViewStyle (list vs galaxy)
 * - preferredAIClipsViewStyle (list vs grid)
 * - isFirstVisit (first visit flag)
 * 
 * Also preserved (not in userSettings):
 * - jamie_clientId (enables session migration on re-login)
 */

/**
 * Clear all user-specific data from localStorage.
 * Call this on sign-out to ensure clean state for next user.
 */
export function clearUserData(): void {
  // Clear top-level user-specific keys
  USER_SPECIFIC_KEYS.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Clear user-specific fields from userSettings (preserve device prefs)
  const settings = localStorage.getItem('userSettings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      USER_SPECIFIC_SETTINGS_KEYS.forEach(key => {
        delete parsed[key];
      });
      localStorage.setItem('userSettings', JSON.stringify(parsed));
    } catch (e) {
      // If userSettings is corrupted, remove it entirely
      console.error('Failed to parse userSettings during sign-out:', e);
      localStorage.removeItem('userSettings');
    }
  }
}

/**
 * Export lists for documentation/debugging purposes
 */
export const userSpecificKeys = USER_SPECIFIC_KEYS;
export const userSpecificSettingsKeys = USER_SPECIFIC_SETTINGS_KEYS;

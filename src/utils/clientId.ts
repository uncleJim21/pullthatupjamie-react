/**
 * Shared utility for managing the client ID used for anonymous research sessions.
 * 
 * The clientId enables:
 * - Anonymous users to have persistent sessions
 * - Automatic session migration when they later sign up/login
 * 
 * Always send clientId, even when authenticated, to enable migration.
 */

const CLIENT_ID_KEY = 'jamie_clientId';
const LEGACY_CLIENT_ID_KEY = 'research_client_id'; // Old key for migration

/**
 * Get or create a stable client ID.
 * - Migrates from legacy key if present
 * - Creates new UUID if none exists
 * - Always returns a valid clientId
 */
export function getOrCreateClientId(): string {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  
  // Migrate from legacy key if present
  if (!clientId) {
    const legacyClientId = localStorage.getItem(LEGACY_CLIENT_ID_KEY);
    if (legacyClientId) {
      clientId = legacyClientId;
      localStorage.setItem(CLIENT_ID_KEY, clientId);
      localStorage.removeItem(LEGACY_CLIENT_ID_KEY);
    }
  }
  
  // Create new if still missing
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  
  return clientId;
}

/**
 * Get current client ID without creating one.
 * Useful for read-only checks.
 */
export function getCurrentClientId(): string | null {
  return localStorage.getItem(CLIENT_ID_KEY) || localStorage.getItem(LEGACY_CLIENT_ID_KEY);
}

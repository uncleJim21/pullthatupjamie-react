# LocalStorage Schema Documentation

## Overview

This document describes all localStorage keys and their schemas used in the Pull That Up Jamie application.

**Last Updated**: 2024-12-01

---

## Core Storage Keys

### `userSettings`

Main user preferences object stored as JSON. This is the primary storage mechanism for user configuration.

**Type**: `UserPreferences` object (JSON stringified)

**Schema**:
```typescript
interface UserPreferences {
  // Jamie Automation Settings
  jamieFullAutoEnabled?: boolean;          // Enable full automation mode
  autoStartCrosspost?: boolean;            // Auto-start cross-posting
  crosspostSignature?: string;             // Signature for cross-posts
  
  // Scheduling Settings
  scheduledPostSlots?: ScheduledSlot[];    // Configured time slots for posting
  randomizePostTime?: boolean;             // Add randomness to posting times
  
  // UI Preferences
  searchViewStyle?: 'classic' | 'split_screen';              // Main search view layout
  searchResultViewStyle?: 'list' | 'galaxy';                 // Result display mode
  preferredAIClipsViewStyle?: 'list' | 'grid';              // AI clips view mode
  showAxisLabels?: boolean;                                   // Display 3D axis labels in galaxy view
  
  // Jamie Assist Settings
  jamieAssistDefaults?: string;            // JSON string of Jamie Assist preferences (tone, style, hashtags)
  
  // Admin Settings
  adminFeedId?: string;                    // Feed ID for admin users
  isFirstVisit?: boolean;                  // Has user seen welcome modal?
  
  // Flexible key-value pairs
  [key: string]: any;
}

interface ScheduledSlot {
  id: string;                              // Unique identifier
  dayOfWeek: number;                       // 0-6 (Sunday = 0)
  time: string;                            // HH:MM format in user's timezone
  enabled: boolean;                        // Is this slot active?
}
```

**Example**:
```json
{
  "jamieFullAutoEnabled": false,
  "autoStartCrosspost": true,
  "searchViewStyle": "split_screen",
  "searchResultViewStyle": "galaxy",
  "showAxisLabels": true,
  "scheduledPostSlots": [
    {
      "id": "slot_1",
      "dayOfWeek": 1,
      "time": "09:00",
      "enabled": true
    }
  ],
  "randomizePostTime": true,
  "isFirstVisit": false
}
```

---

### `auth_token`

Authentication token for the current user session.

**Type**: String (JWT token)

**Example**: `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`

---

### `squareId`

Square/email identifier for authenticated users.

**Type**: String (email address)

**Example**: `"user@example.com"`

---

### `isSubscribed`

Subscription status flag.

**Type**: String (`"true"` or not present)

**Example**: `"true"`

---

### `selectedPodcastSources`

User's selected podcast feeds for filtering search results.

**Type**: JSON array of feed IDs

**Schema**:
```typescript
type SelectedSources = string[];
```

**Example**:
```json
["feed_abc123", "feed_xyz789"]
```

---

### `podcastSearchFilters`

Active filters for podcast search.

**Type**: JSON object

**Schema**:
```typescript
interface PodcastSearchFilters {
  episodeName: string;    // Filter by episode name (partial match)
  minDate: string;        // Filter episodes after this date (YYYY-MM-DD)
  maxDate: string;        // Filter episodes before this date (YYYY-MM-DD)
}
```

**Example**:
```json
{
  "episodeName": "Bitcoin",
  "minDate": "2024-01-01",
  "maxDate": "2024-12-31"
}
```

---

### `bc:config`

Bitcoin Connect / Lightning wallet configuration.

**Type**: JSON object (from @getalby/bitcoin-connect)

**Schema**: Managed by Bitcoin Connect library

---

### `lightning_invoice`

Temporary storage for pending Lightning invoice.

**Type**: JSON object

**Schema**:
```typescript
interface LightningInvoice {
  invoice: string;        // Bolt11 invoice string
  paymentHash: string;    // Payment hash
  amount: number;         // Amount in satoshis
  timestamp: number;      // Creation timestamp
}
```

---

## View Preference Keys (Deprecated - Migrated to userSettings)

These standalone keys are deprecated and should be accessed via `userSettings` instead:

### `searchViewStyle` ❌ DEPRECATED

**Migration**: Now stored in `userSettings.searchViewStyle`

**Type**: String (`"classic"` | `"split_screen"`)

---

### `searchResultViewStyle` ❌ DEPRECATED

**Migration**: Now stored in `userSettings.searchResultViewStyle`

**Type**: String (`"list"` | `"galaxy"`)

---

### `preferredAIClipsViewStyle` ❌ DEPRECATED

**Migration**: Now stored in `userSettings.preferredAIClipsViewStyle`

**Type**: String (`"list"` | `"grid"`)

---

## Usage Patterns

### Reading Settings

```typescript
// Using the hook (recommended)
import { useUserSettings } from '../hooks/useUserSettings';

const { settings, updateSetting } = useUserSettings();
const showLabels = settings.showAxisLabels ?? false;

// Direct localStorage access (legacy)
const saved = localStorage.getItem('userSettings');
const settings = saved ? JSON.parse(saved) : {};
```

### Writing Settings

```typescript
// Using the hook (recommended)
await updateSetting('showAxisLabels', true);

// Or update multiple at once
await updateSettings({
  showAxisLabels: true,
  searchViewStyle: 'split_screen'
});

// Direct localStorage access (legacy - not recommended)
const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
settings.showAxisLabels = true;
localStorage.setItem('userSettings', JSON.stringify(settings));
```

---

## Schema Versioning

### Current Version: 2.0

**Version History**:

- **v1.0**: Initial schema with standalone keys
- **v2.0**: Consolidated into `userSettings` object
  - Added: `showAxisLabels`, `searchViewStyle`, `searchResultViewStyle`, `preferredAIClipsViewStyle`
  - Deprecated: Standalone view preference keys

---

## Migration Notes

When adding new user preferences:

1. ✅ Add to `UserPreferences` interface in `src/services/preferencesService.ts`
2. ✅ Set default value in `useUserSettings` hook if needed
3. ✅ Use `updateSetting()` or `updateSettings()` from the hook
4. ✅ Document in this file
5. ❌ Don't create new standalone localStorage keys

### Example: Adding a New Setting

```typescript
// 1. Add to UserPreferences interface
export interface UserPreferences {
  // ... existing fields
  myNewSetting?: boolean;
}

// 2. Set default in useUserSettings if needed
const [settings, setSettings] = useState<UserPreferences>(() => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  const parsed = stored ? JSON.parse(stored) : {};
  
  if (parsed.myNewSetting === undefined) {
    parsed.myNewSetting = true; // default value
  }
  
  return parsed;
});

// 3. Use in component
const { settings, updateSetting } = useUserSettings();
await updateSetting('myNewSetting', newValue);
```

---

## Security Considerations

- ✅ No sensitive data should be stored in localStorage (use httpOnly cookies for sensitive auth)
- ✅ `auth_token` is stored but should be short-lived and validated server-side
- ✅ Clear auth-related keys on sign-out:
  - `auth_token`
  - `squareId`
  - `isSubscribed`

---

## Cleanup & Maintenance

### On User Sign Out

```typescript
localStorage.removeItem('auth_token');
localStorage.removeItem('squareId');
localStorage.removeItem('isSubscribed');
// Keep userSettings (non-auth preferences)
```

### Clear All User Data

```typescript
localStorage.clear(); // Nuclear option - use sparingly
```

---

## Testing

When testing localStorage functionality:

```typescript
// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: string) { this.store[key] = value; },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; }
};

global.localStorage = mockLocalStorage as any;
```


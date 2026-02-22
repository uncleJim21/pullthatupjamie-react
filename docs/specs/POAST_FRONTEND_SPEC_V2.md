# X-POAST Frontend Specification v2

## Problem Statement

Current implementation has multiple issues:
1. Breaks sign-in flow
2. Wrong upload endpoint (uses `/api/upload` which doesn't exist)
3. Cheap UI that doesn't match Jamie's design language
4. No way to review scheduled posts
5. Poor platform selection indicators
6. Uses `validatePrivs` backend endpoints (requires podcast)

## Design Language Reference

Jamie uses:
- **Background:** `#0a0a0a` to `#000000` (very dark gray to black)
- **Borders:** `border-gray-800` (Tailwind) = `rgba(31, 41, 55, 1)`
- **Text primary:** `text-white` / `text-gray-100`
- **Text secondary:** `text-gray-300` / `text-gray-400`
- **Text muted:** `text-gray-500` / `text-gray-600`
- **Buttons:** Gradient backgrounds, rounded-lg, hover states
- **Inputs:** `bg-gray-900` / `bg-[#0a0a0a]` with `border-gray-700`
- **Modals:** `bg-[#0a0a0a] border border-gray-800 rounded-2xl shadow-2xl`
- **Icons:** Lucide React (already imported)

## Components to Reuse

### 1. Upload Service (CRITICAL - Don't reinvent)

**FROM: `src/services/uploadService.ts`**

```typescript
import UploadService from '../services/uploadService.ts';

// Usage in component:
const handleMediaUpload = async (file: File) => {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  
  try {
    const result = await UploadService.processFileUpload(file, token, true);
    setMediaUrl(result.fileUrl);
  } catch (error) {
    console.error('Upload failed:', error);
    setError(error.message);
  }
};
```

**DO NOT create new upload logic. Use `UploadService.processFileUpload`.**

### 2. Modal Structure

**FROM: `src/components/SignInModal.tsx`** (lines 680-700)

```tsx
return (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 shadow-2xl relative w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        {/* Content here */}
      </div>
    </div>
  </div>
);
```

### 3. Button Styles

**FROM: `src/components/SignInModal.tsx`** (line 619)

```tsx
// Primary button
<button
  className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg px-4 py-3 font-medium hover:from-purple-500 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
>
  Button Text
</button>

// Secondary button (outlined)
<button
  className="w-full border border-gray-700 text-gray-300 rounded-lg px-4 py-3 font-medium hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-600/50 transition-all"
>
  Button Text
</button>
```

### 4. Input Styles

```tsx
<input
  type="text"
  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
  placeholder="Placeholder text"
/>

<textarea
  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
  rows={4}
  placeholder="What's happening?"
/>
```

## New Component Structure

### File: `src/components/PoastPage.tsx` (COMPLETE REWRITE)

#### Required Features

1. **Auth Check** - Redirect to `/app` if not signed in (don't show content)
2. **Post Composition**
   - Text input (multiline)
   - Character counter for Twitter (280 limit, show warning at 250+)
   - Media upload button
   - Media preview with remove button
3. **Platform Selection**
   - Twitter and Nostr chips
   - Visual indicators:
     - **Twitter**: Blue theme, Twitter logo (from `lucide-react`)
     - **Nostr**: Purple theme, Nostr logo (from `/nostr-logo-square.png`)
   - Selected state: Checkmark on top-right corner (like iOS)
   - Unselected: Faded opacity
4. **Scheduling**
   - "Post Now" vs "Schedule" toggle
   - DateTime picker (reuse DateTimePicker if exists, or native datetime-local)
5. **Scheduled Posts List**
   - Separate section below compose form
   - List format with:
     - Platform icon + color code
     - Post text preview (first 100 chars)
     - Scheduled time (formatted)
     - Status badge (scheduled/processing/posted/failed)
     - Edit/Delete buttons
   - Filter by platform (All / Twitter / Nostr)
   - Empty state when no posts

#### API Integration

```typescript
import { API_URL } from '../constants/constants.ts';

const API_BASE = `${API_URL}/api/user/social`;

// Create post
const createPost = async (data: {
  text: string;
  mediaUrl?: string;
  platforms: ('twitter' | 'nostr')[];
  scheduledFor?: string;
  timezone?: string;
}) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create post');
  }
  
  return response.json();
};

// List posts
const listPosts = async (filters?: { status?: string; platform?: string }) => {
  const token = localStorage.getItem('auth_token');
  const params = new URLSearchParams(filters);
  const response = await fetch(`${API_BASE}/posts?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json();
};

// Delete post
const deletePost = async (postId: string) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) throw new Error('Failed to delete post');
  return response.json();
};
```

## Platform Color Coding

```typescript
const PLATFORM_STYLES = {
  twitter: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    hoverBg: 'hover:bg-blue-500/20',
    selectedBg: 'bg-blue-500/20',
    selectedBorder: 'border-blue-500',
  },
  nostr: {
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    hoverBg: 'hover:bg-purple-500/20',
    selectedBg: 'bg-purple-500/20',
    selectedBorder: 'border-purple-500',
  }
};
```

## Platform Selection UI (iOS-style)

```tsx
{(['twitter', 'nostr'] as const).map(platform => {
  const isSelected = platforms.includes(platform);
  const styles = PLATFORM_STYLES[platform];
  
  return (
    <button
      key={platform}
      onClick={() => togglePlatform(platform)}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
        isSelected 
          ? `${styles.selectedBg} ${styles.selectedBorder}` 
          : `${styles.bg} ${styles.border} opacity-60`
      } ${styles.hoverBg}`}
    >
      {/* Icon */}
      {platform === 'twitter' ? (
        <Twitter size={20} className={styles.color} />
      ) : (
        <img 
          src="/nostr-logo-square.png" 
          alt="Nostr" 
          className="w-5 h-5"
          style={{ filter: 'brightness(1.3) saturate(0.8)' }}
        />
      )}
      
      {/* Label */}
      <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
        {platform === 'twitter' ? 'Twitter' : 'Nostr'}
      </span>
      
      {/* Checkmark (top-right corner when selected) */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <Check size={14} className="text-white" />
        </div>
      )}
    </button>
  );
})}
```

## Scheduled Posts List UI

```tsx
<div className="mt-8 border-t border-gray-800 pt-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-bold text-white">Scheduled Posts</h2>
    
    {/* Platform filter */}
    <div className="flex gap-2">
      <button
        onClick={() => setFilter('all')}
        className={`px-3 py-1 rounded-lg text-sm ${
          filter === 'all' 
            ? 'bg-gray-700 text-white' 
            : 'text-gray-400 hover:text-white'
        }`}
      >
        All
      </button>
      <button
        onClick={() => setFilter('twitter')}
        className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${
          filter === 'twitter' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'text-gray-400 hover:text-blue-400'
        }`}
      >
        <Twitter size={14} />
        Twitter
      </button>
      <button
        onClick={() => setFilter('nostr')}
        className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${
          filter === 'nostr' 
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
            : 'text-gray-400 hover:text-purple-400'
        }`}
      >
        <img src="/nostr-logo-square.png" className="w-3.5 h-3.5" />
        Nostr
      </button>
    </div>
  </div>

  {scheduledPosts.length === 0 ? (
    <div className="text-center py-12 text-gray-500">
      <Clock size={48} className="mx-auto mb-4 opacity-50" />
      <p>No scheduled posts yet</p>
    </div>
  ) : (
    <div className="space-y-3">
      {scheduledPosts.map(post => (
        <div 
          key={post._id}
          className={`border rounded-lg p-4 ${
            PLATFORM_STYLES[post.platform].border
          } ${PLATFORM_STYLES[post.platform].bg}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              {/* Platform icon */}
              {post.platform === 'twitter' ? (
                <Twitter size={16} className="text-blue-400 mt-1 flex-shrink-0" />
              ) : (
                <img src="/nostr-logo-square.png" className="w-4 h-4 mt-1 flex-shrink-0" />
              )}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm line-clamp-2 mb-2">
                  {post.content.text || '(Media only)'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>{formatDate(post.scheduledFor)}</span>
                  <span className={`px-2 py-0.5 rounded ${getStatusBadgeClass(post.status)}`}>
                    {post.status}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <button
              onClick={() => deletePost(post._id)}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

## Route Fix

**In: `src/index.js`**

Current route is fine, but ensure auth redirect happens in component:

```tsx
// At top of PoastPage component
useEffect(() => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    navigate('/app');
  }
}, [navigate]);
```

## Testing Checklist

- [ ] Page loads at `/poast`
- [ ] Redirects to `/app` when not signed in
- [ ] Can type text (no character limit for Nostr, 280 for Twitter)
- [ ] Character counter shows for Twitter selection
- [ ] Character counter turns yellow at 250, red at 280+
- [ ] Can upload media via `UploadService.processFileUpload`
- [ ] Media preview displays with remove button
- [ ] Platform selection shows checkmarks correctly
- [ ] Twitter selection shows blue theme
- [ ] Nostr selection shows purple theme
- [ ] Can schedule for later with datetime picker
- [ ] Can post immediately
- [ ] Posts appear in scheduled list
- [ ] Platform filter works (All/Twitter/Nostr)
- [ ] Can delete scheduled posts
- [ ] Status badges show correctly
- [ ] Error messages display properly
- [ ] Mobile responsive

## Files to Create/Modify

1. **REWRITE:** `src/components/PoastPage.tsx`
2. **NO CHANGES:** `src/index.js` (route already exists)

## Design Assets Needed

- `/nostr-logo-square.png` (should already exist based on SignInModal usage)
- Lucide icons: `Twitter`, `Clock`, `Check`, `X`, `Loader2`, `Upload`, `Image`

## Dependencies

- `src/services/uploadService.ts` (already exists - USE THIS)
- `src/constants/constants.ts` (already exists - import API_URL)
- `lucide-react` (already installed)
- `react-router-dom` (already installed)

## Critical Don'ts

- ❌ Don't create new upload logic
- ❌ Don't use inline styles (use Tailwind classes)
- ❌ Don't use `/api/social/posts` (use `/api/user/social/posts`)
- ❌ Don't break sign-in flow (just redirect if no token)
- ❌ Don't make it look cheap (follow Jamie's design language)

## Twitter OAuth Connection

### Platform Connection Service

**FROM: `src/services/platformIntegrationService.ts`**

```typescript
import PlatformIntegrationService from '../services/platformIntegrationService.ts';

// Check if Twitter is connected
const checkTwitterStatus = async () => {
  const status = await PlatformIntegrationService.checkTwitterAuth();
  return status.authenticated;
};

// Connect Twitter (opens OAuth popup)
const connectTwitter = async () => {
  const result = await PlatformIntegrationService.connectTwitter();
  if (result.success) {
    // OAuth popup opened, poll for completion
    pollTwitterConnection();
  }
};

// Poll for connection completion (user finishes OAuth in popup)
const pollTwitterConnection = () => {
  const interval = setInterval(async () => {
    const status = await PlatformIntegrationService.checkTwitterAuth();
    if (status.authenticated) {
      clearInterval(interval);
      setTwitterConnected(true);
      // Refresh platform selection UI
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 5 minutes
  setTimeout(() => clearInterval(interval), 300000);
};
```

### Platform Selection UI Update

When Twitter is selected but not connected, show connection prompt:

```tsx
const [twitterConnected, setTwitterConnected] = useState(false);
const [nostrAvailable, setNostrAvailable] = useState(false);

// Check connection status on mount
useEffect(() => {
  const checkConnections = async () => {
    const twitterStatus = await PlatformIntegrationService.checkTwitterAuth();
    setTwitterConnected(twitterStatus.authenticated);
    
    // Nostr: check for browser extension
    setNostrAvailable(typeof window !== 'undefined' && !!window.nostr);
  };
  
  checkConnections();
}, []);

// Platform chip rendering
{(['twitter', 'nostr'] as const).map(platform => {
  const isSelected = platforms.includes(platform);
  const styles = PLATFORM_STYLES[platform];
  
  // Connection state
  const isConnected = platform === 'twitter' ? twitterConnected : nostrAvailable;
  const needsConnection = isSelected && !isConnected;
  
  return (
    <div key={platform} className="relative">
      <button
        onClick={() => {
          if (platform === 'twitter' && !twitterConnected) {
            // Don't toggle, show connect prompt instead
            return;
          }
          togglePlatform(platform);
        }}
        className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
          isSelected 
            ? `${styles.selectedBg} ${styles.selectedBorder}` 
            : `${styles.bg} ${styles.border} opacity-60`
        } ${styles.hoverBg}`}
      >
        {/* Icon */}
        {platform === 'twitter' ? (
          <Twitter size={20} className={styles.color} />
        ) : (
          <img 
            src="/nostr-logo-square.png" 
            alt="Nostr" 
            className="w-5 h-5"
            style={{ filter: 'brightness(1.3) saturate(0.8)' }}
          />
        )}
        
        {/* Label */}
        <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
          {platform === 'twitter' ? 'Twitter' : 'Nostr'}
        </span>
        
        {/* Connection status badge */}
        {!isConnected && (
          <span className="text-xs text-gray-500">
            (not connected)
          </span>
        )}
        
        {/* Checkmark (top-right corner when selected AND connected) */}
        {isSelected && isConnected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <Check size={14} className="text-white" />
          </div>
        )}
      </button>
      
      {/* Connection prompt overlay */}
      {needsConnection && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <button
            onClick={async () => {
              if (platform === 'twitter') {
                await PlatformIntegrationService.connectTwitter();
                // Start polling for completion
                const interval = setInterval(async () => {
                  const status = await PlatformIntegrationService.checkTwitterAuth();
                  if (status.authenticated) {
                    clearInterval(interval);
                    setTwitterConnected(true);
                  }
                }, 2000);
                setTimeout(() => clearInterval(interval), 300000);
              }
            }}
            className={`px-4 py-2 rounded-lg ${styles.selectedBg} ${styles.selectedBorder} text-white font-medium hover:opacity-80 transition-opacity`}
          >
            Connect {platform === 'twitter' ? 'Twitter' : 'Nostr'}
          </button>
        </div>
      )}
    </div>
  );
})}
```

### Validation Before Posting

```typescript
const handleSubmit = async () => {
  // Check platform connections before posting
  if (platforms.includes('twitter')) {
    const status = await PlatformIntegrationService.checkTwitterAuth();
    if (!status.authenticated) {
      setError('Please connect your Twitter account before posting');
      return;
    }
  }
  
  if (platforms.includes('nostr')) {
    if (!window.nostr) {
      setError('Please install a Nostr browser extension (nos2x or Alby)');
      return;
    }
  }
  
  // Proceed with post creation...
};
```

### Testing Checklist Updates

Add to existing checklist:

- [ ] Shows "Connect Twitter" prompt when Twitter selected but not connected
- [ ] Twitter OAuth popup opens correctly
- [ ] Polling detects successful Twitter connection
- [ ] Platform selection updates after successful connection
- [ ] Shows "not connected" badge for disconnected platforms
- [ ] Prevents posting to Twitter if not connected
- [ ] Nostr extension detection works correctly
- [ ] Connection state persists across page refreshes


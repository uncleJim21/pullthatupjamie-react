# X-POAST Frontend Specification v2

## Problem Statement

Current implementation has multiple issues:
1. Breaks sign-in flow
2. Wrong upload endpoint (uses `/api/upload` which doesn't exist)
3. Cheap UI that doesn't match Jamie's design language
4. No way to review scheduled posts
5. Poor platform selection indicators
6. Uses `validatePrivs` backend endpoints (requires podcast)

## Design System

**🎨 CRITICAL: Read the complete design system first**

**[POAST_DESIGN_SYSTEM.md](./POAST_DESIGN_SYSTEM.md)** - Lightning Faucet-inspired aesthetic

Key principles:
- Near-black backgrounds (`#0e0e0f`, not pure black)
- White text with subtle glows
- Extremely generous whitespace (py-20+)
- Space Grotesk for headings, Inter for body
- Subtle borders (`border-white/10`)
- Twitter blue and Nostr purple used ONLY on their elements
- Hover states with lift + glow
- No shadows, only glows

**Do not deviate from the design system.** This is what makes it premium vs. cheap.

## Components to Reuse

### 1. Upload Service (CRITICAL - Don't reinvent)

**FROM: `src/services/uploadService.ts`**

```typescript
import UploadService from '../services/uploadService.ts';

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

### 2. Platform Integration Service

**FROM: `src/services/platformIntegrationService.ts`**

```typescript
import PlatformIntegrationService from '../services/platformIntegrationService.ts';

// Check Twitter connection
const checkTwitterStatus = async () => {
  const status = await PlatformIntegrationService.checkTwitterAuth();
  return status.authenticated;
};

// Connect Twitter (opens OAuth popup)
const connectTwitter = async () => {
  const result = await PlatformIntegrationService.connectTwitter();
  if (result.success) {
    pollTwitterConnection();
  }
};
```

## API Integration

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
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json();
};

// Delete post
const deletePost = async (postId: string) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error('Failed to delete post');
  return response.json();
};
```

## Page Structure

### Layout Overview

```
┌─────────────────────────────────────────────────────────┐
│ PageBanner (existing component)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Generous vertical padding - py-20 lg:py-32]          │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │        X-POAST (glowing headline)               │    │
│  │     Cross-post to Twitter and Nostr with style  │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ COMPOSE CARD (elevated bg, subtle border)      │    │
│  │                                                  │    │
│  │  • Textarea (character counter for Twitter)     │    │
│  │  • Media upload button + preview                │    │
│  │  • Platform chips (Twitter/Nostr)               │    │
│  │  • Schedule toggle + datetime picker            │    │
│  │  • [POAST] button (white with glow)             │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │ SCHEDULED POSTS (list)                          │    │
│  │                                                  │    │
│  │  Platform filter pills                          │    │
│  │                                                  │    │
│  │  [Post cards with platform color coding]        │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```tsx
<PoastPage>
  <div className="min-h-screen bg-[#0e0e0f]">
    <PageBanner />
    
    {/* Hero Section */}
    <section className="py-20 lg:py-32">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="[design-system headline style]">X-POAST</h1>
        <p className="[design-system subtitle style]">Tagline</p>
      </div>
    </section>
    
    {/* Compose Section */}
    <section className="pb-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="[design-system card style]">
          <ComposeForm />
        </div>
      </div>
    </section>
    
    {/* Scheduled Posts Section */}
    <section className="pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <ScheduledPostsList />
      </div>
    </section>
  </div>
</PoastPage>
```

## Critical Implementation Details

### 1. Character Counter with Glowing States

```tsx
const [charCount, setCharCount] = useState(0);
const isTwitterSelected = platforms.includes('twitter');
const isOverLimit = isTwitterSelected && charCount > 280;
const isWarning = isTwitterSelected && charCount > 250;

// Character counter display
{isTwitterSelected && (
  <div 
    className="text-sm font-mono transition-all duration-300"
    style={{
      color: isOverLimit ? '#ef4444' : isWarning ? '#f59e0b' : '#82828c',
      textShadow: isOverLimit 
        ? '0 0 10px rgba(239, 68, 68, 0.4)'
        : isWarning
        ? '0 0 10px rgba(245, 158, 11, 0.3)'
        : 'none'
    }}
  >
    {charCount}/280
  </div>
)}
```

### 2. Platform Chips with Connection State

```tsx
const PlatformChip = ({ platform }: { platform: 'twitter' | 'nostr' }) => {
  const [connected, setConnected] = useState(false);
  const isSelected = platforms.includes(platform);
  
  useEffect(() => {
    if (platform === 'twitter') {
      PlatformIntegrationService.checkTwitterAuth()
        .then(status => setConnected(status.authenticated));
    } else {
      setConnected(!!window.nostr);
    }
  }, [platform]);
  
  const styles = {
    twitter: {
      color: '#1d9bf0',
      bg: 'bg-[#1d9bf0]/10',
      border: 'border-[#1d9bf0]',
      glow: '0 0 30px rgba(29, 155, 240, 0.3)'
    },
    nostr: {
      color: '#8b5cf6',
      bg: 'bg-[#8b5cf6]/10',
      border: 'border-[#8b5cf6]',
      glow: '0 0 30px rgba(139, 92, 246, 0.3)'
    }
  };
  
  const s = styles[platform];
  
  return (
    <div className="relative">
      <button
        onClick={() => togglePlatform(platform)}
        disabled={!connected}
        className={`
          relative px-6 py-4 rounded-xl
          border-2 transition-all duration-300
          ${isSelected ? `${s.bg} ${s.border}` : 'bg-[#1a1a1b] border-white/10'}
          ${!connected && 'opacity-50 cursor-not-allowed'}
          ${connected && 'hover:-translate-y-0.5'}
        `}
        style={isSelected ? { boxShadow: s.glow } : {}}
      >
        <div className="flex items-center gap-3">
          {platform === 'twitter' ? (
            <Twitter 
              className="w-5 h-5" 
              style={{ 
                color: s.color,
                filter: isSelected ? `drop-shadow(0 0 10px ${s.color}40)` : 'none'
              }} 
            />
          ) : (
            <img 
              src="/nostr-logo-square.png"
              className="w-5 h-5"
              style={{
                filter: isSelected 
                  ? `brightness(1.2) drop-shadow(0 0 10px ${s.color}40)`
                  : 'brightness(0.5)'
              }}
            />
          )}
          
          <span className={`font-display font-semibold ${isSelected ? 'text-white' : 'text-[#82828c]'}`}>
            {platform === 'twitter' ? 'Twitter' : 'Nostr'}
          </span>
          
          {!connected && (
            <span className="text-xs text-[#4a4a4f]">(not connected)</span>
          )}
        </div>
        
        {/* Checkmark badge */}
        {isSelected && connected && (
          <div className="
            absolute -top-2 -right-2 w-6 h-6
            bg-[#10b981] rounded-full
            flex items-center justify-center
            shadow-[0_0_20px_rgba(16,185,129,0.4)]
          ">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </button>
      
      {/* Connection overlay */}
      {isSelected && !connected && (
        <div className="
          absolute inset-0 bg-black/80 backdrop-blur-sm
          rounded-xl flex items-center justify-center
        ">
          <button
            onClick={() => handleConnect(platform)}
            className={`
              px-4 py-2 rounded-lg font-display font-semibold
              ${s.bg} ${s.border} text-white
              transition-all duration-300
              hover:opacity-80
            `}
          >
            Connect {platform === 'twitter' ? 'Twitter' : 'Nostr'}
          </button>
        </div>
      )}
    </div>
  );
};
```

### 3. Scheduled Post Card

```tsx
const ScheduledPostCard = ({ post }: { post: ScheduledPost }) => {
  const platformStyle = {
    twitter: {
      color: '#1d9bf0',
      bg: 'bg-[#1d9bf0]/10',
      border: 'border-[#1d9bf0]/30',
      topBorder: 'before:bg-gradient-to-r before:from-[#1d9bf0] before:to-[#0d7bbf]'
    },
    nostr: {
      color: '#8b5cf6',
      bg: 'bg-[#8b5cf6]/10',
      border: 'border-[#8b5cf6]/30',
      topBorder: 'before:bg-gradient-to-r before:from-[#8b5cf6] before:to-[#6d28d9]'
    }
  };
  
  const s = platformStyle[post.platform];
  
  return (
    <div className={`
      relative overflow-hidden
      ${s.bg} border ${s.border} rounded-2xl p-6
      transition-all duration-300
      hover:-translate-y-1
      hover:border-opacity-50
      hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]
      before:absolute before:top-0 before:left-0 before:right-0 before:h-1
      ${s.topBorder}
    `}>
      <div className="flex items-start gap-4">
        {/* Platform icon */}
        <div className="flex-shrink-0 mt-1">
          {post.platform === 'twitter' ? (
            <Twitter 
              className="w-5 h-5" 
              style={{ 
                color: s.color,
                filter: `drop-shadow(0 0 10px ${s.color}40)`
              }} 
            />
          ) : (
            <img 
              src="/nostr-logo-square.png"
              className="w-5 h-5"
              style={{
                filter: `brightness(1.2) drop-shadow(0 0 10px ${s.color}40)`
              }}
            />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[#c4c4c4] text-sm mb-3 line-clamp-2">
            {post.content.text || '(Media only)'}
          </p>
          
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#82828c]">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{formatDate(post.scheduledFor)}</span>
            </div>
            
            <StatusBadge status={post.status} />
          </div>
        </div>
        
        {/* Delete button */}
        <button
          onClick={() => handleDelete(post._id)}
          className="
            flex-shrink-0
            w-8 h-8
            bg-[#1a1a1b] border border-white/10 rounded-lg
            flex items-center justify-center
            text-[#82828c]
            transition-all duration-300
            hover:bg-[#ef4444]/10
            hover:border-[#ef4444]/30
            hover:text-[#ef4444]
          "
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

### 4. Primary POAST Button

```tsx
<button
  onClick={handleSubmit}
  disabled={isDisabled || isLoading}
  className="
    relative overflow-hidden group
    w-full px-8 py-4
    bg-white text-[#0e0e0f]
    font-display font-semibold text-lg
    rounded-xl
    transition-all duration-300
    hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]
    hover:scale-105
    disabled:opacity-40
    disabled:cursor-not-allowed
    disabled:hover:scale-100
  "
>
  <span className="relative z-10">
    {isLoading ? (
      <span className="flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        POASTING...
      </span>
    ) : (
      'POAST'
    )}
  </span>
  
  {/* Shine effect */}
  <div className="
    absolute inset-0 -translate-x-full
    bg-gradient-to-r from-transparent via-white/20 to-transparent
    group-hover:translate-x-full
    transition-transform duration-700
  " />
</button>
```

## Testing Checklist

### Design System Compliance
- [ ] Background is `#0e0e0f` (not black or gray-900)
- [ ] Card backgrounds are `#1a1a1b`
- [ ] All borders use `border-white/10` or `border-white/20`
- [ ] Headlines use Space Grotesk (`font-display`)
- [ ] Body text uses Inter (`font-sans`)
- [ ] Main headline has text glow effect
- [ ] Vertical padding is generous (py-20 minimum)
- [ ] Twitter elements use blue ONLY
- [ ] Nostr elements use purple ONLY
- [ ] Hover states have lift (-translate-y-1)
- [ ] Hover states have glow (box-shadow)

### Functionality
- [ ] Redirects to `/app` when not signed in
- [ ] Text input works (no char limit for Nostr)
- [ ] Character counter shows for Twitter selection
- [ ] Counter glows amber at 250+, red at 280+
- [ ] Media upload uses `UploadService.processFileUpload`
- [ ] Media preview with remove button
- [ ] Platform connection status checked on mount
- [ ] Twitter OAuth popup opens
- [ ] Nostr extension detection works
- [ ] Connection overlay shows when needed
- [ ] Platforms can be toggled
- [ ] Schedule toggle works
- [ ] Can post immediately or schedule
- [ ] Posts appear in scheduled list
- [ ] Platform filter works (All/Twitter/Nostr)
- [ ] Can delete scheduled posts
- [ ] Status badges display correctly
- [ ] Error states show with glowing text
- [ ] Mobile responsive

## Files to Create/Modify

1. **COMPLETE REWRITE:** `src/components/PoastPage.tsx`
2. **NO CHANGES:** `src/index.js` (route exists)

## Dependencies

- `src/services/uploadService.ts` ✅
- `src/services/platformIntegrationService.ts` ✅
- `src/constants/constants.ts` ✅
- `lucide-react` ✅
- `react-router-dom` ✅

## Critical Don'ts

- ❌ Don't use pure black (#000)
- ❌ Don't use generic Tailwind colors (gray-900, blue-500, etc.)
- ❌ Don't skip text glows on headlines
- ❌ Don't use small padding (minimum py-20)
- ❌ Don't add platform colors everywhere (only on their elements)
- ❌ Don't use dark shadows (only white/colored glows)
- ❌ Don't skip hover states (all interactive elements need lift + glow)
- ❌ Don't create new upload logic
- ❌ Don't use wrong API endpoints

# Embed Mode Implementation for Shared Sessions

## Overview
Added embed mode support for shared research sessions, which provides a cleaner, more focused view suitable for embedding in external sites or sharing.

## Changes Made

### 1. URL Parameter Detection
**Location:** Line ~1334 in `SearchInterface.tsx`

Added detection for the `embed` URL parameter:
```typescript
const isEmbedMode = searchParams.get('embed') === 'true';
```

**Usage:** Add `?embed=true` to any shared session URL to activate embed mode.

### 2. Hidden Components in Embed Mode

#### a) PageBanner
**Location:** Line ~2076 in `SearchInterface.tsx`

The top navigation banner (logo, sign in, tutorial, etc.) is now hidden in embed mode:
```typescript
{!isEmbedMode && (
  <PageBanner 
    logoText="Pull That Up Jamie!" 
    // ... props
  />
)}
```

#### b) Floating Search Bar
**Location:** Line ~2901 in `SearchInterface.tsx`

The floating search bar at the bottom is hidden in embed mode:
```typescript
{!isEmbedMode && hasSearchedInMode(searchMode) && /* ... */ (
  // Floating search bar UI
)}
```

#### c) List/Galaxy View Toggle
**Location:** Line ~2590 in `SearchInterface.tsx`

The segmented control that switches between List and Galaxy view is hidden in embed mode:
```typescript
{!isEmbedMode && (conversation.length > 0 || /* ... */) && (
  <div className="flex justify-center mt-4 mb-3">
    {/* List/Galaxy toggle buttons */}
  </div>
)}
```

#### d) UnifiedSidePanel
**Location:** Line ~3168 in `SearchInterface.tsx`

The side panel (context + analysis panels) is hidden in embed mode for split-screen views:
```typescript
{!isEmbedMode && searchMode === 'podcast-search' && /* ... */ (
  <UnifiedSidePanel
    // ... props
  />
)}
```

### 3. Full Height Galaxy View in Embed Mode
**Location:** Line ~2627 in `SearchInterface.tsx`

The galaxy view container takes up the full viewport height in embed mode (instead of leaving space for the header/search bar):
```typescript
<div className="relative w-full transition-all duration-300 ease-in-out" style={{ 
  height: isEmbedMode ? '100vh' : 'calc(100vh - 150px)' 
}}>
```

This ensures the 3D visualization fills the entire screen when embedded, providing an immersive full-screen experience.

### 4. Hidden Stats/Legend Panel in Embed Mode
**Location:** Line ~1820 in `SemanticGalaxyView.tsx`

The stats and legend panel on the right side is hidden in embed mode:
```typescript
{!hideStats && (
  <div className="absolute top-2 right-4 bg-black/80 backdrop-blur-sm...">
    {/* Stats, Legend, and Research Session UI */}
  </div>
)}
```

Passed from SearchInterface:
```typescript
hideStats={isEmbedMode}
```

### 5. Configurable Nebula Dim Opacity
**Location:** Lines 399, 1328, 1407, 2700 in `SemanticGalaxyView.tsx` and SearchInterface.tsx

The nebula background dim opacity is now configurable via props:

**NebulaBackground component:**
```typescript
const NebulaBackground: React.FC<{ dimOpacity?: number }> = ({ 
  dimOpacity = NEBULA_CONFIG.DIM_OPACITY 
}) => {
  // ... uses dimOpacity for the black overlay opacity
}
```

**Passed through component hierarchy:**
- `SemanticGalaxyView` → `GalaxyScene` → `NebulaBackground`

**In embed mode (SearchInterface.tsx):**
```typescript
nebulaDimOpacity={isEmbedMode ? 0.65 : undefined}
```

This makes the nebula background darker (0.65 vs default 0.5) in embed mode for better star visibility against external site backgrounds.

### 6. Future Enhancement: Mini Player
**Location:** Line ~3079 in `SearchInterface.tsx`

Added a TODO comment for implementing a mini player specifically for embed mode:
```typescript
{/* TODO: Mini Player for Embed Mode
    When isEmbedMode is true, add a mini player at the bottom showing:
    - Podcast/Episode thumbnail
    - Episode title
    - Quote/clip info
    - Basic playback controls
    This will replace the floating search bar in embedded shared sessions
*/}
```

## How to Use

### Basic Embed Mode
Add `?embed=true` to any shared session URL:
```
https://yoursite.com/?sharedSession=ABC123&embed=true
```

### Example URLs
- Regular shared session: `/?sharedSession=ABC123`
- Embedded shared session: `/?sharedSession=ABC123&embed=true`
- Embedded with research session ID: `/?researchSessionId=507f1f77bcf86cd799439011&embed=true`

## What Remains Hidden in Embed Mode
- ✅ Top navigation banner (PageBanner)
- ✅ Floating search bar (bottom of screen)
- ✅ List/Galaxy view toggle (segmented control)
- ✅ Unified side panel (split-screen context/analysis)
- ✅ Stats/Legend panel (right side of galaxy view)

## What Remains Visible in Embed Mode
- ✅ Galaxy view (3D visualization) at full height
- ✅ Galaxy controls (minimap, reset camera, options - bottom left)
- ✅ Shared session title banner (top center)
- ✅ All interactive features (star clicking, hover previews, camera controls)
- ✅ Context menu (right-click on stars)
- ✅ Darker nebula background (0.65 opacity vs 0.5 default)

## Future Work: Mini Player
The mini player would provide:
1. Basic audio playback controls
2. Current episode/quote information
3. Thumbnail display
4. Positioned at the bottom where the search bar used to be
5. Minimal, non-intrusive design suitable for embeds

## Testing
To test embed mode:
1. Create or access a shared session
2. Add `&embed=true` to the URL
3. Verify PageBanner, search bar, and side panel are hidden
4. Verify galaxy view and all its features still work correctly

## Technical Notes
- The `isEmbedMode` constant is derived from URL parameters and updates automatically when the URL changes
- All conditional rendering uses the `!isEmbedMode &&` pattern for consistency
- No new props or state variables were needed beyond reading from `searchParams`
- Changes are backward compatible - without the embed parameter, the interface behaves exactly as before

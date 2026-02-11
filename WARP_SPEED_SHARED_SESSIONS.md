# Warp Speed Shared Research Sessions

## Overview

Shared research sessions now load with the **full warp speed animation experience**, making them feel like a live 3D search rather than just displaying pre-loaded data.

## How It Works

### User Journey:

1. **User clicks share link**: `https://pullthatupjamie.ai/researchSession/8d5417e36d3d`

2. **Serverless function serves meta tags** (for social scrapers):
   ```html
   <meta property="og:title" content="..." />
   <meta property="og:image" content="..." />
   ```

3. **JavaScript redirects** (for humans):
   ```javascript
   window.location.replace('/app?sharedSession=8d5417e36d3d');
   ```

4. **React app loads** at `/app?sharedSession=8d5417e36d3d`:
   - Immediately switches to Galaxy View
   - **Starts warp speed animation** ⚡
   - Fetches session data with 3D coordinates
   - **Decelerates from warp speed** 🌟
   - Displays the research session in 3D

### Technical Flow:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User visits /researchSession/8d5417e36d3d                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Serverless function:                                     │
│    • Fetches metadata from backend                          │
│    • Returns HTML with meta tags                            │
│    • Includes redirect: window.location.replace(...)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. React app loads: /app?sharedSession=8d5417e36d3d        │
│    • Detects query parameter                                │
│    • Triggers warp speed (setIsLoading=true)                │
│    • Switches to Galaxy View                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. API Call #1: GET /api/shared-research-sessions/:shareId │
│    • Gets session metadata (title, id, etc.)                │
│    • Returns MongoDB session._id                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. API Call #2: POST /api/fetch-research-id                │
│    Body: {                                                   │
│      researchSessionId: <mongodb-id>,                       │
│      fastMode: true,                                         │
│      extractAxisLabels: true                                 │
│    }                                                         │
│    • Returns results with coordinates3d                      │
│    • Returns axis labels                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. React app processes results:                             │
│    • Sets galaxy results                                     │
│    • Sets axis labels                                        │
│    • Stops loading (setIsLoading=false)                     │
│    • Triggers warp speed deceleration                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. User sees:                                                │
│    • Warp speed particles slowing down                       │
│    • Stars appearing in 3D space                            │
│    • Interactive galaxy view                                 │
└─────────────────────────────────────────────────────────────┘
```

## Code Changes

### 1. New Service Function

**File**: `src/services/researchSessionShareService.ts`

```typescript
export async function fetchResearchSessionWith3D(researchSessionId: string) {
  const response = await fetch(`${API_URL}/api/fetch-research-id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      researchSessionId,
      fastMode: true,
      extractAxisLabels: true
    })
  });
  
  return await response.json();
}
```

### 2. Updated SearchInterface

**File**: `src/components/SearchInterface.tsx`

The `sharedSession` query parameter now triggers:

```typescript
// Start warp speed animation
setSearchState({ isLoading: true });
setIsDecelerationComplete(false);
setResultViewStyle(SearchResultViewStyle.GALAXY);

// Fetch session metadata
const sharedSession = await fetchSharedResearchSession(shareId);

// Fetch 3D coordinates
const research3DData = await fetchResearchSessionWith3D(sharedSession.id);

// Set results
setGalaxyResults(research3DData.results);
setAxisLabels(research3DData.axisLabels);

// Stop warp speed (triggers deceleration)
setSearchState({ isLoading: false });
```

## API Endpoints Used

### Backend Endpoint #1: Get Session Metadata
```
GET /api/shared-research-sessions/:shareId
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "6942ce3cc8377d6ffc8f7bc6",
    "shareId": "8d5417e36d3d",
    "title": "Research Session Title",
    "nodes": [...],
    "lastItemMetadata": {...}
  }
}
```

### Backend Endpoint #2: Get 3D Coordinates
```
POST /api/fetch-research-id
```

**Request**:
```json
{
  "researchSessionId": "6942ce3cc8377d6ffc8f7bc6",
  "fastMode": true,
  "extractAxisLabels": true
}
```

**Response**:
```json
{
  "query": "6942ce3cc8377d6ffc8f7bc6",
  "results": [
    {
      "shareLink": "...",
      "quote": "...",
      "episode": "...",
      "creator": "...",
      "hierarchyLevel": "paragraph",
      "coordinates3d": {
        "x": 0.92,
        "y": 0.19,
        "z": -1.0
      },
      "similarity": { "combined": 1, "vector": 1 },
      ...
    }
  ],
  "total": 4,
  "axisLabels": {...},
  "metadata": {...}
}
```

## Why Two API Calls?

1. **First call** (`/api/shared-research-sessions/:shareId`):
   - Uses the short `shareId` from the URL
   - Gets session metadata and the MongoDB `_id`
   - Fast, lightweight

2. **Second call** (`/api/fetch-research-id`):
   - Uses the MongoDB `_id`
   - Computes 3D coordinates (UMAP projection)
   - Extracts axis labels
   - More expensive operation

## User Experience

### Before (Static Loading):
```
Link click → Redirect → Results instantly appear (boring)
```

### After (Warp Speed):
```
Link click → Redirect → Warp speed animation → Deceleration → Stars appear ✨
```

## Testing

```bash
# Test the warp speed flow
open "http://localhost:3001/researchSession/8d5417e36d3d"

# What you should see:
# 1. Meta tags load (check View Source)
# 2. Redirect to /app?sharedSession=8d5417e36d3d
# 3. Warp speed particles
# 4. Deceleration
# 5. Galaxy view with 4 stars
```

## Benefits

1. **Consistent UX**: Shared sessions feel like regular searches
2. **Fresh data**: Always computes latest 3D positions
3. **Axis labels**: Can show semantic axes if enabled
4. **Dramatic**: Warp speed animation makes sharing more exciting
5. **Professional**: Matches the rest of the app's animation quality

## Notes

- The warp speed animation lasts ~2 seconds total
- Deceleration happens automatically when `isLoading` becomes `false`
- The `WarpSpeedLoadingOverlay` component handles all animation logic
- No changes needed to the warp speed component itself

## Deployment

No additional configuration needed! Just deploy normally:

```bash
vercel --prod
```

The changes are fully backward compatible.

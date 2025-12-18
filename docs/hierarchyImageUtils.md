# Hierarchy Image Utilities

## Problem

The podcast application has a hierarchical data structure (Feed > Episode > Chapter > Paragraph) where images are stored with different field names at each level:

- **Paragraph**: `episodeImage`, `metadata.episodeImage`
- **Chapter**: No direct image (inherits from episode)
- **Episode**: `imageUrl`, `metadata.imageUrl`
- **Feed**: `imageUrl`, `metadata.imageUrl`, `podcastImage`
- **Search Results**: `episode_image`, `episodeImage`, `tooltipImage`

This inconsistency made it difficult to reliably extract images when:
- Adding items to research sessions
- Displaying hover previews
- Showing session history

## Solution

The `hierarchyImageUtils.ts` utility provides a consistent interface for extracting images from any hierarchical object.

## Usage Examples

### 1. Extract Image from Any Object

```typescript
import { extractImageFromAny } from '../utils/hierarchyImageUtils';

const image = extractImageFromAny(result);
// Checks: tooltipImage, episodeImage, imageUrl, episode_image, podcastImage, image
```

### 2. Get Image from Full Hierarchy

```typescript
import { getImageFromHierarchy } from '../utils/hierarchyImageUtils';

const image = getImageFromHierarchy(hierarchy);
// Priority: paragraph > episode > feed
```

### 3. Get Image from Research Item

```typescript
import { getImageFromResearchItem } from '../utils/hierarchyImageUtils';

const image = getImageFromResearchItem(item);
```

### 4. Normalize Research Item (ensures episodeImage exists)

```typescript
import { normalizeResearchItemImage } from '../utils/hierarchyImageUtils';

const normalizedItem = normalizeResearchItemImage(item);
// Mutates item to add episodeImage if missing
```

### 5. Get Image with Fallback

```typescript
import { getHierarchyImage } from '../utils/hierarchyImageUtils';

const image = getHierarchyImage(primaryObject, fallbackObject);
```

## Implementation Details

### Field Priority (checked in order)

1. `tooltipImage` - Explicit override (highest priority)
2. `episodeImage` - Common in paragraphs/search results
3. `imageUrl` - Common in episode/feed metadata
4. `episode_image` - Backend API format
5. `podcastImage` - Alternative naming
6. `image` - Generic fallback

### Where It's Used

1. **SearchInterface.tsx**: When adding items to research sessions
   ```typescript
   episodeImage: result.episodeImage || extractImageFromAny(result)
   ```

2. **SemanticGalaxyView.tsx**: In hover preview tooltips
   ```typescript
   const tooltipImage = extractImageFromAny(result);
   ```

3. **UnifiedSidePanel.tsx**: In sessions list display
   ```typescript
   {metadata?.episodeImage && <img src={metadata.episodeImage} />}
   ```

## Benefits

1. ✅ **Consistency**: Same logic everywhere images are extracted
2. ✅ **Reliability**: Checks all possible field names automatically
3. ✅ **Maintainability**: Single source of truth for image extraction
4. ✅ **Extensibility**: Easy to add new field names if needed
5. ✅ **Type Safety**: TypeScript interfaces ensure correct usage

## Future Improvements

- Add a default placeholder image constant
- Add image validation (check if URL is valid)
- Add caching for remote image availability
- Add support for CDN transformations (resize, optimize)

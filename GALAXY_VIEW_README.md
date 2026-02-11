# 3D Galaxy View - Installation & Usage

## Installation

To use the 3D Galaxy View feature, you need to install the following dependencies:

```bash
npm install three @react-three/fiber @react-three/drei
```

### Package Versions

- `three`: ^0.160.0 (Three.js - 3D rendering library)
- `@react-three/fiber`: ^8.15.0 (React renderer for Three.js)
- `@react-three/drei`: ^9.92.0 (Useful helpers for react-three-fiber)

## What Was Created

### New Files

1. **`src/components/SemanticGalaxyView.tsx`**
   - Main galaxy visualization component
   - Renders search results as 3D stars
   - Features:
     - Hierarchy-based color coding (from `HIERARCHY_COLORS`)
     - Hover preview with result details
     - Click to open context panel
     - Camera controls (zoom, pan, reset)
     - Minimap for spatial overview
     - Legend showing hierarchy colors
     - Selection highlighting with nearby star dimming

2. **`src/data/mockGalaxyData.ts`**
   - Mock 3D search results for testing
   - 15 hardcoded results with 3D coordinates
   - Includes all required fields matching the API spec

### Modified Files

1. **`src/constants/constants.ts`**
   - Added `SearchResultViewStyle` enum with `LIST` and `GALAXY` options

2. **`src/components/SearchInterface.tsx`**
   - Added view toggle between List and Galaxy views
   - Integrated `SemanticGalaxyView` component
   - Added state management for result view style
   - Persists user preference in localStorage

## Usage

### Basic Usage

The galaxy view is now integrated into SearchInterface. Once you've installed the dependencies and the app is running:

1. Navigate to podcast search mode
2. Perform a search (currently uses hardcoded mock data)
3. Click the "Galaxy" toggle button to switch to 3D view
4. Interact with the 3D space:
   - **Scroll/Pinch**: Zoom in/out
   - **Click+Drag**: Pan around
   - **Click Star**: Open context panel for that result
   - **Hover Star**: See preview popup
   - **Reset Camera**: Click "Reset Camera" button

### Features Demo

**Hierarchy Colors:**
- 🔴 Red (All Pods) - Feed-level results
- 🟠 Orange - Feed-level content
- 🟡 Beige/Light Orange - Episode-level content
- ⚪ White - Chapter-level content
- ⚫ Gray - Paragraph-level content

**Star States:**
- Normal: Medium brightness
- Hovered: Increased brightness + preview tooltip
- Selected: Pulsing animation, full brightness
- Near Selected: 60% opacity (dimmed)

**Controls:**
- Minimap (bottom-right): Shows bird's-eye view
- Legend (bottom-left): Hierarchy color reference
- Stats (top-right): Result count and selection status
- Reset button (top-left): Return camera to default position

## Current State - Prototype

### What Works
✅ 3D star field rendering with color-coded hierarchy
✅ Camera controls (zoom, pan)
✅ Hover previews with result details
✅ Click to select star and open context panel
✅ Minimap showing spatial distribution
✅ Legend and UI overlays
✅ View toggle between List and Galaxy

### What's Hardcoded (TODO)
⚠️ Search term: "artificial intelligence"
⚠️ Results: Using `MOCK_GALAXY_DATA` (15 hardcoded results)
⚠️ Coordinates: Manually created 3D positions

### Next Steps

1. **Connect to Real API**
   - Call `/api/search-quotes-3d` endpoint
   - Replace `MOCK_GALAXY_DATA` with real search results
   - Handle loading states

2. **Wire Up Search**
   - Use actual search query instead of hardcoded term
   - Trigger galaxy view refresh on new searches

3. **Context Panel Integration**
   - Currently opens panel but needs better synchronization
   - Ensure audio playback works from galaxy view

4. **Right-Click Context Menu**
   - Add "Search from this point" feature
   - Copy link, share options

5. **Performance Optimization**
   - Test with 100+ stars
   - Consider instanced mesh rendering for large datasets

6. **Mobile Considerations**
   - Add touch gesture support
   - Optimize for smaller screens
   - Consider stacking context panel above galaxy on mobile

## Troubleshooting

### "Cannot find module '@react-three/fiber'"
Run: `npm install three @react-three/fiber @react-three/drei`

### Stars not rendering / Black screen
1. Check console for errors
2. Verify Three.js is loaded: `console.log(window.THREE)`
3. Check if WebGL is supported in browser

### Performance issues
- Reduce number of results (< 100 for smooth performance)
- Check if GPU acceleration is enabled in browser
- Consider using instanced meshes (future optimization)

### Context panel not opening
- Check that `onStarClick` handler is properly wired
- Verify `selectedParagraphId` state is updating
- Ensure `PodcastContextPanel` receives correct paragraphId

## Architecture Notes

### Component Hierarchy
```
SearchInterface
├── View Toggle (List | Galaxy)
└── Conditional Render:
    ├── List View (existing ConversationRenderer)
    └── Galaxy View (new SemanticGalaxyView)
        ├── Canvas (react-three-fiber)
        │   ├── Camera + Controls
        │   ├── GalaxyScene
        │   │   └── Star[] (individual points)
        │   └── Lighting
        ├── HoverPreview (HTML overlay)
        ├── Minimap (2D canvas)
        ├── Legend
        ├── Stats
        └── Reset Camera button
```

### Data Flow
```
SearchInterface
  ↓ (search query)
/api/search-quotes-3d
  ↓ (results with coordinates3d)
SemanticGalaxyView
  ↓ (star click)
onStarClick → setSelectedParagraphId
  ↓
PodcastContextPanel (opens)
```

### State Management
- `resultViewStyle`: Toggle between LIST and GALAXY
- `selectedParagraphId`: Currently selected star (for context panel)
- `isContextPanelOpen`: Whether context panel is visible
- Persisted in localStorage: User's preferred view style

## Resources

- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [Three.js Docs](https://threejs.org/docs/)
- [Drei Helpers](https://github.com/pmndrs/drei)

## Questions?

See the main architecture doc at `docs/architecture/3DSemanticSearchEndpoint.md`


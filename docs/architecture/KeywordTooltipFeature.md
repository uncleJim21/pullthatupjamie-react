# Keyword Tooltip Feature

## Overview
A reusable tooltip component that enables contextual keyword searches from the podcast context panel.

## Components

### KeywordTooltip.tsx
**Location:** `src/components/KeywordTooltip.tsx`

A reusable tooltip component that:
- Triggers on clicking a keyword badge
- Displays a menu above the keyword with upward expand animation
- Supports customizable menu options
- Auto-closes when clicking outside
- Uses consistent design system (black background, gray borders, hover states)

**Props:**
- `keyword: string` - The keyword text to display
- `options: KeywordTooltipOption[]` - Array of menu options
- `onClose?: () => void` - Optional callback when tooltip closes

**KeywordTooltipOption Interface:**
```typescript
{
  label: string;           // Display text for the option
  icon?: React.ReactNode;  // Optional icon (defaults to Search icon)
  onClick: () => void;     // Handler when option is clicked
}
```

## Implementation

### Integration in PodcastContextPanel

The tooltip is integrated into the PodcastContextPanel in two locations:
1. **Context View Mode** (lines 632-676) - Keywords section for the current chapter
2. **Chapter View Mode** (lines 440-478) - Keywords section when viewing a specific chapter

Each keyword is rendered as a `KeywordTooltip` with three search options:

1. **Search - All Pods**
   - Searches across all selected/available podcasts
   - Uses current selected sources or default search scope
   
2. **Search - This Feed**
   - Searches only within the current podcast feed
   - Passes the `feedId` from hierarchy data
   
3. **Search - This Episode**
   - Searches only within the current episode
   - Passes the `episodeName` from hierarchy data

### Search Flow

When a user clicks a keyword search option:

1. The tooltip's `onClick` handler fires
2. Calls `onKeywordSearch` prop with parameters: `(keyword, feedId?, episodeName?)`
3. SearchInterface receives the callback and:
   - Sets the search query to the keyword
   - Determines appropriate feed IDs based on context
   - Calls `handleQuoteSearch` from podcastService
   - Updates conversation and search state with results

## Styling & Animation

### Tailwind Animation
Added custom animation in `tailwind.config.js`:

```javascript
keyframes: {
  'tooltip-expand': {
    '0%': { 
      opacity: '0', 
      transform: 'translateX(-50%) translateY(10px) scale(0.8)' 
    },
    '100%': { 
      opacity: '1', 
      transform: 'translateX(-50%) translateY(0) scale(1)' 
    },
  },
}
```

The animation creates a smooth upward expansion effect (150ms ease-out).

### Design System Consistency
- Background: `bg-black` with `border-gray-800`
- Hover states: `hover:bg-gray-800/80`
- Text: `text-gray-300` → `hover:text-white`
- Shadow: `shadow-[0_0_20px_rgba(0,0,0,0.5)]`
- Z-index: `z-[200]` to ensure it appears above other UI elements

## Usage Example

```typescript
<KeywordTooltip
  keyword="bitcoin"
  options={[
    {
      label: 'Search - All Pods',
      onClick: () => onKeywordSearch('bitcoin')
    },
    {
      label: 'Search - This Feed',
      onClick: () => onKeywordSearch('bitcoin', feedId)
    },
    {
      label: 'Search - This Episode',
      onClick: () => onKeywordSearch('bitcoin', undefined, episodeName)
    }
  ]}
/>
```

## Future Enhancements

Potential improvements:
- Add keyboard navigation (arrow keys, Enter, Escape)
- Support tooltip positioning (above/below/left/right)
- Add custom icons per search type
- Support for favoriting/saving keywords
- Recent keyword searches history
- Tooltip preview of expected result count


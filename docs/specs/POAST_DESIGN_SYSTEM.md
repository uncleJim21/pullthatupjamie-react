# X-POAST Design System - Lightning Faucet Aesthetic

## Core Principle
**"Glowing text on near-black with subtle depth"**

Lightning Faucet creates premium feel through:
- Near-black backgrounds (not pure black)
- White text with subtle glow effects
- Generous whitespace
- Minimal accent colors used sparingly
- Depth through subtle gray layers

## Color Strategy

### Background Layers
```css
--bg-primary: #0e0e0f;        /* Near-black, main background */
--bg-elevated: #1a1a1b;       /* Cards, elevated surfaces */
--bg-elevated-hover: #222223; /* Hover state for cards */
--bg-input: #161617;          /* Input fields, slightly recessed */
```

**Rule:** Never use pure black (#000). Use near-black for depth.

### Text Hierarchy
```css
--text-primary: #ffffff;      /* Headlines, primary content */
--text-secondary: #c4c4c4;    /* Body text, less emphasis */
--text-muted: #82828c;        /* Descriptions, timestamps */
--text-disabled: #4a4a4f;     /* Disabled states */
```

### Accent Colors (Use Sparingly!)
```css
/* Twitter accent - use ONLY for Twitter elements */
--accent-twitter: #1d9bf0;        /* Twitter blue */
--accent-twitter-glow: rgba(29, 155, 240, 0.4);
--accent-twitter-bg: rgba(29, 155, 240, 0.1);

/* Nostr accent - use ONLY for Nostr elements */
--accent-nostr: #8b5cf6;          /* Purple */
--accent-nostr-glow: rgba(139, 92, 246, 0.4);
--accent-nostr-bg: rgba(139, 92, 246, 0.1);

/* Success/positive states */
--accent-success: #10b981;        /* Green */
--accent-success-glow: rgba(16, 185, 129, 0.4);

/* Warning states */
--accent-warning: #f59e0b;        /* Amber */
--accent-warning-glow: rgba(245, 158, 11, 0.4);

/* Error states */
--accent-error: #ef4444;          /* Red */
--accent-error-glow: rgba(239, 68, 68, 0.4);
```

### Borders & Dividers
```css
--border-subtle: rgba(255, 255, 255, 0.08);  /* Barely visible */
--border-default: rgba(255, 255, 255, 0.12); /* Standard borders */
--border-emphasis: rgba(255, 255, 255, 0.2); /* Focused/hover */
```

## Typography System

### Font Stack
```tsx
// Import in component
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';

// Or use Tailwind config:
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  display: ['Space Grotesk', 'system-ui', 'sans-serif'],
  mono: ['IBM Plex Mono', 'Menlo', 'Monaco', 'monospace'],
}
```

### Type Scale
```tsx
// Hero/Page Title
className="font-display text-6xl font-bold tracking-tight"
// → 60px, bold, Space Grotesk

// Section Heading
className="font-display text-3xl font-bold"
// → 30px, bold, Space Grotesk

// Card Title
className="font-display text-xl font-semibold"
// → 20px, semibold, Space Grotesk

// Body Text
className="font-sans text-base text-secondary"
// → 16px, Inter, secondary color

// Small/Muted
className="font-sans text-sm text-muted"
// → 14px, Inter, muted color

// Monospace (for technical elements)
className="font-mono text-sm"
// → 14px, IBM Plex Mono
```

### Text Glow Effects
```tsx
// Primary glow (for main headline)
<h1 className="text-white" style={{
  textShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15)'
}}>
  X-POAST
</h1>

// Subtle glow (for card titles)
<h2 className="text-white" style={{
  textShadow: '0 0 20px rgba(255, 255, 255, 0.2)'
}}>
  Scheduled Posts
</h2>

// Accent glow (for Twitter text)
<span className="text-[#1d9bf0]" style={{
  textShadow: '0 0 30px rgba(29, 155, 240, 0.4)'
}}>
  Twitter
</span>
```

## Spacing System

### Vertical Rhythm
```tsx
// Page sections
className="py-20 lg:py-32"  // 80px → 128px (generous vertical space)

// Card internal padding
className="p-6 lg:p-8"      // 24px → 32px

// Stack spacing (between elements in a card)
className="space-y-6"       // 24px between elements

// Tight spacing (form fields)
className="space-y-4"       // 16px between fields
```

### Container Widths
```tsx
// Page container
className="max-w-3xl mx-auto px-4" // 768px max, centered

// Wide container (for list views)
className="max-w-5xl mx-auto px-4" // 1024px max
```

## Card Design System

### Base Card
```tsx
<div className="
  bg-[#1a1a1b]                    /* Elevated background */
  border border-white/10          /* Subtle border */
  rounded-2xl                     /* Soft corners */
  p-6 lg:p-8                      /* Generous padding */
  transition-all duration-300     /* Smooth transitions */
  hover:border-white/20           /* Border brightens on hover */
  hover:shadow-2xl                /* Lift effect */
  hover:shadow-white/5            /* Subtle glow */
  hover:-translate-y-1            /* Slight lift */
">
  {/* Card content */}
</div>
```

### Colored Top Border (Lightning Faucet style)
```tsx
// Twitter card
<div className="
  relative overflow-hidden
  bg-[#1a1a1b] border border-white/10 rounded-2xl
  before:absolute before:top-0 before:left-0 before:right-0 
  before:h-1 before:bg-gradient-to-r before:from-[#1d9bf0] before:to-[#0d7bbf]
">
  {/* Card content */}
</div>

// Nostr card
<div className="
  relative overflow-hidden
  bg-[#1a1a1b] border border-white/10 rounded-2xl
  before:absolute before:top-0 before:left-0 before:right-0 
  before:h-1 before:bg-gradient-to-r before:from-[#8b5cf6] before:to-[#6d28d9]
">
  {/* Card content */}
</div>
```

### Card with Glow on Hover
```tsx
<div className="
  bg-[#1a1a1b] border border-white/10 rounded-2xl p-6
  transition-all duration-300
  hover:border-[#1d9bf0]/50
  hover:shadow-[0_0_30px_rgba(29,155,240,0.2)]
  hover:-translate-y-1
">
  {/* Card content */}
</div>
```

## Button Design

### Primary Button (Main CTA)
```tsx
<button className="
  relative overflow-hidden group
  px-8 py-4                          /* Generous padding */
  bg-white text-[#0e0e0f]            /* White button on dark */
  font-display font-semibold         /* Space Grotesk */
  text-lg                            /* Larger text */
  rounded-xl                         /* Soft corners */
  transition-all duration-300
  hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]  /* White glow */
  hover:scale-105                    /* Slight scale */
  disabled:opacity-40
  disabled:cursor-not-allowed
  disabled:hover:scale-100
">
  <span className="relative z-10">POAST</span>
  
  {/* Shine effect on hover */}
  <div className="
    absolute inset-0 -translate-x-full
    bg-gradient-to-r from-transparent via-white/20 to-transparent
    group-hover:translate-x-full
    transition-transform duration-700
  " />
</button>
```

### Secondary Button (Outline)
```tsx
<button className="
  px-6 py-3
  bg-transparent 
  border-2 border-white/20
  text-white
  font-display font-semibold
  rounded-xl
  transition-all duration-300
  hover:border-white/40
  hover:bg-white/5
  hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]
">
  Cancel
</button>
```

### Platform Chips (Twitter/Nostr)
```tsx
// Twitter chip (selected)
<button className="
  relative
  px-6 py-4
  bg-[#1d9bf0]/10                    /* Subtle blue tint */
  border-2 border-[#1d9bf0]          /* Blue border */
  rounded-xl
  transition-all duration-300
  hover:bg-[#1d9bf0]/20
  hover:shadow-[0_0_30px_rgba(29,155,240,0.3)]  /* Blue glow */
  hover:-translate-y-0.5
">
  <div className="flex items-center gap-3">
    <Twitter className="w-5 h-5 text-[#1d9bf0]" />
    <span className="font-display font-semibold text-white">Twitter</span>
  </div>
  
  {/* Checkmark badge (iOS style) */}
  <div className="
    absolute -top-2 -right-2
    w-6 h-6
    bg-[#10b981]                     /* Green checkmark */
    rounded-full
    flex items-center justify-center
    shadow-[0_0_20px_rgba(16,185,129,0.4)]  /* Green glow */
  ">
    <Check className="w-4 h-4 text-white" />
  </div>
</button>

// Unselected chip (faded)
<button className="
  px-6 py-4
  bg-[#1a1a1b]                       /* Standard card bg */
  border-2 border-white/10           /* Subtle border */
  rounded-xl
  opacity-50                         /* Faded */
  transition-all duration-300
  hover:opacity-70
  hover:border-white/20
">
  <div className="flex items-center gap-3">
    <Twitter className="w-5 h-5 text-[#82828c]" />  {/* Muted color */}
    <span className="font-display text-[#82828c]">Twitter</span>
    <span className="text-xs text-[#4a4a4f]">(not connected)</span>
  </div>
</button>
```

## Input Design

### Text Input
```tsx
<input
  type="text"
  className="
    w-full
    px-4 py-3
    bg-[#161617]                     /* Slightly recessed */
    border border-white/10
    text-white placeholder:text-[#82828c]
    rounded-xl
    font-sans
    transition-all duration-300
    focus:outline-none
    focus:border-white/30
    focus:bg-[#1a1a1b]               /* Lift on focus */
    focus:shadow-[0_0_20px_rgba(255,255,255,0.1)]
  "
  placeholder="What's happening?"
/>
```

### Textarea
```tsx
<textarea
  className="
    w-full
    px-4 py-3
    bg-[#161617]
    border border-white/10
    text-white placeholder:text-[#82828c]
    rounded-xl
    font-sans
    resize-none
    min-h-[120px]
    transition-all duration-300
    focus:outline-none
    focus:border-white/30
    focus:bg-[#1a1a1b]
    focus:shadow-[0_0_20px_rgba(255,255,255,0.1)]
  "
  placeholder="What's happening?"
/>
```

### Character Counter
```tsx
{/* Warning state (approaching limit) */}
<div className="text-sm font-mono" style={{
  color: count > 250 ? '#f59e0b' : '#82828c',  // Amber when close
  textShadow: count > 250 ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none'
}}>
  {count}/280
</div>

{/* Error state (over limit) */}
<div className="text-sm font-mono" style={{
  color: '#ef4444',
  textShadow: '0 0 10px rgba(239, 68, 68, 0.3)'
}}>
  {count}/280
</div>
```

## Badge Design

### Status Badges
```tsx
// Scheduled
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1
  bg-[#82828c]/10
  border border-[#82828c]/20
  rounded-lg
  text-xs font-mono font-medium
  text-[#82828c]
">
  <Clock className="w-3 h-3" />
  scheduled
</span>

// Processing
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1
  bg-[#f59e0b]/10
  border border-[#f59e0b]/20
  rounded-lg
  text-xs font-mono font-medium
  text-[#f59e0b]
">
  <Loader2 className="w-3 h-3 animate-spin" />
  processing
</span>

// Posted (success)
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1
  bg-[#10b981]/10
  border border-[#10b981]/20
  rounded-lg
  text-xs font-mono font-medium
  text-[#10b981]
">
  <Check className="w-3 h-3" />
  posted
</span>

// Failed (error)
<span className="
  inline-flex items-center gap-1.5
  px-3 py-1
  bg-[#ef4444]/10
  border border-[#ef4444]/20
  rounded-lg
  text-xs font-mono font-medium
  text-[#ef4444]
">
  <AlertCircle className="w-3 h-3" />
  failed
</span>
```

## Icon Treatment

### Circular Icon Container
```tsx
<div className="
  w-12 h-12
  bg-[#1a1a1b]
  border border-white/10
  rounded-full
  flex items-center justify-center
  transition-all duration-300
  group-hover:border-white/20
  group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]
">
  <Twitter className="w-6 h-6 text-[#1d9bf0]" />
</div>
```

### Platform-Specific Icons
```tsx
// Twitter icon with glow
<div style={{
  filter: 'drop-shadow(0 0 10px rgba(29, 155, 240, 0.4))'
}}>
  <Twitter className="w-5 h-5 text-[#1d9bf0]" />
</div>

// Nostr logo with glow
<img 
  src="/nostr-logo-square.png"
  className="w-5 h-5"
  style={{
    filter: 'brightness(1.2) saturate(0.8) drop-shadow(0 0 10px rgba(139, 92, 246, 0.4))'
  }}
/>
```

## Empty States

### No Scheduled Posts
```tsx
<div className="
  py-20
  flex flex-col items-center justify-center
  text-center
">
  <div className="
    w-20 h-20 mb-6
    bg-[#1a1a1b]
    border-2 border-dashed border-white/10
    rounded-full
    flex items-center justify-center
  ">
    <Clock className="w-10 h-10 text-[#4a4a4f]" />
  </div>
  
  <h3 className="font-display text-xl font-semibold text-white mb-2">
    No scheduled posts yet
  </h3>
  
  <p className="text-[#82828c] max-w-sm">
    Create your first post above to get started
  </p>
</div>
```

## Loading States

### Skeleton Loader
```tsx
<div className="
  bg-[#1a1a1b]
  border border-white/10
  rounded-2xl
  p-6
  animate-pulse
">
  <div className="flex items-center gap-4 mb-4">
    <div className="w-10 h-10 bg-white/5 rounded-full" />
    <div className="flex-1">
      <div className="h-4 bg-white/5 rounded-lg w-1/3 mb-2" />
      <div className="h-3 bg-white/5 rounded-lg w-1/2" />
    </div>
  </div>
  <div className="space-y-2">
    <div className="h-3 bg-white/5 rounded-lg w-full" />
    <div className="h-3 bg-white/5 rounded-lg w-5/6" />
  </div>
</div>
```

## Motion & Animation

### Hover Lift (Cards, Buttons)
```tsx
className="
  transition-all duration-300
  hover:-translate-y-1           /* 4px lift */
  hover:shadow-2xl
"
```

### Shine Effect (Buttons)
```tsx
<button className="relative overflow-hidden group">
  <span>Button Text</span>
  <div className="
    absolute inset-0
    -translate-x-full
    bg-gradient-to-r from-transparent via-white/20 to-transparent
    group-hover:translate-x-full
    transition-transform duration-700 ease-out
  " />
</button>
```

### Fade In (On mount)
```tsx
className="
  animate-in fade-in slide-in-from-bottom-4
  duration-500
"
```

### Pulse (Processing states)
```tsx
className="
  animate-pulse
"
// Or custom keyframe:
// @keyframes pulse-glow {
//   0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.1); }
//   50% { box-shadow: 0 0 40px rgba(255,255,255,0.2); }
// }
```

## Page Layout

### Hero Section
```tsx
<div className="py-20 lg:py-32">
  <div className="max-w-3xl mx-auto px-4 text-center">
    {/* Main headline with glow */}
    <h1 
      className="font-display text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6"
      style={{
        textShadow: '0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15)'
      }}
    >
      X-POAST
    </h1>
    
    {/* Subtitle */}
    <p className="font-sans text-xl text-[#c4c4c4] mb-12">
      Cross-post to Twitter and Nostr with style
    </p>
  </div>
</div>
```

### Two-Column Layout
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Left column: Compose */}
  <div className="space-y-6">
    {/* Cards */}
  </div>
  
  {/* Right column: Preview */}
  <div className="space-y-6">
    {/* Cards */}
  </div>
</div>
```

## Key Differences from Generic Material Design

1. **Backgrounds:** Near-black (#0e0e0f), not pure black or gray-900
2. **Borders:** Extremely subtle (white/10), not solid colors
3. **Text:** White with glow effects, not gray
4. **Spacing:** Generous (py-20), not cramped
5. **Accents:** Used sparingly and only where needed, not everywhere
6. **Typography:** Space Grotesk for display, Inter for body (not default system fonts)
7. **Shadows:** White glows, not dark shadows
8. **Animation:** Subtle lifts and glows, not aggressive transforms

## Implementation Checklist

- [ ] Replace all `bg-black` with `bg-[#0e0e0f]`
- [ ] Replace card backgrounds with `bg-[#1a1a1b]`
- [ ] Use `border-white/10` for all borders
- [ ] Add text-shadow glows to headlines
- [ ] Increase vertical padding (py-20 minimum)
- [ ] Use Space Grotesk for headings (`font-display`)
- [ ] Add hover lift to all interactive elements
- [ ] Platform colors ONLY on platform-specific elements
- [ ] Character counter with glow when warning/error
- [ ] Subtle shine effects on primary buttons

## Additional Lightning Faucet Principles

### Dark UI Best Practices

**Critical Rules:**
1. **Never use pure black** (`#000`) - Use `#0a0a0a` to `#121212`
2. **Never use pure white text** (`#fff`) - Use `#e5e5e5` to `#f5f5f5`
3. **Shadows still work** - Use darker shadows with low opacity
4. **Colored elements pop more** - Use this strategically
5. **Reduce contrast for less important text** - Improves visual hierarchy

#### Updated Color Values

```css
/* Backgrounds (never pure black) */
--bg-true-black: #0a0a0a;        /* Darkest (instead of #000) */
--bg-primary: #0e0e0f;           /* Main background */
--bg-elevated: #1a1a1b;          /* Cards, elevated surfaces */

/* Text (never pure white) */
--text-primary: #f5f5f5;         /* Headlines (instead of #fff) */
--text-body: #e5e5e5;            /* Body text */
--text-secondary: #c4c4c4;       /* Less emphasis */
--text-muted: #82828c;           /* Descriptions */

/* Shadows DO work in dark mode */
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.6);
```

### CTA Hierarchy (Critical!)

**Rule: Never have competing CTAs in the same section**

```tsx
// ✅ CORRECT: One primary, others secondary
<div className="flex gap-4">
  {/* Primary CTA - White button with glow */}
  <button className="
    px-8 py-4
    bg-white text-[#0a0a0a]
    font-display font-semibold text-lg
    rounded-xl
    shadow-[0_0_40px_rgba(255,255,255,0.3)]
  ">
    POAST
  </button>
  
  {/* Secondary CTA - Outlined/ghost */}
  <button className="
    px-6 py-3
    bg-transparent border-2 border-white/20
    text-[#e5e5e5]
    font-display font-medium
    rounded-xl
  ">
    Save Draft
  </button>
</div>

// ❌ WRONG: Multiple primary CTAs competing
<div>
  <button className="bg-white ...">POAST</button>
  <button className="bg-white ...">Schedule</button>  // Don't do this
</div>
```

### Trust & Credibility Elements

**Show activity and build confidence:**

#### 1. Stats Bar (Social Proof)
```tsx
<div className="
  flex items-center gap-8
  px-6 py-4
  bg-[#1a1a1b]/50
  border-y border-white/5
">
  <div className="flex items-center gap-2">
    <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
    <span className="text-sm text-[#82828c]">
      <span className="text-[#e5e5e5] font-mono">127</span> posts scheduled
    </span>
  </div>
  
  <div className="flex items-center gap-2">
    <CheckCircle className="w-4 h-4 text-[#10b981]" />
    <span className="text-sm text-[#82828c]">
      <span className="text-[#e5e5e5] font-mono">98.5%</span> success rate
    </span>
  </div>
</div>
```

#### 2. Live Activity Indicators
```tsx
// Processing indicator (like Lightning Faucet's live games)
{posts.some(p => p.status === 'processing') && (
  <div className="flex items-center gap-2 text-sm text-[#f59e0b]">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span className="font-mono">Publishing now...</span>
  </div>
)}
```

#### 3. Instant Feedback (Reduces Anxiety)
```tsx
// Success toast (bottom-left, Lightning Faucet style)
<div className="
  fixed bottom-6 left-6
  px-6 py-4
  bg-[#10b981]/10
  border border-[#10b981]/30
  rounded-xl
  backdrop-blur-sm
  animate-in slide-in-from-left-5
">
  <div className="flex items-center gap-3">
    <Check className="w-5 h-5 text-[#10b981]" />
    <div>
      <p className="font-display font-semibold text-[#f5f5f5]">
        Posted successfully
      </p>
      <p className="text-sm text-[#82828c]">
        Your post is now live on Twitter
      </p>
    </div>
  </div>
</div>
```

#### 4. Trust Badges
```tsx
// Near scheduled time (shows reliability)
<div className="flex items-center gap-2 text-xs text-[#82828c]">
  <Clock className="w-3 h-3" />
  <span className="font-mono">Posts at exactly scheduled time</span>
  <div className="px-2 py-0.5 bg-[#10b981]/10 border border-[#10b981]/20 rounded text-[#10b981] font-mono">
    ±30s
  </div>
</div>
```

### Shadows in Dark Mode

**Shadows DO work - just use darker colors with opacity**

```tsx
// Card with shadow
<div className="
  bg-[#1a1a1b]
  border border-white/10
  rounded-2xl
  shadow-[0_8px_16px_rgba(0,0,0,0.4)]    // Dark shadow, 40% opacity
  hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)]
">
  {/* Card content */}
</div>

// Button with shadow
<button className="
  bg-white
  rounded-xl
  shadow-[0_4px_8px_rgba(0,0,0,0.3)]
  hover:shadow-[0_8px_16px_rgba(0,0,0,0.5)]
">
  Button
</button>

// Colored glow + dark shadow combo
<div className="
  shadow-[0_8px_16px_rgba(0,0,0,0.4),0_0_30px_rgba(29,155,240,0.2)]
">
  {/* Blue glow + dark shadow */}
</div>
```

### Strategic Use of Colored Elements

**Colored elements pop more in dark mode - use sparingly for impact**

```tsx
// Platform icon with colored container (POPS)
<div className="
  w-12 h-12
  bg-[#1d9bf0]/20                         // Subtle Twitter blue tint
  border border-[#1d9bf0]/30
  rounded-xl
  flex items-center justify-center
">
  <Twitter className="w-6 h-6 text-[#1d9bf0]" />
</div>

// Status badge (POPS because it's colored)
<span className="
  px-3 py-1
  bg-[#10b981]/10                         // Subtle green tint
  border border-[#10b981]/30
  rounded-lg
  text-[#10b981]
">
  posted
</span>
```

### Visual Hierarchy Through Contrast Reduction

**Less important = less contrast**

```tsx
// Primary headline (highest contrast)
<h1 className="text-[#f5f5f5] font-display text-6xl">
  X-POAST
</h1>

// Body text (medium contrast)
<p className="text-[#e5e5e5] font-sans text-base">
  Cross-post to Twitter and Nostr
</p>

// Supporting text (lower contrast)
<p className="text-[#c4c4c4] text-sm">
  Schedule posts or publish immediately
</p>

// Muted text (lowest contrast)
<span className="text-[#82828c] text-xs">
  Last updated 2 hours ago
</span>

// Disabled state (very low contrast)
<button disabled className="text-[#4a4a4f]">
  Connect Twitter
</button>
```

## Design Principles Summary

| Principle | Application | Constraint |
|-----------|-------------|------------|
| **Color Constraint** | 2-3 accent colors max, use sparingly | Twitter blue + Nostr purple + success green ONLY |
| **Font Constraint** | 2-3 fonts max | Space Grotesk (display) + Inter (body) + IBM Plex Mono (code) |
| **Hierarchy** | Size + weight + color + contrast | Most important = largest + boldest + highest contrast |
| **Breathing Room** | Generous padding = premium | Minimum py-20, never cramped |
| **Consistency** | Same border radius, shadows, spacing | rounded-xl everywhere, 24px/32px padding standard |
| **Trust Signals** | Stats, badges, transparency, live data | Show success rates, processing status, timestamps |
| **Activity** | Animations, live indicators, toasts | Pulse on processing, slide-in toasts, hover lifts |
| **Clarity** | One primary CTA per section | Never competing buttons, clear hierarchy |
| **Dark Mode Rules** | Never pure black/white, shadows work | #0a0a0a instead of #000, #f5f5f5 instead of #fff |
| **Colored Elements** | Pop more in dark mode, use strategically | Platform badges, status indicators, not backgrounds |

## Implementation Priority Checklist

**High Priority (Required for Premium Feel):**
- [ ] Use #0a0a0a to #121212 (never #000)
- [ ] Use #e5e5e5 to #f5f5f5 for text (never #fff)
- [ ] One primary CTA per section (white button)
- [ ] All secondary CTAs outlined/ghost
- [ ] Generous vertical padding (py-20 minimum)
- [ ] Space Grotesk for all headings
- [ ] Hover states with lift + glow
- [ ] Platform colors ONLY on platform elements

**Medium Priority (Enhances Experience):**
- [ ] Live activity indicators (processing, posted)
- [ ] Dark shadows with opacity (not just glows)
- [ ] Colored containers for platform icons
- [ ] Contrast reduction for text hierarchy
- [ ] Trust badges (success rate, timing accuracy)

**Nice to Have (Polish):**
- [ ] Toast notifications (bottom-left)
- [ ] Shine effects on primary buttons
- [ ] Pulse animations on live indicators
- [ ] Empty state with dashed border icon
- [ ] Loading skeletons with subtle animation

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeaturedGalaxyCard from './FeaturedGalaxyCard.tsx';

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert HSL values to a hex color string.
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 */
const hslToHex = (h: number, s: number, l: number): string => {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;
  const r = Math.round(hue2rgb(p, q, h / 360 + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h / 360) * 255);
  const b = Math.round(hue2rgb(p, q, h / 360 - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Generate a random color within a hue range.
 * Each call produces a fresh random offset, so colors differ per render/mount.
 * Use inside a useState initializer to keep colors stable within a session.
 */
const generateRandomCategoryColor = (
  baseHue: number,
  variance: number = 15,
  saturation: number = 70,
  lightness: number = 58,
): string => {
  // Random offset within [-variance, +variance]
  const offset = (Math.random() * 2 - 1) * variance;
  const hue = ((baseHue + offset) % 360 + 360) % 360;

  return hslToHex(hue, saturation, lightness);
};

// ============================================================================
// CATEGORY & SESSION DATA TYPES
// ============================================================================
interface FeaturedSession {
  shareId: string;
  fallbackTitle: string;
  fallbackColor?: string; // Only used for legacy categories (no baseHue)
}

interface FeaturedCategory {
  title: string;
  /** HSL base hue (0-360). When set, card colors are generated from this hue. */
  baseHue?: number;
  /** Degrees of hue variation per card. Default 15. */
  hueVariance?: number;
  /** HSL saturation (0-100). Default 70. */
  saturation?: number;
  /** HSL lightness (0-100). Default 58. */
  lightness?: number;
  sessions: FeaturedSession[];
}

// ============================================================================
// FEATURED CATEGORIES CONFIGURATION
// Edit this array to add/remove categories and sessions.
// Categories are shuffled on each page load so visitors see variety.
// ============================================================================
export const FEATURED_CATEGORIES: FeaturedCategory[] = [
  // --- Startups (legacy — keeps original hardcoded colors) ---
  {
    title: 'Learn About Startups',
    sessions: [
      { shareId: '91105b0bb50c', fallbackTitle: 'Stacker News', fallbackColor: '#FF6B6B' },
      { shareId: 'fed92c59ad03', fallbackTitle: 'Branta in the Media', fallbackColor: '#9B59B6' },
      { shareId: '7ae7f2326685', fallbackTitle: 'Maple: Private AI', fallbackColor: '#4ECDC4' },
      { shareId: 'f0895b9bd053', fallbackTitle: 'CASCDR', fallbackColor: '#FF6B6B' },
      { shareId: 'cbf690fca3d0', fallbackTitle: 'Green Candle', fallbackColor: '#4ECDC4' },
    ],
  },
  // --- Bitcoin (warm red-orange hue with tight per-card variation) ---
  // Range ~2°–22° (coral-red to orange-red), matching Modern Chains / WiM / Bitcoin as Money aesthetic
  {
    title: 'Bitcoin',
    baseHue: 12,        // Coral-orange center
    hueVariance: 10,    // Tight range: ±10° → hue 2°–22°
    saturation: 85,
    lightness: 62,
    sessions: [
      // Moved from Startups — keep their hardcoded coral-red color
      { shareId: '9e6dcee34a35', fallbackTitle: 'Modern Chains', fallbackColor: '#FF6B6B' },
      { shareId: '0d1acd2cc1f4', fallbackTitle: 'What Is Money', fallbackColor: '#FF6B6B' },
      // Hue-generated cards
      { shareId: '8c591d87f986', fallbackTitle: 'Bitcoin as Money' },
      { shareId: '486c73448574', fallbackTitle: 'Lightning & Layer 2' },
      { shareId: '2a673bada82b', fallbackTitle: 'Bitcoin Privacy & Sovereignty' },
      { shareId: 'e396d9e20c40', fallbackTitle: 'Bitcoin Mining & Energy' },
      { shareId: 'cfc857419152', fallbackTitle: 'Bitcoin & Geopolitics' },
      { shareId: 'c0bed41d939a', fallbackTitle: 'Bitcoin & Human Rights' },
    ],
  },
  // --- AI & Tech (silver with pale blue tinge) ---
  {
    title: 'AI & Tech',
    baseHue: 215,       // Pale blue-silver
    hueVariance: 12,
    saturation: 12,
    lightness: 72,
    sessions: [
      { shareId: 'c499178d669e', fallbackTitle: 'The AI Revolution' },
      { shareId: 'c80c685fdfa6', fallbackTitle: 'AI Agents & Tooling' },
      { shareId: '081a569e4834', fallbackTitle: 'Big Tech Power' },
      { shareId: 'a30ed556220d', fallbackTitle: 'How Great Companies Are Built' },
    ],
  },
  // --- Health & Wellness (vibrant cyan-teal) ---
  {
    title: 'Health & Wellness',
    baseHue: 182,       // Cyan-teal (Modern Wisdom style)
    hueVariance: 15,
    saturation: 75,
    lightness: 55,
    sessions: [
      { shareId: '96aa56fbd4db', fallbackTitle: 'Longevity & Healthspan' },
      { shareId: 'bd78489b3661', fallbackTitle: 'Sleep & Recovery' },
      { shareId: 'd75764f9fe08', fallbackTitle: 'Nutrition Wars' },
      { shareId: '847a976c3bbc', fallbackTitle: 'Neuroscience of Performance' },
      { shareId: '9786b4b75818', fallbackTitle: 'Stress Hormones & the Body' },
      { shareId: '4f00078ab501', fallbackTitle: "Athlete's Mindset" },
    ],
  },
  // --- Culture Wars (deep crimson / burgundy) ---
  {
    title: 'Culture Wars',
    baseHue: 350,       // Cool crimson
    hueVariance: 10,
    saturation: 70,
    lightness: 42,
    sessions: [
      { shareId: 'e33ff58aa1d8', fallbackTitle: 'The Culture War' },
      { shareId: '0604d3954f2f', fallbackTitle: 'Free Cities & Exit' },
      { shareId: '589954c05d55', fallbackTitle: 'The Surveillance State' },
    ],
  },
  // --- Lunatic Fringe (violet / purple) ---
  {
    title: 'Lunatic Fringe',
    baseHue: 275,       // Violet
    hueVariance: 12,
    saturation: 60,
    lightness: 55,
    sessions: [
      { shareId: '7eebcf7f3efd', fallbackTitle: 'UFOs & UAPs' },
      { shareId: 'e9b03aceee69', fallbackTitle: 'Deep State & Power Structures' },
      { shareId: '63c71c33c6a3', fallbackTitle: 'Media Manipulation' },
    ],
  },
  // --- Business (deep green) ---
  {
    title: 'Business',
    baseHue: 155,       // Deep green
    hueVariance: 12,
    saturation: 65,
    lightness: 40,
    sessions: [
      { shareId: 'b3e1120bda76', fallbackTitle: 'How to Build a Business' },
      { shareId: '6bce290093f6', fallbackTitle: 'The Creator Economy' },
      { shareId: 'cf56dde10b3e', fallbackTitle: 'Finding Cofounders, Hiring & Building Culture' },
      { shareId: '8bb30eb44af1', fallbackTitle: 'Macroeconomic Trends' },
    ],
  },
];

// Legacy flat export (kept for backward compatibility)
export const FEATURED_SESSIONS = FEATURED_CATEGORIES.flatMap(cat =>
  cat.sessions.map(s => ({
    shareId: s.shareId,
    fallbackTitle: s.fallbackTitle,
    fallbackColor: s.fallbackColor ?? '#4ECDC4',
  }))
);

// ============================================================================
// SHUFFLE UTILITY
// ============================================================================
const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ============================================================================
// TYPES
// ============================================================================
interface FeaturedGalaxiesCarouselProps {
  onSessionClick: (shareId: string, title: string) => void;
}

// ============================================================================
// SINGLE CATEGORY ROW COMPONENT
// Each row is an independently scrollable horizontal carousel.
// ============================================================================
const CategoryRow: React.FC<{
  category: FeaturedCategory;
  onSessionClick: (shareId: string, title: string) => void;
}> = ({ category, onSessionClick }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const hasDraggedRef = useRef(false);

  // Assign random colors and shuffle item order (fresh each mount, stable during session)
  const [preparedSessions] = useState(() => {
    const withColors = category.sessions.map(session => ({
      ...session,
      fallbackColor: session.fallbackColor ?? (
        category.baseHue !== undefined
          ? generateRandomCategoryColor(
              category.baseHue,
              category.hueVariance,
              category.saturation,
              category.lightness,
            )
          : '#4ECDC4'
      ),
    }));
    return shuffleArray(withColors);
  });

  // Check scroll position and update button states
  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollButtons();
    container.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      container.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, []);

  // Scroll handlers
  const scrollBy = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 280; // Slightly more than card width (256px + gap)
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeftStart(container.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiplier for scroll speed

    // Mark as dragged if moved more than 5px (to distinguish from click)
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
    }

    container.scrollLeft = scrollLeftStart - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Handle card click - only fire if not dragging
  const handleCardClick = (shareId: string, title: string) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    onSessionClick(shareId, title);
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-widest">
          {category.title}
        </h3>

        {/* Scroll buttons - desktop only */}
        <div className="hidden md:flex gap-1">
          <button
            onClick={() => scrollBy('left')}
            disabled={!canScrollLeft}
            className={`p-1.5 rounded transition-all border ${
              canScrollLeft
                ? 'border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white'
                : 'border-gray-800 text-gray-700 cursor-not-allowed'
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollBy('right')}
            disabled={!canScrollRight}
            className={`p-1.5 rounded transition-all border ${
              canScrollRight
                ? 'border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white'
                : 'border-gray-800 text-gray-700 cursor-not-allowed'
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable container with drag-to-scroll */}
      <div
        ref={scrollContainerRef}
        className={`flex gap-5 overflow-x-auto pb-4 px-2 scrollbar-hide select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {preparedSessions.map((session) => (
          <div key={session.shareId} className="flex-shrink-0">
            <FeaturedGalaxyCard
              shareId={session.shareId}
              fallbackTitle={session.fallbackTitle}
              fallbackColor={session.fallbackColor}
              onClick={() => handleCardClick(session.shareId, session.fallbackTitle || 'Featured Session')}
            />
          </div>
        ))}
      </div>

      {/* Fade edges for scroll indication - hidden on mobile for cleaner look */}
      {canScrollLeft && (
        <div className="hidden md:block absolute left-0 top-10 bottom-4 w-12 bg-gradient-to-r from-black to-transparent pointer-events-none" />
      )}
      {canScrollRight && (
        <div className="hidden md:block absolute right-0 top-10 bottom-4 w-12 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      )}
    </div>
  );
};

// ============================================================================
// MAIN CAROUSEL COMPONENT
// Shuffles categories on mount and renders one row per category.
// ============================================================================
export const FeaturedGalaxiesCarousel: React.FC<FeaturedGalaxiesCarouselProps> = ({
  onSessionClick,
}) => {
  // Shuffle categories once on mount so the order varies per page load
  const [shuffledCategories] = useState(() => shuffleArray(FEATURED_CATEGORIES));

  return (
    <div className="flex flex-col gap-10">
      {shuffledCategories.map((category) => (
        <CategoryRow
          key={category.title}
          category={category}
          onSessionClick={onSessionClick}
        />
      ))}
    </div>
  );
};

export default FeaturedGalaxiesCarousel;

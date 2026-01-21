import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeaturedGalaxyCard from './FeaturedGalaxyCard.tsx';

// ============================================================================
// FEATURED SESSIONS CONFIGURATION
// Edit this array to change which sessions are featured
// Title and color will be fetched from backend; fallbacks used if unavailable
// ============================================================================
export const FEATURED_SESSIONS = [
  { 
    shareId: '0d1acd2cc1f4', 
    fallbackTitle: 'Featured Session 1', 
    fallbackColor: '#FF6B6B' // Coral red
  },
  { 
    shareId: 'cbf690fca3d0', 
    fallbackTitle: 'Featured Session 2', 
    fallbackColor: '#4ECDC4' // Teal
  },
  { 
    shareId: 'fed92c59ad03', 
    fallbackTitle: 'Featured Session 3', 
    fallbackColor: '#9B59B6' // Purple
  },
  { 
    shareId: '9e6dcee34a35', 
    fallbackTitle: 'Featured Session 1', 
    fallbackColor: '#FF6B6B' // Coral red
  },
];

// ============================================================================
// TYPES
// ============================================================================
interface FeaturedGalaxiesCarouselProps {
  onSessionClick: (shareId: string, title: string) => void;
}

// ============================================================================
// MAIN CAROUSEL COMPONENT
// ============================================================================
export const FeaturedGalaxiesCarousel: React.FC<FeaturedGalaxiesCarouselProps> = ({
  onSessionClick,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
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
  
  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-widest">
          Explore Popular Ideas
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
      
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-5 overflow-x-auto pb-4 px-2 scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {FEATURED_SESSIONS.map((session) => (
          <div key={session.shareId} className="snap-start">
            <FeaturedGalaxyCard
              shareId={session.shareId}
              fallbackTitle={session.fallbackTitle}
              fallbackColor={session.fallbackColor}
              onClick={() => onSessionClick(session.shareId, session.fallbackTitle || 'Featured Session')}
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

export default FeaturedGalaxiesCarousel;

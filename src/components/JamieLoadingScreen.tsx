import React, { useEffect, useState, useRef } from 'react';

interface Slide {
  image: string;
  title: string;
  subtitle: string;
  subtitle2?: string;
  timer?: number;
}

const slides: Slide[] = [
  { image: '/jamie-loading-screen/1.png', title: 'Go from Podcast Drop to Promotional Content In a Hurry', subtitle: '', subtitle2: 'Search, Clip, Share in seconds after your podcast drops' },
  { image: '/jamie-loading-screen/2.png', title: 'AI-Powered Search', subtitle: '', subtitle2: 'Find moments instantly after your podcast drops' },
  { image: '/jamie-loading-screen/3.png', title: 'Clip & Share', subtitle: '', subtitle2: 'Create and share viral moments in seconds' },
  { image: '/jamie-loading-screen/4.png', title: 'Cross-Platform', subtitle: '', subtitle2: 'Share to Twitter, Nostr, and more' },
  { image: '/jamie-loading-screen/5.png', title: 'Smart Indexing', subtitle: '', subtitle2: 'Semantic search for every episode' },
  { image: '/jamie-loading-screen/6.png', title: 'Clip Studio', subtitle: '', subtitle2: 'Edit and export with ease' },
  { image: '/jamie-loading-screen/7.png', title: 'Instant Results', subtitle: '', subtitle2: 'No waiting, just results' },
  { image: '/jamie-loading-screen/8.png', title: 'Enjoy!', subtitle: '', subtitle2: 'Start sharing your podcast now with Jamie!' },
];

const FADE_IN_DURATION = 1000; // 1s fade in
const VISIBLE_DURATION = 7000; // 7s fully visible
const FADE_OUT_DURATION = 500; // 0.5s fade out
const TOTAL_CYCLE = FADE_IN_DURATION + VISIBLE_DURATION + FADE_OUT_DURATION; // 8.5s total per slide

const JamieLoadingScreen: React.FC<{ defaultInterval?: number }> = () => {
  const [opacity, setOpacity] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const cyclePosition = elapsed % TOTAL_CYCLE;
      
      if (cyclePosition < FADE_IN_DURATION) {
        // Fade in: 0 to 1 over FADE_IN_DURATION
        const progress = cyclePosition / FADE_IN_DURATION;
        setOpacity(progress);
      } else if (cyclePosition < FADE_IN_DURATION + VISIBLE_DURATION) {
        // Fully visible
        setOpacity(1);
      } else {
        // Fade out: 1 to 0 over FADE_OUT_DURATION
        const fadeOutProgress = (cyclePosition - FADE_IN_DURATION - VISIBLE_DURATION) / FADE_OUT_DURATION;
        setOpacity(Math.max(0, 1 - fadeOutProgress));
      }
    }, 50); // Update every 50ms for smooth animation

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Calculate current slide index based on elapsed time
  const elapsed = Date.now() - startTimeRef.current;
  const currentSlideIndex = Math.floor(elapsed / TOTAL_CYCLE) % slides.length;
  const slide = slides[currentSlideIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] pt-0 bg-black w-full">
      {/* Processing label and spinner always at the top */}
      <div className="flex flex-col items-center mb-4 mt-0">
        <div className="flex flex-row items-center space-x-6">
          <span className="text-[1rem] font-bold text-center" style={{ color: '#c0c0c0' }}>Processing</span>
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2" style={{ borderColor: '#c0c0c0' }} />
        </div>
      </div>
      {/* Dynamic text content */}
      <div className="flex flex-col items-center w-full" style={{ opacity }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2 max-w-2xl">{slide.title}</h1>
        {slide.subtitle && <div className="text-lg text-white text-center mb-1 max-w-2xl">{slide.subtitle}</div>}
        {slide.subtitle2 && <div className="text-base text-gray-300 text-center mb-6 max-w-2xl">{slide.subtitle2}</div>}
        <div className="flex justify-center w-full">
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full max-w-xl aspect-video object-contain border-4 border-gray-700 rounded-xl shadow-lg bg-black"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
};

export default JamieLoadingScreen; 
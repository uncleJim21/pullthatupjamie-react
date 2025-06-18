import React, { useEffect, useState, useRef } from 'react';

interface Slide {
  image: string;
  title: string;
  subtitle: string;
  subtitle2?: string;
  timer?: number;
}

const slides: Slide[] = [
  { image: '/jamie-loading-screen/1.png', title: 'Podcast Drop Straight to Posts that Pop', subtitle: '', subtitle2: 'Search. Clip. Share. Go Viral. Mere seconds after your podcast drops' },
//   { image: '/jamie-loading-screen/2.png', title: 'AI-Powered Search', subtitle: '', subtitle2: 'Find moments instantly after your podcast drops' },
  { image: '/jamie-loading-screen/3.png', title: 'Viral Clips at Your Fingertips', subtitle: '', subtitle2: 'Go Big with Branded Clips in 1/10th the time & effort.' },
  { image: '/jamie-loading-screen/8.png', title: 'Share Key Moments with 0 Hassle', subtitle: '', subtitle2: 'Send friends a link to the exact timestamped moment without poring over hours of audio.' },
  { image: '/jamie-loading-screen/4.png', title: "You Don't Need a Degree in Keywords", subtitle: '', subtitle2: 'Semantic search lets you search by a vague gist rather than exact match.' },
//   { image: '/jamie-loading-screen/5.png', title: 'Smart Indexing', subtitle: '', subtitle2: 'Semantic search for every episode' },
  { image: '/jamie-loading-screen/6.png', title: 'Cross Post with Ease', subtitle: '', subtitle2: 'Share clips or media uploads with your audience on Twitter & Nostr in one click.' },
  { image: '/jamie-loading-screen/7.png', title: 'Find Top Moments with 0 Effort', subtitle: '', subtitle2: 'Pro Plan Exclusive: surface the top moments from your podcast automatically. Alerts straight to your inbox. Ready to post in one click.' },
];

const FADE_IN_DURATION = 1000; // 1s fade in
const VISIBLE_DURATION = 8000; // 8s fully visible
const FADE_OUT_DURATION = 500; // 0.5s fade out
const TOTAL_CYCLE = FADE_IN_DURATION + VISIBLE_DURATION + FADE_OUT_DURATION; // 9.5s total per slide

const TOTAL_PROCESSING_TIME = 120000; // 2 minutes in milliseconds

const JamieLoadingScreen: React.FC<{ defaultInterval?: number }> = () => {
  const [opacity, setOpacity] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    // Slide animation interval
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

    // Progress bar interval
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      
      if (isFinishing) {
        // Stay at 100% when finishing up
        setProgress(100);
      } else {
        const progressPercent = Math.min(100, (elapsed / TOTAL_PROCESSING_TIME) * 100);
        setProgress(progressPercent);
        
        if (elapsed >= TOTAL_PROCESSING_TIME) {
          setIsFinishing(true);
        }
      }
    }, 100); // Update progress every 100ms

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isFinishing]);

  // Calculate current slide index based on elapsed time
  const elapsed = Date.now() - startTimeRef.current;
  const currentSlideIndex = Math.floor(elapsed / TOTAL_CYCLE) % slides.length;
  const slide = slides[currentSlideIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] -mt-12 bg-black w-full">
      {/* Processing label and spinner always at the top */}
      <div className="flex flex-col items-center mb-1 mt-8">
        <div className="flex flex-row items-center space-x-6 mb-3">
          <span className="text-[1rem] font-bold text-center" style={{ color: '#c0c0c0' }}>
            {isFinishing ? 'Finishing Up' : 'Processing'}
          </span>
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2" style={{ borderColor: '#c0c0c0' }} />
        </div>
        {/* Progress bar */}
        <div className="w-80 bg-gray-800 rounded-full h-2 border border-gray-700">
          <div 
            className="bg-gray-400 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {/* Dynamic text content */}
      <div className="flex flex-col items-center w-full mt-4" style={{ opacity }}>
        <h1 className="text-2xl sm:text-4xl font-bold text-white text-center mb-2 max-w-2xl">{slide.title}</h1>
        {slide.subtitle && <div className="text-lg text-white text-center mb-1 max-w-2xl">{slide.subtitle}</div>}
        {slide.subtitle2 && <div className="text-base text-gray-300 text-center mb-6 max-w-2xl">{slide.subtitle2}</div>}
        <div className="flex justify-center w-full pb-24">
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full max-w-3xl aspect-video object-contain border-4 border-gray-700 rounded-xl shadow-lg bg-black"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
};

export default JamieLoadingScreen; 
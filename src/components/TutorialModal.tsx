import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface TutorialSlide {
  menuTitle: string;
  slideTitle: string;
  subtitle: string;
  imagePath: string | null;
  section: string; // section name for grouping
}

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define the sidebar sections in the order shown in the screenshot
const SIDEBAR_SECTIONS = [
  {
    title: 'Podcast Search',
    items: [
      'Podcast Search Overview',
    ],
  },
  {
    title: 'Web Search',
    items: [
      'Web Search Overview',
    ],
  },
  {
    title: 'Jamie Pro (Premium)',
    items: [
      'Dashboard',
      'Adjusting Preferences',
      'Accessing AI Curated Clips',
      'Crosspost to Nostr/Twitter',
      'Upload & Crosspost Arbitrary Media',
    ],
  },
];

const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    menuTitle: 'Podcast Search Overview',
    slideTitle: 'Podcast Search Overview',
    subtitle: `Learn how to search thousands of podcast moments instantly.`,
    imagePath: null,
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Web Search Overview',
    slideTitle: 'Web Search Overview',
    subtitle: `Use Jamie to search the web privately and efficiently.`,
    imagePath: null,
    section: 'Web Search',
  },
  {
    menuTitle: 'Dashboard',
    slideTitle: 'Jamie Pro Dashboard',
    subtitle: `Your home for all Jamie Pro features and quick access to your curated content.`,
    imagePath: '/tutorial/jamie-pro-go-to-home.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Adjusting Preferences',
    slideTitle: 'Adjusting Agent Preferences',
    subtitle: `The Agent selects topics and themes you're likely to find interesting. You can adjust them with prompts.

**Examples:**

- "Highlight stories about personal growth"
- "Disregard statements that are likely to be ads"
`,
    imagePath: '/tutorial/jamie-pro-prefs-change.gif',
    section: 'Jamie Pro (Premium)',
  },
  
  {
    menuTitle: 'Accessing AI Curated Clips',
    slideTitle: 'Accessing AI Curated Clips',
    subtitle: `See your past Jamie Pro runs and curated podcast moments instantly.`,
    imagePath: '/tutorial/jamie-pro-run-history.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Crosspost to Nostr/Twitter',
    slideTitle: 'Crosspost to Nostr/Twitter',
    subtitle: `Share your favorite moments to Nostr or Twitter with a single click.`,
    imagePath: '/tutorial/jamie-pro-instant-share-jamie-assist.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Upload & Crosspost Arbitrary Media',
    slideTitle: 'Upload & Crosspost Arbitrary Media',
    subtitle: `Upload your own media and crosspost it anywhere you like.`,
    imagePath: '/tutorial/jamie-upload-and-share.gif',
    section: 'Jamie Pro (Premium)',
  },
];

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(2); // Default to Dashboard
  const [openSection, setOpenSection] = useState(2); // Default to Jamie Pro open
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (markdownRef.current) {
      markdownRef.current.scrollTop = 0;
    }
  }, [currentSlide]);

  if (!isOpen) return null;

  // Map menu items to slide indices for navigation, grouped by section
  const menuItemToSlideIdx: Record<string, number> = {};
  TUTORIAL_SLIDES.forEach((slide, idx) => {
    menuItemToSlideIdx[slide.menuTitle] = idx;
  });

  // Find the section index for the current slide
  const getSectionIdxForSlide = (slideIdx: number) => {
    const slide = TUTORIAL_SLIDES[slideIdx];
    return SIDEBAR_SECTIONS.findIndex(section => section.title === slide.section);
  };

  // Navigation arrow button component
  const ArrowButton = ({ direction, onClick, disabled }: { direction: 'left' | 'right'; onClick: () => void; disabled: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 flex items-center justify-center rounded-full border border-gray-600 bg-black text-white text-xl shadow transition hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed ml-2 mb-2`}
      aria-label={direction === 'left' ? 'Previous' : 'Next'}
      style={{ minWidth: '2.25rem', minHeight: '2.25rem' }}
    >
      {direction === 'left' ? <span>&larr;</span> : <span>&rarr;</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <style dangerouslySetInnerHTML={{
        __html: `
          .tutorial-scrollbar::-webkit-scrollbar {
            width: 12px;
          }
          .tutorial-scrollbar::-webkit-scrollbar-track {
            background: #000000;
            border-radius: 6px;
          }
          .tutorial-scrollbar::-webkit-scrollbar-thumb {
            background: #ffffff;
            border-radius: 6px;
            border: 2px solid #000000;
          }
          .tutorial-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #e5e5e5;
          }
        `
      }} />
      {/* Fullscreen Image Overlay */}
      {fullscreenImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95 cursor-zoom-out"
          onClick={() => setFullscreenImg(null)}
          aria-modal="true"
          role="dialog"
        >
          <img
            src={fullscreenImg}
            alt="Full screen preview"
            className="max-w-full max-h-full rounded-lg shadow-2xl border border-gray-700"
            style={{ background: '#000', objectFit: 'contain' }}
          />
          <button
            className="absolute top-6 right-8 text-white text-3xl font-bold bg-black bg-opacity-60 rounded-full px-3 py-1 border border-gray-700 hover:bg-opacity-90 focus:outline-none z-60"
            onClick={e => { e.stopPropagation(); setFullscreenImg(null); }}
            aria-label="Close Fullscreen"
          >
            ×
          </button>
        </div>
      )}
      <div className="relative flex w-full max-w-5xl h-[600px] rounded-2xl bg-[#111] border border-gray-800 shadow-2xl overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 bg-black/80 border-r border-white flex flex-col py-8 px-6 min-h-full max-h-full overflow-y-auto tutorial-scrollbar">
          {SIDEBAR_SECTIONS.map((section, sectionIdx) => (
            <div key={section.title} className="mb-4">
              <button
                className="w-full flex items-center justify-between text-white font-bold text-lg mb-2 focus:outline-none"
                onClick={() => setOpenSection(sectionIdx)}
                aria-expanded={openSection === sectionIdx}
              >
                <span>{section.title}</span>
                <span className="ml-2 text-white">{openSection === sectionIdx ? '▼' : '▶'}</span>
              </button>
              {openSection === sectionIdx && (
                <ul className="space-y-2 ml-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className={`cursor-pointer px-2 py-1 rounded transition-colors flex items-center gap-2 ${
                        TUTORIAL_SLIDES[currentSlide]?.menuTitle === item && getSectionIdxForSlide(currentSlide) === sectionIdx
                          ? 'text-white font-bold' : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => {
                        if (menuItemToSlideIdx[item] !== undefined) {
                          setCurrentSlide(menuItemToSlideIdx[item]);
                          setOpenSection(sectionIdx);
                        }
                      }}
                    >
                      {TUTORIAL_SLIDES[currentSlide]?.menuTitle === item && getSectionIdxForSlide(currentSlide) === sectionIdx ? (
                        <span className="text-white">&#10003;</span>
                      ) : (
                        <span className="text-gray-400">&#8250;</span>
                      )}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {/* Main Content */}
        <div className="flex-1 flex flex-col relative h-full">
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold focus:outline-none"
            onClick={onClose}
            aria-label="Close Tutorial"
          >
            ×
          </button>
          {/* Title always at the top with fixed padding */}
          <h2 className="text-3xl font-bold text-white text-left w-full pt-12 px-10 mb-4">
            {TUTORIAL_SLIDES[currentSlide].slideTitle}
          </h2>
          {/* Scrollable content area below title */}
          <div className="flex-1 flex flex-col items-center min-w-0 overflow-y-auto tutorial-scrollbar">
            {TUTORIAL_SLIDES[currentSlide].imagePath ? (
              <img
                src={TUTORIAL_SLIDES[currentSlide].imagePath!}
                alt={TUTORIAL_SLIDES[currentSlide].slideTitle}
                className="rounded-lg border border-gray-700 2 shadow-lg cursor-zoom-in max-w-full object-contain"
                style={{ maxHeight: '400px', background: '#000' }}
                onClick={() => setFullscreenImg(TUTORIAL_SLIDES[currentSlide].imagePath!)}
                tabIndex={0}
                role="button"
                aria-label="View image fullscreen"
              />
            ) : (
              <div className="w-full h-72 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg mb-2 text-gray-500">
                Image coming soon
              </div>
            )}
            <div ref={markdownRef} className="max-w-xl w-full text-gray-300 text-lg text-left mt-6 px-12 pb-12" style={{maxHeight: '220px'}}>
              <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-white mb-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-white mb-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-xl font-bold text-white mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="ml-6 list-disc" {...props} />,
                }}
              >
                {TUTORIAL_SLIDES[currentSlide].subtitle || 'Content coming soon.'}
              </ReactMarkdown>
            </div>
          </div>
          {/* Navigation Arrows in lower right corner */}
          <div className="absolute bottom-8 right-8 flex flex-row gap-3 z-10">
            <ArrowButton
              direction="left"
              onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
              disabled={currentSlide === 0}
            />
            <ArrowButton
              direction="right"
              onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, TUTORIAL_SLIDES.length - 1))}
              disabled={currentSlide === TUTORIAL_SLIDES.length - 1}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal; 
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  defaultSection?: number;
}

// Define the sidebar sections in the order shown in the screenshot
const SIDEBAR_SECTIONS = [
  {
    title: 'Podcast Search',
    items: [
      'Podcast Search Basics',
      'Podcast Search Filters',
      'Instant Podcast Clip Share',
      'Create Clip Videos',
      'Cross Post Clips to Twitter/Nostr'
    ],
  },
  {
    title: 'Web Search',
    items: [
        'Private Web Search',
      'How It Works',
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
    menuTitle: 'Podcast Search Basics',
    slideTitle: 'Search with Just a Vibe',
    subtitle: `Can't think of the perfect keywords? No problem. Jamie's semantic search to turn vague queries into the precise moment you were looking for.
    
  **Steps:**
    1. Type in your query.
    2. (Optional) Click the "Filter" button and adjust as needed (see Filters section below)
    3. Click the search button or press enter.
    4. Peruse, play back, clip or share the clip results.
    `,
    imagePath: '/tutorial/jamie-pod-search.gif',
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Podcast Search Filters',
    slideTitle: 'Choose Which Podcasts to Search',
    subtitle: `Adjust which podcasts you want to search in 3 simple steps.
    
  **Steps:**
    1. Click the "Podcast Filter" toward top right of the search bar button.
    2. Click on the logos to select the podcast(s) you want to search clips from. You can search the list to narrow down the feed you want.
    3. (Optional) Click Save as Default to remember these settings for future sessions on PullThatUpJamie.ai.`,
    imagePath: '/tutorial/jamie-pod-filter.gif',
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Instant Podcast Clip Share',
    slideTitle: 'Send a Precise Clip to a Friend in 1 Click',
    subtitle: `
  **Steps:**
    1. Find the clip you want to share.
    2. Then click the "Link" button to copy a timestamped link to your clipboard. 
    3. Send the link to a friend. When they click Jamie will instantly jump them straight to the part you want to share.`,
    imagePath: '/tutorial/jamie-pod-quick-share.gif',
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Create Clip Videos',
    slideTitle: 'Search & Edit Clips in No Time',
    subtitle: `Share insightful moments from a podcast in a few simple steps.

  **Steps:**
    1. Find the approximate timestamp of the clip you want to share with semantic search.
    2. Click the "Clip" button
    3. Either choose Clip This to clip the existing clips or edit timestamps to your liking.
    4. Wait a few seconds for the clip to be created.
    5. Watch, download and share your clip!
  `,
    imagePath: '/tutorial/jamie-pod-make-clip.gif',
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Cross Post Clips to Twitter/Nostr',
    slideTitle: 'In One Click Share Your Clip on Twitter & Nostr:',
    subtitle: `Reach your audience on Nostr & Twitter with ease.

  **Steps:**
    1. Identify the clip of interest.
    2. Click the "Share" button on the clip of interest.
    3. Hit the nostr/twitter cross post button.
    4. Write the accompanying text to your liking (or have Jamie Assist write it for you).
    5. Click post and your clip will crosspost. Click the links to view your crossposted content.`,
    imagePath: '/tutorial/jamie-pod-cross-post-clip.gif',
    section: 'Podcast Search',
  },
  {
    menuTitle: 'Private Web Search',
    slideTitle: 'Search Privately and Efficiently',
    subtitle: `Jamie gives the convenience of AI web search with robust privacy guarantees.


  **Steps:**
    1. Type a search query.
    2. Click the "Search" button or press enter.
    3. Jamie will compile and summarize the search results with inline reference links.
    `,
    imagePath: '/tutorial/jamie-web-search.gif',
    section: 'Web Search',
  },
  {
    menuTitle: 'How It Works',
    slideTitle: 'Search Privately and Efficiently',
    subtitle: `Jamie Web Search is open source and shields you from big tech surveillance. By cloaking your identity from LLM providers and search engines, you get the benefits of high tech without giving up your privacy.`,
    imagePath: '/tutorial/jamie-web-explainer.png',
    section: 'Web Search',
  },
  {
    menuTitle: 'Dashboard',
    slideTitle: 'Jamie Pro Dashboard',
    subtitle: `The Pro Dashboard is your home for all Jamie Pro features and quick access to your curated content. To reach it, click the "Pro Dashboard" button in the banner from any page.`,
    imagePath: '/tutorial/jamie-pro-go-to-home.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Adjusting Preferences',
    slideTitle: 'Adjusting Agent Preferences',
    subtitle: `The Agent selects topics and themes you're likely to find interesting. You can adjust them with prompts.

  **Steps:**
    1. Go to the Pro Dashboard.
    2. Go to Jamie Pro tab from the top
    3. Go to Chat with Jamie
    4. Prompt Jamie to include/exclude certain topics or themes.

**Examples:**

- "Highlight stories about personal growth"
- "Remove the topic of macroeconomics"
- "Disregard statements that are likely to be ads"
`,
    imagePath: '/tutorial/jamie-pro-prefs-change.gif',
    section: 'Jamie Pro (Premium)',
  },
  
  {
    menuTitle: 'Accessing AI Curated Clips',
    slideTitle: 'Accessing AI Curated Clips',
    subtitle: `See previous Jamie Pro Agent curated clips. Typically each episode has 1 run with 3-5 clips each.

**Steps:**
    1. Go to the Pro Dashboard.
    2. Go to Jamie Pro tab from the top
    3. Go to Run History
    4. Click on the run of interest (typically 1 per episode)
    5. Peruse the curated clips (typically 3-5 per run)
    `,
    imagePath: '/tutorial/jamie-pro-run-history.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Crosspost to Nostr/Twitter',
    slideTitle: 'Crosspost to Nostr/Twitter',
    subtitle: `Share your favorite moments to Nostr or Twitter in two clicks.

**Steps:**
    1. Choose the clip of interest in Run History
    2. Click "Share" to tee up the AI generated clip
    3. (Optional) Click "Clip" to edit a clip to your liking.
    4. Type out the accompanying text OR
    5. (Optional) Click "Jamie Assist" to have Jamie AI write text
    6. Click "Post" to post to Twitter via OAuth & Nostr via extension of your choice.
    `,
    imagePath: '/tutorial/jamie-pro-instant-share-jamie-assist.gif',
    section: 'Jamie Pro (Premium)',
  },
  {
    menuTitle: 'Upload & Crosspost Arbitrary Media',
    slideTitle: 'Upload & Crosspost Arbitrary Media',
    subtitle: `Cross post any media of your choosing using the Jamie Pro Upload/Storage tab.

**Steps:**
    1. Go to the Pro Dashboard.
    2. Click "Upload" button on the top right.
    3. Choose the media & await upload.
    4. Type out the accompanying text
    5. Click "Post" to post to Twitter via OAuth & Nostr via extension of your choice.
    `,
    imagePath: '/tutorial/jamie-upload-and-share.gif',
    section: 'Jamie Pro (Premium)',
  },
];

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, defaultSection = 2 }) => {
  // Find the first slide for the default section
  const getFirstSlideForSection = (sectionIdx: number) => {
    if (sectionIdx >= 0 && sectionIdx < SIDEBAR_SECTIONS.length) {
      const sectionTitle = SIDEBAR_SECTIONS[sectionIdx].title;
      return TUTORIAL_SLIDES.findIndex(slide => slide.section === sectionTitle);
    }
    return 2; // Default to Dashboard if section not found
  };

  const [currentSlide, setCurrentSlide] = useState(() => getFirstSlideForSection(defaultSection));
  const [openSection, setOpenSection] = useState(defaultSection); // Use defaultSection prop
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const markdownRef = useRef<HTMLDivElement>(null);

  // Find the section index for the current slide
  const getSectionIdxForSlide = (slideIdx: number) => {
    const slide = TUTORIAL_SLIDES[slideIdx];
    return SIDEBAR_SECTIONS.findIndex(section => section.title === slide.section);
  };

  useEffect(() => {
    if (markdownRef.current) {
      markdownRef.current.scrollTop = 0;
    }
  }, [currentSlide]);

  // Update open section when current slide changes (for navigation arrows)
  useEffect(() => {
    if (isNavigating) {
      const sectionIdx = getSectionIdxForSlide(currentSlide);
      if (sectionIdx !== -1) {
        setOpenSection(sectionIdx);
      }
      setIsNavigating(false);
    }
  }, [currentSlide, isNavigating]);

  // Add escape key handler for fullscreen image
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fullscreenImg) {
        setFullscreenImg(null);
      }
    };

    if (fullscreenImg) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [fullscreenImg]);

  if (!isOpen) return null;

  // Map menu items to slide indices for navigation, grouped by section
  const menuItemToSlideIdx: Record<string, number> = {};
  TUTORIAL_SLIDES.forEach((slide, idx) => {
    menuItemToSlideIdx[slide.menuTitle] = idx;
  });

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
            className="max-w-[90%] max-h-[90%] rounded-lg shadow-2xl border border-gray-700"
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
      <div className="relative flex flex-col lg:flex-row w-full max-w-5xl h-[90vh] lg:h-[600px] rounded-2xl bg-[#111] border border-gray-800 shadow-2xl overflow-hidden m-4">
        {/* Sidebar - stacked on top for mobile */}
        <div className="w-full lg:w-72 bg-black/80 border-b lg:border-b-0 lg:border-r border-white flex flex-col py-4 lg:py-8 px-4 lg:px-6 max-h-48 lg:max-h-full overflow-y-auto tutorial-scrollbar">
          {SIDEBAR_SECTIONS.map((section, sectionIdx) => (
            <div key={section.title} className="mb-2 lg:mb-4">
              <button
                className="w-full flex items-center justify-between text-white font-bold text-base lg:text-lg mb-1 lg:mb-2 focus:outline-none"
                onClick={() => setOpenSection(sectionIdx)}
                aria-expanded={openSection === sectionIdx}
              >
                <span>{section.title}</span>
                {openSection === sectionIdx ? (
                  <ChevronDown className="ml-2 w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="ml-2 w-4 h-4 text-gray-400" />
                )}
              </button>
              {openSection === sectionIdx && (
                <ul className="space-y-1 lg:space-y-2 ml-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className={`cursor-pointer px-2 py-1 rounded transition-colors flex items-center gap-2 text-sm lg:text-base ${
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
            className="absolute top-2 lg:top-4 right-2 lg:right-4 text-gray-400 hover:text-white text-xl lg:text-2xl font-bold focus:outline-none z-10"
            onClick={onClose}
            aria-label="Close Tutorial"
          >
            ×
          </button>
          {/* Title always at the top with fixed padding */}
          <h2 className="text-xl lg:text-3xl font-bold text-white text-left w-full pt-8 lg:pt-12 px-4 lg:px-10 mb-2 lg:mb-4">
            {TUTORIAL_SLIDES[currentSlide].slideTitle}
          </h2>
          {/* Scrollable content area below title */}
          <div className="flex-1 flex flex-col items-center min-w-0 overflow-y-auto tutorial-scrollbar px-4 lg:px-0">
            {TUTORIAL_SLIDES[currentSlide].imagePath ? (
              <img
                src={TUTORIAL_SLIDES[currentSlide].imagePath!}
                alt={TUTORIAL_SLIDES[currentSlide].slideTitle}
                className="rounded-lg border border-gray-700 shadow-lg cursor-zoom-in max-w-full object-contain"
                style={{ maxHeight: '300px', background: '#000' }}
                onClick={() => setFullscreenImg(TUTORIAL_SLIDES[currentSlide].imagePath!)}
                tabIndex={0}
                role="button"
                aria-label="View image fullscreen"
              />
            ) : (
              <div className="w-full h-48 lg:h-72 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg mb-2 text-gray-500">
                Image coming soon
              </div>
            )}
            <div ref={markdownRef} className="max-w-xl w-full text-gray-300 text-base lg:text-lg text-left mt-4 lg:mt-6 px-4 lg:px-12 pb-12" style={{maxHeight: '220px'}}>
              <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl lg:text-3xl font-bold text-white mb-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl lg:text-2xl font-bold text-white mb-3" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg lg:text-xl font-bold text-white mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="ml-6 list-disc" {...props} />,
                }}
              >
                {TUTORIAL_SLIDES[currentSlide].subtitle || 'Content coming soon.'}
              </ReactMarkdown>
              <br></br>
            </div>
          </div>
          {/* Navigation Arrows in lower right corner */}
          <div className="absolute bottom-4 lg:bottom-8 right-4 lg:right-8 flex flex-row gap-2 lg:gap-3 z-10">
            <ArrowButton
              direction="left"
              onClick={() => {
                setIsNavigating(true);
                setCurrentSlide((prev) => Math.max(prev - 1, 0));
              }}
              disabled={currentSlide === 0}
            />
            <ArrowButton
              direction="right"
              onClick={() => {
                setIsNavigating(true);
                setCurrentSlide((prev) => Math.min(prev + 1, TUTORIAL_SLIDES.length - 1));
              }}
              disabled={currentSlide === TUTORIAL_SLIDES.length - 1}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal; 
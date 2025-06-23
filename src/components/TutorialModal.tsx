import React, { useState } from 'react';

interface TutorialSlide {
  menuTitle: string;
  slideTitle: string;
  subtitle: string;
  imagePath: string;
  section: string; // section name for grouping
}

interface TutorialModalProps {
  slides: TutorialSlide[];
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

const TutorialModal: React.FC<TutorialModalProps> = ({ slides, isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openSection, setOpenSection] = useState(2); // Default to Jamie Pro open

  if (!isOpen) return null;

  // Map menu items to slide indices for navigation, grouped by section
  const menuItemToSlideIdx: Record<string, number> = {};
  slides.forEach((slide, idx) => {
    menuItemToSlideIdx[slide.menuTitle] = idx;
  });

  // Find the section index for the current slide
  const getSectionIdxForSlide = (slideIdx: number) => {
    const slide = slides[slideIdx];
    return SIDEBAR_SECTIONS.findIndex(section => section.title === slide.section);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="relative flex w-full max-w-5xl h-[600px] rounded-2xl bg-[#111] border border-gray-800 shadow-2xl overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 bg-black/80 border-r border-white flex flex-col py-8 px-6 min-h-full max-h-full overflow-y-auto">
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
                        slides[currentSlide]?.menuTitle === item && getSectionIdxForSlide(currentSlide) === sectionIdx
                          ? 'text-white font-bold' : 'text-gray-300 hover:text-white'
                      }`}
                      onClick={() => {
                        if (menuItemToSlideIdx[item] !== undefined) {
                          setCurrentSlide(menuItemToSlideIdx[item]);
                          setOpenSection(sectionIdx);
                        }
                      }}
                    >
                      {slides[currentSlide]?.menuTitle === item && getSectionIdxForSlide(currentSlide) === sectionIdx ? (
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
        <div className="flex-1 flex flex-col items-center justify-center p-10 relative max-h-full overflow-y-auto">
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold focus:outline-none"
            onClick={onClose}
            aria-label="Close Tutorial"
          >
            ×
          </button>
          <div className="w-full flex flex-col items-center">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">
              {slides[currentSlide].slideTitle}
            </h2>
            <div className="flex flex-col items-center">
              <img
                src={slides[currentSlide].imagePath}
                alt={slides[currentSlide].slideTitle}
                className="rounded-lg border border-gray-700 max-h-72 mb-6 shadow-lg"
                style={{ objectFit: 'contain', background: '#000' }}
              />
              <p className="text-gray-300 text-lg text-center max-w-xl">
                {slides[currentSlide].subtitle}
              </p>
            </div>
          </div>
          {/* Navigation */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
            <button
              className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg disabled:opacity-50"
              onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
              disabled={currentSlide === 0}
            >
              Previous
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))}
              disabled={currentSlide === slides.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal; 
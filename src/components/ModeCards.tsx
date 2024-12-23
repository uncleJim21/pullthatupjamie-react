import React, { useState, useEffect } from 'react';
import { FeedbackForm } from './FeedbackForm.tsx';

// Carousel Component
const DataSourceCarousel = ({ sources }: { sources: Array<{ imageUrl: string, title: string, subtitle: string }> }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === sources.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Change every 3 seconds

    return () => clearInterval(timer);
  }, [sources.length]);

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? sources.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === sources.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div className="border border-gray-500 rounded-lg p-4 mb-8 ml-16 mr-16">
      <div className="flex items-center justify-between">
        <button 
          onClick={handlePrevious}
          className="text-gray-500 px-2 hover:text-gray-300"
        >
          &lt;
        </button>
        <div className="flex items-center gap-2 mb-2 mt-2">
          <img
            src={sources[currentIndex].imageUrl}
            alt={sources[currentIndex].title}
            className="w-8 h-8 rounded object-cover"
          />
          <div className="flex flex-col">
            <span className="font-medium">{sources[currentIndex].title}</span>
            <span className="text-sm text-gray-400">{sources[currentIndex].subtitle}</span>
          </div>
        </div>
        <button 
          onClick={handleNext}
          className="text-gray-500 px-2 hover:text-gray-300"
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export const DepthModeCard = () => {
  return (
    <div>
        <br></br>
        <div className="max-w-2xl mx-auto bg-black rounded-xl p-8 border border-gray-800">
      <div className="mb-12">
        <div className="flex items-center gap-6 mb-8">
          <div className="text-4xl">🤿</div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            Depth Mode - Under Construction!
            <span className="text-yellow-500">🚧</span>
          </div>
        </div>

        <ul className="space-y-4 text-gray-200">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Get more broad & higher quality search based on your intent</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Fine tune depth of search with a simple slider!</span>
          </li>
        </ul>
      </div>
      <FeedbackForm mode="expert" />
    </div>
    
    </div>
  );
};

export const ExpertModeCard = () => {
  // Example data sources - replace with your actual data
  const dataSources = [
    {
      imageUrl: "/stacker-news-logo.png",
      title: "Stacker News",
      subtitle: "Where Stackers talk shop"
    },
    {
      imageUrl: "/podcast-logo.png",
      title: "Podcasts",
      subtitle: "Access thousands of discussions"
    },
    {
      imageUrl: "/nostr-logo.png",
      title: "Nostr",
      subtitle: "Access data from the free and open social network"
    }
  ];

  return (
    <div>
        <br></br>
        <div className="max-w-2xl mx-auto bg-black rounded-xl p-8 border border-gray-800">
        <div className="mb-12">
            <div className="flex items-center gap-6 mb-8">
            <div className="text-4xl">🔮</div>
            <div className="text-2xl font-semibold flex items-center gap-2">
                Expert Mode - Under Construction!
                <span className="text-yellow-500">🚧</span>
            </div>
            </div>

            <ul className="space-y-4 text-gray-200 mb-8">
            <li className="flex items-start gap-2">
                <span>•</span>
                <span>Do deep search based on high quality data feeds</span>
            </li>
            <li className="flex items-start gap-2">
                <span>•</span>
                <span>Extract insight from sources as:</span>
            </li>
            </ul>

            <DataSourceCarousel sources={dataSources} />
        </div>

        <FeedbackForm mode="expert" />
        </div>
    </div>
  );
};
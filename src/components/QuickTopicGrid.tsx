import React, { useState, useEffect } from 'react';

interface QuickTopicCardProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  fadeOut: boolean;
  onAnimationEnd: () => void;
}

const QuickTopicCard: React.FC<QuickTopicCardProps> = ({ 
  icon, 
  title, 
  onClick, 
  fadeOut,
  onAnimationEnd
}) => (
  <button
    onClick={onClick}
    onTransitionEnd={onAnimationEnd}
    className={`relative group flex flex-col items-center justify-center aspect-square bg-[#111111] border border-white-800 rounded-lg hover:border-gray-700 transition-all duration-500 pr-1 pl-1 pb-1 pt-1 ${
      fadeOut ? 'opacity-0 -translate-y-8' : 'opacity-100 translate-y-0'
    }`}
  >
    <div className="text-5xl mb-3 group-hover:scale-105 transition-transform duration-200">
      {icon}
    </div>
    <div className="text-xl font-medium text-white group-hover:text-gray-300 transition-colors">
      {title}
    </div>
  </button>
);

interface QuickTopicGridProps {
  onTopicSelect: (query: string) => void;
  triggerFadeOut?: boolean; // New prop to trigger fade out from parent
}

const QuickTopicGrid: React.FC<QuickTopicGridProps> = ({ onTopicSelect , triggerFadeOut=false}) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);

  useEffect(() => {
    if (triggerFadeOut) {
      setFadeOut(true);
      setTimeout(() => {
        setIsGridVisible(false);
      }, 500);
    }
  }, [triggerFadeOut]);

  const topics = [
    { 
      icon: <img src="/icons/meat.png" alt="Diet" className="w-16 h-16" />, 
      title: 'Diet',
      query: 'diet nutrition health'
    },
    { 
      icon: <img src="/icons/bitcoin.png" alt="Bitcoin" className="w-16 h-16" />, 
      title: 'Bitcoin',
      query: 'bitcoin news or tech developments'
    },
    { 
      icon: <img src="/icons/tech.png" alt="Tech" className="w-16 h-16" />, 
      title: 'Tech',
      query: 'technology innovation'
    },
    { 
      icon: <img src="/icons/fitness.png" alt="Fitness" className="w-16 h-16" />, 
      title: 'Fitness',
      query: 'fitness workouts and tips'
    },
    { 
      icon: <img src="/icons/economics.png" alt="Economic Trends" className="w-16 h-16" />, 
      title: 'Economic Trends',
      query: 'economic trends, news and macro predictions'
    },
    { 
      icon: <img src="/icons/politics.png" alt="Politics" className="w-16 h-16" />, 
      title: 'Politics',
      query: 'political discussions and debates'
    }
  ];

  const handleTopicClick = (query: string) => {
    setFadeOut(true);
    // Wait for the fade animation to complete before triggering the search
    setTimeout(() => {
      onTopicSelect(query);
      setIsGridVisible(false);
    }, 500); // Match the duration-500 timing
  };

  if (!isGridVisible) return null;

  return (
    <div className="px-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6">Quick Topics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {topics.map((topic, index) => (
          <QuickTopicCard
            key={index}
            icon={topic.icon}
            title={topic.title}
            fadeOut={fadeOut}
            onAnimationEnd={() => {}}
            onClick={() => handleTopicClick(topic.query)}
          />
        ))}
      </div>
    </div>
  );
};

export default QuickTopicGrid;
import React, { useState } from 'react';

// Automation wizard steps enum
enum AutomationStep {
  CURATION_SETTINGS = 1,
  POSTING_STYLE = 2,
  POSTING_SCHEDULE = 3
}

// Step indicator interface
interface StepIndicatorProps {
  currentStep: AutomationStep;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Curation Settings' },
    { number: 2, label: 'Posting Style' },
    { number: 3, label: 'Posting Schedule' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 flex items-center px-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200
                ${currentStep === step.number
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-gray-700 text-white border-gray-700'}
              `}
              style={{ minWidth: 32, minHeight: 32 }}
            >
              <span className="text-sm sm:text-lg font-bold">{step.number}</span>
            </div>
            <span
              className={`text-xs mt-1 ${
                currentStep === step.number ? 'text-white font-bold' : 'text-gray-400 font-normal'
              }`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {step.label}
            </span>
          </div>
          {idx !== steps.length - 1 && (
            <div className="flex-1 h-[1.5px] bg-gray-700 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Topic input field component
interface TopicInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onRemove?: () => void;
  canRemove?: boolean;
}

const TopicInputField: React.FC<TopicInputFieldProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  onRemove, 
  canRemove = false 
}) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
      />
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
};

// Suggested topic card component
interface SuggestedTopicCardProps {
  emoji: string;
  title: string;
  onClick: () => void;
}

const SuggestedTopicCard: React.FC<SuggestedTopicCardProps> = ({ emoji, title, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center aspect-square bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 transition-all duration-200 p-4"
  >
    <div className="text-4xl mb-2 group-hover:scale-105 transition-transform duration-200">
      {emoji}
    </div>
    <div className="text-sm font-medium text-white group-hover:text-gray-300 transition-colors text-center">
      {title}
    </div>
  </button>
);

const AutomationSettingsPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AutomationStep>(AutomationStep.CURATION_SETTINGS);
  const [topics, setTopics] = useState<string[]>(['', '', '']);

  // Handle topic input changes
  const handleTopicChange = (index: number, value: string) => {
    const newTopics = [...topics];
    newTopics[index] = value;
    setTopics(newTopics);
  };

  // Add a new topic field
  const addTopicField = () => {
    if (topics.length < 5) {
      setTopics([...topics, '']);
    }
  };

  // Remove a topic field
  const removeTopicField = (index: number) => {
    if (topics.length > 1) {
      const newTopics = topics.filter((_, i) => i !== index);
      setTopics(newTopics);
    }
  };

  // Handle suggested topic selection
  const handleSuggestedTopicClick = (topicTitle: string) => {
    // Find the first empty topic field or add a new one
    const emptyIndex = topics.findIndex(topic => topic === '');
    if (emptyIndex !== -1) {
      handleTopicChange(emptyIndex, topicTitle);
    } else if (topics.length < 5) {
      setTopics([...topics, topicTitle]);
    }
  };

  // Check if at least one topic is filled
  const hasValidTopics = topics.some(topic => topic.trim() !== '');

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < AutomationStep.POSTING_SCHEDULE) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > AutomationStep.CURATION_SETTINGS) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Suggested topics data
  const suggestedTopics = [
    { emoji: '🥩', title: 'Personal Growth' },
    { emoji: '💰', title: 'Corruption' },
    { emoji: '🕵️', title: 'Conspiracies' },
    { emoji: '🍎', title: 'Health' },
    { emoji: '💪', title: 'Fitness' },
    { emoji: '🧠', title: 'Psychology' },
    { emoji: '📈', title: 'Economics' },
    { emoji: '🏛️', title: 'Politics' },
    { emoji: '🔬', title: 'Science' },
  ];

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case AutomationStep.CURATION_SETTINGS:
        return (
          <div className="max-w-2xl mx-auto">
            {/* Header Text */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Configure Your Content Curation</h1>
              <p className="text-gray-400 text-lg">
                Tell Jamie what topics you're passionate about and want to automatically find and share content for.
              </p>
            </div>

            {/* Topic Input Fields */}
            <div className="space-y-4 mb-8">
              {topics.map((topic, index) => (
                <TopicInputField
                  key={index}
                  value={topic}
                  onChange={(value) => handleTopicChange(index, value)}
                  placeholder={`Topic #${index + 1}`}
                  onRemove={() => removeTopicField(index)}
                  canRemove={topics.length > 1}
                />
              ))}
              
              {/* Add topic button */}
              {topics.length < 5 && (
                <button
                  onClick={addTopicField}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg py-3 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  + Add Another Topic
                </button>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center py-6">
              <button
                onClick={handleBack}
                disabled={currentStep === AutomationStep.CURATION_SETTINGS}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  currentStep === AutomationStep.CURATION_SETTINGS
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                Back
              </button>
              
              <button
                onClick={handleNext}
                disabled={!hasValidTopics}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  hasValidTopics
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>

            {/* Suggested Topics */}
            <div className="border-t border-gray-800 pt-8">
              <h3 className="text-xl font-bold text-white mb-6 text-center">Suggested Topics</h3>
              <div className="grid grid-cols-3 gap-4">
                {suggestedTopics.map((topic, index) => (
                  <SuggestedTopicCard
                    key={index}
                    emoji={topic.emoji}
                    title={topic.title}
                    onClick={() => handleSuggestedTopicClick(topic.title)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      
      case AutomationStep.POSTING_STYLE:
        return (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-gray-400">Posting Style configuration coming soon...</p>
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 rounded-lg font-medium transition-colors bg-gray-700 text-white hover:bg-gray-600"
              >
                Back
              </button>
              
              <button
                onClick={handleNext}
                className="px-6 py-3 rounded-lg font-medium transition-colors bg-white text-black hover:bg-gray-200"
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case AutomationStep.POSTING_SCHEDULE:
        return (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-gray-400">Posting Schedule configuration coming soon...</p>
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 rounded-lg font-medium transition-colors bg-gray-700 text-white hover:bg-gray-600"
              >
                Back
              </button>
              
              <button
                onClick={() => {
                  // TODO: Save settings and close wizard
                  console.log('Save automation settings');
                }}
                className="px-6 py-3 rounded-lg font-medium transition-colors bg-white text-black hover:bg-gray-200"
              >
                Save Settings
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Jamie Pro Banner */}
      <div className="flex flex-col items-center pt-8 pb-6">
        <img
          src="/jamie-pro-banner.png"
          alt="Jamie Pro Banner"
          className="max-w-full h-auto"
        />
        <p className="text-gray-400 text-xl font-medium mt-2">Automation Settings</p>
      </div>
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        {renderStepContent()}
      </div>
    </div>
  );
};

export default AutomationSettingsPage;

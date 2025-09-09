import React, { useState, useEffect } from 'react';
import { Twitter } from 'lucide-react';
import ScheduledPostSlots from './ScheduledPostSlots.tsx';
import { ScheduledSlot } from '../services/preferencesService.ts';
import PageBanner from './PageBanner.tsx';
import { getAutomationSettings, saveAutomationSettings, AutomationSettings, PlatformAutomationSettings } from '../services/automationSettingsService.ts';
import PlatformIntegrationService, { PlatformState } from '../services/platformIntegrationService.ts';
import SignInModal from './SignInModal.tsx';
import { API_URL, printLog } from '../constants/constants.ts';

// Define type for Nostr window extension
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: any) => Promise<any>;
      nip04?: {
        encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
      };
    };
  }
}

// Automation wizard steps enum
enum AutomationStep {
  CURATION_SETTINGS = 1,
  POSTING_STYLE = 2,
  POSTING_SCHEDULE = 3,
  PLATFORM_INTEGRATION = 4
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
    { number: 4, label: 'Platform Integration' },
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
  emoji?: string;
  icon?: React.ReactNode;
  title: string;
  onClick: () => void;
}

const SuggestedTopicCard: React.FC<SuggestedTopicCardProps> = ({ emoji, icon, title, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center aspect-square bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 transition-all duration-200 p-4"
  >
    <div className="mb-2 group-hover:scale-105 transition-transform duration-200">
      {icon ? (
        <div className="flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <div className="text-4xl">
          {emoji}
        </div>
      )}
    </div>
    <div className="text-sm font-medium text-white group-hover:text-gray-300 transition-colors text-center">
      {title}
    </div>
  </button>
);

// Success Modal for Settings Save
const SettingsSaveSuccessPopup = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-lg font-bold mb-4">Settings Saved Successfully!</h2>
      <p className="text-gray-400 mb-4">
        Your Jamie Full Auto settings have been saved. Jamie will now automatically find and share content based on your preferences.
      </p>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
      >
        Continue
      </button>
    </div>
  </div>
);

// Admin Access Required Modal
interface AdminAccessRequiredModalProps {
  onClose: () => void; 
  onSignIn: () => void;
  isUserSignedIn: boolean;
}

const AdminAccessRequiredModal = ({ onClose, onSignIn, isUserSignedIn }: AdminAccessRequiredModalProps) => (
  <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-xl font-bold mb-4">
        Admin Access Required
      </h2>
      <p className="text-gray-400 mb-6">
        {isUserSignedIn 
          ? "You need admin privileges to access automation settings. Please sign in with an admin account to configure podcast automation features."
          : "You need to be signed in as an admin to access automation settings. Please sign in with an admin account to configure podcast automation features."
        }
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSignIn}
          className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
        >
          {isUserSignedIn ? 'Sign In as Admin' : 'Sign In'}
        </button>
      </div>
    </div>
  </div>
);

const AutomationSettingsPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AutomationStep>(AutomationStep.CURATION_SETTINGS);
  const [topics, setTopics] = useState<string[]>(['']);
  const [writingStyle, setWritingStyle] = useState<string>('');
  const [isUsingDefault, setIsUsingDefault] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [isUserSignedIn, setIsUserSignedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showAdminRequiredModal, setShowAdminRequiredModal] = useState<boolean>(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(false);
  const [platformStates, setPlatformStates] = useState<{
    twitter: PlatformState;
    nostr: PlatformState;
  }>({
    twitter: { enabled: false, available: true, authenticated: false },
    nostr: { enabled: false, available: true, authenticated: false }
  });
  const [automationSettings, setAutomationSettings] = useState<PlatformAutomationSettings>({
    twitterOAuthEnabled: false,
    nostrAutomationEnabled: false
  });
  const [scheduledSlots, setScheduledSlots] = useState<ScheduledSlot[]>(() => {
    // Generate default slots: 9:45 AM and 4:45 PM on weekdays (Monday-Friday)
    const defaultSlots: ScheduledSlot[] = [];
    for (let day = 1; day <= 5; day++) { // Monday = 1, Friday = 5
      defaultSlots.push({
        id: `slot_${day}_morning_${Date.now()}`,
        dayOfWeek: day,
        time: '09:45',
        enabled: true
      });
      defaultSlots.push({
        id: `slot_${day}_afternoon_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dayOfWeek: day,
        time: '16:45',
        enabled: true
      });
    }
    return defaultSlots;
  });

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
  const handleSuggestedTopicClick = (topicQuery: string) => {
    // Find the first empty topic field or add a new one
    const emptyIndex = topics.findIndex(topic => topic === '');
    if (emptyIndex !== -1) {
      handleTopicChange(emptyIndex, topicQuery);
    } else if (topics.length < 5) {
      setTopics([...topics, topicQuery]);
    }
  };

  // Check if at least one topic is filled
  const hasValidTopics = topics.some(topic => topic.trim() !== '');

  // Handle writing style changes
  const handleWritingStyleFocus = () => {
    if (isUsingDefault) {
      setWritingStyle('');
      setIsUsingDefault(false);
    }
  };

  const handleWritingStyleChange = (value: string) => {
    setWritingStyle(value);
    setIsUsingDefault(false);
  };

  const handleUseDefault = () => {
    setWritingStyle(defaultWritingStylePrompt);
    setIsUsingDefault(true);
    if (currentStep < AutomationStep.POSTING_SCHEDULE) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < AutomationStep.PLATFORM_INTEGRATION) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > AutomationStep.CURATION_SETTINGS) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle scheduled slots changes
  const handleScheduledSlotsChange = (slots: ScheduledSlot[]) => {
    setScheduledSlots(slots);
  };

  // Platform integration handlers
  const handleTwitterConnect = async () => {
    try {
      const result = await PlatformIntegrationService.connectTwitter();
      if (result.success) {
        // Refresh platform status after connection
        await loadPlatformStatus();
      } else {
        console.error('Twitter connection failed:', result.error);
        alert('Failed to connect to Twitter. Please try again.');
      }
    } catch (error) {
      console.error('Twitter connection error:', error);
      alert('Failed to connect to Twitter. Please try again.');
    }
  };

  const handleTwitterDisconnect = async () => {
    try {
      const result = await PlatformIntegrationService.disconnectTwitter();
      if (result.success) {
        // Refresh platform status after disconnection
        await loadPlatformStatus();
        // Disable automation if disconnected
        setAutomationSettings(prev => ({ ...prev, twitterOAuthEnabled: false }));
      } else {
        console.error('Twitter disconnection failed:', result.error);
        alert('Failed to disconnect from Twitter. Please try again.');
      }
    } catch (error) {
      console.error('Twitter disconnection error:', error);
      alert('Failed to disconnect from Twitter. Please try again.');
    }
  };

  const handleAutomationSettingChange = (platform: 'twitter' | 'nostr', enabled: boolean) => {
    setAutomationSettings(prev => ({
      ...prev,
      ...(platform === 'twitter' 
        ? { twitterOAuthEnabled: enabled }
        : { nostrAutomationEnabled: enabled }
      )
    }));
  };

  const loadPlatformStatus = async () => {
    try {
      const status = await PlatformIntegrationService.getPlatformStatus();
      setPlatformStates(status);
    } catch (error) {
      console.error('Failed to load platform status:', error);
    }
  };

  // Check platform status using shared service
  const checkPlatformStatus = async () => {
    try {
      const [twitterState, nostrState] = await Promise.all([
        PlatformIntegrationService.checkTwitterAuth(),
        PlatformIntegrationService.checkNostrExtension()
      ]);
      
      setPlatformStates({
        twitter: twitterState,
        nostr: nostrState
      });
    } catch (error) {
      printLog(`Error checking platform status: ${error}`);
    }
  };

  // Connect to Nostr extension using shared service
  const connectNostrExtension = async () => {
    try {
      const nostrState = await PlatformIntegrationService.connectNostrExtension();
      setPlatformStates(prev => ({
        ...prev,
        nostr: nostrState
      }));
    } catch (error) {
      printLog(`Error connecting to Nostr: ${error}`);
    }
  };

  // Default writing style prompt
  const defaultWritingStylePrompt = "Pull out the most impactful verbatim quote from this clip then follow up with a carriage return and a call to action with the full podcast link";

  // Load authentication state from localStorage
  useEffect(() => {
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      const isUserSignedIn = hasToken && hasSquareId;
      setIsUserSignedIn(isUserSignedIn);
      
      // Check admin privileges from localStorage
      const adminPrivs = localStorage.getItem('admin_privs');
      const isUserAdmin = adminPrivs === 'true' && isUserSignedIn; // Must be signed in AND have admin privs
      setIsAdmin(isUserAdmin);
      
      // Show admin required modal if user is not signed in OR not admin
      if (!isUserSignedIn || !isUserAdmin) {
        setShowAdminRequiredModal(true);
      }
    };
  
    // Add a slight delay before checking localStorage
    const timeout = setTimeout(checkSignedIn, 50); // 50ms delay
  
    return () => clearTimeout(timeout); // Cleanup timeout
  }, []);

  // Load existing settings on component mount (only if admin)
  useEffect(() => {
    const loadAutomationSettings = async () => {
      try {
        setIsLoading(true);
        const feedId = '550168'; // Hardcoded feedId as shown in the curl example
        
        const result = await getAutomationSettings(feedId);
        
        if (result.success && result.data) {
          const { curationSettings, postingStyle, postingSchedule } = result.data;
          
          // Populate curation settings (topics)
          if (curationSettings?.topics && Array.isArray(curationSettings.topics)) {
            const loadedTopics = curationSettings.topics.length > 0 ? curationSettings.topics : [''];
            setTopics(loadedTopics);
          }
          
          // Populate posting style
          if (postingStyle?.prompt && postingStyle.prompt.trim() !== '') {
            setWritingStyle(postingStyle.prompt);
            setIsUsingDefault(postingStyle.prompt === defaultWritingStylePrompt);
          } else {
            // If prompt is null, empty, or whitespace-only, use default
            setWritingStyle(defaultWritingStylePrompt);
            setIsUsingDefault(true);
          }
          
          // Populate posting schedule
          if (postingSchedule?.scheduledPostSlots && Array.isArray(postingSchedule.scheduledPostSlots)) {
            setScheduledSlots(postingSchedule.scheduledPostSlots);
          }

          // Load platform integration settings from userSettings
          const userSettings = localStorage.getItem('userSettings');
          if (userSettings) {
            try {
              const parsed = JSON.parse(userSettings);
              if (parsed.automationSettings) {
                setAutomationSettings(parsed.automationSettings);
              }
            } catch (e) {
              console.error('Failed to parse userSettings:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading automation settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only load settings if user is admin
    if (isAdmin) {
      loadAutomationSettings();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Load platform status when reaching platform integration step
  useEffect(() => {
    if (currentStep === AutomationStep.PLATFORM_INTEGRATION && isAdmin) {
      checkPlatformStatus();
    }
  }, [currentStep, isAdmin]);

  // Handle sign in modal open
  const handleOpenSignInModal = () => {
    setIsSignInModalOpen(true);
  };

  // Handle admin access modal actions
  const handleAdminModalSignIn = () => {
    setShowAdminRequiredModal(false);
    setIsSignInModalOpen(true);
  };

  const handleAdminModalClose = () => {
    setShowAdminRequiredModal(false);
    // Redirect back to the main feed page
    window.location.href = '/app/feed/550168/jamieProHistory';
  };

  // Handle sign in success
  const handleSignInSuccess = () => {
    setIsSignInModalOpen(false);
    setIsUserSignedIn(true);
    
    // Recheck admin privileges after sign in
    const adminPrivs = localStorage.getItem('admin_privs');
    const isUserAdmin = adminPrivs === 'true';
    setIsAdmin(isUserAdmin);
    
    if (!isUserAdmin) {
      setShowAdminRequiredModal(true);
    }
  };
  
  // Handle sign out
  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('squareId');
    localStorage.removeItem('isSubscribed');
    setIsUserSignedIn(false);
    
    // Redirect to main app after sign out
    window.location.href = '/app';
  };

  const handleUpgrade = () => {
    // For now, just redirect to the main app
    window.location.href = '/app';
  };

  const handleTutorialClick = () => {
    // For now, just redirect to the main app
    window.location.href = '/app';
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const feedId = '550168'; // Hardcoded feedId as shown in the curl example
      
      const settingsToSave: AutomationSettings = {
        curationSettings: {
          topics: topics.filter(topic => topic.trim() !== ''),
          feedId: feedId
        },
        postingStyle: {
          prompt: isUsingDefault ? defaultWritingStylePrompt : writingStyle
        },
        postingSchedule: {
          scheduledPostSlots: scheduledSlots,
          randomizePostTime: true // Default to true as shown in the API response
        },
        automationSettings: {
          twitterOAuthEnabled: automationSettings.twitterOAuthEnabled,
          nostrAutomationEnabled: automationSettings.nostrAutomationEnabled
        },
        automationEnabled: true // Enable automation when settings are saved
      };
      
      const result = await saveAutomationSettings(settingsToSave);
      
      if (result.success) {
        // Save automation settings to userSettings
        const userSettings = localStorage.getItem('userSettings');
        const parsedSettings = userSettings ? JSON.parse(userSettings) : {};
        parsedSettings.automationSettings = automationSettings;
        localStorage.setItem('userSettings', JSON.stringify(parsedSettings));
        
        setShowSuccessModal(true);
      } else {
        console.error('Failed to save automation settings:', result.message || 'Unknown error');
        alert('Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving automation settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Suggested topics data
  const suggestedTopics = [
    // Row 1: Bitcoin & Economics
    { 
      icon: <img src="/icons/bitcoin.png" alt="Bitcoin" className="w-16 h-16" />, 
      title: 'Bitcoin Economics',
      query: 'bitcoin implications on macroeconomics, return to sound money and the effects of hyperbitcoinization'
    },
    { 
      emoji: '🏗️', 
      title: 'Bitcoin Innovation',
      query: 'novel bitcoin use cases and lightning network developments'
    },
    { 
      icon: <img src="/icons/economics.png" alt="Economics" className="w-16 h-16" />, 
      title: 'Austrian Economics',
      query: 'Austrian school economics and macroeconomic analysis'
    },
    
    // Row 2: Politics & Society
    { 
      icon: <img src="/icons/politics.png" alt="Politics" className="w-16 h-16" />, 
      title: 'Political Corruption',
      query: 'government corruption and civil liberties violations'
    },
    { 
      emoji: '🕵️', 
      title: 'Alternative Perspectives',
      query: 'unconventional takes from veterans and intelligence people'
    },
    { 
      emoji: '🤡🌍', 
      title: 'Clown World',
      query: 'satire on progressive politics and societal trends'
    },
    
    // Row 3: Personal & Business
    { 
      icon: <img src="/icons/fitness.png" alt="Fitness" className="w-16 h-16" />, 
      title: 'Personal Growth',
      query: 'lessons learned from struggles and overcoming adversity'
    },
    { 
      emoji: '🚀', 
      title: 'Founder Stories',
      query: 'background stories and what inspires startup founders, challenges they face'
    },
    { 
      icon: <img src="/icons/tech.png" alt="Tech" className="w-16 h-16" />, 
      title: 'Future Trends',
      query: 'futurism and sociological developments affecting society'
    },
    
    // Row 4: Technology & Freedom
    { 
      emoji: '🤖', 
      title: 'AI & Tech',
      query: 'artificial intelligence and surveillance state implications'
    },
    { 
      emoji: '🛡️', 
      title: 'Freedom Tech',
      query: 'bitcoin, nostr, privacy and freedom tech developments'
    },
    { 
      emoji: '🔍', 
      title: 'Geopolitics',
      query: 'geopolitical developments and their economic impacts'
    },
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
                Tell Jamie in plain language what topics you're passionate about and want to automatically find and share content for.
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
                    icon={topic.icon}
                    title={topic.title}
                    onClick={() => handleSuggestedTopicClick(topic.query)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      
      case AutomationStep.POSTING_STYLE:
        return (
          <div className="max-w-2xl mx-auto">
            {/* Header Text */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Coach Jamie's Writing Style</h1>
              <p className="text-gray-400 text-lg">
                Instruct Jamie on how you want him to write text accompanying your video podcast clips.
              </p>
            </div>

            {/* Writing Style Text Box */}
            <div className="mb-8">
              {isUsingDefault && (
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Prompt:
                </label>
              )}
              <textarea
                value={writingStyle}
                onFocus={handleWritingStyleFocus}
                onChange={(e) => handleWritingStyleChange(e.target.value)}
                className={`w-full px-4 py-3 bg-[#111111] border border-gray-800 rounded-lg focus:outline-none focus:border-gray-600 transition-colors resize-none ${
                  isUsingDefault ? 'text-gray-400' : 'text-white'
                }`}
                rows={4}
                placeholder="Describe how you want Jamie to write your social media posts..."
              />
              
              {/* Example Output */}
              <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
                <h4 className="text-white font-medium mb-2">Example Output:</h4>
                <div className="text-gray-300 text-sm">
                  <p className="mb-2">
                    "Bitcoin is that ship, the ultimate tool for the entrepreneur, freeing us from the weight of the fiat system."
                  </p>
                  <p>
                    Dive into the full conversation with MADEX on THE Bitcoin Podcast: https://fountain.fm/episode/5jHdICDe5fOX0xms74fI
                  </p>
                </div>
              </div>
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
                onClick={isUsingDefault ? handleUseDefault : handleNext}
                className="px-6 py-3 rounded-lg font-medium transition-colors bg-white text-black hover:bg-gray-200"
              >
                {isUsingDefault ? 'Use Default' : 'Next'}
              </button>
            </div>
          </div>
        );
      
      case AutomationStep.POSTING_SCHEDULE:
        return (
          <div className="max-w-2xl mx-auto">
            {/* Header Text */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Choose Your Posting Slots</h1>
              <p className="text-gray-400 text-lg">
                Select the default time slots Jamie will choose when auto posting on your behalf
              </p>
            </div>

            {/* Scheduled Post Slots */}
            <div className="mb-8">
              <ScheduledPostSlots
                slots={scheduledSlots}
                onSlotsChange={handleScheduledSlotsChange}
                maxSlots={10}
                isSelectable={false}
              />
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
      
      case AutomationStep.PLATFORM_INTEGRATION:
        return (
          <div className="max-w-2xl mx-auto">
            {/* Header Text */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Platform Integration</h1>
              <p className="text-gray-400 text-lg">
                Connect your social media accounts and configure automation settings
              </p>
            </div>

            {/* Platform Selection with Checkboxes */}
            <div className="mb-6">
              <div className="space-y-3">
                {/* Twitter Platform */}
                <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Twitter className="w-6 h-6 text-blue-400" />
                    <div className="flex-1">
                      {platformStates.twitter.authenticated ? (
                        <p className="text-white text-sm">Signed in as @{platformStates.twitter.username}</p>
                      ) : (
                        <p className="text-white text-sm">Connect to enable automatic posting</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {platformStates.twitter.authenticated ? (
                        <button
                          onClick={handleTwitterDisconnect}
                          className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={handleTwitterConnect}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <input
                      type="checkbox"
                      checked={automationSettings.twitterOAuthEnabled}
                      onChange={(e) => handleAutomationSettingChange('twitter', e.target.checked)}
                      disabled={!platformStates.twitter.authenticated}
                      className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Nostr Platform */}
                <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <img 
                      src="/nostr-logo-square.png" 
                      alt="Nostr" 
                      className="w-6 h-6"
                      style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen', opacity: platformStates.nostr.available ? 1 : 0.5 }}
                    />
                    <div className="flex-1">
                      {platformStates.nostr.available && platformStates.nostr.authenticated ? (
                        <p className="text-white text-sm">Extension connected</p>
                      ) : platformStates.nostr.available ? (
                        <p className="text-white text-sm">Connect NIP07 Extension to enable automation</p>
                      ) : (
                        <div className="text-xs text-gray-400 italic opacity-70">Install a Nostr extension (like nos2x)</div>
                      )}
                    </div>
                    {platformStates.nostr.available && !platformStates.nostr.authenticated && (
                      <button
                        onClick={connectNostrExtension}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <input
                      type="checkbox"
                      checked={automationSettings.nostrAutomationEnabled}
                      onChange={(e) => handleAutomationSettingChange('nostr', e.target.checked)}
                      disabled={!platformStates.nostr.available || !platformStates.nostr.authenticated}
                      className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Automation Settings Labels */}
            <div className="mb-6 space-y-2">
              <div className="text-sm text-gray-400">
                <strong>Twitter:</strong> Automatically post to Twitter via @{platformStates.twitter.username || 'your account'}
              </div>
              <div className="text-sm text-gray-400">
                <strong>Nostr:</strong> Receive emails when auto-generated Nostr notes are ready for signing
              </div>
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
                onClick={handleSaveSettings}
                disabled={isSaving || (!automationSettings.twitterOAuthEnabled && !automationSettings.nostrAutomationEnabled)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isSaving || (!automationSettings.twitterOAuthEnabled && !automationSettings.nostrAutomationEnabled)
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative pb-0.5">
      {/* Page Banner */}
      <PageBanner 
        logoText="Pull That Up Jamie!" 
        onSignIn={handleOpenSignInModal}
        onSignOut={handleSignOut}
        onUpgrade={handleUpgrade}
        onTutorialClick={handleTutorialClick}
        isUserSignedIn={isUserSignedIn}
        setIsUserSignedIn={setIsUserSignedIn}
      />

      {/* Back Arrow and Jamie Pro Banner */}
      <div className="relative w-full max-w-4xl mx-auto">
        <div className="flex justify-start md:block mb-4 md:mb-0">
          <button 
            onClick={() => window.location.href = `/app/feed/550168/jamieProHistory`} 
            className="md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 h-12 w-12 flex items-center justify-center bg-transparent text-white hover:text-gray-300 focus:outline-none z-10 ml-4 md:ml-0"
            style={{
              color: '#C0C0C0',
              textShadow: '0 0 8px #C0C0C0',
              fontSize: '32px'
            }}
          >
            ←
          </button>
        </div>
        <div className="flex flex-col items-center py-8">
          <img
            src="/jamie-pro-banner.png"
            alt="Jamie Pro Banner"
            className="max-w-full h-auto"
          />
          <p className="text-gray-400 text-xl font-medium mt-2">Automation Settings</p>
        </div>
      </div>
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <div className={`max-w-4xl mx-auto px-4 pb-8 ${!isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
        {renderStepContent()}
      </div>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading your settings...</p>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {showSuccessModal && (
        <SettingsSaveSuccessPopup 
          onClose={() => {
            setShowSuccessModal(false);
            // Navigate back to Jamie Pro History page
            window.location.href = '/app/feed/550168/jamieProHistory';
          }} 
        />
      )}

      {/* Admin Access Required Modal */}
      {showAdminRequiredModal && (
        <AdminAccessRequiredModal
          onClose={handleAdminModalClose}
          onSignIn={handleAdminModalSignIn}
          isUserSignedIn={isUserSignedIn}
        />
      )}

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInModalOpen} 
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={handleSignInSuccess}
      />
    </div>
  );
};

export default AutomationSettingsPage;

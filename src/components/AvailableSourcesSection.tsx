import React, { useState, useEffect, useRef } from 'react';
import { Check, Filter, Search, Save } from 'lucide-react';
import { API_URL, printLog } from '../constants/constants.ts';
import { FeedbackForm } from './FeedbackForm.tsx';
import { CheckoutModal } from './CheckoutModal.tsx';
import PodcastSourceItem from './PodcastSourceItem.tsx';
import { fetchAvailableSources, submitPodcastRequest, PodcastSource, sortPodcastSources } from '../services/podcastSourceService.ts';

interface AvailableSourcesProps {
  className?: string;
  hasSearched: boolean;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
  sizeOverride?: string;
  isSendingFeedback: boolean;
  setIsSendingFeedback: React.Dispatch<React.SetStateAction<boolean>>;
}

const STORAGE_KEY = 'selectedPodcastSources';

// Enum for tracking the podcast request flow steps
enum RequestFlowStep {
  INITIAL = 0,
  USER_TYPE = 1,
  PODCAST_DETAILS = 2,
  FAN_OPTIONS = 3,
  CHECKOUT = 4,
  SUCCESS = 5
}

const AvailableSourcesSection: React.FC<AvailableSourcesProps> = ({ 
  className, 
  hasSearched, 
  selectedSources, 
  setSelectedSources, 
  sizeOverride, 
  isSendingFeedback, 
  setIsSendingFeedback 
}) => {  
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<PodcastSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!hasSearched);
  const [isMobile, setIsMobile] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const hasLoadedDefault = useRef(false);
  const sourcesContainerRef = useRef<HTMLDivElement>(null);

  // Podcast request flow state
  const [requestFlowStep, setRequestFlowStep] = useState<RequestFlowStep>(RequestFlowStep.INITIAL);
  const [userRole, setUserRole] = useState<'fan' | 'podcaster' | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [podcastDetails, setPodcastDetails] = useState({
    email: '',
    podcastName: '',
    podcastUrl: ''
  });
  const [paymentOption, setPaymentOption] = useState<'vote' | 'pay' | null>(null);
  const [isJamiePro, setIsJamiePro] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPurchaseSuccess, setIsPurchaseSuccess] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth <= 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const results = await fetchAvailableSources();
        setSources(results);
        
        // Only load saved selection from localStorage on initial mount
        // and only if the selectedSources is empty (hasn't been modified yet)
        if (!hasLoadedDefault.current && selectedSources.size === 0) {
          const savedSelection = localStorage.getItem(STORAGE_KEY);
          if (savedSelection) {
            try {
              setSelectedSources(new Set(JSON.parse(savedSelection)));
            } catch (e) {
              console.error('Error parsing saved podcast sources:', e);
            }
          }
          hasLoadedDefault.current = true;
        }
      } catch (err) {
        setError('Failed to load podcast sources');
        console.error('Error fetching podcast sources:', err);
      }
    };

    fetchSources();
  }, [setSelectedSources, selectedSources.size]);

  // Update filtered sources when sources, selectedSources, or searchQuery changes
  useEffect(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = sources.filter(source =>
      source.title.toLowerCase().includes(lowerCaseQuery) ||
      source.description.toLowerCase().includes(lowerCaseQuery)
    );
    
    // Sort the filtered sources with selected sources first, then alphabetically
    const sortedFiltered = sortPodcastSources(filtered, selectedSources);
    setFilteredSources(sortedFiltered);
    
    // Scroll to top when selection changes
    if (sourcesContainerRef.current) {
      sourcesContainerRef.current.scrollLeft = 0;
    }
  }, [searchQuery, sources, selectedSources]);

  useEffect(() => {
    if (!isExpanded) {
      setSearchQuery('');
    }
  }, [isExpanded]);

  const toggleSource = (feedId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      printLog(`newSet:${JSON.stringify(Array.from(newSet))}`);
      return newSet;
    });
  };

  const selectAll = () => {
    const allFeedIds = new Set(filteredSources.map(source => source.feedId));
    setSelectedSources(allFeedIds);
  };

  const deselectAll = () => {
    setSelectedSources(new Set());
  };

  const saveFilter = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedSources)));
    printLog('Saved selected podcast sources to localStorage');
    setIsSavingDefault(true);
    setInterval(() => (setIsSavingDefault(false)),2000);
  };

  const resetToDefault = () => {
    // Load the default selection from localStorage
    const savedSelection = localStorage.getItem(STORAGE_KEY);
    if (savedSelection) {
      try {
        setSelectedSources(new Set(JSON.parse(savedSelection)));
      } catch (e) {
        console.error('Error parsing saved podcast sources:', e);
      }
    } else {
      // If there's no saved selection, just deselect all
      setSelectedSources(new Set());
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Podcast request flow functions
  const startRequestFlow = () => {
    setRequestFlowStep(RequestFlowStep.USER_TYPE);
    setIsSendingFeedback(true);
  };

  const handleUserTypeSelection = (type: 'fan' | 'podcaster') => {
    setUserRole(type);
    if (type === 'podcaster') {
      setRequestFlowStep(RequestFlowStep.PODCAST_DETAILS);
    } else {
      setRequestFlowStep(RequestFlowStep.PODCAST_DETAILS);
    }
  };

  const handlePodcastDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save the user's email to localStorage for later use
    localStorage.setItem('squareId', podcastDetails.email);
    
    if (userRole === 'podcaster') {
      setIsJamiePro(true);
      setRequestFlowStep(RequestFlowStep.CHECKOUT);
      setIsCheckoutOpen(true);
    } else {
      setRequestFlowStep(RequestFlowStep.FAN_OPTIONS);
    }
  };

  const handleFanOptionSelection = (option: 'vote' | 'pay') => {
    setPaymentOption(option);
    if (option === 'pay') {
      setIsJamiePro(false);
      setRequestFlowStep(RequestFlowStep.CHECKOUT);
      setIsCheckoutOpen(true);
    } else {
      // Save user email to localStorage if not already set
      if (!localStorage.getItem('squareId')) {
        localStorage.setItem('squareId', podcastDetails.email);
      }
      
      // Just register their vote and show success
      submitPodcastRequest({
        email: podcastDetails.email,
        podcastName: podcastDetails.podcastName,
        podcastUrl: podcastDetails.podcastUrl,
        role: 'fan',
        paymentIntent: 'vote'
      })
      .then(() => {
        setIsSuccess(true);
        setIsPurchaseSuccess(false);
        setRequestFlowStep(RequestFlowStep.SUCCESS);
      })
      .catch(error => {
        console.error('Error submitting podcast request:', error);
      });
    }
  };

  const handleCheckoutSuccess = () => {
    // Save user email to localStorage if not already set
    if (!localStorage.getItem('squareId')) {
      localStorage.setItem('squareId', podcastDetails.email);
    }
    
    submitPodcastRequest({
      email: podcastDetails.email,
      podcastName: podcastDetails.podcastName,
      podcastUrl: podcastDetails.podcastUrl,
      role: userRole as 'fan' | 'podcaster',
      paymentIntent: userRole === 'podcaster' ? 'business' : 'pay'
    })
    .then(() => {
      setIsCheckoutOpen(false);
      
      // For voting flow (no payment), isJamiePro should remain false
      if (paymentOption === 'vote') {
        setIsJamiePro(false);
      }
      
      setIsSuccess(true);
      setIsPurchaseSuccess(true);
      setRequestFlowStep(RequestFlowStep.SUCCESS);
    })
    .catch(error => {
      console.error('Error submitting podcast request:', error);
    });
  };

  const resetRequestFlow = () => {
    setRequestFlowStep(RequestFlowStep.INITIAL);
    setUserRole(null);
    setPaymentOption(null);
    setPodcastDetails({
      email: '',
      podcastName: '',
      podcastUrl: ''
    });
    setIsSendingFeedback(false);
    setIsJamiePro(false);
    setIsSuccess(false);
    setIsPurchaseSuccess(false);
    setIsCheckoutOpen(false);
  };

  if (error) {
    return (
      <div className="text-red-500 p-4">
        {error}
      </div>
    );
  }

  const renderUserTypeSelection = () => {
    return (
      <div className="bg-black p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6">
          Which Accurately Describes You?
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => handleUserTypeSelection('fan')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors"
          >
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🪭</div>
            <span className="text-white text-sm sm:text-base font-medium">Fan</span>
          </button>
          <button
            onClick={() => handleUserTypeSelection('podcaster')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors"
          >
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🎙️</div>
            <span className="text-white text-sm sm:text-base font-medium">Podcaster/Team</span>
          </button>
        </div>
        <div className="flex justify-between">
          <button
            onClick={resetRequestFlow}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={userRole === null}
            className={`${userRole !== null ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors`}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderPodcastDetailsForm = () => {
    const isFormComplete = podcastDetails.email && podcastDetails.podcastName;
    
    return (
      <div className="bg-black p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-2">
          More Details Please <span className="text-xl sm:text-2xl">✍️</span>
        </h2>
        <form onSubmit={handlePodcastDetailsSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <input
              type="email"
              value={podcastDetails.email}
              onChange={(e) => setPodcastDetails({...podcastDetails, email: e.target.value})}
              placeholder="Email"
              required
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
            />
          </div>
          <div>
            <input
              type="text"
              value={podcastDetails.podcastName}
              onChange={(e) => setPodcastDetails({...podcastDetails, podcastName: e.target.value})}
              placeholder="Name of the Podcast"
              required
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
            />
          </div>
          <div>
            <input
              type="url"
              value={podcastDetails.podcastUrl}
              onChange={(e) => setPodcastDetails({...podcastDetails, podcastUrl: e.target.value})}
              placeholder="Podcast URL (Optional)"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
            />
          </div>
          <div className="flex justify-between pt-3 sm:pt-4">
            <button
              type="button"
              onClick={() => setRequestFlowStep(RequestFlowStep.USER_TYPE)}
              className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              className={`${isFormComplete ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors`}
              disabled={!isFormComplete}
            >
              Next
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderFanOptions = () => {
    return (
      <div className="bg-black p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6">
          How Bad Do You Want to Add the Podcast?
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => handleFanOptionSelection('vote')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🗳️</div>
            <span className="text-white text-sm sm:text-base font-medium text-center">I Just Want to Vote</span>
          </button>
          <button
            onClick={() => handleFanOptionSelection('pay')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">💰</div>
            <span className="text-white text-sm sm:text-base font-medium text-center">Willing to Pay</span>
          </button>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => setRequestFlowStep(RequestFlowStep.PODCAST_DETAILS)}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            disabled={paymentOption === null}
            className={`${paymentOption !== null ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors`}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderSuccessModal = () => {
    return (
      <div className="bg-black p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md border border-green-500">
        {isPurchaseSuccess ? (
          // Purchase success modal (right image in mockup)
          <div className="text-center">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">Success!</h2>
            <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6">
              Welcome Aboard! We will add your podcast to the search index shortly! One of our team members will be in touch within 1 business day.
            </p>
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="bg-green-500 rounded-full p-1.5 sm:p-2">
                <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            <button
              onClick={resetRequestFlow}
              className="bg-white text-black px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          // Vote success modal (left image in mockup)
          <div className="text-center">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">Your Vote is Cast!</h2>
            <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6">
              Our team will add the pod if there's enough interest! Tell your friends to get on PullThatUpJamie.ai and strengthen your case!
            </p>
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="bg-green-500 rounded-full p-1.5 sm:p-2">
                <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            <button
              onClick={resetRequestFlow}
              className="bg-white text-black px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  const getRenderRequestFlow = () => {
    switch (requestFlowStep) {
      case RequestFlowStep.USER_TYPE:
        return renderUserTypeSelection();
      case RequestFlowStep.PODCAST_DETAILS:
        return renderPodcastDetailsForm();
      case RequestFlowStep.FAN_OPTIONS:
        return renderFanOptions();
      case RequestFlowStep.SUCCESS:
        return renderSuccessModal();
      default:
        return <></>;
    }
  };

  return (
    <div onClick={!isExpanded ? () => setIsExpanded(true) : undefined} className={`mx-auto max-w-4xl mt-4 pt-4 px-6 relative rounded-lg mb-2 select-none ${!isExpanded ? 'pb-1 hover:bg-gray-800' : ''}`}>
      {isSendingFeedback && requestFlowStep !== RequestFlowStep.INITIAL && requestFlowStep !== RequestFlowStep.CHECKOUT && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4 sm:p-0">
          <div className="bg-[#0A0A0A] rounded-lg shadow-lg max-w-lg w-full relative">
            {getRenderRequestFlow()}
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <CheckoutModal 
          isOpen={isCheckoutOpen} 
          onClose={() => {
            setIsCheckoutOpen(false);
            resetRequestFlow();
          }} 
          onSuccess={handleCheckoutSuccess}
          productName={isJamiePro ? "jamie-pro" : "amber"}
          customDescription={isJamiePro ? "Early Access, Search, and AI Clips. Unlock all features for podcasts." : undefined}
          customFeatures={isJamiePro ? [
            "Pods Transcribed & Searchable",
            "AI Curated Clips & Email Alerts",
            "AI Assist for Social Media"
          ] : undefined}
          customPrice={isJamiePro ? "49.99" : undefined}
        />
      )}

      <button 
        className="text-white text-xl font-medium mb-4 flex items-center gap-2 border-white-800 rounded-lg hover:border-gray-700 transition-colors select-none"
        onClick={toggleExpanded}
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          ▼
        </span>
        Podcast Feeds <Filter className='w-5 h-5' /> 
        <p className="text-sm text-gray-400">
          ({selectedSources.size > 0 
            ? `${selectedSources.size} of ${sources.length}` 
            : `${sources.length}`} Feeds)
        </p>
      </button>

      {isExpanded && sources.length > 0 && (
        <>
          {/* Search Bar */}
          <div className="relative mb-4 flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feeds..."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600"
              />
              <Search className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
            </div>
            <button 
              onClick={startRequestFlow}
              className="mt-2 md:mt-0 px-6 py-2 text-black font-medium bg-white rounded-lg hover:bg-gray-400 md:shrink-0 select-none"
            >
              Request a Podcast
            </button>
          </div>

          <div className="relative border border-gray-800 pt-4 pb-4 rounded-lg">
            <div ref={sourcesContainerRef} className="overflow-x-auto px-4">
              <div className="flex space-x-4">
                {filteredSources.map((source, index) => (
                  <PodcastSourceItem
                    key={source.feedId}
                    source={source}
                    isSelected={selectedSources.has(source.feedId)}
                    onClick={toggleSource}
                    sizeClass={`w-24 lg:w-${sizeOverride ?? '36'}`}
                    customTitleClass="text-xs sm:text-sm md:text-base lg:text-lg"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="text-sm flex justify-center mt-4 space-x-2 select-none">
            <button
              className="font-bold px-4 py-2 text-black bg-white border border-gray-800 rounded hover:bg-gray-200 select-none"
              onClick={selectAll}
            >
              Select All
            </button>
            <button
              className="font-bold px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800 select-none"
              onClick={deselectAll}
            >
              Deselect All
            </button>
            <button
              className="font-bold px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800 select-none"
              onClick={saveFilter}
            >
              {isSavingDefault ? 'Saved!' : 'Save as Default'}
            </button>
            <button
              className="font-bold px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800 select-none"
              onClick={resetToDefault}
            >
              Reset to Default
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AvailableSourcesSection;

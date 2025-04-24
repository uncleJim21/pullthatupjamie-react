import React, { useState, useEffect, useRef } from 'react';
import { Check, Filter, Search, X } from 'lucide-react';
import { fetchAvailableSources, submitPodcastRequest, PodcastSource } from '../services/podcastSourceService.ts';
import PodcastSourceItem from './PodcastSourceItem.tsx';
import { CheckoutModal } from './CheckoutModal.tsx';
import { printLog } from '../constants/constants.ts';

interface PodcastSourceFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
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

const PodcastSourceFilterModal: React.FC<PodcastSourceFilterModalProps> = ({
  isOpen,
  onClose,
  selectedSources,
  setSelectedSources
}) => {
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<PodcastSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
  const [isRequestingPodcast, setIsRequestingPodcast] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth <= 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fetchSources = async () => {
        try {
          const results = await fetchAvailableSources();
          setSources(results);
          setFilteredSources(results);
        } catch (err) {
          setError('Failed to load podcast sources');
          console.error('Error fetching podcast sources:', err);
        }
      };

      fetchSources();
    }

    // Reset request flow state when modal opens
    if (isOpen && requestFlowStep !== RequestFlowStep.INITIAL) {
      resetRequestFlow();
    }
  }, [isOpen]);

  useEffect(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    setFilteredSources(
      sources.filter(source =>
        source.title.toLowerCase().includes(lowerCaseQuery) ||
        source.description.toLowerCase().includes(lowerCaseQuery)
      )
    );
  }, [searchQuery, sources]);

  const toggleSource = (feedId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
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

  const saveAsDefault = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedSources)));
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  const handleDone = () => {
    onClose();
  };

  // Podcast request flow functions
  const startRequestFlow = () => {
    setRequestFlowStep(RequestFlowStep.USER_TYPE);
    setIsRequestingPodcast(true);
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
    setIsRequestingPodcast(false);
    setIsJamiePro(false);
    setIsSuccess(false);
    setIsPurchaseSuccess(false);
    setIsCheckoutOpen(false);
  };

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
          // Purchase success modal
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
          // Vote success modal
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
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
            "All Features Pods Searchable",
            "AI Curated Clips & Alerts",
            "AI Assist for Social Media"
          ] : undefined}
          customPrice={isJamiePro ? "49.99" : undefined}
        />
      )}

      {isRequestingPodcast && requestFlowStep !== RequestFlowStep.INITIAL ? (
        <div className="bg-[#0A0A0A] rounded-lg shadow-lg max-w-lg w-full relative">
          {getRenderRequestFlow()}
        </div>
      ) : (
        <div className="bg-black border border-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-white text-xl font-semibold">Filter by Podcast Feed</h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4">
            <div className="relative mb-4">
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
              className="w-full mb-4 px-6 py-2 text-black font-medium bg-white rounded-lg hover:bg-gray-200 flex justify-center items-center"
            >
              Request a Podcast
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="text-red-500 p-4">{error}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredSources.map((source, index) => (
                  <PodcastSourceItem
                    key={index}
                    source={source}
                    isSelected={selectedSources.has(source.feedId)}
                    onClick={toggleSource}
                    sizeClass="w-full"
                    customImageClass="border-2"
                    customTitleClass="text-sm"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 flex flex-wrap justify-between gap-2">
            <div className="flex space-x-2">
              <button
                className="px-4 py-2 text-black bg-white rounded hover:bg-gray-200 text-sm font-medium"
                onClick={selectAll}
              >
                Select All
              </button>
              <button
                className="px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800 text-sm font-medium"
                onClick={deselectAll}
              >
                Deselect All
              </button>
              <button
                className="px-4 py-2 text-white bg-black border border-white rounded hover:bg-gray-800 text-sm font-medium"
                onClick={saveAsDefault}
              >
                <span>Save as Default {isSaving ? '✅' : '💾'}</span>
              </button>
            </div>
            <button
              className="px-8 py-2 text-black bg-white rounded hover:bg-gray-200 text-sm font-medium"
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastSourceFilterModal; 
import React, { useState, useEffect, useRef } from 'react';
import { Check, Filter, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAvailableSources, submitPodcastRequest, PodcastSource, sortPodcastSources } from '../services/podcastSourceService.ts';
import PodcastSourceItem from './PodcastSourceItem.tsx';
import { CheckoutModal } from './CheckoutModal.tsx';
import { printLog } from '../constants/constants.ts';

export interface PodcastSearchFilters {
  episodeName: string;
  minDate: string;
  maxDate: string;
}

interface PodcastSourceFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
  filters?: PodcastSearchFilters;
  setFilters?: (filters: PodcastSearchFilters) => void;
}

const STORAGE_KEY = 'selectedPodcastSources';
const FILTERS_STORAGE_KEY = 'podcastSearchFilters';

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
  setSelectedSources,
  filters,
  setFilters
}) => {
  const [sources, setSources] = useState<PodcastSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<PodcastSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sourcesContainerRef = useRef<HTMLDivElement>(null);
  
  // Advanced filters state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<PodcastSearchFilters>({
    episodeName: '',
    minDate: '',
    maxDate: ''
  });
  
  // Keep track of whether sources have already been fetched
  const hasSourcesLoaded = useRef(false);

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

  // Load filters from localStorage or props on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setLocalFilters(parsed);
        if (setFilters) {
          setFilters(parsed);
        }
      } catch (e) {
        console.error('Error parsing saved filters:', e);
      }
    } else if (filters) {
      setLocalFilters(filters);
    }
  }, []);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth <= 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Log the current selected sources when the modal opens
      printLog(`Modal opened with selectedSources: ${JSON.stringify(Array.from(selectedSources))}`);
      
      // Reset accordion to collapsed state when modal opens
      setIsAdvancedOpen(false);
      
      // Load filters from localStorage when modal opens
      const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          setLocalFilters(parsed);
          if (setFilters) {
            setFilters(parsed);
          }
          printLog(`Loaded filters from storage: ${JSON.stringify(parsed)}`);
        } catch (e) {
          console.error('Error parsing saved filters:', e);
        }
      }
      
      const fetchSources = async () => {
        try {
          // Only fetch sources if they haven't been loaded yet
          if (!hasSourcesLoaded.current || sources.length === 0) {
            setIsLoading(true);
            const results = await fetchAvailableSources();
            setSources(results);
            hasSourcesLoaded.current = true;
            printLog(`Fetched ${results.length} sources`);
          }
          
          // We intentionally don't load from localStorage here
          // to preserve the current selection that was passed to the modal
          
        } catch (err) {
          setError('Failed to load podcast sources');
          console.error('Error fetching podcast sources:', err);
        } finally {
          setIsLoading(false);
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
    const filtered = sources.filter(source =>
      source.title.toLowerCase().includes(lowerCaseQuery) ||
      source.description.toLowerCase().includes(lowerCaseQuery)
    );
    
    // Sort the filtered sources with selected sources first, then alphabetically
    const sortedFiltered = sortPodcastSources(filtered, selectedSources);
    setFilteredSources(sortedFiltered);
    
    // Scroll to top when selection changes
    if (sourcesContainerRef.current) {
      sourcesContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, sources, selectedSources]);

  const toggleSource = (feedId: string) => {
    printLog(`Toggling source: ${feedId}`);
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      printLog(`Selection after toggle: ${JSON.stringify(Array.from(newSet))}`);
      return newSet;
    });
  };

  const selectAll = () => {
    const allFeedIds = new Set(filteredSources.map(source => source.feedId));
    printLog(`Selecting all ${allFeedIds.size} sources`);
    setSelectedSources(allFeedIds);
  };

  const deselectAll = () => {
    printLog('Deselecting all sources');
    setSelectedSources(new Set());
  };

  const saveAsDefault = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedSources)));
    printLog(`Saved ${selectedSources.size} sources as default`);
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  const resetToDefault = () => {
    // Load the default selection from localStorage
    const savedSelection = localStorage.getItem(STORAGE_KEY);
    if (savedSelection) {
      try {
        const parsedSources = new Set<string>(JSON.parse(savedSelection));
        printLog(`Reset to default: ${JSON.stringify(Array.from(parsedSources))}`);
        setSelectedSources(parsedSources);
      } catch (e) {
        console.error('Error parsing saved podcast sources:', e);
      }
    } else {
      // If there's no saved selection, just deselect all
      printLog('No default selection found, deselecting all');
      setSelectedSources(new Set());
    }
  };

  const handleDone = () => {
    // Save the current selection to localStorage before closing
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedSources)));
    printLog(`Modal closed with selection: ${JSON.stringify(Array.from(selectedSources))}`);
    
    // Save filters to localStorage
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(localFilters));
    if (setFilters) {
      setFilters(localFilters);
    }
    printLog(`Modal closed with filters: ${JSON.stringify(localFilters)}`);
    
    onClose();
  };

  const handleFilterChange = (key: keyof PodcastSearchFilters, value: string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    // Auto-save to localStorage
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
    if (setFilters) {
      setFilters(newFilters);
    }
  };

  const resetFilters = () => {
    const emptyFilters = {
      episodeName: '',
      minDate: '',
      maxDate: ''
    };
    setLocalFilters(emptyFilters);
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(emptyFilters));
    if (setFilters) {
      setFilters(emptyFilters);
    }
    printLog('Filters reset');
  };

  const hasActiveFilters = () => {
    return localFilters.episodeName !== '' || localFilters.minDate !== '' || localFilters.maxDate !== '';
  };

  // Helper function to set date ranges
  const setDateRange = (days: number) => {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);
    
    const maxDate = today.toISOString().split('T')[0];
    const minDate = pastDate.toISOString().split('T')[0];
    
    const newFilters = {
      ...localFilters,
      minDate,
      maxDate
    };
    
    setLocalFilters(newFilters);
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
    if (setFilters) {
      setFilters(newFilters);
    }
    printLog(`Set date range to last ${days} days: ${minDate} to ${maxDate}`);
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
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6 select-none">
          Which Accurately Describes You?
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => handleUserTypeSelection('fan')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors select-none"
          >
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🪭</div>
            <span className="text-white text-sm sm:text-base font-medium">Fan</span>
          </button>
          <button
            onClick={() => handleUserTypeSelection('podcaster')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors select-none"
          >
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🎙️</div>
            <span className="text-white text-sm sm:text-base font-medium">Podcaster/Team</span>
          </button>
        </div>
        <div className="flex justify-between">
          <button
            onClick={resetRequestFlow}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors select-none"
          >
            Cancel
          </button>
          <button
            disabled={userRole === null}
            className={`${userRole !== null ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors select-none`}
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
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-2 select-none">
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
              className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors select-none"
            >
              Back
            </button>
            <button
              type="submit"
              className={`${isFormComplete ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors select-none`}
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
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6 select-none">
          How Bad Do You Want to Add the Podcast?
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => handleFanOptionSelection('vote')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors select-none"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🗳️</div>
            <span className="text-white text-sm sm:text-base font-medium text-center">I Just Want to Vote</span>
          </button>
          <button
            onClick={() => handleFanOptionSelection('pay')}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 flex flex-col items-center hover:bg-gray-800 transition-colors select-none"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">💰</div>
            <span className="text-white text-sm sm:text-base font-medium text-center">Willing to Pay</span>
          </button>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => setRequestFlowStep(RequestFlowStep.PODCAST_DETAILS)}
            className="bg-gray-900 text-white px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-gray-800 transition-colors select-none"
          >
            Back
          </button>
          <button
            disabled={paymentOption === null}
            className={`${paymentOption !== null ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'} px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg transition-colors select-none`}
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
          <div className="text-center select-none">
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
          <div className="text-center select-none">
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

  // Custom scrollbar styles
  const scrollbarStyles = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #000000;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: #ffffff;
      border-radius: 4px;
      border: 2px solid #000000;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: #cccccc;
    }
  `;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm select-none">
      <style>{scrollbarStyles}</style>
      
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
            "AI Assist for Social Media",
            "Easy Nostr/Twitter Crossposting"
          ] : undefined}
          customPrice={isJamiePro ? "49.99" : undefined}
        />
      )}

      {isRequestingPodcast && requestFlowStep !== RequestFlowStep.INITIAL ? (
        <div className="bg-[#0A0A0A] rounded-lg shadow-lg max-w-lg w-full relative">
          {getRenderRequestFlow()}
        </div>
      ) : (
        <div className="bg-black border border-gray-800 rounded-lg shadow-lg w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-white text-lg font-medium">Filter by Podcast Feed</h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3">
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feeds..."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-600 text-sm"
              />
              <Search className="absolute right-3 top-2 text-gray-400 w-4 h-4" />
            </div>

            {/* Advanced Filters Accordion */}
            <div className="mb-3 border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
              <button
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full px-4 py-2 flex justify-between items-center text-white hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-medium">
                  Advanced Filters {hasActiveFilters() && <span className="text-blue-400">●</span>}
                </span>
                {isAdvancedOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isAdvancedOpen && (
                <div className="p-4 border-t border-gray-700 space-y-3">
                  {/* Episode Name Filter */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Episode Name (Exact Match)
                    </label>
                    <input
                      type="text"
                      value={localFilters.episodeName}
                      onChange={(e) => handleFilterChange('episodeName', e.target.value)}
                      placeholder="Enter exact episode title..."
                      className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 text-sm"
                    />
                  </div>

                  {/* Quick Date Range Buttons */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Quick Date Ranges
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDateRange(7)}
                        className="px-3 py-2 text-xs bg-gray-800 text-white border border-gray-700 rounded hover:bg-gray-700 transition-colors"
                      >
                        Last 7 Days
                      </button>
                      <button
                        onClick={() => setDateRange(30)}
                        className="px-3 py-2 text-xs bg-gray-800 text-white border border-gray-700 rounded hover:bg-gray-700 transition-colors"
                      >
                        Last 30 Days
                      </button>
                    </div>
                  </div>

                  {/* Date Range Filters */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Min Date
                      </label>
                      <input
                        type="date"
                        value={localFilters.minDate}
                        onChange={(e) => handleFilterChange('minDate', e.target.value)}
                        className="w-full px-2 py-2 bg-black border border-gray-700 rounded text-white focus:outline-none focus:border-gray-600 text-sm [color-scheme:dark]"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Max Date
                      </label>
                      <input
                        type="date"
                        value={localFilters.maxDate}
                        onChange={(e) => handleFilterChange('maxDate', e.target.value)}
                        className="w-full px-2 py-2 bg-black border border-gray-700 rounded text-white focus:outline-none focus:border-gray-600 text-sm [color-scheme:dark]"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </div>

                  {/* Reset Filters Button */}
                  {hasActiveFilters() && (
                    <button
                      onClick={resetFilters}
                      className="w-full px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-400 hover:border-blue-300 rounded transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div ref={sourcesContainerRef} className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {error ? (
              <div className="text-red-500 p-4">{error}</div>
            ) : isLoading ? (
              <div className="text-white p-4 text-center">Loading...</div>
            ) : filteredSources.length === 0 && searchQuery.trim() !== '' ? (
              <div className="text-white p-4 text-center">No podcast feeds matched your search</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filteredSources.map((source) => (
                  <PodcastSourceItem
                    key={source.feedId}
                    source={source}
                    isSelected={selectedSources.has(source.feedId)}
                    onClick={toggleSource}
                    sizeClass="w-[70%] mx-auto"
                    customImageClass="border-2"
                    imageOnly={false}
                    showCheckmark={true}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                className="px-3 py-1.5 text-black bg-white rounded hover:bg-gray-200 text-xs font-medium"
                onClick={selectAll}
              >
                Select All
              </button>
              <button
                className="px-3 py-1.5 text-white bg-black border border-white rounded hover:bg-gray-800 text-xs font-medium"
                onClick={deselectAll}
              >
                Deselect All
              </button>
              <button
                className="px-3 py-1.5 text-white bg-black border border-white rounded hover:bg-gray-800 text-xs font-medium"
                onClick={saveAsDefault}
              >
                <span>Save as Default {isSaving ? '✅' : '💾'}</span>
              </button>
              <button
                className="px-3 py-1.5 text-white bg-black border border-white rounded hover:bg-gray-800 text-xs font-medium"
                onClick={resetToDefault}
              >
                Reset to Default
              </button>
            </div>
            <div className="mt-2 flex justify-center">
              <button
                className="px-3 py-1.5 text-black bg-white rounded hover:bg-gray-200 text-xs font-medium w-1/2"
                onClick={handleDone}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastSourceFilterModal; 
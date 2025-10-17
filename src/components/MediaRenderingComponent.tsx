import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Scissors, Share, Filter } from 'lucide-react';
import TranscriptionService from '../services/transcriptionService.ts';

interface MediaRenderingComponentProps {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  onClose: () => void;
}

const MediaRenderingComponent: React.FC<MediaRenderingComponentProps> = ({
  fileUrl,
  fileName,
  fileType,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showChildrenClips, setShowChildrenClips] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isFilterEnabled, setIsFilterEnabled] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [currentActiveIndex, setCurrentActiveIndex] = useState<number | null>(null);
  const [transcriptData, setTranscriptData] = useState<Array<{time: string, text: string}>>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  // Sample transcript data with more diverse content for filtering (fallback)
  const sampleTranscriptData = [
    { time: '0:15', text: 'Welcome back to the podcast everyone. Today we\'re diving deep into the world of artificial intelligence and machine learning.' },
    { time: '0:30', text: 'So Jamie, you\'ve been working in tech for over a decade now. What\'s your take on the current AI boom?' },
    { time: '0:45', text: 'Well, it\'s fascinating to see how quickly things are evolving. Just last year, we were talking about GPT-3, and now we have GPT-4 and beyond.' },
    { time: '1:00', text: 'The acceleration is incredible. But I think what\'s really interesting is how businesses are actually implementing these tools.' },
    { time: '1:15', text: 'Absolutely. We\'re seeing companies use AI for everything from customer service to content creation to data analysis.' },
    { time: '1:30', text: 'But there are also concerns about job displacement. What do you think about the impact on employment?' },
    { time: '1:45', text: 'That\'s a great question. I believe AI will augment human capabilities rather than replace them entirely. It\'s about working alongside these tools.' },
    { time: '2:00', text: 'For example, in content creation, AI can help with ideation and first drafts, but human creativity and judgment are still crucial.' },
    { time: '2:15', text: 'Speaking of content creation, you mentioned earlier that you\'ve been experimenting with AI for podcast production.' },
    { time: '2:30', text: 'Yes! We\'ve been using AI to help with transcript generation, highlight extraction, and even social media content.' },
    { time: '2:45', text: 'The quality has been surprisingly good. It can identify key moments and create engaging clips automatically.' },
    { time: '3:00', text: 'That sounds amazing. What about the ethical considerations? How do you ensure the AI-generated content aligns with your brand?' },
    { time: '3:15', text: 'Great point. We always review and edit AI-generated content. It\'s a tool, not a replacement for human oversight.' },
    { time: '3:30', text: 'We also make sure to maintain our authentic voice and values in everything we produce, whether AI-assisted or not.' },
    { time: '3:45', text: 'Looking ahead, where do you see AI heading in the next few years? Any predictions?' },
    { time: '4:00', text: 'I think we\'ll see more specialized AI models for specific industries and use cases. The one-size-fits-all approach will evolve.' },
    { time: '4:15', text: 'We\'ll also see better integration between different AI tools, creating more seamless workflows for creators and businesses.' },
    { time: '4:30', text: 'And I expect we\'ll see more focus on AI safety and alignment as these systems become more powerful.' },
    { time: '4:45', text: 'That makes sense. The responsible development of AI is crucial for its long-term success and acceptance.' },
    { time: '5:00', text: 'Before we wrap up, any advice for listeners who want to start experimenting with AI in their own work?' },
    { time: '5:15', text: 'Start small and focus on specific use cases. Don\'t try to automate everything at once. Learn the tools gradually.' },
    { time: '5:30', text: 'And always maintain human oversight. AI is incredibly powerful, but human judgment and creativity remain irreplaceable.' },
    { time: '5:45', text: 'Perfect advice. Thanks for sharing your insights today, Jamie. This has been a fascinating conversation.' },
    { time: '6:00', text: 'Thank you for having me. It\'s always great to discuss these topics with fellow tech enthusiasts.' },
    { time: '6:15', text: 'That\'s all for today\'s episode. Don\'t forget to subscribe and leave us a review. See you next time!' }
  ];

  // Sample children clips data
  const childrenClipsData = [
    { id: 1, name: 'ai_boom_discussion_clip.mp4', duration: '0:15' },
    { id: 2, name: 'gpt_evolution_clip.mp4', duration: '0:22' },
    { id: 3, name: 'business_implementation_clip.mp4', duration: '0:18' },
    { id: 4, name: 'job_displacement_clip.mp4', duration: '0:25' },
    { id: 5, name: 'ai_augmentation_clip.mp4', duration: '0:20' },
    { id: 6, name: 'content_creation_clip.mp4', duration: '0:28' },
    { id: 7, name: 'podcast_production_clip.mp4', duration: '0:24' },
    { id: 8, name: 'ethical_considerations_clip.mp4', duration: '0:19' },
    { id: 9, name: 'ai_predictions_clip.mp4', duration: '0:26' },
    { id: 10, name: 'advice_for_beginners_clip.mp4', duration: '0:21' }
  ];
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Determine media type
  const isVideo = fileType?.startsWith('video/') || 
    /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i.test(fileName);
  const isAudio = fileType?.startsWith('audio/') || 
    /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(fileName);

  // Handle play/pause
  const togglePlayPause = () => {
    if (isVideo && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    } else if (isAudio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Handle mute/unmute
  const toggleMute = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.muted = !isMuted;
    } else if (isAudio && audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // Get current transcript text for subtitle display
  const getCurrentTranscriptText = (): string => {
    if (transcriptData.length === 0) {
      return 'No transcript available';
    }
    if (currentActiveIndex !== null && transcriptData[currentActiveIndex]) {
      return transcriptData[currentActiveIndex].text;
    }
    return 'Reiciendis corporis nemo'; // Default fallback
  };

  // Convert seconds to MM:SS format
  const secondsToTimeString = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Convert sentence-level timestamps to transcript format
  const convertSentencesToTranscript = (sentences: Array<{text: string, start: number, end: number}>): Array<{time: string, text: string}> => {
    return sentences.map(sentence => ({
      time: secondsToTimeString(sentence.start),
      text: sentence.text
    }));
  };

  // Start transcription process
  const startTranscription = async () => {
    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const response = await TranscriptionService.startTranscription({
        remote_url: fileUrl,
        guid: null
      });

      if (response.successAction?.url) {
        // Start polling for results
        const transcript = await TranscriptionService.pollForCompletion(
          response.successAction.url,
          (status) => {
            // Optional: handle progress updates
            console.log('Transcription progress:', status.state);
          }
        );
        
        setTranscriptData(transcript);
        setIsTranscribing(false);
      } else {
        throw new Error('Invalid response from transcription service');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setTranscriptionError(error instanceof Error ? error.message : 'Failed to start transcription');
      setIsTranscribing(false);
    }
  };

  // Convert time string (e.g., "2:15") to seconds
  const timeStringToSeconds = (timeString: string): number => {
    const [minutes, seconds] = timeString.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  // Find transcript entry based on current playback time
  const findCurrentTranscriptEntry = (playbackTime: number): number => {
    console.log('Finding transcript entry for playback time:', playbackTime);
    console.log('Transcript data:', transcriptData);
    
    for (let i = transcriptData.length - 1; i >= 0; i--) {
      const entryTime = timeStringToSeconds(transcriptData[i].time);
      console.log(`Entry ${i}: time="${transcriptData[i].time}" -> ${entryTime}s, playback=${playbackTime}s`);
      if (playbackTime >= entryTime) {
        console.log(`Found matching entry: ${i}`);
        return i;
      }
    }
    console.log('No matching entry found, returning 0');
    return 0; // Default to first entry
  };

  // Handle time updates with auto-scroll
  const handleTimeUpdateWithAutoScroll = () => {
    const current = isVideo ? videoRef.current?.currentTime : audioRef.current?.currentTime;
    const total = isVideo ? videoRef.current?.duration : audioRef.current?.duration;
    
    console.log('Time update - current:', current, 'total:', total, 'isAutoScrollEnabled:', isAutoScrollEnabled);
    
    if (current !== undefined) setCurrentTime(current);
    if (total !== undefined) setDuration(total);

    // Auto-scroll transcript based on current playback time
    if (isAutoScrollEnabled && current !== undefined) {
      const currentEntryIndex = findCurrentTranscriptEntry(current);
      console.log('Setting currentActiveIndex to:', currentEntryIndex);
      setCurrentActiveIndex(currentEntryIndex);
      
      // Only scroll if we're not currently highlighting a search result
      if (highlightedIndex === null || !searchQuery.trim()) {
        const contentArea = contentAreaRef.current;
        if (contentArea) {
          const currentElement = contentArea.querySelector(`[data-index="${currentEntryIndex}"]`);
          if (currentElement) {
            currentElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }
      }
    }
  };

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = seekTime;
    } else if (isAudio && audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
    setCurrentTime(seekTime);
  };

  // Handle clicking on transcript entry
  const handleTranscriptClick = (timeString: string) => {
    const seekTime = timeStringToSeconds(timeString);
    
    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = seekTime;
      videoRef.current.play();
      setIsPlaying(true);
    } else if (isAudio && audioRef.current) {
      audioRef.current.currentTime = seekTime;
      audioRef.current.play();
      setIsPlaying(true);
    }
    
    setCurrentTime(seekTime);
  };

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Filter transcript data based on search query and filter toggle
  const filteredTranscriptData = isFilterEnabled 
    ? transcriptData.filter(item =>
        searchQuery === '' || item.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transcriptData;

  // Filter children clips data based on search query
  const filteredChildrenClipsData = childrenClipsData.filter(clip =>
    searchQuery === '' || clip.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get all matching indices for the current search query
  const getMatchingIndices = (query: string) => {
    if (query.trim() === '') return [];
    
    return transcriptData
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.text.toLowerCase().includes(query.toLowerCase()))
      .map(({ index }) => index);
  };

  // Handle search with "Find Next" functionality
  const handleSearch = (query: string, isNext: boolean = false) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
      return;
    }

    const matchingIndices = getMatchingIndices(query);
    
    if (matchingIndices.length === 0) {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
      return;
    }

    let targetIndex: number;
    
    if (isNext) {
      // Find next match (cycle through results)
      const currentIndex = highlightedIndex !== null ? highlightedIndex : -1;
      const currentPosition = matchingIndices.indexOf(currentIndex);
      const nextPosition = (currentPosition + 1) % matchingIndices.length;
      targetIndex = matchingIndices[nextPosition];
      setCurrentMatchIndex(nextPosition);
    } else {
      // First search - go to first match
      targetIndex = matchingIndices[0];
      setCurrentMatchIndex(0);
    }

    setHighlightedIndex(targetIndex);
    
    // Scroll to the matching entry after a brief delay
    setTimeout(() => {
      const contentArea = contentAreaRef.current;
      if (contentArea) {
        const matchingElement = contentArea.querySelector(`[data-index="${targetIndex}"]`);
        if (matchingElement) {
          matchingElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    }, 100);
  };

  // Handle automatic scrolling after user stops typing (non-filter mode)
  const handleAutoScroll = (query: string) => {
    if (query.trim() === '') {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
      return;
    }

    const matchingIndices = getMatchingIndices(query);
    
    if (matchingIndices.length === 0) {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
      return;
    }

    // Go to first match and scroll to it
    const targetIndex = matchingIndices[0];
    setHighlightedIndex(targetIndex);
    setCurrentMatchIndex(0);
    
    // Scroll to the matching entry after a brief delay
    setTimeout(() => {
      const contentArea = contentAreaRef.current;
      if (contentArea) {
        const matchingElement = contentArea.querySelector(`[data-index="${targetIndex}"]`);
        if (matchingElement) {
          matchingElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    }, 100);
  };

  // Handle search input change with debounced auto-scroll
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for auto-scroll (only in non-filter mode)
    if (!isFilterEnabled) {
      const timeout = setTimeout(() => {
        handleAutoScroll(query);
      }, 500); // 500ms delay after user stops typing
      
      setSearchTimeout(timeout);
    }
  };

  // Handle Enter key press in search input (Find Next)
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(e.currentTarget.value, true); // true = find next
    }
  };

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedData = () => setIsMediaLoading(false);
    const handleCanPlay = () => setIsMediaLoading(false);

    if (video) {
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('timeupdate', handleTimeUpdateWithAutoScroll);
      video.addEventListener('loadedmetadata', handleTimeUpdateWithAutoScroll);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('canplay', handleCanPlay);
    }

    if (audio) {
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('timeupdate', handleTimeUpdateWithAutoScroll);
      audio.addEventListener('loadedmetadata', handleTimeUpdateWithAutoScroll);
      audio.addEventListener('loadeddata', handleLoadedData);
      audio.addEventListener('canplay', handleCanPlay);
    }

    return () => {
      if (video) {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('timeupdate', handleTimeUpdateWithAutoScroll);
        video.removeEventListener('loadedmetadata', handleTimeUpdateWithAutoScroll);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
      }
      if (audio) {
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('timeupdate', handleTimeUpdateWithAutoScroll);
        audio.removeEventListener('loadedmetadata', handleTimeUpdateWithAutoScroll);
        audio.removeEventListener('loadeddata', handleLoadedData);
        audio.removeEventListener('canplay', handleCanPlay);
      }
    };
  }, [isVideo, isAudio, isAutoScrollEnabled, highlightedIndex, searchQuery]);

  // Handle real-time search as user types (first match only)
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
      return;
    }

    const matchingIndices = getMatchingIndices(searchQuery);
    
    if (matchingIndices.length > 0) {
      setHighlightedIndex(matchingIndices[0]);
      setCurrentMatchIndex(0);
    } else {
      setHighlightedIndex(null);
      setCurrentMatchIndex(0);
    }
  }, [searchQuery]);

  // Clear active index when auto-scroll is disabled
  useEffect(() => {
    if (!isAutoScrollEnabled) {
      setCurrentActiveIndex(null);
    }
  }, [isAutoScrollEnabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Skip rendering if not video or audio
  if (!isVideo && !isAudio) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Main content */}
      <div className="flex w-full h-full">
        {/* Left side - Media Player */}
        <div className="flex-1 flex flex-col">
          {isVideo ? (
            <div className="flex-1 relative bg-black flex items-center justify-center">
              {isMediaLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
              <video
                ref={videoRef}
                src={fileUrl}
                className="max-w-full max-h-full"
                onClick={togglePlayPause}
              />
              
              {/* Subtitle overlay */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 px-6 py-3 rounded-lg">
                <p className="text-white text-lg font-medium select-none">{getCurrentTranscriptText()}</p>
              </div>

              {/* Video controls overlay */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={togglePlayPause}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  
                  <div className="flex-1 mx-3">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <span className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  
                  <button className="text-white hover:text-gray-300 transition-colors">
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>
          ) : isAudio ? (
            <div className="flex-1 flex items-center justify-center bg-black">
              {isMediaLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
              <div className="text-center">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">{fileName}</h2>
                  <p className="text-gray-400">Audio File</p>
                </div>
                
                <div className="flex items-center justify-center space-x-4 mb-6">
                  <button
                    onClick={togglePlayPause}
                    className="bg-white text-black rounded-full p-4 hover:bg-gray-200 transition-colors"
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                </div>
                
                <div className="w-80 mx-auto">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-400 mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
              
              <audio
                ref={audioRef}
                src={fileUrl}
                className="hidden"
              />
            </div>
          ) : null}
        </div>

        {/* Right side - Transcript Panel */}
        <div className="w-96 bg-black border-l border-gray-800 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 mt-12">
            <button
              onClick={() => {
                setShowTranscript(true);
                setShowChildrenClips(false);
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                showTranscript ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Transcript
            </button>
            <button
              onClick={() => {
                setShowTranscript(false);
                setShowChildrenClips(true);
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                showChildrenClips ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Children Clips
            </button>
          </div>

          {/* Search bar */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyPress={handleSearchKeyPress}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
              <button
                onClick={() => setIsFilterEnabled(!isFilterEnabled)}
                className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors ${
                  isFilterEnabled 
                    ? 'bg-white text-black hover:bg-gray-200' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                title={isFilterEnabled ? 'Disable filter (show all)' : 'Enable filter (show matches only)'}
              >
                <Filter size={16} />
              </button>
              {searchQuery.trim() !== '' && highlightedIndex !== null && (
                <div className="text-gray-400 text-sm whitespace-nowrap">
                  {currentMatchIndex + 1} of {getMatchingIndices(searchQuery).length}
                </div>
              )}
            </div>
          </div>

          {/* Auto-scroll toggle */}
          <div className="px-4 pb-4 border-b border-gray-800">
            <label className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoScrollEnabled}
                onChange={(e) => setIsAutoScrollEnabled(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-white focus:ring-white focus:ring-2"
              />
              <span>Auto-scroll transcript with playback</span>
            </label>
          </div>

          {/* Content area */}
          <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-4">
            {showTranscript ? (
              <div className="space-y-4">
                {transcriptData.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <p className="select-none mb-6">No transcript yet</p>
                    {isTranscribing ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span className="select-none">Transcribing...</span>
                      </div>
                    ) : transcriptionError ? (
                      <div className="text-red-400 mb-4">
                        <p className="select-none">{transcriptionError}</p>
                        <button
                          onClick={startTranscription}
                          className="mt-4 bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startTranscription}
                        className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        Transcribe
                      </button>
                    )}
                  </div>
                ) : filteredTranscriptData.length > 0 ? (
                  filteredTranscriptData.map((item, index) => {
                    const originalIndex = transcriptData.findIndex(original => original === item);
                    const isHighlighted = highlightedIndex === originalIndex;
                    const isActive = currentActiveIndex === originalIndex;
                    
                    return (
                      <div 
                        key={index} 
                        data-index={originalIndex}
                        onClick={() => handleTranscriptClick(item.time)}
                        className={`flex items-start space-x-3 p-3 rounded-lg transition-colors cursor-pointer ${
                          isHighlighted 
                            ? 'bg-yellow-900/30 border border-yellow-600' 
                            : isActive 
                              ? 'border border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                              : 'hover:bg-gray-900/50'
                        }`}
                      >
                        <span className="text-gray-400 text-sm font-mono select-none">{item.time}</span>
                        <p className="text-white text-sm leading-relaxed select-none">
                          {item.text}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p className="select-none">No matching transcript entries found</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChildrenClipsData.length > 0 ? (
                  filteredChildrenClipsData.map((clip) => (
                    <div key={clip.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate select-none">{clip.name}</p>
                        <p className="text-gray-400 text-xs select-none">{clip.duration}</p>
                      </div>
                      <button className="ml-3 text-gray-400 hover:text-white transition-colors">
                        <Play size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p className="select-none">No children clips</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex space-x-3">
              <button className="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors font-medium">
                <Scissors size={16} />
                <span>Clip</span>
              </button>
              <button className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors font-medium flex items-center justify-center space-x-2">
                <Share size={16} />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaRenderingComponent;

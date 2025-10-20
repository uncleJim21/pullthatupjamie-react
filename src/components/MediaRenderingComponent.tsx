import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Scissors, Share, Filter } from 'lucide-react';
import TranscriptionService, { generateHash } from '../services/transcriptionService.ts';
import VideoEditService, { ChildEdit, SubtitleSegment } from '../services/videoEditService.ts';
import { WordTimestamp } from '../services/transcriptionService.ts';
import { printLog } from '../constants/constants.ts';

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
  const [transcriptData, setTranscriptData] = useState<Array<{time: string, text: string}>>([]);
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [isCheckingExistingTranscript, setIsCheckingExistingTranscript] = useState(true);
  
  // Children clips state
  const [childrenClips, setChildrenClips] = useState<ChildEdit[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [pollingClips, setPollingClips] = useState<Set<string>>(new Set());
  
  // Clip creation mode state
  const [isClipMode, setIsClipMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [clipStartTime, setClipStartTime] = useState(0);
  const [clipEndTime, setClipEndTime] = useState(0);
  const [isCreatingClip, setIsCreatingClip] = useState(false);
  const [clipCreationError, setClipCreationError] = useState<string | null>(null);
  
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

  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabledRef = useRef(isAutoScrollEnabled);
  const manualSeekTimeRef = useRef<number | null>(null);

  // Update ref when isAutoScrollEnabled changes
  useEffect(() => {
    isAutoScrollEnabledRef.current = isAutoScrollEnabled;
  }, [isAutoScrollEnabled]);

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

  // Convert time string (e.g., "2:15") to seconds
  const timeStringToSeconds = (timeString: string): number => {
    const [minutes, seconds] = timeString.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  // Single source of truth for current transcript entry
  const getCurrentTranscriptEntry = (playbackTime: number) => {
    if (transcriptData.length === 0) {
      return { index: 0, text: 'No transcript available' };
    }
    
    // Find the current transcript entry based on playback time
    for (let i = transcriptData.length - 1; i >= 0; i--) {
      const entryTime = timeStringToSeconds(transcriptData[i].time);
      if (playbackTime >= entryTime) {
        return { 
          index: i, 
          text: transcriptData[i].text 
        };
      }
    }
    
    // Default to first entry if no match found
    return { 
      index: 0, 
      text: transcriptData[0]?.text || 'Reiciendis corporis nemo' 
    };
  };

  // Get current transcript text for subtitle display
  const getCurrentTranscriptText = (): string => {
    const currentEntry = getCurrentTranscriptEntry(currentTime);
    printLog('getCurrentTranscriptText - currentTime: ' + currentTime + ', currentEntryIndex: ' + currentEntry.index);
    printLog('Returning transcript text: ' + currentEntry.text);
    return currentEntry.text;
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

      // Generate the same GUID that was used in the request
      const guid = generateHash(fileUrl);
      
      if (response.successAction?.url) {
        // Start polling for results using the GUID
        const result = await TranscriptionService.pollForCompletionWithWords(
          guid,
          (status) => {
            // Optional: handle progress updates
            printLog('Transcription progress: ' + status.state);
          }
        );
        
        setTranscriptData(result.sentences);
        setWordTimestamps(result.words);
        printLog('Loaded ' + result.sentences.length + ' sentences and ' + result.words.length + ' word timestamps');
        setIsTranscribing(false);
      } else {
        throw new Error('Invalid response from transcription service');
      }
    } catch (error) {
      printLog('Transcription error: ' + error);
      printLog('Error details: ' + JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack
      }));
      setTranscriptionError(error instanceof Error ? error.message : 'Failed to start transcription');
      setIsTranscribing(false);
    }
  };

  // Check for existing transcript when component loads
  useEffect(() => {
    const checkExistingTranscript = async () => {
      try {
        setIsCheckingExistingTranscript(true);
        const existingResult = await TranscriptionService.checkExistingTranscriptWithWords(fileUrl);
        
        if (existingResult && existingResult.sentences.length > 0) {
          setTranscriptData(existingResult.sentences);
          setWordTimestamps(existingResult.words);
          printLog('Loaded existing transcript with ' + existingResult.sentences.length + ' entries and ' + existingResult.words.length + ' word timestamps');
          
          // Initial scroll to correct position (highlighting handled in render)
          setTimeout(() => {
            if (isAutoScrollEnabled) {
              const currentPlaybackTime = isVideo ? videoRef.current?.currentTime || 0 : audioRef.current?.currentTime || 0;
              const initialEntry = getCurrentTranscriptEntry(currentPlaybackTime);
              const contentArea = contentAreaRef.current;
              if (contentArea) {
                const currentElement = contentArea.querySelector(`[data-index="${initialEntry.index}"]`);
                printLog('=== PANEL SCROLL DEBUG (MOUNT) ===');
                printLog('Looking for element with data-index: ' + initialEntry.index);
                printLog('Found element: ' + (currentElement ? 'YES' : 'NO'));
                printLog('Available data-index elements: ' + JSON.stringify(Array.from(contentArea.querySelectorAll('[data-index]')).map(el => el.getAttribute('data-index'))));
                printLog('Content area scroll position: ' + contentArea.scrollTop);
                printLog('Content area height: ' + contentArea.clientHeight);
                printLog('Content area scroll height: ' + contentArea.scrollHeight);
                if (currentElement) {
                  printLog('Element position relative to viewport: ' + currentElement.getBoundingClientRect().top);
                  printLog('Element offset from content area top: ' + ((currentElement as HTMLElement).offsetTop - contentArea.scrollTop));
                }
                printLog('=== END PANEL SCROLL DEBUG ===');
                if (currentElement) {
                  currentElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                  });
                  printLog('Scrolled to initial position for index: ' + initialEntry.index);
                } else {
                  printLog('Could not find element with data-index: ' + initialEntry.index);
                }
              }
            }
          }, 100); // Small delay to ensure DOM is ready
        }
      } catch (error) {
        printLog('Error checking existing transcript: ' + error);
      } finally {
        setIsCheckingExistingTranscript(false);
      }
    };

    checkExistingTranscript();
  }, [fileUrl]);

  // Load children clips when Children Clips tab is opened
  useEffect(() => {
    const loadChildrenClips = async () => {
      if (!showChildrenClips) return;
      
      setIsLoadingChildren(true);
      setChildrenError(null);
      
      try {
        const children = await VideoEditService.getChildEdits(fileName);
        setChildrenClips(children);
        printLog('Loaded ' + children.length + ' child edits');
        
        // Start polling for any processing clips
        const processingClips = children.filter(c => c.status === 'processing' || c.status === 'queued');
        processingClips.forEach(clip => startPollingClip(clip.lookupHash));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to load child edits';
        printLog('Error loading children clips: ' + errorMsg);
        setChildrenError(errorMsg);
      } finally {
        setIsLoadingChildren(false);
      }
    };
    
    loadChildrenClips();
  }, [showChildrenClips, fileName]);

  // Poll for processing clips
  const startPollingClip = (lookupHash: string) => {
    printLog('Starting to poll for clip: ' + lookupHash);
    
    const pollInterval = setInterval(async () => {
      try {
        const status = await VideoEditService.checkEditStatus(lookupHash);
        printLog('Clip ' + lookupHash + ' status: ' + status.status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          setPollingClips(prev => {
            const next = new Set(prev);
            next.delete(lookupHash);
            return next;
          });
          
          // Refresh children list
          printLog('Clip processing finished, refreshing children list');
          if (showChildrenClips) {
            const children = await VideoEditService.getChildEdits(fileName);
            setChildrenClips(children);
          }
        }
      } catch (error) {
        printLog('Polling error for ' + lookupHash + ': ' + error);
        clearInterval(pollInterval);
        setPollingClips(prev => {
          const next = new Set(prev);
          next.delete(lookupHash);
          return next;
        });
      }
    }, 3000); // Poll every 3 seconds
    
    setPollingClips(prev => new Set(prev).add(lookupHash));
  };

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      // Clear all polling intervals when component unmounts
      pollingClips.forEach(() => {
        printLog('Cleaning up polling intervals');
      });
    };
  }, []);

  // Add text selection listener for clip mode
  useEffect(() => {
    if (!isClipMode) return;
    
    const handleSelectionChange = () => {
      // Debounce the selection handler
      setTimeout(() => {
        handleTextSelection();
      }, 100);
    };
    
    document.addEventListener('mouseup', handleSelectionChange);
    
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, [isClipMode, transcriptData]);

  // Transcript data changes - no state updates needed, highlighting handled in render

  // Handle manual seeks (when user clicks on transcript entry)
  useEffect(() => {
    if (manualSeekTimeRef.current !== null && isAutoScrollEnabledRef.current) {
      const seekTime = manualSeekTimeRef.current;
      printLog('Manual seek detected to time: ' + seekTime);
      
      const currentEntry = getCurrentTranscriptEntry(seekTime);
      const contentArea = contentAreaRef.current;
      
      if (contentArea) {
        const currentElement = contentArea.querySelector(`[data-index="${currentEntry.index}"]`);
        printLog('Manual seek - scrolling to index: ' + currentEntry.index);
        
        if (currentElement) {
          currentElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          printLog('Manual seek - scroll completed');
        } else {
          printLog('Manual seek - could not find element with index: ' + currentEntry.index);
        }
      }
      
      // Clear the manual seek ref
      manualSeekTimeRef.current = null;
    }
  }, [currentTime, transcriptData]);

  // Handle time updates with auto-scroll
  const handleTimeUpdateWithAutoScroll = () => {
    const current = isVideo ? videoRef.current?.currentTime : audioRef.current?.currentTime;
    const total = isVideo ? videoRef.current?.duration : audioRef.current?.duration;
    
    printLog('Time update - current: ' + current + ', total: ' + total + ', isAutoScrollEnabled: ' + isAutoScrollEnabledRef.current);
    
    if (current !== undefined) setCurrentTime(current);
    if (total !== undefined) setDuration(total);

    // Auto-scroll logic (highlighting now handled directly in render)
    if (current !== undefined) {
      // Only auto-scroll if enabled and not currently highlighting a search result
      if (isAutoScrollEnabledRef.current && (highlightedIndex === null || !searchQuery.trim())) {
        const currentEntry = getCurrentTranscriptEntry(current);
        const contentArea = contentAreaRef.current;
        if (contentArea) {
          const currentElement = contentArea.querySelector(`[data-index="${currentEntry.index}"]`);
          printLog('=== PANEL SCROLL DEBUG (PLAYBACK) ===');
          printLog('Auto-scroll: Looking for element with data-index: ' + currentEntry.index);
          printLog('Auto-scroll: Found element: ' + (currentElement ? 'YES' : 'NO'));
          printLog('Auto-scroll: Available data-index elements: ' + JSON.stringify(Array.from(contentArea.querySelectorAll('[data-index]')).map(el => el.getAttribute('data-index'))));
          printLog('Content area scroll position: ' + contentArea.scrollTop);
          printLog('Content area height: ' + contentArea.clientHeight);
          printLog('Content area scroll height: ' + contentArea.scrollHeight);
          printLog('highlightedIndex: ' + highlightedIndex + ', searchQuery: "' + searchQuery + '"');
          if (currentElement) {
            printLog('Element position relative to viewport: ' + currentElement.getBoundingClientRect().top);
            printLog('Element offset from content area top: ' + ((currentElement as HTMLElement).offsetTop - contentArea.scrollTop));
            printLog('Element is visible: ' + (currentElement.getBoundingClientRect().top >= 0 && currentElement.getBoundingClientRect().bottom <= contentArea.clientHeight));
          }
          printLog('=== END PANEL SCROLL DEBUG ===');
          if (currentElement) {
            currentElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            printLog('Auto-scroll: Scrolled to index: ' + currentEntry.index);
          } else {
            printLog('Auto-scroll: Could not find element with data-index: ' + currentEntry.index);
          }
        }
      } else if (!isAutoScrollEnabledRef.current) {
        printLog('Auto-scroll disabled - highlighting handled in render');
      } else {
        printLog('Auto-scroll: Skipped scrolling due to search highlighting (highlightedIndex: ' + highlightedIndex + ', searchQuery: "' + searchQuery + '")');
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
    
    // Set manual seek time ref to trigger scroll on next render
    manualSeekTimeRef.current = seekTime;
    
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

  // Format time with one decimal place for seconds
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(1);
    return `${minutes}:${seconds.padStart(4, '0')}`;
  };

  // ========== CLIP MODE FUNCTIONS ==========
  
  // Enter clip mode
  const handleEnterClipMode = () => {
    printLog('Entering clip mode');
    setIsClipMode(true);
    setSelectedEntries(new Set());
    setClipStartTime(0);
    setClipEndTime(0);
    setClipCreationError(null);
    
    // Pause playback when entering clip mode
    if (isPlaying) {
      togglePlayPause();
    }
  };

  // Exit clip mode (cancel)
  const handleCancelClipMode = () => {
    printLog('Canceling clip mode');
    setIsClipMode(false);
    setSelectedEntries(new Set());
    setClipStartTime(0);
    setClipEndTime(0);
    setClipCreationError(null);
  };

  // Calculate time range from selected entries (ensures contiguous selection)
  const calculateClipRange = (selection: Set<number>) => {
    if (selection.size === 0) {
      return { startTime: 0, endTime: 0 };
    }

    const selectedIndices = Array.from(selection).sort((a, b) => a - b);
    
    // Check for contiguity
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        printLog('Warning: Non-contiguous selection detected');
        // For now, just use the range from first to last (will fill gaps)
        break;
      }
    }
    
    const firstIndex = selectedIndices[0];
    const lastIndex = selectedIndices[selectedIndices.length - 1];
    
    const startTime = timeStringToSeconds(transcriptData[firstIndex].time);
    
    // End time is the start of the next entry, or calculate based on duration
    let endTime: number;
    if (lastIndex < transcriptData.length - 1) {
      endTime = timeStringToSeconds(transcriptData[lastIndex + 1].time);
    } else {
      // Last entry - use video duration or add estimated duration
      endTime = duration || (startTime + 10); // Fallback: add 10 seconds
    }
    
    return { startTime, endTime };
  };

  // Toggle entry selection (maintains contiguity)
  const toggleEntrySelection = (index: number) => {
    const newSelection = new Set(selectedEntries);
    
    if (newSelection.size === 0) {
      // First selection - just add it
      newSelection.add(index);
    } else {
      const selectedIndices = Array.from(newSelection).sort((a, b) => a - b);
      const minIndex = selectedIndices[0];
      const maxIndex = selectedIndices[selectedIndices.length - 1];
      
      if (newSelection.has(index)) {
        // Deselecting - check if it's at the edge
        if (index === minIndex) {
          // Remove from start
          newSelection.delete(index);
        } else if (index === maxIndex) {
          // Remove from end
          newSelection.delete(index);
        } else {
          // Clicking in middle - contract selection to this point
          // Keep entries from min to clicked index
          for (let i = index + 1; i <= maxIndex; i++) {
            newSelection.delete(i);
          }
        }
      } else {
        // Selecting - extend range to include this index
        if (index < minIndex) {
          // Extend backwards
          for (let i = index; i < minIndex; i++) {
            newSelection.add(i);
          }
        } else if (index > maxIndex) {
          // Extend forwards
          for (let i = maxIndex + 1; i <= index; i++) {
            newSelection.add(i);
          }
        } else {
          // Fill gap in middle
          for (let i = minIndex; i <= index; i++) {
            newSelection.add(i);
          }
        }
      }
    }
    
    setSelectedEntries(newSelection);
    
    // Update clip range
    const { startTime, endTime } = calculateClipRange(newSelection);
    setClipStartTime(startTime);
    setClipEndTime(endTime);
    
    printLog('Selection updated: ' + Array.from(newSelection).sort((a, b) => a - b).join(','));
    printLog('Clip range: ' + formatTime(startTime) + ' - ' + formatTime(endTime));
  };

  // Handle text selection - detect which entries are selected
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !isClipMode) return;
    
    printLog('Text selection detected');
    
    // Get the range of selected text
    const range = selection.getRangeAt(0);
    const container = contentAreaRef.current;
    if (!container) return;
    
    // Find all transcript entries that intersect with the selection
    const selectedIndices = new Set<number>();
    const transcriptElements = container.querySelectorAll('[data-index]');
    
    transcriptElements.forEach((element) => {
      const index = parseInt(element.getAttribute('data-index') || '-1');
      if (index === -1) return;
      
      // Check if this element intersects with the selection
      if (selection.containsNode(element, true)) {
        selectedIndices.add(index);
      }
    });
    
    if (selectedIndices.size > 0) {
      // Make selection contiguous
      const indices = Array.from(selectedIndices).sort((a, b) => a - b);
      const contiguousSelection = new Set<number>();
      
      for (let i = indices[0]; i <= indices[indices.length - 1]; i++) {
        contiguousSelection.add(i);
      }
      
      setSelectedEntries(contiguousSelection);
      
      // Update clip range
      const { startTime, endTime } = calculateClipRange(contiguousSelection);
      setClipStartTime(startTime);
      setClipEndTime(endTime);
      
      printLog('Text selection mapped to entries: ' + Array.from(contiguousSelection).sort((a, b) => a - b).join(','));
      
      // Clear the text selection
      selection.removeAllRanges();
    }
  };

  // Generate word-level subtitle segments from selected transcript entries
  const generateSubtitleSegments = (): SubtitleSegment[] => {
    if (selectedEntries.size === 0 || wordTimestamps.length === 0) return [];
    
    const selectedIndices = Array.from(selectedEntries).sort((a, b) => a - b);
    const segments: SubtitleSegment[] = [];
    
    selectedIndices.forEach((index) => {
      const entry = transcriptData[index];
      if (!entry) return;
      
      // Find word-level timestamps that correspond to this transcript entry
      const entryStartTime = timeStringToSeconds(entry.time);
      
      // Find words that fall within this transcript entry's time range
      const entryWords = wordTimestamps.filter(word => {
        const wordStart = word.start;
        // Check if word starts within this entry's time range (with some tolerance)
        return wordStart >= (entryStartTime - 0.5) && wordStart < (entryStartTime + 10); // Assume max 10s per entry
      });
      
      // Create individual word-level subtitle segments
      entryWords.forEach(word => {
        segments.push({
          start: parseFloat(word.start.toFixed(1)),
          end: parseFloat(word.end.toFixed(1)),
          text: word.word
        });
      });
      
      printLog(`Entry ${index}: Generated ${entryWords.length} word-level segments for "${entry.text.substring(0, 30)}..."`);
    });
    
    return segments;
  };

  // Finish clip creation
  const handleFinishClip = async () => {
    if (selectedEntries.size === 0) {
      setClipCreationError('Please select at least one transcript entry');
      return;
    }
    
    const clipDuration = clipEndTime - clipStartTime;
    
    // Validate duration
    if (clipDuration > 600) {
      setClipCreationError('Clip duration cannot exceed 10 minutes (current: ' + formatTime(clipDuration) + ')');
      return;
    }
    
    if (clipDuration <= 0) {
      setClipCreationError('Invalid clip duration');
      return;
    }
    
    setIsCreatingClip(true);
    setClipCreationError(null);
    
    try {
      printLog('Creating clip: ' + clipStartTime + 's - ' + clipEndTime + 's');
      
      // Generate subtitle segments from selected transcript entries
      const subtitles = generateSubtitleSegments();
      printLog('Generated ' + subtitles.length + ' subtitle segments');
      
      const response = await VideoEditService.createVideoEdit({
        cdnUrl: fileUrl,
        startTime: parseFloat(clipStartTime.toFixed(1)),
        endTime: parseFloat(clipEndTime.toFixed(1)),
        useSubtitles: true,
        subtitles: subtitles
      });
      
      printLog('Clip creation started: ' + response.lookupHash);
      
      // Poll for completion
      await VideoEditService.pollForCompletion(
        response.lookupHash,
        (status) => {
          printLog('Clip status: ' + status.status);
        }
      );
      
      printLog('Clip created successfully!');
      
      // Exit clip mode
      setIsClipMode(false);
      setSelectedEntries(new Set());
      setClipStartTime(0);
      setClipEndTime(0);
      
      // Switch to Children Clips tab to show the new clip
      setShowTranscript(false);
      setShowChildrenClips(true);
      
      // Children clips will reload automatically via useEffect
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create clip';
      printLog('Clip creation error: ' + errorMsg);
      setClipCreationError(errorMsg);
    } finally {
      setIsCreatingClip(false);
    }
  };


  // Filter transcript data based on search query and filter toggle
  const filteredTranscriptData = isFilterEnabled 
    ? transcriptData.filter(item =>
        searchQuery === '' || item.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transcriptData;

  // Filter children clips data based on search query, and sort chronologically (newest first)
  const filteredChildrenClipsData = childrenClips
    .filter(clip =>
      searchQuery === '' || clip.editRange.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by creation date, newest first
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

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
  }, [isVideo, isAudio, highlightedIndex, searchQuery, transcriptData]);

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

  // Clear active index when auto-scroll is disabled - REMOVED
  // We now always highlight the current entry regardless of auto-scroll setting

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
            <div className="flex-1 relative bg-black" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'hidden' }}>
              {isMediaLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
              <video
                ref={videoRef}
                src={fileUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
                onClick={togglePlayPause}
              />
              
              {/* Subtitle overlay - positioned at bottom above controls */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 px-6 py-3 rounded-lg max-w-[80%]">
                <p className="text-white text-lg font-medium select-none text-center">{getCurrentTranscriptText()}</p>
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

          {/* Top control area - Auto-scroll or Clip Mode Banner */}
          <div className="px-4 pb-4 border-b border-gray-800">
            {isClipMode ? (
              // Clip Mode Banner
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Scissors size={20} className="text-blue-400" />
                    <div>
                      <p className="text-white font-medium select-none">Clip Creation Mode</p>
                      <p className="text-sm text-gray-400 select-none">
                        Click or drag to select transcript entries, or highlight text to create a clip
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedEntries.size > 0 ? (
                      <div>
                        <p className="text-sm text-gray-400 select-none">Selected Range</p>
                        <p className="text-white font-medium select-none">
                          {formatTime(clipStartTime)} - {formatTime(clipEndTime)}
                        </p>
                        <p className="text-xs text-gray-500 select-none">
                          Duration: {formatTime(clipEndTime - clipStartTime)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 select-none">No selection</p>
                    )}
                  </div>
                </div>
                {clipCreationError && (
                  <div className="mt-2 text-red-400 text-sm select-none">
                    {clipCreationError}
                  </div>
                )}
              </div>
            ) : (
              // Normal Mode - Auto-scroll checkbox
              <label className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoScrollEnabled}
                  onChange={(e) => setIsAutoScrollEnabled(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-white focus:ring-white focus:ring-2"
                />
                <span>Auto-scroll transcript with playback</span>
              </label>
            )}
          </div>

          {/* Content area */}
          <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-4">
            {showTranscript ? (
              <div className="space-y-4">
                {transcriptData.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <p className="select-none mb-6">No transcript yet</p>
                    {isCheckingExistingTranscript ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span className="select-none">Checking for existing transcript...</span>
                      </div>
                    ) : isTranscribing ? (
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
                    const isSelected = selectedEntries.has(originalIndex);
                    
                    // Use the same DRY logic as subtitles - direct calculation, no state dependency
                    const currentEntry = getCurrentTranscriptEntry(currentTime);
                    const isActive = currentEntry.index === originalIndex;
                    
                    printLog(`Entry ${originalIndex}: time=${item.time}, isActive=${isActive}, currentEntryIndex=${currentEntry.index}, currentTime=${currentTime}`);
                    
                    return (
                      <div 
                        key={index} 
                        data-index={originalIndex}
                        onClick={() => {
                          if (isClipMode) {
                            toggleEntrySelection(originalIndex);
                          } else {
                            handleTranscriptClick(item.time);
                          }
                        }}
                        className={`flex items-start space-x-3 p-3 rounded-lg transition-colors cursor-pointer ${
                          isClipMode && isSelected
                            ? 'bg-blue-900/50 border-2 border-blue-500' 
                            : isHighlighted 
                              ? 'bg-yellow-900/30 border border-yellow-600' 
                              : isActive 
                                ? 'border border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                                : 'hover:bg-gray-900/50'
                        }`}
                      >
                        {isClipMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEntrySelection(originalIndex)}
                            className="mt-1 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <span className="text-gray-400 text-sm font-mono select-none">{item.time}</span>
                        <p className={`text-white text-sm leading-relaxed flex-1 ${isClipMode ? '' : 'select-none'}`}>
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
                {isLoadingChildren ? (
                  <div className="flex items-center justify-center py-12 space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span className="text-gray-400 select-none">Loading child clips...</span>
                  </div>
                ) : childrenError ? (
                  <div className="text-center text-red-400 py-12">
                    <p className="select-none mb-4">{childrenError}</p>
                    <button
                      onClick={() => {
                        setShowChildrenClips(false);
                        setTimeout(() => setShowChildrenClips(true), 100);
                      }}
                      className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                ) : filteredChildrenClipsData.length > 0 ? (
                  filteredChildrenClipsData.map((clip) => {
                    const isPolling = pollingClips.has(clip.lookupHash);
                    const isProcessing = clip.status === 'processing' || clip.status === 'queued';
                    const isFailed = clip.status === 'failed';
                    const isCompleted = clip.status === 'completed';
                    
                    return (
                      <div 
                        key={clip.lookupHash} 
                        onClick={() => {
                          if (isCompleted && clip.url) {
                            window.open(clip.url, '_blank');
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isCompleted ? 'bg-gray-900 hover:bg-gray-800 cursor-pointer' : 'bg-gray-900/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium select-none">
                            {clip.editRange.replace(/(\d+\.\d+)/g, (match) => parseFloat(match).toFixed(1))} ({clip.duration.toFixed(1)}s)
                          </p>
                          <p className={`text-xs select-none ${
                            isProcessing ? 'text-blue-400' : 
                            isFailed ? 'text-red-400' : 
                            'text-gray-400'
                          }`}>
                            {isProcessing && isPolling && (
                              <span className="flex items-center space-x-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-400"></div>
                                <span>Processing...</span>
                              </span>
                            )}
                            {isProcessing && !isPolling && 'Queued'}
                            {isCompleted && '✓ Ready'}
                            {isFailed && '✗ Failed'}
                          </p>
                          {clip.createdAt && (
                            <p className="text-gray-500 text-xs select-none mt-1">
                              {new Date(clip.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        {isCompleted && clip.url && (
                          <div className="ml-3 text-gray-400">
                            <Play size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p className="select-none">
                      {searchQuery ? 'No matching clips found' : 'No child clips yet'}
                    </p>
                    {!searchQuery && (
                      <p className="text-gray-500 text-sm mt-2 select-none">
                        Use the Clip button to create clips from this video
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex space-x-3">
              {isClipMode ? (
                // Clip Mode Buttons
                <>
                  <button 
                    onClick={handleFinishClip}
                    disabled={selectedEntries.size === 0 || isCreatingClip}
                    className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors flex-1 ${
                      selectedEntries.size === 0 || isCreatingClip
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                  >
                    {isCreatingClip ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating Clip...</span>
                      </>
                    ) : (
                      <>
                        <Scissors size={16} />
                        <span>Finish Clip</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleCancelClipMode}
                    disabled={isCreatingClip}
                    className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                // Normal Mode Buttons
                <>
                  <button 
                    onClick={handleEnterClipMode}
                    className="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors font-medium"
                  >
                    <Scissors size={16} />
                    <span>Clip</span>
                  </button>
                  <button className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors font-medium flex items-center justify-center space-x-2">
                    <Share size={16} />
                    <span>Share</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaRenderingComponent;

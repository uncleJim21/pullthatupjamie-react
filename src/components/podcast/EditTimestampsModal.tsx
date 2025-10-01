import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Minus, Plus, Scissors, RotateCw, RotateCcw } from "lucide-react";
import { formatTime } from "../../utils/time.ts";

interface EditTimestampsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string;
  episodeTitle: string;
  episodeDate: string;
  creator: string;
  episodeImage?: string;
  initialStartTime: number;
  initialEndTime: number;
  onConfirm: (newStartTime: number, newEndTime: number) => void;
  editTimestampsError?:string;
}

const EditTimestampsModal: React.FC<EditTimestampsModalProps> = ({
  isOpen,
  onClose,
  audioUrl,
  episodeTitle,
  episodeDate,
  creator,
  episodeImage = "/podcast-logo.png",
  initialStartTime,
  initialEndTime,
  onConfirm,
  editTimestampsError
}) => {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [currentTime, setCurrentTime] = useState(initialStartTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState(formatTime(initialStartTime));
  const [endTimeInput, setEndTimeInput] = useState(formatTime(initialEndTime));
  const [inputErrors, setInputErrors] = useState<{start?: string; end?: string}>({});
  const [hasValidated, setHasValidated] = useState<{start: boolean; end: boolean}>({start: false, end: false});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play();
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const resetToStart = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = startTime;//set currentTime to 0 on mount
      }
    }
    setTimeout(resetToStart,100);
  },[])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
    }
  }, [startTime]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(endTime - 5, startTime);
    }
  }, [endTime]);

  useEffect(() => {
    if (audioRef.current) {
      const checkTime = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);

          // Looping logic
          if (audioRef.current.currentTime >= endTime) {
            audioRef.current.currentTime = startTime;
            audioRef.current.play();
          }
        }
      };
      audioRef.current.addEventListener("timeupdate", checkTime);
      return () => {
        audioRef.current?.removeEventListener("timeupdate", checkTime);
      };
    }
  }, [startTime, endTime]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = startTime + (endTime - startTime) * clickPosition;

      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Validation function for time format (MM:SS or HH:MM:SS)
  const validateTimeFormat = (timeString: string): boolean => {
    // Allow empty string for typing
    if (timeString === '') return true;
    
    // Check for MM:SS format (minutes:seconds)
    const mmssRegex = /^(\d{1,3}):(\d{2})$/;
    if (mmssRegex.test(timeString)) {
      const [, minutes, seconds] = timeString.match(mmssRegex)!;
      const mins = parseInt(minutes);
      const secs = parseInt(seconds);
      return mins >= 0 && secs >= 0 && secs < 60;
    }
    
    // Check for HH:MM:SS format (hours:minutes:seconds)
    const hhmmssRegex = /^(\d{1,3}):(\d{2}):(\d{2})$/;
    if (hhmmssRegex.test(timeString)) {
      const [, hours, minutes, seconds] = timeString.match(hhmmssRegex)!;
      const hrs = parseInt(hours);
      const mins = parseInt(minutes);
      const secs = parseInt(seconds);
      return hrs >= 0 && mins >= 0 && mins < 60 && secs >= 0 && secs < 60;
    }
    
    return false;
  };

  // Convert time string to seconds
  const timeStringToSeconds = (timeString: string): number => {
    if (timeString === '') return 0;
    
    const parts = timeString.split(':').map(Number);
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // Handle start time input change (no validation)
  const handleStartTimeChange = (value: string) => {
    setStartTimeInput(value);
  };

  // Handle end time input change (no validation)
  const handleEndTimeChange = (value: string) => {
    setEndTimeInput(value);
  };

  // Validate start time on blur
  const validateStartTime = () => {
    setHasValidated(prev => ({ ...prev, start: true }));
    
    if (startTimeInput === '') {
      setInputErrors(prev => ({ ...prev, start: 'Invalid timestamp' }));
      return false;
    }
    
    if (validateTimeFormat(startTimeInput)) {
      const newStartTime = timeStringToSeconds(startTimeInput);
      if (newStartTime >= 0) {
        setStartTime(newStartTime);
        setInputErrors(prev => ({ ...prev, start: undefined }));
        return true;
      } else {
        setInputErrors(prev => ({ ...prev, start: 'Invalid timestamp' }));
        return false;
      }
    } else {
      setInputErrors(prev => ({ ...prev, start: 'Invalid timestamp' }));
      return false;
    }
  };

  // Validate end time on blur
  const validateEndTime = () => {
    setHasValidated(prev => ({ ...prev, end: true }));
    
    if (endTimeInput === '') {
      setInputErrors(prev => ({ ...prev, end: 'Invalid timestamp' }));
      return false;
    }
    
    if (validateTimeFormat(endTimeInput)) {
      const newEndTime = timeStringToSeconds(endTimeInput);
      if (newEndTime > startTime) {
        setEndTime(newEndTime);
        setInputErrors(prev => ({ ...prev, end: undefined }));
        return true;
      } else {
        setInputErrors(prev => ({ ...prev, end: 'End time must be after start time' }));
        return false;
      }
    } else {
      setInputErrors(prev => ({ ...prev, end: 'Invalid timestamp' }));
      return false;
    }
  };

  // Update input values when times change from buttons
  useEffect(() => {
    setStartTimeInput(formatTime(startTime));
  }, [startTime]);

  useEffect(() => {
    setEndTimeInput(formatTime(endTime));
  }, [endTime]);

  // Auto-fix invalid timestamp relationships
  useEffect(() => {
    if (startTime >= endTime) {
      setEndTime(startTime + 1);
    }
  }, [startTime, endTime]);

  const progress = Math.min(
    ((currentTime - startTime) / (endTime - startTime)) * 100,
    100
  );

  return isOpen ? (
    <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-[#111111] rounded-lg p-6 text-left w-[90%] max-w-lg border border-gray-800 relative">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-2 right-2 text-white text-xl">
          <X size={20} />
        </button>

        {/* Header with Podcast Info */}
        <div className="flex items-start space-x-4">
          <img src={episodeImage} alt="Podcast" className="w-20 h-20 rounded-md border border-gray-700" />
          <div className="flex-1">
            <h2 className="text-white text-lg font-bold line-clamp-2">
              {episodeTitle}
            </h2>
            <p className="text-gray-400 text-sm">{creator}</p>
            {/* <p className="text-gray-500 text-xs">{episodeDate || "Date not provided"}</p> */}
          </div>
        </div>

        {/* Audio Player with Progress Bar */}
        <div className="mt-4">
          <audio ref={audioRef} src={audioUrl} />
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full bg-white text-black hover:bg-gray-200"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Progress Bar */}
            <div
              ref={progressRef}
              className="flex-grow h-1 bg-gray-700 rounded cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div className="h-full bg-white rounded transition-all" style={{ width: `${progress}%` }} />
            </div>

            {/* Time Display */}
            <span className="text-xs text-gray-400">
              {formatTime(currentTime)} / {formatTime(endTime)}
            </span>
          </div>
        </div>
        {/* Timestamp Adjustments */}
        <div className="flex justify-between items-center mt-4">
          {/* Start Time Controls */}
          <div className="text-white">
            <div className="block mb-2 text-center">
              Start: 
              <input
                type="text"
                value={startTimeInput}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                onBlur={validateStartTime}
                className={`ml-1 px-1 py-0 bg-transparent text-white border-b ${
                  inputErrors.start ? 'border-red-500' : 'border-gray-500'
                } focus:outline-none focus:border-white text-center`}
                style={{ width: '60px' }}
              />
            </div>
            {inputErrors.start && (
              <p className="text-red-400 text-xs text-center mb-1">{inputErrors.start}</p>
            )}
            <div className="flex space-x-2">
              <button
                onClick={() => setStartTime((t) => Math.max(0, t - 1))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCcw size={14} />
              </button>
              <span>1s</span>
              <button
                onClick={() => setStartTime((t) => t + 1)}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCw size={14} />
              </button>
            </div>
            <div className="flex space-x-2 mt-2 mb-2">
              <button
                onClick={() => setStartTime((t) => Math.max(0, t - 5))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCcw size={14} />
              </button>
              <span>5s</span>
              <button
                onClick={() => setStartTime((t) => t + 5)}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>

          {/* End Time Controls */}
          <div className="text-white">
            <div className="block mb-2 text-center">
              End: 
              <input
                type="text"
                value={endTimeInput}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                onBlur={validateEndTime}
                className={`ml-1 px-1 py-0 bg-transparent text-white border-b ${
                  inputErrors.end ? 'border-red-500' : 'border-gray-500'
                } focus:outline-none focus:border-white text-center`}
                style={{ width: '60px' }}
              />
            </div>
            {inputErrors.end && (
              <p className="text-red-400 text-xs text-center mb-1">{inputErrors.end}</p>
            )}
            <div className="flex space-x-2">
              <button
                onClick={() => setEndTime((t) => Math.max(startTime + 1, t - 1))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCcw size={14} />
              </button>
              <span>1s</span>
              <button
                onClick={() => setEndTime((t) => t + 1)}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCw size={14} />
              </button>
            </div>
            <div className="flex space-x-2 mt-2 mb-2">
              <button
                onClick={() => setEndTime((t) => Math.max(startTime + 5, t - 5))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCcw size={14} />
              </button>
              <span>5s</span>
              <button
                onClick={() => setEndTime((t) => t + 5)}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={() => {
            const startValid = validateStartTime();
            const endValid = validateEndTime();
            if (startValid && endValid) {
              onConfirm(startTime, endTime);
            }
          }}
          className="flex items-center justify-center px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-400 transition-colors w-full mt-4"
        >
          <Scissors className="w-5 h-5 mr-2" />
          Confirm Edit
        </button>
        {editTimestampsError && 
      (
      <div className="mb-4 mt-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg">
          {editTimestampsError}
      </div>
    )}
      </div>
    </div>
  ) : null;
};

export default EditTimestampsModal;
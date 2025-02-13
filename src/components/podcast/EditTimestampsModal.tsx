import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Minus, Plus, Scissors } from "lucide-react";
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
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
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
            <p className="text-gray-500 text-xs">{episodeDate || "Date not provided"}</p>
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
            <span className="block mb-1">Start: {formatTime(startTime)}</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setStartTime((t) => Math.max(0, Math.min(t - 1, endTime - 1)))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => setStartTime((t) => Math.min(t + 1, endTime - 1))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* End Time Controls */}
          <div className="text-white">
            <span className="block mb-1">End: {formatTime(endTime)}</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setEndTime((t) => Math.max(startTime + 1, t - 1))}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => setEndTime((t) => t + 1)}
                className="p-2 bg-gray-800 text-white rounded-md"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={() => onConfirm(startTime, endTime)}
          className="flex items-center justify-center px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-400 transition-colors w-full mt-4"
        >
          <Scissors className="w-5 h-5 mr-2 text-black" />
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

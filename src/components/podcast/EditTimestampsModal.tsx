import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Minus, Plus, Scissors } from "lucide-react";
import { formatTime } from '../../utils/time.ts';

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
}) => {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        if (audioRef.current && audioRef.current.currentTime >= endTime) {
          audioRef.current.currentTime = startTime; // Loop back
          audioRef.current.play();
        }
      };
      audioRef.current.addEventListener("timeupdate", checkTime);
      return () => {
        audioRef.current?.removeEventListener("timeupdate", checkTime);
      };
    }
  }, [startTime, endTime]);

  return isOpen ? (
    <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#111111] rounded-lg p-6 text-center w-[90%] max-w-lg border border-gray-800 relative">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-2 right-2 text-white text-xl">
          <X size={20} />
        </button>

        {/* Modal Content */}
        <div className="flex flex-col items-center space-y-6">
          {/* Episode Info */}
          <div className="flex flex-row items-center space-x-4">
            <img src={episodeImage} alt="Podcast" className="w-20 h-20 rounded-md border border-gray-700" />
            <div className="text-left">
              <h2 className="text-white text-lg font-bold">{episodeTitle}</h2>
              <p className="text-gray-400 text-sm">{creator}</p>
              <p className="text-gray-500 text-xs">{episodeDate}</p>
            </div>
          </div>

          {/* Audio Player */}
          <audio ref={audioRef} src={audioUrl} />
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full bg-white text-black hover:bg-gray-200"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>

          {/* Timestamp Adjustments */}
          <div className="flex justify-between w-full px-4">
            <div className="text-white">
              <span>Start: {formatTime(startTime)}</span>
              <div className="flex space-x-2 mt-2">
                <button onClick={() => setStartTime((t) => Math.max(0, t - 1))} className="p-2 bg-gray-800 text-white rounded-md">
                  <Minus size={14} />
                </button>
                <button onClick={() => setStartTime((t) => t + 1)} className="p-2 bg-gray-800 text-white rounded-md">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="text-white">
              <span>End: {formatTime(endTime)}</span>
              <div className="flex space-x-2 mt-2">
                <button onClick={() => setEndTime((t) => Math.max(startTime + 1, t - 1))} className="p-2 bg-gray-800 text-white rounded-md">
                  <Minus size={14} />
                </button>
                <button onClick={() => setEndTime((t) => t + 1)} className="p-2 bg-gray-800 text-white rounded-md">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={() => onConfirm(startTime, endTime)}
            className="flex items-center justify-center px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-700 transition-colors w-full"
          >
            <Scissors className="w-5 h-5 mr-2 text-black" />
            Confirm Edit
          </button>
        </div>
      </div>
    </div>
  ) : null;
};

export default EditTimestampsModal;

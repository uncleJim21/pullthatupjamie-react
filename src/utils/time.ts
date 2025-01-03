// utils/time.ts

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getTimestampedUrl = (audioUrl: string, startTime: number): string => {
  // Convert to seconds and ensure it's an integer
  const seconds = Math.floor(startTime);
  
  // Remove any existing timestamp fragments
  const baseUrl = audioUrl.split('#')[0];

  // Handle different podcast platform URLs
    // For all other URLs, use Media Fragments RFC standard format #t={seconds}
    return `${baseUrl}#t=${seconds}`;
};
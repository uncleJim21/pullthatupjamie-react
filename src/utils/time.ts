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

  const finalSeconds = Math.max(seconds - 3,0)

  // Handle different podcast platform URLs
    // For all other URLs, use Media Fragments RFC standard format #t={seconds}
    return `${baseUrl}#t=${finalSeconds}`;
};

// Unified date formatting function: "Mon 8/11/25 @ 2:30 PM"
export const formatScheduledDate = (dateInput: string | Date): string => {
  if (!dateInput) {
    return 'Date Not Available';
  }
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Date Not Available';
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  
  const minutesStr = minutes.toString().padStart(2, '0');
  
  return `${dayName} ${month}/${day}/${year} @ ${hours}:${minutesStr} ${ampm}`;
};

// Short date format without time: "Mon 8/11/25"
export const formatShortDate = (dateInput: string | Date): string => {
  if (!dateInput) {
    return 'Date Not Available';
  }
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Date Not Available';
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  
  return `${dayName} ${month}/${day}/${year}`;
};
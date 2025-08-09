import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import CustomCalendar from './CustomCalendar.tsx';
import { printLog } from '../constants/constants.ts';

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface TimeOption {
  value: string; // HH:MM format
  label: string;
}

// Generate time options with minute precision
const generateTimeOptions = (): TimeOption[] => {
  const options: TimeOption[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) { // 15-minute intervals for better UX
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const value = `${hourStr}:${minuteStr}`;
      
      // Format for display (12-hour format)
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:${minuteStr} ${ampm}`;
      
      options.push({ value, label });
    }
  }
  
  return options;
};

const timeOptions = generateTimeOptions();

// Function to find the next available time slot closest to current time
const findNextAvailableTimeSlot = (date: string): string | null => {
  printLog('🔍 findNextAvailableTimeSlot called with date: ' + date);
  
  if (!date) {
    printLog('❌ No date provided, returning null');
    return null;
  }
  
  const now = new Date();
  const selectedDate = new Date(date + 'T00:00:00');
  const isToday = selectedDate.toDateString() === now.toDateString();
  
  printLog('📅 Date comparison: now=' + now.toDateString() + ', selected=' + selectedDate.toDateString() + ', isToday=' + isToday);
  
  if (!isToday) {
    // If it's a future date, return the first time slot
    printLog('🔮 Future date, returning first time slot: ' + timeOptions[0].value);
    return timeOptions[0].value;
  }
  
  // For today, find the next available time slot (at least 5 minutes from now)
  const nowPlusFive = new Date(now.getTime() + 5 * 60 * 1000); // Add 5 minutes
  const currentHour = nowPlusFive.getHours();
  const currentMinute = nowPlusFive.getMinutes();
  
  // Round up to next 15-minute interval
  const nextQuarterMinute = Math.ceil(currentMinute / 15) * 15;
  const nextHour = nextQuarterMinute >= 60 ? currentHour + 1 : currentHour;
  const nextMinute = nextQuarterMinute >= 60 ? 0 : nextQuarterMinute;
  
  // Handle hour overflow (past midnight)
  const finalHour = nextHour >= 24 ? 0 : nextHour;
  
  // Format as HH:MM
  const nextTimeValue = `${finalHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
  
  printLog('⏰ Time calculation: now=' + now.toLocaleTimeString() + ', nextTime=' + nextTimeValue + ', currentMin=' + currentMinute + ', nextMin=' + nextMinute);
  
  // If we've gone past midnight, return null (no valid time today)
  if (nextHour >= 24) {
    printLog('❌ Past midnight, no valid time today');
    return null;
  }
  
  // Find this exact time in our options first
  let targetIndex = timeOptions.findIndex(option => option.value === nextTimeValue);
  
  printLog('🎯 Looking for time ' + nextTimeValue + ', found at index: ' + targetIndex);
  
  // If exact time not found, find the first time after our calculated time
  if (targetIndex === -1) {
    targetIndex = timeOptions.findIndex(option => option.value > nextTimeValue);
    printLog('🔄 Fallback search, found at index: ' + targetIndex);
  }
  
  const result = targetIndex >= 0 ? timeOptions[targetIndex].value : null;
  printLog('✅ Final result: ' + result);
  
  return result;
};

// Timezone utilities
const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const SERVER_TIMEZONE = 'America/Chicago';

// Simple helper to check if a date/time is in the past
const isDateTimeInPast = (date: string, time: string): boolean => {
  if (!date || !time) return false;
  
  const [hours, minutes] = time.split(':').map(Number);
  // Parse date in local timezone to avoid UTC/local timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const selectedDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  return selectedDateTime < new Date();
};

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  minDate = new Date(),
  placeholder = "Select date and time",
  disabled = false,
  className = ""
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isCalendarClosing, setIsCalendarClosing] = useState(false);
  const [userTimezone] = useState(getUserTimezone());
  
  const isInitializingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounced onChange to prevent feedback loops
  const debouncedOnChange = useCallback((date: Date) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!isInitializingRef.current) {
        onChange(date);
      }
    }, 100);
  }, [onChange]);

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      isInitializingRef.current = true;
      
      // Work with user's local time directly
      const dateStr = value.toISOString().split('T')[0];
      const hours = value.getHours().toString().padStart(2, '0');
      const minutes = value.getMinutes().toString().padStart(2, '0');
      
      setSelectedDate(dateStr);
      setSelectedTime(`${hours}:${minutes}`);
      
      // Reset flag after a brief delay
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 200);
    }
  }, [value]);

  // Auto-select time when date changes or component mounts
  useEffect(() => {
    if (selectedDate && !selectedTime && !isInitializingRef.current) {
      printLog('🎯 Date selected but no time, auto-selecting...');
      const nextAvailableTime = findNextAvailableTimeSlot(selectedDate);
      if (nextAvailableTime) {
        printLog('⚡ Auto-setting time to: ' + nextAvailableTime);
        setSelectedTime(nextAvailableTime);
      }
    }
  }, [selectedDate, selectedTime]);

  // Auto-select today's date and time if no value is provided
  useEffect(() => {
    if (!value && !selectedDate && !isInitializingRef.current) {
      printLog('🔄 No initial value, setting today and auto-selecting time...');
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
      // Time will be auto-selected by the effect above
    }
  }, [value, selectedDate]);

  // Update parent when date or time changes
  useEffect(() => {
    if (selectedDate && selectedTime && !isInitializingRef.current) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      // Parse date in local timezone to avoid UTC/local timezone issues
      const [year, month, day] = selectedDate.split('-').map(Number);
      const userDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      
      // Always update parent - let them decide what to do with past times
      // The UI will show warnings but won't block the date selection
      debouncedOnChange(userDateTime);
    }
  }, [selectedDate, selectedTime, debouncedOnChange]);

  // Auto-scroll to next available time when dropdown opens
  useEffect(() => {
    printLog('🔄 Auto-scroll useEffect triggered: dropdown=' + showTimeDropdown + ', date=' + selectedDate + ', time=' + selectedTime);
    
    if (showTimeDropdown && timeDropdownRef.current && selectedDate) {
      let timeToScrollTo = selectedTime;
      
      // Find the index of the time to scroll to
      if (timeToScrollTo) {
        const targetIndex = timeOptions.findIndex(option => option.value === timeToScrollTo);
        printLog('📍 Scrolling to time: ' + timeToScrollTo + ' at index ' + targetIndex);
        
        if (targetIndex >= 0) {
          // Use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            if (timeDropdownRef.current) {
              const optionHeight = 40; // Height of each option button
              const containerHeight = timeDropdownRef.current.clientHeight;
              const scrollTop = Math.max(0, targetIndex * optionHeight - containerHeight / 2 + optionHeight / 2);
              printLog('📜 Scrolling dropdown to position: ' + scrollTop);
              timeDropdownRef.current.scrollTop = scrollTop;
            }
          });
        }
      }
    }
  }, [showTimeDropdown, selectedDate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);



  const handleTimeSelect = (timeValue: string) => {
    // Prevent selecting times in the past
    if (selectedDate && isDateTimeInPast(selectedDate, timeValue)) {
      return; // Don't allow selecting past times
    }
    
    setSelectedTime(timeValue);
    setShowTimeDropdown(false);
  };

  const handleCustomDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    printLog('📅 Date selected: ' + dateStr);
    setSelectedDate(dateStr);
    handleCalendarClose();
    
    // Auto-set time if needed using our new function
    if (!selectedTime || isDateTimeInPast(dateStr, selectedTime)) {
      printLog('🔄 Auto-setting time for new date...');
      const nextAvailableTime = findNextAvailableTimeSlot(dateStr);
      printLog('⏰ Next available time for date: ' + nextAvailableTime);
      if (nextAvailableTime) {
        printLog('✅ Setting time to: ' + nextAvailableTime);
        setSelectedTime(nextAvailableTime);
      }
    }
  };

  // Mouse wheel handler for time
  const handleTimeWheel = (e: React.WheelEvent) => {
    printLog('🖱️ Time wheel event triggered! deltaY=' + e.deltaY);
    
    if (!selectedDate || disabled || showTimeDropdown) {
      printLog('❌ Time wheel blocked: date=' + selectedDate + ', disabled=' + disabled + ', dropdown=' + showTimeDropdown);
      return; // Don't trigger if dropdown is open
    }
    
    printLog('✅ Time wheel proceeding with change');
    e.preventDefault();
    e.stopPropagation();
    
    const currentIndex = selectedTime 
      ? timeOptions.findIndex(option => option.value === selectedTime)
      : timeOptions.findIndex(option => option.value === findNextAvailableTimeSlot(selectedDate));
    
    if (currentIndex === -1) return;
    
    const direction = e.deltaY > 0 ? 1 : -1; // Scroll down = next time, scroll up = previous time
    let newIndex = currentIndex + direction;
    
    // Ensure we stay within bounds and don't select past times
    while (newIndex >= 0 && newIndex < timeOptions.length) {
      const newTime = timeOptions[newIndex];
      if (!isDateTimeInPast(selectedDate, newTime.value)) {
        setSelectedTime(newTime.value);
        break;
      }
      newIndex += direction;
    }
  };

  // Mouse wheel handler for date
  const handleDateWheel = (e: React.WheelEvent) => {
    printLog('📅 Date wheel event triggered! deltaY=' + e.deltaY);
    
    if (disabled || showCalendar) {
      printLog('❌ Date wheel blocked: disabled=' + disabled + ', calendar=' + showCalendar);
      return; // Don't trigger if calendar is open
    }
    
    printLog('✅ Date wheel proceeding with change');
    e.preventDefault();
    e.stopPropagation();
    
    const currentDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
    const direction = e.deltaY > 0 ? 1 : -1; // Scroll down = next day, scroll up = previous day
    
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    
    // Don't go before minDate
    if (newDate >= minDate) {
      const newDateStr = newDate.toISOString().split('T')[0];
      setSelectedDate(newDateStr);
      
      // Auto-adjust time if current time is now in the past for the new date
      if (selectedTime && isDateTimeInPast(newDateStr, selectedTime)) {
        const nextAvailableTime = findNextAvailableTimeSlot(newDateStr);
        if (nextAvailableTime) {
          setSelectedTime(nextAvailableTime);
        }
      }
    }
  };

  const handleCalendarClose = () => {
    setIsCalendarClosing(true);
    setTimeout(() => {
      setShowCalendar(false);
      setIsCalendarClosing(false);
    }, 300); // Match animation duration
  };

  const formatDisplayValue = (): string => {
    if (!selectedDate || !selectedTime) return '';
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    const date = new Date(selectedDate);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${dateStr} at ${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Check if datetime is valid using pure local timezone logic
  const isValidDateTime = selectedDate && selectedTime && (() => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const [year, month, day] = selectedDate.split('-').map(Number);
    const userDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return userDateTime > minDate;
  })();

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-3">
        {/* Date Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={() => showCalendar ? handleCalendarClose() : setShowCalendar(true)}
            onWheel={handleDateWheel}
            disabled={disabled}
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-3 
                     text-left focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
                     disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
          >
            {selectedDate ? (
              new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })
            ) : (
              <span className="text-gray-400">Select date</span>
            )}
          </button>
          
          {/* Custom Calendar */}
          {showCalendar && (
            <CustomCalendar
              selectedDate={selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined}
              onDateSelect={handleCustomDateSelect}
              minDate={minDate}
              onClose={handleCalendarClose}
              isClosing={isCalendarClosing}
            />
          )}
        </div>

        {/* Time Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            onWheel={handleTimeWheel}
            disabled={disabled || !selectedDate}
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-10 py-3 
                     text-left focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
                     disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
          >
            {selectedTime ? (
              timeOptions.find(opt => opt.value === selectedTime)?.label || selectedTime
            ) : (
              <span className="text-gray-400">Select time</span>
            )}
          </button>
          <ChevronDown 
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 
                       transition-transform ${showTimeDropdown ? 'rotate-180' : ''}`}
          />
          
          {/* Time Dropdown */}
          {showTimeDropdown && (
            <div 
              ref={timeDropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 
                          rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              {timeOptions.map((option) => {
                const isPastTime = selectedDate && isDateTimeInPast(selectedDate, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleTimeSelect(option.value)}
                    disabled={isPastTime}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors
                             first:rounded-t-lg last:rounded-b-lg
                             ${isPastTime 
                               ? 'text-gray-500 cursor-not-allowed opacity-50' 
                               : 'text-white hover:bg-gray-800 focus:bg-gray-800 focus:outline-none'
                             }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Display formatted value and timezone info */}
      {isValidDateTime && (
        <div className="mt-3 p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="text-sm text-white font-medium mb-1">
            {formatDisplayValue()}
          </div>
          <div className="text-xs text-gray-400">
            Your timezone: {userTimezone}
          </div>
          {isDateTimeInPast(selectedDate, selectedTime) && (
            <div className="text-xs text-red-400 mt-1">
              ⚠️ Selected time is in the past
            </div>
          )}
        </div>
      )}

      {/* Click outside handler */}
      {showTimeDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowTimeDropdown(false)}
        />
      )}
    </div>
  );
};

export default DateTimePicker;




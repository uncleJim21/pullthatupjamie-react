import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import CustomCalendar from './CustomCalendar.tsx';
import { printLog } from '../constants/constants.ts';
import { formatShortDate } from '../utils/time.ts';

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onDropdownStateChange?: (hasOpenDropdowns: boolean) => void;
}

interface TimeOption {
  value: string; // HH:MM format
  label: string;
}

// Generate time options with minute precision (5-minute increments)
const generateTimeOptions = (): TimeOption[] => {
  const options: TimeOption[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) { // 5-minute intervals
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
  const [year, month, day] = date.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const isToday = selectedDate.toDateString() === now.toDateString();
  
  printLog('📅 Date comparison: now=' + now.toDateString() + ', selected=' + selectedDate.toDateString() + ', isToday=' + isToday);
  
  if (!isToday) {
    // If it's a future date, return the first time slot
    printLog('🔮 Future date, returning first time slot: ' + timeOptions[0].value);
    return timeOptions[0].value;
  }
  
  // For today, find the next available time slot (at least 1 minute from now)
  const nowPlusOne = new Date(now.getTime() + 60 * 1000); // Add 1 minute
  const currentHour = nowPlusOne.getHours();
  const currentMinute = nowPlusOne.getMinutes();
  
  // Round up to next 5-minute interval
  const nextBucketMinute = Math.ceil(currentMinute / 5) * 5;
  const nextHour = nextBucketMinute >= 60 ? currentHour + 1 : currentHour;
  const nextMinute = nextBucketMinute >= 60 ? 0 : nextBucketMinute;
  
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

// Simple helper to check if a date/time is in the past (with 1 minute buffer)
const isDateTimeInPast = (date: string, time: string): boolean => {
  if (!date || !time) return false;
  
  const [hours, minutes] = time.split(':').map(Number);
  // Parse date in local timezone to avoid UTC/local timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const selectedDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Allow times that are at least 1 minute in the future
  const now = new Date();
  const minAllowedTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
  
  return selectedDateTime < minAllowedTime;
};

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  minDate = (() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  })(),
  placeholder = "Select date and time",
  disabled = false,
  className = "",
  onDropdownStateChange
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showTimeDropdown, setShowTimeDropdown] = useState<string | false>(false);
  const [editingValue, setEditingValue] = useState<string>('');
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
      
      // Work with user's local time directly - avoid toISOString() timezone shift
      const year = value.getFullYear();
      const month = (value.getMonth() + 1).toString().padStart(2, '0');
      const day = value.getDate().toString().padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
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
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const today = `${year}-${month}-${day}`;
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

  // Notify parent of dropdown state changes
  useEffect(() => {
    if (onDropdownStateChange) {
      const hasOpenDropdowns = showCalendar || !!showTimeDropdown;
      onDropdownStateChange(hasOpenDropdowns);
    }
  }, [showCalendar, showTimeDropdown, onDropdownStateChange]);

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
    // Immediately stop propagation to prevent any bubbling
    e.preventDefault();
    e.stopPropagation();
    
    printLog('🖱️ Time wheel event triggered! deltaY=' + e.deltaY);
    
    if (!selectedDate || disabled || showTimeDropdown) {
      printLog('❌ Time wheel blocked: date=' + selectedDate + ', disabled=' + disabled + ', dropdown=' + showTimeDropdown);
      return; // Don't trigger if dropdown is open
    }
    
    printLog('✅ Time wheel proceeding with change');
    
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
    // Immediately stop propagation to prevent any bubbling
    e.preventDefault();
    e.stopPropagation();
    
    printLog('📅 Date wheel event triggered! deltaY=' + e.deltaY);
    
    if (disabled || showCalendar) {
      printLog('❌ Date wheel blocked: disabled=' + disabled + ', calendar=' + showCalendar);
      return; // Don't trigger if calendar is open
    }
    
    printLog('✅ Date wheel proceeding with change');
    
    const currentDate = selectedDate ? (() => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : new Date();
    const direction = e.deltaY > 0 ? 1 : -1; // Scroll down = next day, scroll up = previous day
    
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    
    // Don't go before minDate
    if (newDate >= minDate) {
      const year = newDate.getFullYear();
      const month = (newDate.getMonth() + 1).toString().padStart(2, '0');
      const day = newDate.getDate().toString().padStart(2, '0');
      const newDateStr = `${year}-${month}-${day}`;
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
    
    // Parse date components to avoid timezone conversion
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dateStr = formatShortDate(date);
    
    return `${dateStr} at ${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Check if datetime is valid using proper time validation
  const isValidDateTime = selectedDate && selectedTime && (() => {
    // Check if the date is valid (not before minDate)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    if (selectedDateObj < minDate) return false;
    
    // Check if the time is valid (not in the past for today)
    return !isDateTimeInPast(selectedDate, selectedTime);
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
            onWheelCapture={handleDateWheel}
            disabled={disabled}
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-3 
                     text-left focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
                     disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
            style={{ touchAction: 'none' }}
          >
                      {selectedDate ? (
            (() => {
              const [year, month, day] = selectedDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              return formatShortDate(date);
            })()
          ) : (
            <span className="text-gray-400">Select date</span>
          )}
          </button>
          
          {/* Custom Calendar */}
          {showCalendar && (
            <CustomCalendar
              selectedDate={selectedDate ? (() => {
                const [year, month, day] = selectedDate.split('-').map(Number);
                return new Date(year, month - 1, day);
              })() : undefined}
              onDateSelect={handleCustomDateSelect}
              minDate={minDate}
              onClose={handleCalendarClose}
              isClosing={isCalendarClosing}
            />
          )}
        </div>

        {/* Time Input with Direct Typing like Scheduled Slots */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          
          {selectedTime ? (
            <div className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-3 
                          focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
              <div className="flex items-center space-x-1">
                {(() => {
                  const [hours24, minutes] = selectedTime.split(':').map(Number);
                  const hour12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
                  const ampm = hours24 >= 12 ? 'PM' : 'AM';
                  
                  return (
                    <>
                      {/* Hour Input */}
                      {showTimeDropdown === 'hour' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setEditingValue(inputValue);
                          }}
                          onBlur={(e) => {
                            // Validate and fix on blur
                            const inputValue = e.target.value;
                            let finalHour = parseInt(inputValue);
                            
                            // If invalid, default to 12
                            if (isNaN(finalHour) || finalHour < 1 || finalHour > 12) {
                              finalHour = 12;
                            }
                            
                            let newHours24 = finalHour === 12 ? 0 : finalHour;
                            if (ampm === 'PM' && finalHour !== 12) newHours24 += 12;
                            if (ampm === 'AM' && finalHour === 12) newHours24 = 0;
                            const newTime = `${newHours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                            setSelectedTime(newTime);
                            setShowTimeDropdown(false);
                            setEditingValue('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              // Validate and fix on enter/tab
                              const inputValue = e.currentTarget.value;
                              let finalHour = parseInt(inputValue);
                              
                              // If invalid, default to 12
                              if (isNaN(finalHour) || finalHour < 1 || finalHour > 12) {
                                finalHour = 12;
                              }
                              
                              let newHours24 = finalHour === 12 ? 0 : finalHour;
                              if (ampm === 'PM' && finalHour !== 12) newHours24 += 12;
                              if (ampm === 'AM' && finalHour === 12) newHours24 = 0;
                              const newTime = `${newHours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                              setSelectedTime(newTime);
                              setShowTimeDropdown(false);
                              setEditingValue('');
                            }
                          }}
                          className="w-8 px-1 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                          maxLength={2}
                          placeholder={hour12.toString().padStart(2, '0')}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={disabled || !selectedDate}
                          onClick={() => {
                            setEditingValue('');
                            setShowTimeDropdown('hour');
                          }}
                          className="px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                        >
                          {hour12.toString().padStart(2, '0')}
                        </button>
                      )}
                      
                      <span className="text-gray-400">:</span>
                      
                      {/* Minutes Input */}
                      {showTimeDropdown === 'minutes' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setEditingValue(inputValue);
                          }}
                          onBlur={(e) => {
                            // Validate and fix on blur
                            const inputValue = e.target.value;
                            let finalMinutes = parseInt(inputValue);
                            
                            // If invalid, default to 00
                            if (isNaN(finalMinutes) || finalMinutes < 0 || finalMinutes > 59) {
                              finalMinutes = 0;
                            }
                            
                            const newTime = `${hours24.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
                            setSelectedTime(newTime);
                            setShowTimeDropdown(false);
                            setEditingValue('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              // Validate and fix on enter/tab
                              const inputValue = e.currentTarget.value;
                              let finalMinutes = parseInt(inputValue);
                              
                              // If invalid, default to 00
                              if (isNaN(finalMinutes) || finalMinutes < 0 || finalMinutes > 59) {
                                finalMinutes = 0;
                              }
                              
                              const newTime = `${hours24.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
                              setSelectedTime(newTime);
                              setShowTimeDropdown(false);
                              setEditingValue('');
                            }
                          }}
                          className="w-8 px-1 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                          maxLength={2}
                          placeholder={minutes.toString().padStart(2, '0')}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={disabled || !selectedDate}
                          onClick={() => {
                            setEditingValue('');
                            setShowTimeDropdown('minutes');
                          }}
                          className="px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                        >
                          {minutes.toString().padStart(2, '0')}
                        </button>
                      )}
                      
                      {/* AM/PM Toggle */}
                      <button
                        type="button"
                        disabled={disabled || !selectedDate}
                        onClick={() => {
                          const newAmpm = ampm === 'AM' ? 'PM' : 'AM';
                          let newHours24 = hour12;
                          if (newAmpm === 'PM' && hour12 !== 12) newHours24 += 12;
                          if (newAmpm === 'AM' && hour12 === 12) newHours24 = 0;
                          const newTime = `${newHours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                          setSelectedTime(newTime);
                        }}
                        className="px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                      >
                        {ampm}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (selectedDate) {
                  const nextAvailableTime = findNextAvailableTimeSlot(selectedDate);
                  if (nextAvailableTime) {
                    setSelectedTime(nextAvailableTime);
                  }
                }
              }}
              disabled={disabled || !selectedDate}
              className="w-full bg-gray-900 text-gray-400 border border-gray-700 rounded-lg pl-10 pr-4 py-3 
                       text-left focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
                       disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
            >
              Select time
            </button>
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


    </div>
  );
};

export default DateTimePicker;




import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  onClose: () => void;
  isClosing?: boolean;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  selectedDate,
  onDateSelect,
  minDate = new Date(),
  onClose,
  isClosing = false
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return selectedDate || new Date();
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Generate calendar days
  const calendarDays: (Date | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today || date < minDate;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;
    onDateSelect(date);
    // onClose is called from handleCustomDateSelect in parent
  };

  const formatMonthYear = (): string => {
    return `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.custom-calendar')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <>
      <style>{`
        .animate-slide-up {
          animation: slideUp 0.8s ease-out forwards;
        }
        
        .animate-slide-down {
          animation: slideDown 0.8s ease-in forwards;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
          to {
            opacity: 0;
            transform: translateY(-10px) scaleY(0.95);
          }
        }
      `}</style>
      <div className={`custom-calendar absolute top-full left-0 right-0 mt-1 bg-black border border-gray-700 rounded-lg shadow-xl z-50 p-4 origin-top
                      ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 rounded hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-300" />
        </button>
        
        <h3 className="text-lg font-medium text-white">
          {formatMonthYear()}
        </h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 rounded hover:bg-gray-800 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={index} className="h-8"></div>;
          }

          const disabled = isDateDisabled(date);
          const selected = isDateSelected(date);
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={`
                h-8 w-8 text-sm rounded flex items-center justify-center transition-colors
                ${disabled 
                  ? 'text-gray-600 cursor-not-allowed opacity-50' 
                  : 'text-white hover:bg-gray-800 cursor-pointer'
                }
                ${selected 
                  ? 'bg-white text-gray-800 font-medium' 
                  : ''
                }
                ${isToday && !selected 
                  ? 'bg-gray-700 text-white' 
                  : ''
                }
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      <div className="mt-4 pt-3 border-t border-gray-800">
        <button
          onClick={onClose}
          className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
      </div>
    </>
  );
};

export default CustomCalendar;

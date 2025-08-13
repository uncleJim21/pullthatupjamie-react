import React, { useState } from 'react';
import { Clock, X, Plus } from 'lucide-react';
import { ScheduledSlot } from '../services/preferencesService.ts';

interface ScheduledPostSlotsProps {
  slots: ScheduledSlot[];
  onSlotsChange: (slots: ScheduledSlot[]) => void;
  maxSlots?: number;
  className?: string;
  onSlotSelect?: (slot: ScheduledSlot) => void; // For selecting time in SocialShareModal
  isSelectable?: boolean; // Whether slots can be clicked for selection
}

const ScheduledPostSlots: React.FC<ScheduledPostSlotsProps> = ({
  slots,
  onSlotsChange,
  maxSlots = 10,
  className = "",
  onSlotSelect,
  isSelectable = false
}) => {
  const [editingSlot, setEditingSlot] = useState<string | null>(null);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const generateId = () => {
    return `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNewSlot = () => {
    if (slots.length >= maxSlots) return;

    const newSlot: ScheduledSlot = {
      id: generateId(),
      dayOfWeek: 1, // Default to Monday
      time: '16:45', // Default time
      enabled: true
    };

    onSlotsChange([...slots, newSlot]);
    setEditingSlot(newSlot.id);
  };

  const updateSlot = (id: string, updates: Partial<ScheduledSlot>) => {
    const updatedSlots = slots.map(slot =>
      slot.id === id ? { ...slot, ...updates } : slot
    );
    onSlotsChange(updatedSlots);
  };

  const deleteSlot = (id: string) => {
    const updatedSlots = slots.filter(slot => slot.id !== id);
    onSlotsChange(updatedSlots);
    if (editingSlot === id) {
      setEditingSlot(null);
    }
  };

  const handleSlotClick = (slot: ScheduledSlot) => {
    if (onSlotSelect && slot.enabled) {
      onSlotSelect(slot);
    }
  };

  const formatDisplayTime = (time: string, dayOfWeek: number): string => {
    // Use military time format (24-hour)
    return `${dayNames[dayOfWeek]} ${time}`;
  };

  // Get current time info for smart sorting
  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Helper function to calculate "days from now" considering current time
  const getDaysFromNow = (slot: ScheduledSlot): number => {
    let dayDiff = (slot.dayOfWeek - currentDayOfWeek + 7) % 7;
    
    // If it's today but the time has passed, move to next week
    if (dayDiff === 0 && slot.time <= currentTimeString) {
      dayDiff = 7;
    }
    
    return dayDiff;
  };

  // Sort slots based on current time (next upcoming slots first)
  const sortedSlots = [...slots].sort((a, b) => {
    const daysFromNowA = getDaysFromNow(a);
    const daysFromNowB = getDaysFromNow(b);
    
    if (daysFromNowA !== daysFromNowB) {
      return daysFromNowA - daysFromNowB;
    }
    
    // Same day, sort by time
    return a.time.localeCompare(b.time);
  });

  // Find the next upcoming slot for default selection
  const getNextSlot = (): ScheduledSlot | null => {
    const enabledSlots = sortedSlots.filter(slot => slot.enabled);
    return enabledSlots.length > 0 ? enabledSlots[0] : null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-white font-medium mb-1">Scheduled Post Slots</h4>
          <p className="text-gray-400 text-sm">
            Set regular times for posting content. All times are in your local timezone.
          </p>
        </div>
        {slots.length < maxSlots && (
          <button
            onClick={addNewSlot}
            className="flex items-center justify-center w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded-full border border-gray-600 transition-colors"
            title="Add time slot"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
          <div className="flex justify-center mb-2">
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-3">No scheduled slots yet</p>
          <button
            onClick={addNewSlot}
            className="flex items-center space-x-2 mx-auto px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md border border-gray-600 transition-colors text-sm"
          >
            <Plus className="w-3 h-3" />
            <span>Add First Slot</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedSlots.map((slot) => (
            <div
              key={slot.id}
              className={`bg-gray-900 border rounded-lg p-3 transition-colors ${
                slot.enabled 
                  ? 'border-gray-700' 
                  : 'border-gray-800 opacity-60'
              } ${
                isSelectable && slot.enabled && onSlotSelect
                  ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-800'
                  : ''
              }`}
              onClick={() => isSelectable && handleSlotClick(slot)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
                  <Clock className="w-3 h-3 text-gray-400" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlot(slot.id);
                  }}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete slot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex space-x-2">
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSlot(slot.id, { dayOfWeek: parseInt(e.target.value) });
                  }}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:border-white focus:outline-none"
                  style={{ width: '40%' }}
                >
                  {dayNames.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
                
                <input
                  type="time"
                  value={slot.time}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSlot(slot.id, { time: e.target.value });
                  }}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:border-white focus:outline-none"
                  style={{ width: '40%' }}
                />
              </div>
            </div>
          ))}

          {/* Add slot placeholder if under max */}
          {slots.length < maxSlots && (
            <button
              onClick={addNewSlot}
              className="bg-gray-900 border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg p-3 flex flex-col items-center justify-center text-gray-400 hover:text-gray-300 transition-colors min-h-[64px]"
            >
              <Plus className="w-4 h-4 mb-1" />
              <span className="text-xs">Add Slot</span>
            </button>
          )}
        </div>
      )}

      {sortedSlots.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          {sortedSlots.filter(s => s.enabled).length} of {sortedSlots.length} slots enabled
          {sortedSlots.length < maxSlots && ` • ${maxSlots - sortedSlots.length} slots available`}
        </div>
      )}
    </div>
  );
};

export default ScheduledPostSlots;

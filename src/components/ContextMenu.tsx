import React, { useEffect, useRef } from 'react';

export interface ContextMenuOption {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

interface ContextMenuProps {
  options: ContextMenuOption[];
  position: { x: number; y: number };
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  options,
  position,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Close on escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleOptionClick = (option: ContextMenuOption) => {
    if (option.disabled) return;
    option.onClick();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] animate-tooltip-expand"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <div className="bg-black border border-gray-800 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-lg">
        <div className="min-w-[180px]">
          {options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={option.disabled}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 border-b border-gray-800 last:border-b-0 whitespace-nowrap ${
                option.disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
              }`}
            >
              <span style={{ color: option.color || 'currentColor' }}>
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

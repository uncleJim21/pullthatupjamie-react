import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

export interface KeywordTooltipOption {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface KeywordTooltipProps {
  keyword: string;
  options: KeywordTooltipOption[];
  onClose?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const KeywordTooltip: React.FC<KeywordTooltipProps> = ({
  keyword,
  options,
  onClose,
  isOpen: externalIsOpen,
  onOpenChange
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const showTooltip = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (onOpenChange) {
      onOpenChange(true);
    } else {
      setInternalIsOpen(true);
    }
  };

  // Use layoutEffect to calculate position before paint
  useLayoutEffect(() => {
    if (showTooltip && buttonRef.current && menuRef.current && containerRef.current) {
      const button = buttonRef.current.getBoundingClientRect();
      const menu = menuRef.current.getBoundingClientRect();
      
      // Get the parent scrollable container
      let parent = containerRef.current.parentElement;
      while (parent && !parent.classList.contains('overflow-y-auto')) {
        parent = parent.parentElement;
      }
      
      const parentBounds = parent 
        ? parent.getBoundingClientRect() 
        : document.body.getBoundingClientRect();
      
      // Position above the button
      let top = -menu.height - 8;
      
      // Calculate horizontal position - try to center
      let left = (button.width / 2) - (menu.width / 2);
      
      // Check left overflow
      if (button.left + left < parentBounds.left) {
        left = parentBounds.left - button.left + 8;
      }
      
      // Check right overflow
      if (button.left + left + menu.width > parentBounds.right) {
        left = (parentBounds.right - button.left) - menu.width - 8;
      }
      
      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
      });
    } else {
      setTooltipStyle(null);
    }
  }, [showTooltip]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (onOpenChange) {
          onOpenChange(false);
        } else {
          setInternalIsOpen(false);
        }
        onClose?.();
      }
    };

    if (showTooltip && tooltipStyle) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip, tooltipStyle, onClose, onOpenChange]);

  const handleOptionClick = (option: KeywordTooltipOption) => {
    option.onClick();
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      setInternalIsOpen(false);
    }
    onClose?.();
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Keyword Badge */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`text-xs px-2 py-0.5 rounded transition-colors cursor-pointer ${
          showTooltip
            ? 'bg-white text-black hover:bg-gray-200'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {keyword}
      </button>

      {/* Tooltip - initially rendered with opacity 0 for measurement, then shown */}
      {showTooltip && (
        <div
          ref={menuRef}
          className={`absolute z-[200] origin-bottom ${tooltipStyle ? 'animate-tooltip-expand' : 'opacity-0 pointer-events-none'}`}
          style={tooltipStyle || { top: '-9999px', left: '-9999px' }}
        >
          <div className="bg-black border border-gray-800 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-lg">
            <div className="min-w-[180px]">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800/80 hover:text-white transition-colors flex items-center gap-2 border-b border-gray-800 last:border-b-0 whitespace-nowrap"
                  disabled={!tooltipStyle}
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
      )}
    </div>
  );
};


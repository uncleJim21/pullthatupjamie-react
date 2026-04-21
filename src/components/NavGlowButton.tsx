import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable prev/next navigation button with a breathing pulse glow.
 * Glow color is configurable via `glowRgb` (e.g. "255,255,255" for white).
 *
 * Styling lives in `.btn-nav` (index.css) and reads the CSS variable
 * `--nav-glow-rgb` that we set inline here.
 */
export interface NavGlowButtonProps {
  direction: 'prev' | 'next';
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  /** RGB triplet, e.g. "255,255,255" (default teal matches SemanticGalaxyView). */
  glowRgb?: string;
  /** Visual size. */
  size?: 'sm' | 'md';
  /** Only show the chevron — hide the text label. */
  iconOnly?: boolean;
  className?: string;
  title?: string;
}

export const NavGlowButton: React.FC<NavGlowButtonProps> = ({
  direction,
  onClick,
  disabled,
  label,
  glowRgb,
  size = 'md',
  iconOnly = false,
  className = '',
  title,
}) => {
  const text = label ?? (direction === 'prev' ? 'Prev' : 'Next');
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  const sizePad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : '';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const style: React.CSSProperties = glowRgb
    ? ({ ['--nav-glow-rgb' as any]: glowRgb } as React.CSSProperties)
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-nav ${sizePad} ${className}`.trim()}
      style={style}
      title={title ?? text}
      aria-label={title ?? text}
    >
      {direction === 'prev' && <Icon className={iconSize} />}
      {!iconOnly && <span>{text}</span>}
      {direction === 'next' && <Icon className={iconSize} />}
    </button>
  );
};

export default NavGlowButton;

import React from 'react';
import { Link } from 'react-router-dom';
import { ButtonArrowIcon } from './Icons.tsx';

interface ButtonProps {
  children: React.ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  showArrow?: boolean;
  style?: React.CSSProperties;
}

const Button: React.FC<ButtonProps> = ({
  children,
  to,
  onClick,
  variant = 'primary',
  showArrow = false,
  style = {}
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    gap: '8px',
    ...style
  };

  const variantStyles = {
    primary: {
      backgroundColor: isHovered ? '#eaeaea' : 'white',
      color: 'black',
      border: 'none',
    },
    secondary: {
      backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
      color: 'white',
      border: '2px solid white',
    }
  };

  const combinedStyle = {
    ...baseStyle,
    ...variantStyles[variant],
  };

  const content = (
    <>
      {children}
      {showArrow && <ButtonArrowIcon />}
    </>
  );

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  if (to) {
    return (
      <Link 
        to={to} 
        style={combinedStyle} 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </Link>
    );
  }

  return (
    <button 
      onClick={onClick} 
      style={combinedStyle} 
      type="button"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </button>
  );
};

export default Button; 
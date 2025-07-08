import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, User, LogIn, LogOut, CircleFadingArrowUp, Radio, BookOpen } from 'lucide-react';
import BitcoinConnectButton from './BitcoinConnectButton.tsx';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService.ts';

interface AccountButtonProps {
  onConnect: () => void;
  onSignInClick: () => void;
  onUpgradeClick: () => void;
  onSignOut: () => void;
  onTutorialClick: () => void;
  isSignedIn: boolean;
  isInMobileMenu?: boolean; // New prop to detect if we're in mobile menu
}

interface AdminFeed {
  feedId: string;
  access: 'admin' | 'user' | 'viewer';
}

export const AccountButton: React.FC<AccountButtonProps> = ({
  onConnect,
  onSignInClick,
  onSignOut,
  onUpgradeClick,
  onTutorialClick,
  isSignedIn,
  isInMobileMenu = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [showNickname, setShowNickname] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [adminFeed, setAdminFeed] = useState<AdminFeed | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  // Check for mobile screen size
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      setNickname(localStorage.getItem('squareId'));
      
      // Check admin privileges
      const checkAdmin = async () => {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) return;
          
          const response = await AuthService.checkPrivs(token);
          if (response?.privs?.privs) {
            setAdminFeed({
              feedId: response.privs.privs.feedId,
              access: response.privs.privs.access
            });
          }
        } catch (error) {
          setAdminFeed(null);
        }
      };
      
      checkAdmin();
      
      // Check if user is subscribed
      setTimeout(() => {
        setShowUpgrade(localStorage.getItem('isSubscribed') !== 'true');
      }, 1000);

      // Add small delay before showing nickname to ensure smooth transition
      setTimeout(() => {
        setShowNickname(true);
      }, 100);
    } else {
      setAdminFeed(null);
      setShowNickname(false);
    }
  }, [isSignedIn]);

  const truncateMiddle = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    const half = Math.floor(maxLength / 2);
    return `${str.slice(0, half)}...${str.slice(-half)}`;
  };

  // Determine dropdown positioning based on screen size and mobile menu context
  const getDropdownPositioning = () => {
    if (isInMobileMenu) {
      // When in mobile menu, position relative to the button but stay within bounds
      return {
        left: '0',
        right: 'auto',
        transform: 'translateX(-50%)', // Center the dropdown relative to button
        marginTop: '8px'
      };
    } else if (isMobile) {
      // On mobile but not in mobile menu, position to the left to avoid overflow
      return {
        left: '0',
        right: 'auto',
        transform: 'translateX(-80%)',
        marginLeft: '-8px'
      };
    }
    // Desktop positioning - align to right as before
    return {
      right: '0',
      left: 'auto'
    };
  };

  const buttonStyle = isInMobileMenu 
    ? { width: '100%', maxWidth: '180px' } // Constrain width in mobile menu
    : { minWidth: '130px' }; // Original desktop behavior

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#111111] text-white rounded-lg border border-gray-800 hover:border-gray-700 transition-all"
        style={buttonStyle}
      >
        <User size={20} />
        <div className="hidden sm:block overflow-hidden" style={{ width: '100%', maxWidth: isInMobileMenu ? '120px' : '180px' }}>
          <span
            className="inline-block whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-500 ease-in-out"
            title={nickname || "Account"}
            style={{ 
              opacity: isSignedIn && showNickname && nickname ? 1 : 0.7,
              maxWidth: isSignedIn && showNickname && nickname ? (isInMobileMenu ? '120px' : '180px') : '0px',
              transform: isSignedIn && showNickname && nickname ? 'translateX(0)' : 'translateX(-20px)',
            }}
          >
            {isSignedIn && nickname ? truncateMiddle(nickname, isInMobileMenu ? 15 : 20) : ""}
          </span>
          <span
            className="inline-block transition-all duration-500 ease-in-out"
            style={{ 
              opacity: isSignedIn && showNickname && nickname ? 0 : 1,
              maxWidth: isSignedIn && showNickname && nickname ? '0px' : (isInMobileMenu ? '120px' : '180px'),
              transform: isSignedIn && showNickname && nickname ? 'translateX(20px)' : 'translateX(0)',
              position: isSignedIn && showNickname && nickname ? 'absolute' : 'relative',
            }}
          >
            Account
          </span>
        </div>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute mt-2 bg-[#111111] border border-gray-800 rounded-lg shadow-xl overflow-hidden"
          style={{
            ...getDropdownPositioning(),
            width: isInMobileMenu ? '190px' : '240px', // Increased mobile width to match new container
            zIndex: isInMobileMenu ? '60' : '50' // Higher z-index in mobile menu
          }}
        >
          <div className="p-2 space-y-1">
            {/* Bitcoin Connect */}
            <div className="p-2">
              <BitcoinConnectButton onConnect={onConnect} />
            </div>

            {/* My Feed Button (for admins) */}
            {adminFeed?.access === 'admin' && (
              <button
                onClick={() => {
                  navigate(`/app/feed/${adminFeed.feedId}`);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <Radio size={20} />
                <span>My Podcast</span>
              </button>
            )}

            {/* Upgrade Button */}
            {showUpgrade && isSignedIn && (
              <button
                onClick={() => {
                  onUpgradeClick();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <CircleFadingArrowUp size={20} />
                <span>Upgrade</span>
              </button>
            )}

            {/* Tutorial Button */}
            <button
              onClick={() => {
                onTutorialClick();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <BookOpen size={20} />
              <span>Tutorial</span>
            </button>

            {/* Sign In/Out */}
            <button
              onClick={() => {
                isSignedIn ? onSignOut() : onSignInClick();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
            >
              {isSignedIn ? (
                <>
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountButton;

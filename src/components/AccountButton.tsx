import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, User, LogIn, LogOut, CircleFadingArrowUp, LayoutDashboard, Headphones, PlusCircle, Send } from 'lucide-react';
import BitcoinConnectButton from './BitcoinConnectButton.tsx';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService.ts';
import { NavigationMode } from '../constants/constants.ts';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.ts';

interface AccountButtonProps {
  onConnect: () => void;
  onSignInClick: () => void;
  onUpgradeClick: () => void;
  onSignOut: () => void;
  onTutorialClick: () => void;
  onProDashboardClick?: () => void;
  onAddEpisodeClick?: () => void;
  isSignedIn: boolean;
  isOnAppPage?: boolean; // Whether we're on /app (affects what shows in dropdown vs header)
  isInMobileMenu?: boolean; // New prop to detect if we're in mobile menu
  navigationMode?: NavigationMode;
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
  onProDashboardClick,
  onAddEpisodeClick,
  isSignedIn,
  isOnAppPage = false,
  isInMobileMenu = false,
  navigationMode = NavigationMode.STANDARD,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [showNickname, setShowNickname] = useState(false);
  const [adminFeed, setAdminFeed] = useState<AdminFeed | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  
  // Use centralized subscription status hook
  // (automatically refreshes when auth-state-changed event fires)
  const subscriptionStatus = useSubscriptionStatus();

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

      // Add small delay before showing nickname to ensure smooth transition
      setTimeout(() => {
        setShowNickname(true);
      }, 100);
    } else {
      setAdminFeed(null);
      setShowNickname(false);
      setNickname(null);
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
            {/* Bitcoin Connect - Hidden for now (Lightning auth deprecated) */}
            {/* <div className="p-2">
              <BitcoinConnectButton onConnect={onConnect} />
            </div> */}

            {/* Navigation Items - Show "Search Podcasts" only when NOT on /app */}
            {navigationMode === NavigationMode.CLEAN && !window.location.pathname.startsWith('/app') && (
              <>
                <button
                  onClick={() => {
                      window.location.href = '/app';
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Headphones size={20} />
                  <span>Search Podcasts</span>
                </button>
              </>
            )}

            {/* Pro Dashboard Button - show in dropdown when on /app (header shows Add Episode there) */}
            {isOnAppPage && (
              <button
                onClick={() => {
                  if (adminFeed?.access === 'admin') {
                    // If admin, navigate directly to their feed
                    navigate(`/app/feed/${adminFeed.feedId}`);
                  } else if (onProDashboardClick) {
                    // Otherwise, use the handler (shows upgrade modal)
                    onProDashboardClick();
                  }
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <LayoutDashboard size={20} />
                <span>Pro Dashboard</span>
              </button>
            )}

            {/* Add Episode Button - show in dropdown when NOT on /app (header shows it there) */}
            {!isOnAppPage && (
              <button
                onClick={() => {
                  if (onAddEpisodeClick) {
                    onAddEpisodeClick();
                  } else {
                    navigate('/try-jamie');
                  }
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <PlusCircle size={20} />
                <span>Add Episode</span>
              </button>
            )}

            {/* POAST - Cross-posting tool */}
            <button
              onClick={() => {
                navigate('/app/poast');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <Send size={20} />
              <span>POAST</span>
            </button>

            {/* Upgrade Button - only show if not already Pro */}
            {subscriptionStatus.shouldShowUpgrade() && isSignedIn && (
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

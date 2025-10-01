import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Search, LayoutDashboard } from 'lucide-react';
import AuthService from '../services/authService.ts';
import AccountButton from './AccountButton.tsx';
import SignInModal from './SignInModal.tsx';
import {printLog, NavigationMode} from '../constants/constants.ts';

interface PageBannerProps {
  logoText?: string;
  onConnect?: () => void;
  onSignIn?: () => void;
  onUpgrade?: () => void;
  onSignOut?: () => void;
  onTutorialClick?: () => void;
  isUserSignedIn?: boolean;
  setIsUserSignedIn?: (value: boolean) => void;
  navigationMode?: NavigationMode;
}

interface AdminFeed {
  feedId: string;
  access: 'admin' | 'user' | 'viewer';
}

const PageBanner: React.FC<PageBannerProps> = ({ 
  logoText = "Pull That Up Jamie!",
  onConnect,
  onSignIn,
  onUpgrade,
  onSignOut,
  onTutorialClick,
  isUserSignedIn: propsIsUserSignedIn,
  setIsUserSignedIn: propsSetIsUserSignedIn,
  navigationMode = NavigationMode.STANDARD
}) => {
  const [adminFeed, setAdminFeed] = useState<AdminFeed | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isProDashboardModalOpen, setIsProDashboardModalOpen] = useState(false);
  const navigate = useNavigate();

  // Check for screen size
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    // Initial check
    checkIsMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIsMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Check if user is signed in
  useEffect(() => {
    // If sign-in status is controlled by parent, use that value
    if (propsIsUserSignedIn !== undefined) {
      setIsUserSignedIn(propsIsUserSignedIn);
      return;
    }
    
    // Otherwise check localStorage
    const checkSignedIn = () => {
      const hasToken = !!localStorage.getItem('auth_token');
      const hasSquareId = !!localStorage.getItem('squareId');
      setIsUserSignedIn(hasToken && hasSquareId);
    };
  
    // Add a slight delay before checking localStorage
    const timeout = setTimeout(checkSignedIn, 50); // 50ms delay
  
    return () => clearTimeout(timeout); // Cleanup timeout
  }, [propsIsUserSignedIn]);

  // Check for admin privileges
  useEffect(() => {
    const checkAdminPrivileges = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        printLog(`Checking admin privileges, token exists: ${!!token}`);
        if (!token) return;

        const response = await AuthService.checkPrivs(token);
        printLog(`Admin privileges check response: ${JSON.stringify(response)}`);
        
        if (response && response.privs && response.privs.privs) {
          // If user has admin privileges for a feed, store it
          const newAdminFeed = {
            feedId: response.privs.privs.feedId,
            access: response.privs.privs.access
          };
          printLog(`Setting admin feed: ${JSON.stringify(newAdminFeed)}`);
          setAdminFeed(newAdminFeed);
        } else {
          printLog('No admin privileges found in response');
          setAdminFeed(null);
        }
      } catch (error) {
        printLog(`Error checking admin privileges: ${error}`);
        setAdminFeed(null);
      }
    };

    if (isUserSignedIn) {
      printLog('User is signed in, checking admin privileges');
      checkAdminPrivileges();
    } else {
      printLog('User is not signed in, clearing admin feed');
      setAdminFeed(null);
    }
  }, [isUserSignedIn]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMenuOpen && !target.closest('.mobile-menu') && !target.closest('.hamburger-button')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleProDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    printLog(`Pro Dashboard clicked, adminFeed: ${JSON.stringify(adminFeed)}, isUserSignedIn: ${isUserSignedIn}`);
    
    // Close mobile menu if open
    setIsMenuOpen(false);
    
    if (adminFeed && adminFeed.feedId) {
      // If user has admin privileges, navigate to their feed
      printLog(`Navigating to: /app/feed/${adminFeed.feedId}`);
      navigate(`/app/feed/${adminFeed.feedId}`);
    } else {
      // If user doesn't have admin privileges, show Pro Dashboard modal immediately
      printLog('No admin feed found, showing Pro Dashboard modal');
      setIsProDashboardModalOpen(true);
    }
  };

  const navLinkStyle = {
    textDecoration: 'none', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px',
  };

  const iconStyle = {
    width: '24px',
    height: '24px',
    flexShrink: 0
  };

  // AccountButton handlers
  const handleConnect = () => {
    if (onConnect) {
      onConnect();
    } else {
      printLog("Bitcoin Connect clicked - no handler provided");
    }
  };

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      // Open the sign in modal instead of navigating
      setIsSignInModalOpen(true);
    }
  };

  const handleSignInSuccess = () => {
    // Update internal state
    setIsUserSignedIn(true);
    setIsSignInModalOpen(false);
    
    // Update parent state if provided
    if (propsSetIsUserSignedIn) {
      propsSetIsUserSignedIn(true);
    }
  };

  const handleSignUpSuccess = () => {
    // Update internal state
    setIsUserSignedIn(true);
    setIsSignInModalOpen(false);
    
    // Update parent state if provided
    if (propsSetIsUserSignedIn) {
      propsSetIsUserSignedIn(true);
    }
    
    // For sign up success, we just close the modal and sign in the user
    // No need to trigger upgrade flow or pro dashboard modal
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      printLog("Upgrade clicked - no handler provided");
    }
  };

  const handleProDashboardUpgrade = () => {
    setIsProDashboardModalOpen(false);
    
    if (!isUserSignedIn) {
      // If not signed in, show sign in modal
      setIsSignInModalOpen(true);
    } else {
      // If signed in, call parent upgrade handler
      if (onUpgrade) {
        onUpgrade();
      }
    }
  };

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('squareId');
      localStorage.removeItem('isSubscribed');
      
      // Update internal state
      setIsUserSignedIn(false);
      
      // Update parent state if provided
      if (propsSetIsUserSignedIn) {
        propsSetIsUserSignedIn(false);
      }
    }
  };

  return (
    <>
      <header className="page-banner" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        backgroundColor: 'black',
        color: 'white',
        width: '100%',
        borderBottom: '1px solid #333',
        position: 'relative',
        zIndex: 10
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src="/default-source-favicon.png" 
              alt="Logo" 
              style={{ height: '36px', width: '36px', marginRight: '10px' }} 
            />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{logoText}</span>
          </div>
        </Link>
        
        {/* Hamburger Menu Button (Mobile) */}
        {isMobile && (
          <button 
            className="hamburger-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '5px',
            }}
          >
            {isMenuOpen ? 
              <span style={{ fontSize: '24px' }}>✕</span> : 
              <span style={{ fontSize: '24px' }}>☰</span>
            }
          </button>
        )}
        
        {/* Desktop Navigation */}
        {!isMobile && (
          <nav 
            style={{ 
              display: 'flex', 
              gap: '24px',
              alignItems: 'center'
            }}
            className="desktop-nav"
          >
            {navigationMode === NavigationMode.STANDARD && (
              <>
                <a 
                  href="/app"
                  style={navLinkStyle}
                  className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
                  onClick={(e) => {
                    e.preventDefault();
                    // Check if we need to reload by comparing URLs
                    if (window.location.pathname === '/app' && !window.location.search.includes('mode=web-search')) {
                      window.location.reload();
                    } else {
                      window.location.href = '/app';
                    }
                  }}
                >
                  <Headphones size={24} style={iconStyle} />
                  <span>Search Podcasts</span>
                </a>
                <a 
                  href="/app/?mode=web-search"
                  style={navLinkStyle}
                  className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
                  onClick={(e) => {
                    e.preventDefault();
                    // Check if we need to reload by comparing URLs
                    if (window.location.pathname === '/app' && window.location.search.includes('mode=web-search')) {
                      window.location.reload();
                    } else {
                      window.location.href = '/app/?mode=web-search';
                    }
                  }}
                >
                  <Search size={24} style={iconStyle} />
                  <span>Search Web</span>
                </a>
              </>
            )}
            <a 
              href="#" 
              onClick={handleProDashboardClick}
              style={{ ...navLinkStyle, cursor: 'pointer' }}
              className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
            >
              <LayoutDashboard size={24} style={iconStyle} />
              <span>Pro Dashboard</span>
            </a>
            <AccountButton 
              onConnect={handleConnect}
              onSignInClick={handleSignIn}
              onUpgradeClick={handleUpgrade}
              onSignOut={handleSignOut}
              onTutorialClick={onTutorialClick || (() => {})}
              isSignedIn={isUserSignedIn}
              navigationMode={navigationMode}
            />
          </nav>
        )}
        
        {/* Mobile Menu */}
        {isMobile && isMenuOpen && (
          <div 
            className="mobile-menu"
            style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              backgroundColor: '#111',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '12px',
              width: '220px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 20,
              marginRight: '10px',
              overflow: 'visible'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {navigationMode === NavigationMode.STANDARD && (
                <>
                  <a 
                    href="/app"
                    style={{ ...navLinkStyle, padding: '8px 12px' }}
                    className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      
                      // Check if we need to reload by comparing URLs
                      if (window.location.pathname === '/app' && !window.location.search.includes('mode=web-search')) {
                        window.location.reload();
                      } else {
                        window.location.href = '/app';
                      }
                    }}
                  >
                    <Headphones size={24} style={iconStyle} />
                    <span>Search Podcasts</span>
                  </a>
                  <a 
                    href="/app/?mode=web-search"
                    style={{ ...navLinkStyle, padding: '8px 12px' }}
                    className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      
                      // Check if we need to reload by comparing URLs
                      if (window.location.pathname === '/app' && window.location.search.includes('mode=web-search')) {
                        window.location.reload();
                      } else {
                        window.location.href = '/app/?mode=web-search';
                      }
                    }}
                  >
                    <Search size={24} style={iconStyle} />
                    <span>Search Web</span>
                  </a>
                </>
              )}
              <a 
                href="#" 
                onClick={handleProDashboardClick}
                style={{ ...navLinkStyle, cursor: 'pointer', padding: '8px 12px' }}
                className="text-gray-300 hover:text-white transition-all duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] font-bold"
              >
                <LayoutDashboard size={24} style={iconStyle} />
                <span>Pro Dashboard</span>
              </a>
              <div style={{ 
                padding: '4px 8px', // Reduced padding to give more space
                overflow: 'visible', // Changed from hidden to visible
                maxWidth: '100%',
                width: '196px' // Updated to match new mobile menu width (220px - 24px padding)
              }}>
                <AccountButton 
                  onConnect={handleConnect}
                  onSignInClick={handleSignIn}
                  onUpgradeClick={handleUpgrade}
                  onSignOut={handleSignOut}
                  onTutorialClick={onTutorialClick || (() => {})}
                  isSignedIn={isUserSignedIn}
                  isInMobileMenu={true}
                  navigationMode={navigationMode}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInModalOpen} 
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={handleSignUpSuccess}
      />

      {/* Pro Dashboard Modal */}
      {isProDashboardModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
            <h2 className="text-white text-xl font-bold mb-4">
              Pro Dashboard Access Required
            </h2>
            <p className="text-gray-400 mb-6">
              The Pro Dashboard is exclusively for Jamie Pro subscribers. Upgrade now to access advanced podcast management features, analytics, and premium tools.
            </p>
            <p className="text-gray-400 mb-6">
              If you just recently purchased Jamie Pro, please wait 1 business day for our representative to fully onboard you.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsProDashboardModalOpen(false)}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleProDashboardUpgrade}
                className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PageBanner; 
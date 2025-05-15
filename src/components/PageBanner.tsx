import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Search, LayoutDashboard, Mail, Menu, X } from 'lucide-react';
import AuthService from '../services/authService.ts';

interface PageBannerProps {
  logoText?: string;
}

interface AdminFeed {
  feedId: string;
  access: 'admin' | 'user' | 'viewer';
}

const PageBanner: React.FC<PageBannerProps> = ({ logoText = "Pull That Up Jamie!" }) => {
  const [adminFeed, setAdminFeed] = useState<AdminFeed | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  // Check for screen size
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkIsMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIsMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Check for admin privileges
  useEffect(() => {
    const checkAdminPrivileges = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await AuthService.checkPrivs(token);
        console.log('Admin privileges check:', response);
        
        if (response && response.privs && response.privs.privs) {
          // If user has admin privileges for a feed, store it
          setAdminFeed({
            feedId: response.privs.privs.feedId,
            access: response.privs.privs.access
          });
        } else {
          setAdminFeed(null);
        }
      } catch (error) {
        console.error('Error checking admin privileges:', error);
        setAdminFeed(null);
      }
    };

    checkAdminPrivileges();
  }, []);

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
    if (adminFeed && adminFeed.feedId) {
      navigate(`/app/feed/${adminFeed.feedId}`);
    } else {
      navigate('/app/dashboard');
    }
    setIsMenuOpen(false);
  };

  const navLinkStyle = {
    textDecoration: 'none', 
    color: 'white',
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px',
  };

  const iconStyle = {
    width: '24px',
    height: '24px',
    flexShrink: 0
  };

  return (
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
            <X size={24} style={iconStyle} /> : 
            <Menu size={24} style={iconStyle} />
          }
        </button>
      )}
      
      {/* Desktop Navigation */}
      {!isMobile && (
        <nav 
          style={{ 
            display: 'flex', 
            gap: '24px',
          }}
          className="desktop-nav"
        >
          <Link to="/app" style={navLinkStyle}>
            <Headphones size={24} style={iconStyle} />
            <span>Search Podcasts</span>
          </Link>
          <Link to="/app/?mode=web-search" style={navLinkStyle}>
            <Search size={24} style={iconStyle} />
            <span>Search Web</span>
          </Link>
          <a 
            href="#" 
            onClick={handleProDashboardClick}
            style={{ ...navLinkStyle, cursor: 'pointer' }}
          >
            <LayoutDashboard size={24} style={iconStyle} />
            <span>Pro Dashboard</span>
          </a>
          <Link to="/contact" style={navLinkStyle}>
            <Mail size={24} style={iconStyle} />
            <span>Contact</span>
          </Link>
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
            width: '200px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 20
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Link 
              to="/app" 
              style={{ ...navLinkStyle, padding: '8px 12px' }}
              onClick={() => setIsMenuOpen(false)}
            >
              <Headphones size={24} style={iconStyle} />
              <span>Search Podcasts</span>
            </Link>
            <Link 
              to="/app/?mode=web-search" 
              style={{ ...navLinkStyle, padding: '8px 12px' }}
              onClick={() => setIsMenuOpen(false)}
            >
              <Search size={24} style={iconStyle} />
              <span>Search Web</span>
            </Link>
            <a 
              href="#" 
              onClick={handleProDashboardClick}
              style={{ ...navLinkStyle, cursor: 'pointer', padding: '8px 12px' }}
            >
              <LayoutDashboard size={24} style={iconStyle} />
              <span>Pro Dashboard</span>
            </a>
            <Link 
              to="/contact" 
              style={{ ...navLinkStyle, padding: '8px 12px' }}
              onClick={() => setIsMenuOpen(false)}
            >
              <Mail size={24} style={iconStyle} />
              <span>Contact</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PageBanner; 
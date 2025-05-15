import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Search, LayoutDashboard, Mail } from 'lucide-react';
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
  const navigate = useNavigate();

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

  const handleProDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (adminFeed && adminFeed.feedId) {
      navigate(`/app/feed/${adminFeed.feedId}`);
    } else {
      navigate('/app/dashboard');
    }
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
      borderBottom: '1px solid #333'
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
      
      <nav style={{ display: 'flex', gap: '24px' }}>
        <Link to="/app" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Headphones size={18} />
          <span>Search Podcasts</span>
        </Link>
        <Link to="/app/?mode=web-search" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={18} />
          <span>Search Web</span>
        </Link>
        <a 
          href="#" 
          onClick={handleProDashboardClick}
          style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <LayoutDashboard size={18} />
          <span>Pro Dashboard</span>
        </a>
        <Link to="/contact" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mail size={18} />
          <span>Contact</span>
        </Link>
      </nav>
    </header>
  );
};

export default PageBanner; 
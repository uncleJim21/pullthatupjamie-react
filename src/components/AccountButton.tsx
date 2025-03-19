import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, User, LogIn, LogOut, CircleFadingArrowUp, Radio } from 'lucide-react';
import BitcoinConnectButton from './BitcoinConnectButton.tsx'; // Regular import
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService.ts';
import { DEBUG_MODE } from '../constants/constants.ts';

interface AccountButtonProps {
  onConnect: () => void;
  onSignInClick: () => void;
  onUpgradeClick: () => void;
  onSignOut: () => void;
  isSignedIn: boolean; // Prop passed from the parent component
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
  isSignedIn,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [adminFeed, setAdminFeed] = useState<AdminFeed | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Check for admin privileges
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

  useEffect(() => {
    const email = localStorage.getItem('squareId') as string;
    if (email) {
      setNickname(email);
    }
  }, [isSignedIn]);

  // Check admin privileges when signed in status changes
  useEffect(() => {
    if (isSignedIn) {
      checkAdminPrivileges();
    } else {
      setAdminFeed(null);
    }
  }, [isSignedIn]);

  useEffect(() => {
    async function checkUpgradePath(){
      const isUpgraded = localStorage.getItem('isSubscribed') as string === 'true';
      setShowUpgrade(!isUpgraded);
    }
    setTimeout(checkUpgradePath, 2000);
  }, [isSignedIn]);

  const truncateMiddle = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    const start = str.slice(0, Math.floor(maxLength / 2));
    const end = str.slice(-Math.floor(maxLength / 2));
    return `${start}...${end}`;
  };

  const handleMyFeedClick = () => {
    if (adminFeed && adminFeed.feedId) {
      navigate(`/feed/${adminFeed.feedId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#111111] text-white rounded-lg border border-gray-800 hover:border-gray-700 transition-all"
      >
        <User size={20} />
        <span
          className="hidden sm:inline max-w-[200px] overflow-hidden text-ellipsis"
          title={nickname || "Account"}
        >
          {isSignedIn
            ? nickname
              ? truncateMiddle(nickname, 20) // Adjust the max length as needed
              : "Account"
            : "Account"}
        </span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-[#111111] border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 space-y-1">
            {/* Bitcoin Connect */}
            <div className="p-2">
              <BitcoinConnectButton onConnect={onConnect} />
            </div>

            {/* My Feed Button (Shown only when admin privileges exist) */}
            {adminFeed && adminFeed.access === 'admin' && (
              <button
                onClick={handleMyFeedClick}
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
                  setIsOpen(false);
                  onUpgradeClick();
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <CircleFadingArrowUp size={20} />
                <span>Upgrade</span>
              </button>
            )}

            {/* Sign In/Out */}
            {isSignedIn ? (
              <button
                onClick={() => {
                  onSignOut();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onSignInClick();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogIn size={20} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountButton;

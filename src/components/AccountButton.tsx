import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, User, LogIn, LogOut, CircleFadingArrowUp, Radio } from 'lucide-react';
import BitcoinConnectButton from './BitcoinConnectButton.tsx';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService.ts';

interface AccountButtonProps {
  onConnect: () => void;
  onSignInClick: () => void;
  onUpgradeClick: () => void;
  onSignOut: () => void;
  isSignedIn: boolean;
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
  const navigate = useNavigate();

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
    } else {
      setAdminFeed(null);
    }
  }, [isSignedIn]);

  const truncateMiddle = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    const half = Math.floor(maxLength / 2);
    return `${str.slice(0, half)}...${str.slice(-half)}`;
  };

  return (
    <div className="relative">
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
          {isSignedIn && nickname ? truncateMiddle(nickname, 20) : "Account"}
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

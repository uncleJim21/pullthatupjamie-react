import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, User, LogIn, LogOut } from 'lucide-react';
import BitcoinConnectButton from './BitcoinConnectButton.tsx'; // Regular import

interface AccountButtonProps {
  onConnect: () => void;
  onSignInClick: () => void;
  onSignOut: () => void;
  isSignedIn: boolean; // Prop passed from the parent component
}

export const AccountButton: React.FC<AccountButtonProps> = ({
  onConnect,
  onSignInClick,
  onSignOut,
  isSignedIn,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = localStorage.getItem('squareId') as string;
    if (email) {
      setNickname(email);
    }
  }, [isSignedIn]);

  const truncateMiddle = (str: string, maxLength: number) => {
    if (str.length <= maxLength) return str;
    const start = str.slice(0, Math.floor(maxLength / 2));
    const end = str.slice(-Math.floor(maxLength / 2));
    return `${start}...${end}`;
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
        <div className="absolute right-0 mt-2 w-60 bg-[#111111] border border-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 space-y-1">
            {/* Bitcoin Connect */}
            <div className="p-2">
              <BitcoinConnectButton onConnect={onConnect} />
            </div>

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

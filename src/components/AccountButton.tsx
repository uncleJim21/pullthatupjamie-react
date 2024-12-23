import React, { useState, useRef } from 'react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#111111] text-white rounded-lg border border-gray-800 hover:border-gray-700 transition-all"
      >
        <User size={20} />
        <span className="hidden sm:inline">Account</span>
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

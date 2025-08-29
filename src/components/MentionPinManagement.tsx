import React, { useState, useEffect } from 'react';
import { Pin, PinOff, Edit, Trash2, Loader2, Plus, Twitter, Link, X } from 'lucide-react';
import { mentionService } from '../services/mentionService.ts';
import { PersonalPin, TwitterProfileData, NostrProfileData } from '../types/mention.ts';

interface MentionPinManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onStartLinking?: (pin: PersonalPin) => void; // Callback to start linking mode
}

const MentionPinManagement: React.FC<MentionPinManagementProps> = ({
  isOpen,
  onClose,
  onStartLinking
}) => {
  const [pins, setPins] = useState<PersonalPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPin, setEditingPin] = useState<PersonalPin | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPins();
    }
  }, [isOpen]);

  const loadPins = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await mentionService.getPins();
      if (result.success) {
        setPins(result.data || []);
      } else {
        setError(result.error || 'Failed to load pins');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!window.confirm('Are you sure you want to delete this pin?')) {
      return;
    }

    try {
      const result = await mentionService.deletePin(pinId);
      if (result.success) {
        setPins(prev => prev.filter(pin => pin.id !== pinId));
      } else {
        setError(result.error || 'Failed to delete pin');
      }
    } catch (error) {
      setError('Failed to delete pin');
    }
  };

  const handleUpdatePin = async (pinId: string, updates: any) => {
    try {
      const result = await mentionService.updatePin(pinId, updates);
      if (result.success) {
        setPins(prev => prev.map(pin => 
          pin.id === pinId ? { ...pin, ...updates, updatedAt: new Date().toISOString() } : pin
        ));
        setEditingPin(null);
      } else {
        setError(result.error || 'Failed to update pin');
      }
    } catch (error) {
      setError('Failed to update pin');
    }
  };

  const handleStartLinking = (pin: PersonalPin) => {
    onStartLinking?.(pin);
    onClose(); // Close the pin management modal to start linking
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'twitter') {
      return <span className="text-blue-400">𝕏</span>;
    } else if (platform === 'nostr') {
      return <img src="/nostr-logo-square.png" alt="Nostr" className="w-4 h-4" style={{ filter: 'brightness(1.2)' }} />;
    }
    return <span>{platform}</span>;
  };

  const getProfileDisplayName = (pin: PersonalPin) => {
    if (pin.profileData) {
      if (pin.platform === 'twitter') {
        const twitterData = pin.profileData as TwitterProfileData;
        return twitterData.name || twitterData.username;
      } else {
        const nostrData = pin.profileData as NostrProfileData;
        return nostrData.displayName || nostrData.nip05 || nostrData.npub.slice(0, 16) + '...';
      }
    }
    return pin.username;
  };

  const getProfileImage = (pin: PersonalPin) => {
    if (pin.profileData) {
      if (pin.platform === 'twitter') {
        const twitterData = pin.profileData as TwitterProfileData;
        return twitterData.profile_image_url;
      } else {
        const nostrData = pin.profileData as NostrProfileData;
        // Use profile_image_url if available (mapped field), otherwise fallback to picture
        return nostrData.profile_image_url || nostrData.picture;
      }
    }
    return null;
  };

  const isCrossPlatformMapping = (pin: PersonalPin) => {
    return pin.targetPlatform && pin.targetPlatform !== pin.platform && pin.targetUsername;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Pin className="w-5 h-5 mr-2 text-yellow-500" />
            Personal Mention Pins
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              <span className="text-gray-400">Loading pins...</span>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-4">{error}</div>
          ) : pins.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Pin className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-lg mb-2">No pinned mentions yet</p>
              <p className="text-sm">Pin users from the mention search to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Profile Image */}
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                        {getProfileImage(pin) ? (
                          <img 
                            src={getProfileImage(pin)!} 
                            alt={getProfileDisplayName(pin)}
                            className="w-10 h-10 object-cover"
                          />
                        ) : (
                          getPlatformIcon(pin.platform)
                        )}
                      </div>
                      
                      {/* User Info */}
                      <div className="flex items-center space-x-2">
                        {getPlatformIcon(pin.platform)}
                        <span className="text-white font-medium">
                          {getProfileDisplayName(pin)}
                        </span>
                        <span className="text-gray-400 text-sm">
                          @{pin.username}
                        </span>
                      </div>

                      {/* Cross-platform mapping indicator */}
                      {isCrossPlatformMapping(pin) && (
                        <>
                          <span className="text-gray-400">→</span>
                          <div className="flex items-center space-x-2">
                            {getPlatformIcon(pin.targetPlatform!)}
                            <span className="text-white font-medium">
                              @{pin.targetUsername}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                        Used {pin.usageCount} times
                      </span>
                      {isCrossPlatformMapping(pin) && (
                        <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                          Cross-platform
                        </span>
                      )}
                      <button
                        onClick={() => setEditingPin(editingPin?.id === pin.id ? null : pin)}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Edit pin"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!isCrossPlatformMapping(pin) && onStartLinking && (
                        <button
                          onClick={() => handleStartLinking(pin)}
                          className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                          title={`Link with ${pin.platform === 'twitter' ? 'Nostr' : 'Twitter'} profile`}
                        >
                          <Link className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePin(pin.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete pin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {pin.notes && (
                    <div className="text-gray-300 text-sm mb-3">
                      {pin.notes}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Created: {formatDate(pin.createdAt)} • Updated: {formatDate(pin.updatedAt)}
                  </div>

                  {/* Edit Form */}
                  {editingPin?.id === pin.id && (
                    <div className="mt-4 p-3 bg-gray-700 rounded border border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Target Platform (for cross-platform mapping)</label>
                          <select
                            value={pin.targetPlatform || ''}
                            onChange={(e) => handleUpdatePin(pin.id, { targetPlatform: e.target.value || undefined })}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          >
                            <option value="">No cross-platform mapping</option>
                            <option value="twitter">Twitter</option>
                            <option value="nostr">Nostr</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Target Username</label>
                          <input
                            type="text"
                            value={pin.targetUsername || ''}
                            onChange={(e) => handleUpdatePin(pin.id, { targetUsername: e.target.value || undefined })}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            placeholder="Enter target username for cross-platform mapping"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Notes</label>
                        <textarea
                          value={pin.notes || ''}
                          onChange={(e) => handleUpdatePin(pin.id, { notes: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                          rows={2}
                          placeholder="Add notes (optional)"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {pins.length} pinned mention{pins.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MentionPinManagement; 
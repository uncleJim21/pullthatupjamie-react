import { useState, useEffect, useCallback, useRef } from 'react';
import PreferencesService, { UserPreferences, generateDefaultScheduledSlots } from '../services/preferencesService.ts';

interface UseUserSettingsOptions {
  enableCloudSync?: boolean; // Enable cloud sync for admin users
  autoLoadOnMount?: boolean; // Automatically load on mount
  debounceDelay?: number; // Debounce delay in milliseconds for cloud sync (default: 1000ms)
}

interface UseUserSettingsReturn {
  settings: UserPreferences;
  isLoading: boolean;
  error: string | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  updateSettings: (newSettings: Partial<UserPreferences>) => Promise<void>;
  syncWithCloud: () => Promise<void>;
  flushPendingChanges: () => Promise<void>;
  clearError: () => void;
}

const LOCAL_STORAGE_KEY = 'userSettings';

/**
 * Custom hook for managing user settings with optional cloud sync
 */
export const useUserSettings = (options: UseUserSettingsOptions = {}): UseUserSettingsReturn => {
  const { enableCloudSync = false, autoLoadOnMount = true, debounceDelay = 1000 } = options;
  
  const [settings, setSettings] = useState<UserPreferences>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      
      // Set default scheduled slots if none exist
      if (!parsed.scheduledPostSlots || parsed.scheduledPostSlots.length === 0) {
        parsed.scheduledPostSlots = generateDefaultScheduledSlots();
      }
      
      // Set default randomizePostTime if not set
      if (parsed.randomizePostTime === undefined) {
        parsed.randomizePostTime = true;
      }
      
      // Migrate jamieAssistDefaults from old localStorage location if not already in userSettings
      if (!parsed.jamieAssistDefaults) {
        try {
          const oldJamieAssistDefaults = localStorage.getItem('jamieAssistDefaults');
          if (oldJamieAssistDefaults) {
            parsed.jamieAssistDefaults = oldJamieAssistDefaults;
            console.log('Migrated jamieAssistDefaults to userSettings');
          }
        } catch (migrationError) {
          console.error('Error migrating jamieAssistDefaults:', migrationError);
        }
      }
      
      return parsed;
    } catch (error) {
      console.error('Error parsing stored user settings:', error);
      return {
        scheduledPostSlots: generateDefaultScheduledSlots(),
        randomizePostTime: true
      };
    }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for debouncing and sync tracking
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSettingsRef = useRef<UserPreferences | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  const prevEnableCloudSyncRef = useRef<boolean>(enableCloudSync);
  const migrationCleanupRef = useRef<boolean>(false);

  /**
   * Save settings to localStorage
   */
  const saveToLocalStorage = useCallback((newSettings: UserPreferences) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
      
      // Clean up old jamieAssistDefaults localStorage entry after successful migration
      if (!migrationCleanupRef.current && newSettings.jamieAssistDefaults) {
        try {
          localStorage.removeItem('jamieAssistDefaults');
          migrationCleanupRef.current = true;
          console.log('Cleaned up old jamieAssistDefaults from localStorage');
        } catch (cleanupError) {
          console.error('Error cleaning up old jamieAssistDefaults:', cleanupError);
        }
      }
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, []);

  /**
   * Load settings from cloud (for admin users)
   */
  const loadFromCloud = useCallback(async (): Promise<UserPreferences | null> => {
    if (!enableCloudSync) return null;
    
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return null;

    try {
      const response = await PreferencesService.getPreferences(authToken);
      return response.preferences;
    } catch (error) {
      console.error('Error loading settings from cloud:', error);
      // Don't throw here - we want to gracefully fall back to localStorage
      return null;
    }
  }, [enableCloudSync]);

  /**
   * Save settings to cloud (for admin users)
   */
  const saveToCloud = useCallback(async (settingsToSave: UserPreferences): Promise<boolean> => {
    if (!enableCloudSync) return false;
    
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) return false;

    try {
      await PreferencesService.updatePreferences(authToken, settingsToSave);
      return true;
    } catch (error) {
      console.error('Error saving settings to cloud:', error);
      setError('Failed to sync settings to cloud');
      return false;
    }
  }, [enableCloudSync]);

  /**
   * Debounced save to cloud - accumulates changes and saves after delay
   */
  const debouncedSaveToCloud = useCallback((settingsToSave: UserPreferences) => {
    if (!enableCloudSync) return;

    // Store the latest settings
    pendingSettingsRef.current = settingsToSave;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(async () => {
      if (pendingSettingsRef.current) {
        await saveToCloud(pendingSettingsRef.current);
        pendingSettingsRef.current = null;
      }
    }, debounceDelay);
  }, [enableCloudSync, debounceDelay, saveToCloud]);

  /**
   * Sync with cloud - load from cloud and merge with local settings
   */
  const syncWithCloud = useCallback(async () => {
    if (!enableCloudSync) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const cloudSettings = await loadFromCloud();
      
      if (cloudSettings && Object.keys(cloudSettings).length > 0) {
        // Cloud has settings - merge with local settings (cloud takes precedence)
        setSettings(prevSettings => {
          const mergedSettings = { ...prevSettings, ...cloudSettings };
          
          // Ensure default slots exist if none are set
          if (!mergedSettings.scheduledPostSlots || mergedSettings.scheduledPostSlots.length === 0) {
            mergedSettings.scheduledPostSlots = generateDefaultScheduledSlots();
          }
          
          // Ensure randomizePostTime is set
          if (mergedSettings.randomizePostTime === undefined) {
            mergedSettings.randomizePostTime = true;
          }
          
          saveToLocalStorage(mergedSettings);
          return mergedSettings;
        });
      } else {
        // No cloud settings or empty - upload current localStorage settings to cloud
        setSettings(prevSettings => {
          if (Object.keys(prevSettings).length > 0) {
            saveToCloud(prevSettings).then(success => {
              if (!success) {
                setError('Failed to sync local settings to cloud');
              }
            });
          }
          return prevSettings;
        });
      }
    } catch (error) {
      console.error('Error syncing with cloud:', error);
      setError('Failed to sync settings with cloud');
    } finally {
      setIsLoading(false);
    }
  }, [enableCloudSync, loadFromCloud, saveToCloud, saveToLocalStorage]);

  /**
   * Update a single setting
   */
  const updateSetting = useCallback(async (key: string, value: any) => {
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings, [key]: value };
      saveToLocalStorage(newSettings);
      
      // If cloud sync is enabled, use debounced save to cloud
      if (enableCloudSync) {
        debouncedSaveToCloud(newSettings);
      }
      
      return newSettings;
    });
  }, [saveToLocalStorage, debouncedSaveToCloud, enableCloudSync]);

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback(async (newSettings: Partial<UserPreferences>) => {
    setSettings(prevSettings => {
      const mergedSettings = { ...prevSettings, ...newSettings };
      saveToLocalStorage(mergedSettings);
      
      // If cloud sync is enabled, use debounced save to cloud
      if (enableCloudSync) {
        debouncedSaveToCloud(mergedSettings);
      }
      
      return mergedSettings;
    });
  }, [saveToLocalStorage, debouncedSaveToCloud, enableCloudSync]);

  /**
   * Force immediate save of any pending changes to cloud
   */
  const flushPendingChanges = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    if (pendingSettingsRef.current) {
      await saveToCloud(pendingSettingsRef.current);
      pendingSettingsRef.current = null;
    }
  }, [saveToCloud]);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load and sync on mount if enabled OR when cloud sync is first enabled
  useEffect(() => {
    const shouldSync = (autoLoadOnMount && enableCloudSync && !hasInitializedRef.current) ||
                      (!prevEnableCloudSyncRef.current && enableCloudSync);
    
    if (!shouldSync) {
      prevEnableCloudSyncRef.current = enableCloudSync;
      return;
    }
    
    hasInitializedRef.current = true;
    prevEnableCloudSyncRef.current = enableCloudSync;
    
    const performInitialSync = async () => {
      if (!enableCloudSync) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) return;

        const cloudResponse = await PreferencesService.getPreferences(authToken);
        const cloudSettings = cloudResponse.preferences;
        
        if (cloudSettings && Object.keys(cloudSettings).length > 0) {
          // Cloud has settings - merge with local settings (cloud takes precedence)
          setSettings(prevSettings => {
            const mergedSettings = { ...prevSettings, ...cloudSettings };
            
            // Ensure default slots exist if none are set
            if (!mergedSettings.scheduledPostSlots || mergedSettings.scheduledPostSlots.length === 0) {
              mergedSettings.scheduledPostSlots = generateDefaultScheduledSlots();
            }
            
            // Ensure randomizePostTime is set
            if (mergedSettings.randomizePostTime === undefined) {
              mergedSettings.randomizePostTime = true;
            }
            
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedSettings));
            } catch (error) {
              console.error('Error saving settings to localStorage:', error);
            }
            return mergedSettings;
          });
        } else {
          // No cloud settings or empty - upload current localStorage settings to cloud
          setSettings(prevSettings => {
            if (Object.keys(prevSettings).length > 0) {
              PreferencesService.updatePreferences(authToken, prevSettings).catch(error => {
                console.error('Error saving settings to cloud:', error);
                setError('Failed to sync local settings to cloud');
              });
            }
            return prevSettings;
          });
        }
      } catch (error) {
        console.error('Error syncing with cloud:', error);
        setError('Failed to sync settings with cloud');
      } finally {
        setIsLoading(false);
      }
    };
    
    performInitialSync();
  }, [autoLoadOnMount, enableCloudSync]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    updateSettings,
    syncWithCloud,
    flushPendingChanges,
    clearError
  };
};

export default useUserSettings;

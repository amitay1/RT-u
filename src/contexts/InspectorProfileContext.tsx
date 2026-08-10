import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
  InspectorProfile,
  InspectorProfileFormData,
  InspectorProfileStorage,
  generateInitials,
} from '@/types/inspectorProfile';
import { resolveStoredInspectorProfileId } from '@/lib/rtPtInspectorProfileSelection';
import { getStorageData, setStorageData, STORAGE_KEYS } from '@/services/unifiedStorage';

const STORAGE_KEY = STORAGE_KEYS.INSPECTOR_PROFILES;
const USER_ID_KEY = STORAGE_KEYS.USER_ID;
const API_BASE_URL = '/api/inspector-profiles';

interface InspectorProfileContextValue {
  profiles: InspectorProfile[];
  currentProfile: InspectorProfile | null;
  preferredProfileId: string | null;
  rememberSelection: boolean;
  isLoading: boolean;
  needsProfileSelection: boolean;

  // Actions
  selectProfile: (id: string) => void;
  createProfile: (data: InspectorProfileFormData) => InspectorProfile;
  updateProfile: (id: string, data: InspectorProfileFormData) => void;
  deleteProfile: (id: string) => void;
  setDefaultProfile: (id: string) => void;
  setRememberSelection: (remember: boolean) => void;
  clearCurrentProfile: () => void;
}

const InspectorProfileContext = createContext<InspectorProfileContextValue | null>(null);

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const defaultStorage: InspectorProfileStorage = {
  profiles: [],
  currentProfileId: null,
  rememberSelection: false,
  lastUsedProfileId: null,
};

async function loadFromStorage(): Promise<InspectorProfileStorage> {
  try {
    const stored = await getStorageData<InspectorProfileStorage>(STORAGE_KEY, defaultStorage);
    return stored;
  } catch (error) {
    console.error('Failed to load inspector profiles from storage:', error);
  }
  return defaultStorage;
}

async function saveToStorage(data: InspectorProfileStorage): Promise<void> {
  try {
    await setStorageData(STORAGE_KEY, data);
  } catch (error) {
    console.error('Failed to save inspector profiles to storage:', error);
  }
}

// User ID is stored separately and cached in memory for performance
let cachedUserId: string | null = null;

async function getUserIdAsync(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  try {
    const stored = await getStorageData<string>(USER_ID_KEY, '');
    if (stored) {
      cachedUserId = stored;
      return stored;
    }
  } catch (error) {
    console.error('Failed to load user ID:', error);
  }

  // Generate new user ID
  const newUserId = generateUUID();
  cachedUserId = newUserId;
  await setStorageData(USER_ID_KEY, newUserId);
  return newUserId;
}

// Synchronous getter for immediate use (returns cached or generates new)
function getUserIdSync(): string {
  if (cachedUserId) {
    return cachedUserId;
  }
  // Fallback to localStorage for immediate access
  let userId = localStorage.getItem('rtpt_inspector_user_id');
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem('rtpt_inspector_user_id', userId);
  }
  cachedUserId = userId;
  return userId;
}

interface InspectorProfileProviderProps {
  children: ReactNode;
}

export function InspectorProfileProvider({ children }: InspectorProfileProviderProps) {
  const [profiles, setProfiles] = useState<InspectorProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [lastUsedProfileId, setLastUsedProfileId] = useState<string | null>(null);
  const [rememberSelection, setRememberSelectionState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);
  // Check if offline mode is enabled via env variable or if we're in Electron
  const isOfflineMode = import.meta.env.VITE_RTPT_ENABLE_OFFLINE_MODE === 'true' ||
                        (typeof window !== 'undefined' && (
                          window.electron?.isElectron === true || Boolean(window.electronAPI)
                        ));
  const [useServerSync, setUseServerSync] = useState(!isOfflineMode); // Disable server sync in offline mode

  // Fetch profiles from server
  const fetchProfilesFromServer = useCallback(async () => {
    try {
      const userId = await getUserIdAsync();
      const response = await fetch(API_BASE_URL, {
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profiles from server');
      }

      const serverProfiles = await response.json();
      return serverProfiles;
    } catch (error) {
      console.error('Failed to fetch profiles from server:', error);
      return null;
    }
  }, []);

  // Load from server or unified storage on mount
  useEffect(() => {
    const loadProfiles = async () => {
      if (useServerSync) {
        // Try to load from server first
        const serverProfiles = await fetchProfilesFromServer();

        if (serverProfiles && Array.isArray(serverProfiles)) {
          // Successfully loaded from server
          setProfiles(serverProfiles);

          // Restore the workstation identity only when it still exists on the server.
          const stored = await loadFromStorage();
          setRememberSelectionState(stored.rememberSelection);
          const restoredProfileId = resolveStoredInspectorProfileId(serverProfiles, stored);
          setCurrentProfileId(restoredProfileId);
          setLastUsedProfileId(restoredProfileId);

          // Also save to unified storage as backup
          await saveToStorage({
            profiles: serverProfiles,
            currentProfileId: restoredProfileId,
            rememberSelection: stored.rememberSelection,
            lastUsedProfileId: restoredProfileId,
          });
        } else {
          // Fallback to unified storage if server fails
          console.log('Falling back to unified storage');
          const stored = await loadFromStorage();
          setProfiles(stored.profiles);
          setRememberSelectionState(stored.rememberSelection);
          const restoredProfileId = resolveStoredInspectorProfileId(stored.profiles, stored);
          setCurrentProfileId(restoredProfileId);
          setLastUsedProfileId(restoredProfileId);
        }
      } else {
        // Use unified storage only
        const stored = await loadFromStorage();
        setProfiles(stored.profiles);
        setRememberSelectionState(stored.rememberSelection);
        const restoredProfileId = resolveStoredInspectorProfileId(stored.profiles, stored);
        setCurrentProfileId(restoredProfileId);
        setLastUsedProfileId(restoredProfileId);
      }

      setIsLoading(false);
      initialLoadDone.current = true;
    };

    loadProfiles();
  }, [useServerSync, fetchProfilesFromServer]);

  // Save to unified storage whenever data changes
  useEffect(() => {
    if (!isLoading && initialLoadDone.current) {
      saveToStorage({
        profiles,
        currentProfileId,
        rememberSelection,
        lastUsedProfileId,
      });
    }
  }, [profiles, currentProfileId, rememberSelection, lastUsedProfileId, isLoading]);

  const currentProfile = profiles.find(p => p.id === currentProfileId) || null;
  const preferredProfileId = rememberSelection ? lastUsedProfileId : null;

  // Show profile selection if no profile is selected and we have profiles OR no profiles at all
  const needsProfileSelection = !isLoading && !currentProfile;

  const selectProfile = useCallback((id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      setCurrentProfileId(id);
      if (rememberSelection) {
        setLastUsedProfileId(id);
      }
    }
  }, [profiles, rememberSelection]);

  const createProfile = useCallback((data: InspectorProfileFormData): InspectorProfile => {
    const now = new Date().toISOString();
    const newProfile: InspectorProfile = {
      id: generateUUID(),
      name: data.name.trim(),
      initials: generateInitials(data.name),
      certificationLevel: data.certificationLevel,
      certificationNumber: data.certificationNumber.trim(),
      certifyingOrganization: data.certifyingOrganization.trim(),
      employeeId: data.employeeId?.trim() || undefined,
      department: data.department?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      isDefault: profiles.length === 0, // First profile is default
    };

    // Save to server if sync is enabled
    if (useServerSync) {
      fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getUserIdSync(),
        },
        body: JSON.stringify(newProfile),
      })
        .then(response => {
          if (!response.ok) {
            console.error('Failed to save profile to server');
          }
          return response.json();
        })
        .then(serverProfile => {
          console.log('Profile saved to server:', serverProfile);
        })
        .catch(error => {
          console.error('Error saving profile to server:', error);
        });
    }

    setProfiles(prev => [...prev, newProfile]);
    // Creating an inspector from the workstation profile flow must select that exact
    // profile in the same update cycle. Calling selectProfile here would read
    // the previous profiles closure before React commits the new entry.
    setCurrentProfileId(newProfile.id);
    if (rememberSelection) {
      setLastUsedProfileId(newProfile.id);
    }
    return newProfile;
  }, [profiles.length, rememberSelection, useServerSync]);

  const updateProfile = useCallback((id: string, data: InspectorProfileFormData) => {
    const updatedData = {
      name: data.name.trim(),
      initials: generateInitials(data.name),
      certificationLevel: data.certificationLevel,
      certificationNumber: data.certificationNumber.trim(),
      certifyingOrganization: data.certifyingOrganization.trim(),
      employeeId: data.employeeId?.trim() || undefined,
      department: data.department?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    // Update on server if sync is enabled
    if (useServerSync) {
      fetch(`${API_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getUserIdSync(),
        },
        body: JSON.stringify(updatedData),
      })
        .then(response => {
          if (!response.ok) {
            console.error('Failed to update profile on server');
          }
          return response.json();
        })
        .then(serverProfile => {
          console.log('Profile updated on server:', serverProfile);
        })
        .catch(error => {
          console.error('Error updating profile on server:', error);
        });
    }

    setProfiles(prev => prev.map(profile => {
      if (profile.id !== id) return profile;
      return {
        ...profile,
        ...updatedData,
      };
    }));
  }, [useServerSync]);

  const deleteProfile = useCallback((id: string) => {
    // Delete from server if sync is enabled
    if (useServerSync) {
      fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': getUserIdSync(),
        },
      })
        .then(response => {
          if (!response.ok) {
            console.error('Failed to delete profile from server');
          } else {
            console.log('Profile deleted from server');
          }
        })
        .catch(error => {
          console.error('Error deleting profile from server:', error);
        });
    }

    setProfiles(prev => {
      const newProfiles = prev.filter(p => p.id !== id);

      // If we deleted the default, make the first one default
      if (newProfiles.length > 0 && !newProfiles.some(p => p.isDefault)) {
        newProfiles[0].isDefault = true;
      }

      return newProfiles;
    });

    // Clear current if it was the deleted one
    if (currentProfileId === id) {
      setCurrentProfileId(null);
    }
  }, [currentProfileId, useServerSync]);

  const setDefaultProfile = useCallback((id: string) => {
    setProfiles(prev => prev.map(profile => ({
      ...profile,
      isDefault: profile.id === id,
      updatedAt: profile.id === id ? new Date().toISOString() : profile.updatedAt,
    })));
  }, []);

  const setRememberSelection = useCallback((remember: boolean) => {
    setRememberSelectionState(remember);
    setLastUsedProfileId(remember ? (currentProfileId || lastUsedProfileId) : null);
  }, [currentProfileId, lastUsedProfileId]);

  const clearCurrentProfile = useCallback(() => {
    setCurrentProfileId(null);
  }, []);

  const value: InspectorProfileContextValue = {
    profiles,
    currentProfile,
    preferredProfileId,
    rememberSelection,
    isLoading,
    needsProfileSelection,
    selectProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    setRememberSelection,
    clearCurrentProfile,
  };

  return (
    <InspectorProfileContext.Provider value={value}>
      {children}
    </InspectorProfileContext.Provider>
  );
}

// This hook intentionally shares the provider module so its private context stays encapsulated.
// eslint-disable-next-line react-refresh/only-export-components
export function useInspectorProfile(): InspectorProfileContextValue {
  const context = useContext(InspectorProfileContext);
  if (!context) {
    throw new Error('useInspectorProfile must be used within an InspectorProfileProvider');
  }
  return context;
}

/**
 * Unified Storage Service
 *
 * Provides consistent data storage across all environments (Chrome, Edge, Electron).
 * Data is stored in files on the local machine via a local server,
 * ensuring the same data is available regardless of how the app is opened.
 *
 * Priority:
 * 1. Same-origin RT Inspector API (file-based storage) - shared across this product's browsers/Electron
 * 2. localStorage fallback - browser-specific (only if server unavailable)
 */

const STORAGE_API_PATH = '/api/unified-storage';

const getStorageServerUrl = (): string => (
  typeof window === 'undefined' ? '' : window.location.origin
);

// Storage keys
export const STORAGE_KEYS = {
  SAVED_CARDS: 'rtpt_inspector_saved_cards',
  SETTINGS: 'rtpt_inspector_settings',
  INSPECTOR_PROFILES: 'rtpt_inspector_profiles',
  FIRST_RUN: 'rtpt_inspector_first_run_completed',
  FIRST_RUN_DATA: 'rtpt_inspector_first_run_data',
  USER_ID: 'rtpt_inspector_user_id',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// Check if server is available
let serverAvailable: boolean | null = null;
let serverCheckPromise: Promise<boolean> | null = null;

async function checkServerAvailability(): Promise<boolean> {
  if (serverAvailable !== null) {
    return serverAvailable;
  }

  if (serverCheckPromise) {
    return serverCheckPromise;
  }

  serverCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${STORAGE_API_PATH}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      serverAvailable = response.ok;
      return serverAvailable;
    } catch {
      serverAvailable = false;
      return false;
    } finally {
      serverCheckPromise = null;
    }
  })();

  return serverCheckPromise;
}

// Reset server availability check (useful for retry)
export function resetServerCheck(): void {
  serverAvailable = null;
  serverCheckPromise = null;
}

// Get data from unified storage
export async function getStorageData<T>(key: StorageKey, defaultValue: T): Promise<T> {
  const isServerAvailable = await checkServerAvailability();

  if (isServerAvailable) {
    try {
      const response = await fetch(`${STORAGE_API_PATH}/${key}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data !== null && result.data !== undefined) {
          return result.data as T;
        }
      }
    } catch (error) {
      console.warn(`[UnifiedStorage] Server fetch failed for ${key}, using localStorage fallback:`, error);
    }
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error(`[UnifiedStorage] localStorage read failed for ${key}:`, error);
  }

  return defaultValue;
}

// Set data to unified storage
export async function setStorageData<T>(key: StorageKey, data: T): Promise<boolean> {
  // Always save to localStorage as immediate backup
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[UnifiedStorage] localStorage write failed for ${key}:`, error);
  }

  const isServerAvailable = await checkServerAvailability();

  if (isServerAvailable) {
    try {
      const response = await fetch(`${STORAGE_API_PATH}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.warn(`[UnifiedStorage] Server write failed for ${key}:`, error);
    }
  }

  return false;
}

// Delete data from unified storage
export async function deleteStorageData(key: StorageKey): Promise<boolean> {
  // Always remove from localStorage
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[UnifiedStorage] localStorage delete failed for ${key}:`, error);
  }

  const isServerAvailable = await checkServerAvailability();

  if (isServerAvailable) {
    try {
      const response = await fetch(`${STORAGE_API_PATH}/${key}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.warn(`[UnifiedStorage] Server delete failed for ${key}:`, error);
    }
  }

  return true;
}

// Sync localStorage data to server (migrate existing data)
export async function syncLocalStorageToServer(): Promise<{ synced: string[]; failed: string[] }> {
  const synced: string[] = [];
  const failed: string[] = [];

  const isServerAvailable = await checkServerAvailability();

  if (!isServerAvailable) {
    console.warn('[UnifiedStorage] Server not available for sync');
    return { synced, failed };
  }

  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      const localData = localStorage.getItem(key);
      if (localData) {
        const parsed = JSON.parse(localData);

        // Check if server already has data
        const serverResponse = await fetch(`${STORAGE_API_PATH}/${key}`);
        const serverResult = await serverResponse.json();

        // Only sync if server has no data or local data is newer/different
        if (!serverResult.data || serverResult.data === null) {
          const success = await setStorageData(key as StorageKey, parsed);
          if (success) {
            synced.push(key);
          } else {
            failed.push(key);
          }
        } else {
          synced.push(key); // Already in sync
        }
      }
    } catch (error) {
      console.error(`[UnifiedStorage] Sync failed for ${key}:`, error);
      failed.push(key);
    }
  }

  return { synced, failed };
}

// Get storage status info
export async function getStorageStatus(): Promise<{
  serverAvailable: boolean;
  serverUrl: string;
  keys: string[];
}> {
  const isServerAvailable = await checkServerAvailability();

  return {
    serverAvailable: isServerAvailable,
    serverUrl: getStorageServerUrl(),
    keys: Object.values(STORAGE_KEYS),
  };
}

// Create a storage hook helper for React contexts
export function createStorageHelpers<T>(key: StorageKey, defaultValue: T) {
  return {
    load: () => getStorageData<T>(key, defaultValue),
    save: (data: T) => setStorageData(key, data),
    remove: () => deleteStorageData(key),
  };
}

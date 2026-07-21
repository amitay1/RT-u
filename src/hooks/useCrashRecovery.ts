import { useState, useEffect, useCallback, useRef } from 'react';

const RECOVERY_STORAGE_KEY = 'rtpt_inspector_crash_recovery';
const AUTO_SAVE_STORAGE_KEY = 'rtpt_inspector_autosave';
const MAX_SNAPSHOTS = 5;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export interface CrashSnapshot {
  id: string;
  timestamp: string;
  data: unknown;
  route?: string;
  activeTab?: string;
}

export interface CrashRecoveryState {
  hasPendingRecovery: boolean;
  recoveryData: CrashSnapshot | null;
  lastCrashTime: string | null;
  crashCount: number;
}

interface UseCrashRecoveryOptions {
  enabled?: boolean;
  onRecover?: (data: unknown) => void;
}

// Compress large data by removing unnecessary fields
function compressData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  const compressed = JSON.parse(JSON.stringify(data));

  // Remove large binary data or base64 images if present
  const removeKeys = ['base64', 'imageData', 'binaryData'];

  function cleanObject(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (removeKeys.some(k => key.toLowerCase().includes(k))) {
        obj[key] = '[REMOVED_FOR_COMPRESSION]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleanObject(obj[key] as Record<string, unknown>);
      }
    }
  }

  if (typeof compressed === 'object') {
    cleanObject(compressed as Record<string, unknown>);
  }

  return compressed;
}

// Get data size in bytes
function getDataSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

export function useCrashRecovery(options: UseCrashRecoveryOptions = {}) {
  const { enabled = true, onRecover } = options;

  const [recoveryState, setRecoveryState] = useState<CrashRecoveryState>({
    hasPendingRecovery: false,
    recoveryData: null,
    lastCrashTime: null,
    crashCount: 0,
  });

  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentDataRef = useRef<unknown>(null);

  // Check for pending recovery on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const stored = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CrashRecoveryState;
        if (parsed.hasPendingRecovery && parsed.recoveryData) {
          setRecoveryState(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load recovery state:', error);
    }
  }, [enabled]);

  // Save snapshot to localStorage
  const saveSnapshot = useCallback((data: unknown, context?: { route?: string; activeTab?: string }) => {
    if (!enabled) return;

    try {
      const existingSnapshots = JSON.parse(
        localStorage.getItem(AUTO_SAVE_STORAGE_KEY) || '[]'
      ) as CrashSnapshot[];

      const compressedData = compressData(data);
      const dataSize = getDataSize(compressedData);

      // Skip if data is too large (> 5MB)
      if (dataSize > 5 * 1024 * 1024) {
        console.warn('Auto-save skipped: data too large');
        return;
      }

      const snapshot: CrashSnapshot = {
        id: `snapshot_${Date.now()}`,
        timestamp: new Date().toISOString(),
        data: compressedData,
        route: context?.route || window.location.pathname,
        activeTab: context?.activeTab,
      };

      // Keep only latest snapshots
      const updatedSnapshots = [snapshot, ...existingSnapshots].slice(0, MAX_SNAPSHOTS);

      localStorage.setItem(AUTO_SAVE_STORAGE_KEY, JSON.stringify(updatedSnapshots));
      currentDataRef.current = data;
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    }
  }, [enabled]);

  // Start auto-save interval
  const startAutoSave = useCallback((getData: () => unknown, context?: { route?: string; activeTab?: string }) => {
    if (!enabled) return;

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Save immediately
    const data = getData();
    saveSnapshot(data, context);

    // Start interval
    autoSaveIntervalRef.current = setInterval(() => {
      const currentData = getData();
      saveSnapshot(currentData, context);
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [enabled, saveSnapshot]);

  // Stop auto-save
  const stopAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
  }, []);

  // Mark crash occurred
  const markCrash = useCallback((error: Error, componentStack?: string) => {
    try {
      const snapshots = JSON.parse(
        localStorage.getItem(AUTO_SAVE_STORAGE_KEY) || '[]'
      ) as CrashSnapshot[];

      const latestSnapshot = snapshots[0] || null;

      const currentState = JSON.parse(
        localStorage.getItem(RECOVERY_STORAGE_KEY) || '{}'
      ) as Partial<CrashRecoveryState>;

      const newState: CrashRecoveryState = {
        hasPendingRecovery: latestSnapshot !== null,
        recoveryData: latestSnapshot,
        lastCrashTime: new Date().toISOString(),
        crashCount: (currentState.crashCount || 0) + 1,
      };

      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(newState));

      // Also store crash details for diagnostics
      const crashDetails = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      const crashHistory = JSON.parse(
        localStorage.getItem('rtpt_inspector_crash_history') || '[]'
      );
      crashHistory.unshift(crashDetails);
      localStorage.setItem(
        'rtpt_inspector_crash_history',
        JSON.stringify(crashHistory.slice(0, 50)) // Keep last 50 crashes
      );

    } catch (err) {
      console.error('Failed to mark crash:', err);
    }
  }, []);

  // Accept recovery
  const acceptRecovery = useCallback(() => {
    if (recoveryState.recoveryData && onRecover) {
      onRecover(recoveryState.recoveryData.data);
    }

    // Clear recovery state
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    setRecoveryState({
      hasPendingRecovery: false,
      recoveryData: null,
      lastCrashTime: null,
      crashCount: 0,
    });
  }, [recoveryState.recoveryData, onRecover]);

  // Dismiss recovery
  const dismissRecovery = useCallback(() => {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    setRecoveryState({
      hasPendingRecovery: false,
      recoveryData: null,
      lastCrashTime: null,
      crashCount: 0,
    });
  }, []);

  // Clear all recovery data
  const clearAllRecoveryData = useCallback(() => {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem(AUTO_SAVE_STORAGE_KEY);
    localStorage.removeItem('rtpt_inspector_crash_history');
    setRecoveryState({
      hasPendingRecovery: false,
      recoveryData: null,
      lastCrashTime: null,
      crashCount: 0,
    });
  }, []);

  // Get crash history for diagnostics
  const getCrashHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('rtpt_inspector_crash_history') || '[]');
    } catch {
      return [];
    }
  }, []);

  // Export recovery data for diagnostics
  const exportRecoveryData = useCallback(() => {
    return {
      recoveryState,
      snapshots: JSON.parse(localStorage.getItem(AUTO_SAVE_STORAGE_KEY) || '[]'),
      crashHistory: getCrashHistory(),
    };
  }, [recoveryState, getCrashHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  return {
    ...recoveryState,
    saveSnapshot,
    startAutoSave,
    stopAutoSave,
    markCrash,
    acceptRecovery,
    dismissRecovery,
    clearAllRecoveryData,
    getCrashHistory,
    exportRecoveryData,
  };
}

export default useCrashRecovery;

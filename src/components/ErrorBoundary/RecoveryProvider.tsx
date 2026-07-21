import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { ErrorRecoveryDialog } from './ErrorRecoveryDialog';
import { useCrashRecovery } from '@/hooks/useCrashRecovery';

interface RecoveryContextType {
  saveSnapshot: (data: unknown, context?: { route?: string; activeTab?: string }) => void;
  startAutoSave: (
    getData: () => unknown,
    context?: { route?: string; activeTab?: string },
  ) => (() => void) | undefined;
  stopAutoSave: () => void;
  exportDiagnostics: () => void;
}

const RecoveryContext = createContext<RecoveryContextType | null>(null);

// This hook intentionally shares the provider module to keep the recovery API cohesive.
// eslint-disable-next-line react-refresh/only-export-components
export function useRecovery() {
  const context = useContext(RecoveryContext);
  if (!context) {
    throw new Error('useRecovery must be used within RecoveryProvider');
  }
  return context;
}

interface RecoveryProviderProps {
  children: React.ReactNode;
  onRecover?: (data: unknown) => void;
}

export function RecoveryProvider({ children, onRecover }: RecoveryProviderProps) {
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  const {
    hasPendingRecovery,
    recoveryData,
    lastCrashTime,
    crashCount,
    saveSnapshot,
    startAutoSave,
    stopAutoSave,
    acceptRecovery,
    dismissRecovery,
    exportRecoveryData,
  } = useCrashRecovery({
    enabled: true,
    onRecover,
  });

  // Show recovery dialog if there's pending recovery
  useEffect(() => {
    if (hasPendingRecovery && recoveryData) {
      // Delay showing dialog to ensure app is mounted
      const timer = setTimeout(() => {
        setShowRecoveryDialog(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasPendingRecovery, recoveryData]);

  const handleRecover = useCallback(() => {
    acceptRecovery();
    setShowRecoveryDialog(false);
  }, [acceptRecovery]);

  const handleDismiss = useCallback(() => {
    dismissRecovery();
    setShowRecoveryDialog(false);
  }, [dismissRecovery]);

  const exportDiagnostics = useCallback(() => {
    try {
      const data = exportRecoveryData();
      const diagnostics = {
        ...data,
        exportedAt: new Date().toISOString(),
        systemInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          url: window.location.href,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        },
      };

      const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rtpt_inspector_diagnostics_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export diagnostics:', e);
    }
  }, [exportRecoveryData]);

  const contextValue: RecoveryContextType = {
    saveSnapshot,
    startAutoSave,
    stopAutoSave,
    exportDiagnostics,
  };

  return (
    <RecoveryContext.Provider value={contextValue}>
      {children}
      <ErrorRecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        recoveryData={recoveryData}
        crashCount={crashCount}
        lastCrashTime={lastCrashTime}
        onRecover={handleRecover}
        onDismiss={handleDismiss}
        onExportDiagnostics={exportDiagnostics}
      />
    </RecoveryContext.Provider>
  );
}

export default RecoveryProvider;

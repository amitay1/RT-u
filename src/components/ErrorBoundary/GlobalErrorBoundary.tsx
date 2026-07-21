import React, { Component, ErrorInfo, ReactNode, createContext, useContext } from 'react';
import { CrashErrorDialog } from './ErrorRecoveryDialog';
import { crashReporter } from '@/lib/crashReporter';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryContextType {
  reportError: (error: Error, componentStack?: string) => void;
  clearError: () => void;
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextType | null>(null);

// This hook intentionally shares the provider module to keep the recovery API cohesive.
// eslint-disable-next-line react-refresh/only-export-components
export function useErrorBoundary() {
  const context = useContext(ErrorBoundaryContext);
  if (!context) {
    throw new Error('useErrorBoundary must be used within GlobalErrorBoundary');
  }
  return context;
}

interface GlobalErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onExportDiagnostics?: () => void;
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GlobalErrorBoundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    // Report crash using crashReporter service
    crashReporter.reportCrash({
      type: 'crash',
      error,
      context: {
        route: window.location.pathname,
        componentStack: errorInfo.componentStack || undefined,
      },
    });

    // Mark that we have pending recovery
    this.markPendingRecovery();

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  markPendingRecovery() {
    try {
      const recoverySnapshots = JSON.parse(
        localStorage.getItem('rtpt_inspector_autosave') || '[]'
      );

      if (recoverySnapshots.length > 0) {
        const crashHistory = crashReporter.getCrashHistory();
        const recoveryState = {
          hasPendingRecovery: true,
          recoveryData: recoverySnapshots[0],
          lastCrashTime: new Date().toISOString(),
          crashCount: crashHistory.length,
        };
        localStorage.setItem('rtpt_inspector_crash_recovery', JSON.stringify(recoveryState));
      }
    } catch (e) {
      console.error('Failed to mark pending recovery:', e);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleExportDiagnostics = () => {
    if (this.props.onExportDiagnostics) {
      this.props.onExportDiagnostics();
    } else {
      this.defaultExportDiagnostics();
    }
  };

  defaultExportDiagnostics() {
    try {
      // Use crashReporter's downloadDiagnostics
      crashReporter.downloadDiagnostics();
    } catch (e) {
      console.error('Failed to export diagnostics:', e);
      alert('Failed to export diagnostics. Please contact support.');
    }
  }

  reportError = (error: Error, componentStack?: string) => {
    const errorInfo: ErrorInfo = {
      componentStack: componentStack || '',
    };
    this.componentDidCatch(error, errorInfo);
    this.setState({ hasError: true, error, errorInfo });
  };

  clearError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const contextValue: ErrorBoundaryContextType = {
      reportError: this.reportError,
      clearError: this.clearError,
    };

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background">
          <CrashErrorDialog
            open={true}
            error={this.state.error}
            componentStack={this.state.errorInfo?.componentStack}
            onReload={this.handleReload}
            onExportDiagnostics={this.handleExportDiagnostics}
          />
        </div>
      );
    }

    return (
      <ErrorBoundaryContext.Provider value={contextValue}>
        {this.props.children}
      </ErrorBoundaryContext.Provider>
    );
  }
}

export default GlobalErrorBoundary;

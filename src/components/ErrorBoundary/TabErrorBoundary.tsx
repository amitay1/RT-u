import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface TabErrorBoundaryProps {
  children: ReactNode;
  tabName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo, tabName?: string) => void;
  fallback?: ReactNode;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`TabErrorBoundary [${this.props.tabName || 'Unknown'}] caught an error:`, error, errorInfo);
    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.props.tabName);
    }

    // Log to crash history
    this.logTabCrash(error, errorInfo);
  }

  logTabCrash(error: Error, errorInfo: ErrorInfo) {
    try {
      const tabCrashInfo = {
        type: 'tab_crash',
        tabName: this.props.tabName || 'Unknown',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      };

      const history = JSON.parse(
        localStorage.getItem('rtpt_inspector_crash_history') || '[]'
      );
      history.unshift(tabCrashInfo);
      localStorage.setItem(
        'rtpt_inspector_crash_history',
        JSON.stringify(history.slice(0, 50))
      );
    } catch (e) {
      console.error('Failed to log tab crash:', e);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-muted/30 rounded-lg border border-dashed">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>

          <h3 className="text-lg font-semibold mb-2">
            {this.props.tabName ? `${this.props.tabName} Tab Error` : 'Tab Error'}
          </h3>

          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            Something went wrong in this section. Your other tabs are still working.
            You can try reloading this tab or continue working in other areas.
          </p>

          {this.state.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 max-w-md">
              <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <Button onClick={this.handleRetry} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier use with hooks
interface TabErrorBoundaryWrapperProps {
  children: ReactNode;
  tabName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo, tabName?: string) => void;
  fallback?: ReactNode;
}

// This HOC intentionally remains beside the boundary whose behavior it configures.
// eslint-disable-next-line react-refresh/only-export-components
export function withTabErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  tabName: string
) {
  return function WithTabErrorBoundary(props: P) {
    return (
      <TabErrorBoundary tabName={tabName}>
        <WrappedComponent {...props} />
      </TabErrorBoundary>
    );
  };
}

export default TabErrorBoundary;

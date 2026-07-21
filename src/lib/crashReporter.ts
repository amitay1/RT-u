/**
 * Crash Reporter - Enterprise-grade error tracking and reporting
 *
 * Features:
 * - Automatic crash detection and logging
 * - Local storage of crash reports (last 50)
 * - Export functionality for USB transfer
 * - System information collection
 * - Privacy-respecting (no PII in reports)
 */

export interface CrashReport {
  id: string;
  timestamp: string;
  type: 'crash' | 'error' | 'unhandled_rejection' | 'tab_crash';
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  context: {
    route: string;
    activeTab?: string;
    userAction?: string;
    componentStack?: string;
  };
  systemInfo: {
    platform: string;
    userAgent: string;
    language: string;
    appVersion: string;
    electronVersion?: string;
    screenSize: string;
    viewportSize: string;
    memoryUsage?: number;
    onLine: boolean;
  };
  factoryInfo: {
    machineId?: string;
    factoryId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface DiagnosticsExport {
  exportedAt: string;
  appVersion: string;
  crashes: CrashReport[];
  systemInfo: CrashReport['systemInfo'];
  settings?: Record<string, unknown>;
  recentActivity?: string[];
}

const CRASH_HISTORY_KEY = 'rtpt_inspector_crash_history';
const MAX_CRASH_REPORTS = 50;
const APP_VERSION = '1.0.102'; // Should be imported from package.json in production

class CrashReporterService {
  private static instance: CrashReporterService;
  private isInitialized = false;
  private machineId?: string;
  private factoryId?: string;

  private constructor() {}

  static getInstance(): CrashReporterService {
    if (!CrashReporterService.instance) {
      CrashReporterService.instance = new CrashReporterService();
    }
    return CrashReporterService.instance;
  }

  /**
   * Initialize the crash reporter
   */
  initialize(options?: { machineId?: string; factoryId?: string }) {
    if (this.isInitialized) return;

    this.machineId = options?.machineId;
    this.factoryId = options?.factoryId;

    // Set up global error handlers
    this.setupGlobalHandlers();

    this.isInitialized = true;
    console.log('CrashReporter initialized');
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalHandlers() {
    // Handle uncaught errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.reportCrash({
        type: 'error',
        error: error || new Error(String(message)),
        context: {
          route: window.location.pathname,
          userAction: `Error at ${source}:${lineno}:${colno}`,
        },
      });
      return false; // Don't prevent default handling
    };

    // Handle unhandled promise rejections
    window.onunhandledrejection = (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      this.reportCrash({
        type: 'unhandled_rejection',
        error,
        context: {
          route: window.location.pathname,
        },
      });
    };
  }

  /**
   * Report a crash/error
   */
  reportCrash(options: {
    type: CrashReport['type'];
    error: Error;
    context?: Partial<CrashReport['context']>;
    metadata?: Record<string, unknown>;
  }): string {
    const { type, error, context, metadata } = options;

    const report: CrashReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context: {
        route: context?.route || window.location.pathname,
        activeTab: context?.activeTab,
        userAction: context?.userAction,
        componentStack: context?.componentStack,
      },
      systemInfo: this.collectSystemInfo(),
      factoryInfo: {
        machineId: this.machineId,
        factoryId: this.factoryId,
      },
      metadata,
    };

    this.saveCrashReport(report);
    console.error('Crash reported:', report.id, error.message);

    return report.id;
  }

  /**
   * Collect system information
   */
  private collectSystemInfo(): CrashReport['systemInfo'] {
    const isElectron = !!(window as unknown as { electronAPI?: unknown }).electronAPI;

    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      appVersion: APP_VERSION,
      electronVersion: isElectron ? 'electron' : undefined,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
      onLine: navigator.onLine,
    };
  }

  /**
   * Save crash report to localStorage
   */
  private saveCrashReport(report: CrashReport) {
    try {
      const history = this.getCrashHistory();
      history.unshift(report);

      // Keep only the last MAX_CRASH_REPORTS
      const trimmed = history.slice(0, MAX_CRASH_REPORTS);

      localStorage.setItem(CRASH_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save crash report:', e);
    }
  }

  /**
   * Get crash history
   */
  getCrashHistory(): CrashReport[] {
    try {
      const stored = localStorage.getItem(CRASH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get crash count
   */
  getCrashCount(): number {
    return this.getCrashHistory().length;
  }

  /**
   * Get crashes by type
   */
  getCrashesByType(type: CrashReport['type']): CrashReport[] {
    return this.getCrashHistory().filter(crash => crash.type === type);
  }

  /**
   * Get recent crashes (last 24 hours)
   */
  getRecentCrashes(): CrashReport[] {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.getCrashHistory().filter(
      crash => new Date(crash.timestamp).getTime() > oneDayAgo
    );
  }

  /**
   * Clear crash history
   */
  clearCrashHistory() {
    localStorage.removeItem(CRASH_HISTORY_KEY);
  }

  /**
   * Export diagnostics for USB transfer
   */
  exportDiagnostics(options?: {
    includeSettings?: boolean;
    includeRecentActivity?: boolean;
  }): DiagnosticsExport {
    const crashes = this.getCrashHistory();

    const diagnostics: DiagnosticsExport = {
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      crashes,
      systemInfo: this.collectSystemInfo(),
    };

    if (options?.includeSettings) {
      try {
        const settings = localStorage.getItem('rtpt_inspector_settings');
        if (settings) {
          diagnostics.settings = JSON.parse(settings);
        }
      } catch {
        // Ignore settings parsing errors
      }
    }

    if (options?.includeRecentActivity) {
      diagnostics.recentActivity = this.getRecentActivityLog();
    }

    return diagnostics;
  }

  /**
   * Download diagnostics as JSON file
   */
  downloadDiagnostics(filename?: string) {
    const diagnostics = this.exportDiagnostics({
      includeSettings: true,
      includeRecentActivity: true,
    });

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `rtpt_inspector_diagnostics_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get recent activity log from localStorage
   */
  private getRecentActivityLog(): string[] {
    try {
      const log = localStorage.getItem('rtpt_inspector_activity_log');
      return log ? JSON.parse(log) : [];
    } catch {
      return [];
    }
  }

  /**
   * Log user activity (for diagnostics)
   */
  logActivity(action: string) {
    try {
      const log = this.getRecentActivityLog();
      const entry = `${new Date().toISOString()}: ${action}`;
      log.unshift(entry);

      // Keep only last 100 activities
      const trimmed = log.slice(0, 100);
      localStorage.setItem('rtpt_inspector_activity_log', JSON.stringify(trimmed));
    } catch {
      // Ignore logging errors
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set factory information
   */
  setFactoryInfo(machineId: string, factoryId: string) {
    this.machineId = machineId;
    this.factoryId = factoryId;
  }

  /**
   * Check if there are critical crashes that need attention
   */
  hasCriticalCrashes(): boolean {
    const recentCrashes = this.getRecentCrashes();
    return recentCrashes.length >= 3;
  }

  /**
   * Get a summary of crash statistics
   */
  getCrashStats(): {
    total: number;
    last24Hours: number;
    byType: Record<string, number>;
    lastCrash: string | null;
  } {
    const history = this.getCrashHistory();
    const recentCrashes = this.getRecentCrashes();

    const byType: Record<string, number> = {};
    for (const crash of history) {
      byType[crash.type] = (byType[crash.type] || 0) + 1;
    }

    return {
      total: history.length,
      last24Hours: recentCrashes.length,
      byType,
      lastCrash: history[0]?.timestamp || null,
    };
  }
}

// Export singleton instance
export const crashReporter = CrashReporterService.getInstance();

// Export convenience functions
export const reportCrash = crashReporter.reportCrash.bind(crashReporter);
export const getCrashHistory = crashReporter.getCrashHistory.bind(crashReporter);
export const downloadDiagnostics = crashReporter.downloadDiagnostics.bind(crashReporter);
export const logActivity = crashReporter.logActivity.bind(crashReporter);

export default crashReporter;

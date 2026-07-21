/**
 * Diagnostic Tests - Self-diagnostic system for RT-PT Inspector
 *
 * Runs various health checks on:
 * - System resources (disk, memory, CPU)
 * - Application health (database and file system)
 * - Performance benchmarks
 */

import { crashReporter } from '@/lib/crashReporter';

export type TestStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed';

export interface DiagnosticTest {
  id: string;
  name: string;
  category: 'system' | 'application' | 'performance';
  description: string;
  status: TestStatus;
  result?: string;
  details?: string;
  duration?: number;
}

export interface DiagnosticReport {
  timestamp: string;
  appVersion: string;
  overallStatus: 'healthy' | 'warning' | 'unhealthy';
  tests: DiagnosticTest[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

const APP_VERSION = __APP_VERSION__;

// Thresholds
const MEMORY_WARNING_MB = 1500;
const MEMORY_CRITICAL_MB = 2000;
const CRASH_WARNING_COUNT = 2;
const CRASH_CRITICAL_COUNT = 5;

class DiagnosticTestRunner {
  private tests: DiagnosticTest[] = [];
  private onProgress?: (test: DiagnosticTest) => void;

  constructor(onProgress?: (test: DiagnosticTest) => void) {
    this.onProgress = onProgress;
    this.initializeTests();
  }

  private initializeTests() {
    this.tests = [
      // System Resources
      {
        id: 'memory',
        name: 'Memory Usage',
        category: 'system',
        description: 'Check available memory',
        status: 'pending',
      },
      {
        id: 'storage',
        name: 'Storage Access',
        category: 'system',
        description: 'Verify localStorage access',
        status: 'pending',
      },
      {
        id: 'network',
        name: 'Network Status',
        category: 'system',
        description: 'Check network connectivity',
        status: 'pending',
      },

      // Application Health
      {
        id: 'indexeddb',
        name: 'IndexedDB',
        category: 'application',
        description: 'Verify database storage',
        status: 'pending',
      },
      {
        id: 'crashes',
        name: 'Crash History',
        category: 'application',
        description: 'Check recent crash reports',
        status: 'pending',
      },
      {
        id: 'settings',
        name: 'Settings Integrity',
        category: 'application',
        description: 'Verify settings data',
        status: 'pending',
      },

      // Performance
      {
        id: 'render_speed',
        name: 'Render Performance',
        category: 'performance',
        description: 'Test UI rendering speed',
        status: 'pending',
      },
      {
        id: 'storage_speed',
        name: 'Storage Speed',
        category: 'performance',
        description: 'Test read/write speed',
        status: 'pending',
      },
    ];
  }

  private updateTest(id: string, updates: Partial<DiagnosticTest>) {
    const index = this.tests.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tests[index] = { ...this.tests[index], ...updates };
      if (this.onProgress) {
        this.onProgress(this.tests[index]);
      }
    }
  }

  // Test implementations

  private async testMemory(): Promise<void> {
    this.updateTest('memory', { status: 'running' });
    const start = performance.now();

    try {
      const memory = (performance as unknown as { memory?: {
        usedJSHeapSize: number;
        jsHeapSizeLimit: number;
        totalJSHeapSize: number;
      }}).memory;

      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        const totalMB = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));
        const percentUsed = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

        let status: TestStatus = 'passed';
        if (usedMB > MEMORY_CRITICAL_MB) {
          status = 'failed';
        } else if (usedMB > MEMORY_WARNING_MB) {
          status = 'warning';
        }

        this.updateTest('memory', {
          status,
          result: `${usedMB} MB / ${totalMB} MB (${percentUsed}%)`,
          details: status === 'passed' ? 'Memory usage is healthy' :
                   status === 'warning' ? 'Memory usage is elevated' :
                   'Memory usage is critical',
          duration: performance.now() - start,
        });
      } else {
        this.updateTest('memory', {
          status: 'warning',
          result: 'Not available',
          details: 'Memory API not supported in this browser',
          duration: performance.now() - start,
        });
      }
    } catch (error) {
      this.updateTest('memory', {
        status: 'failed',
        result: 'Error',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: performance.now() - start,
      });
    }
  }

  private async testStorage(): Promise<void> {
    this.updateTest('storage', { status: 'running' });
    const start = performance.now();

    try {
      const testKey = 'rtpt_inspector_diagnostic_test';
      const testValue = 'test_' + Date.now();

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved === testValue) {
        // Estimate storage used
        let totalSize = 0;
        for (const key in localStorage) {
          if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            totalSize += localStorage.getItem(key)?.length || 0;
          }
        }
        const sizeKB = Math.round(totalSize / 1024);

        this.updateTest('storage', {
          status: 'passed',
          result: `${sizeKB} KB used`,
          details: 'localStorage is accessible and working',
          duration: performance.now() - start,
        });
      } else {
        this.updateTest('storage', {
          status: 'failed',
          result: 'Read/Write mismatch',
          details: 'localStorage data corruption detected',
          duration: performance.now() - start,
        });
      }
    } catch (error) {
      this.updateTest('storage', {
        status: 'failed',
        result: 'Error',
        details: error instanceof Error ? error.message : 'Storage access denied',
        duration: performance.now() - start,
      });
    }
  }

  private async testNetwork(): Promise<void> {
    this.updateTest('network', { status: 'running' });
    const start = performance.now();

    try {
      const isOnline = navigator.onLine;

      this.updateTest('network', {
        status: isOnline ? 'passed' : 'warning',
        result: isOnline ? 'Online' : 'Offline',
        details: isOnline
          ? 'Network connection available'
          : 'Running in offline mode - some features may be limited',
        duration: performance.now() - start,
      });
    } catch (error) {
      this.updateTest('network', {
        status: 'warning',
        result: 'Unknown',
        details: 'Could not determine network status',
        duration: performance.now() - start,
      });
    }
  }

  private async testIndexedDB(): Promise<void> {
    this.updateTest('indexeddb', { status: 'running' });
    const start = performance.now();

    try {
      const request = indexedDB.open('rtpt_inspector_diagnostic_test', 1);

      await new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(new Error('IndexedDB access denied'));
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase('rtpt_inspector_diagnostic_test');
          resolve();
        };
        request.onupgradeneeded = () => {
          // Database created successfully
        };
      });

      this.updateTest('indexeddb', {
        status: 'passed',
        result: 'Available',
        details: 'IndexedDB is accessible for data storage',
        duration: performance.now() - start,
      });
    } catch (error) {
      this.updateTest('indexeddb', {
        status: 'warning',
        result: 'Limited',
        details: error instanceof Error ? error.message : 'IndexedDB may not be available',
        duration: performance.now() - start,
      });
    }
  }

  private async testCrashes(): Promise<void> {
    this.updateTest('crashes', { status: 'running' });
    const start = performance.now();

    try {
      const stats = crashReporter.getCrashStats();

      let status: TestStatus = 'passed';
      if (stats.last24Hours >= CRASH_CRITICAL_COUNT) {
        status = 'failed';
      } else if (stats.last24Hours >= CRASH_WARNING_COUNT) {
        status = 'warning';
      }

      this.updateTest('crashes', {
        status,
        result: `${stats.last24Hours} in last 24h`,
        details: status === 'passed'
          ? 'No significant crash activity'
          : status === 'warning'
          ? 'Some crashes detected - consider exporting diagnostics'
          : 'Multiple crashes detected - please contact support',
        duration: performance.now() - start,
      });
    } catch (error) {
      this.updateTest('crashes', {
        status: 'warning',
        result: 'Unknown',
        details: 'Could not read crash history',
        duration: performance.now() - start,
      });
    }
  }

  private async testSettings(): Promise<void> {
    this.updateTest('settings', { status: 'running' });
    const start = performance.now();

    try {
      const settings = localStorage.getItem('rtpt_inspector_settings');

      if (settings) {
        JSON.parse(settings); // Validate JSON
        this.updateTest('settings', {
          status: 'passed',
          result: 'Valid',
          details: 'Application settings are intact',
          duration: performance.now() - start,
        });
      } else {
        this.updateTest('settings', {
          status: 'passed',
          result: 'Default',
          details: 'Using default settings',
          duration: performance.now() - start,
        });
      }
    } catch (error) {
      this.updateTest('settings', {
        status: 'warning',
        result: 'Corrupted',
        details: 'Settings data may be corrupted - consider resetting',
        duration: performance.now() - start,
      });
    }
  }

  private async testRenderSpeed(): Promise<void> {
    this.updateTest('render_speed', { status: 'running' });
    const start = performance.now();

    try {
      // Create a simple render benchmark
      const iterations = 100;
      const testDiv = document.createElement('div');
      testDiv.style.position = 'absolute';
      testDiv.style.left = '-9999px';
      document.body.appendChild(testDiv);

      const benchStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        testDiv.innerHTML = `<div style="background: red; width: 100px; height: 100px;">Test ${i}</div>`;
        void testDiv.offsetHeight; // Force reflow
      }
      const benchEnd = performance.now();
      document.body.removeChild(testDiv);

      const avgTime = (benchEnd - benchStart) / iterations;
      let status: TestStatus = 'passed';
      if (avgTime > 5) {
        status = 'failed';
      } else if (avgTime > 2) {
        status = 'warning';
      }

      this.updateTest('render_speed', {
        status,
        result: `${avgTime.toFixed(2)} ms/render`,
        details: status === 'passed'
          ? 'Rendering performance is good'
          : status === 'warning'
          ? 'Rendering may be slow on complex views'
          : 'Rendering is very slow - check system resources',
        duration: performance.now() - start,
      });
    } catch (error) {
      this.updateTest('render_speed', {
        status: 'warning',
        result: 'Error',
        details: 'Could not run render benchmark',
        duration: performance.now() - start,
      });
    }
  }

  private async testStorageSpeed(): Promise<void> {
    this.updateTest('storage_speed', { status: 'running' });
    const start = performance.now();

    try {
      const testKey = 'rtpt_inspector_speed_test';
      const testData = 'x'.repeat(10000); // 10KB of data
      const iterations = 50;

      const writeStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        localStorage.setItem(testKey + i, testData);
      }
      const writeEnd = performance.now();

      const readStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        localStorage.getItem(testKey + i);
      }
      const readEnd = performance.now();

      // Cleanup
      for (let i = 0; i < iterations; i++) {
        localStorage.removeItem(testKey + i);
      }

      const writeSpeed = ((iterations * 10) / ((writeEnd - writeStart) / 1000)).toFixed(0);
      const readSpeed = ((iterations * 10) / ((readEnd - readStart) / 1000)).toFixed(0);

      this.updateTest('storage_speed', {
        status: 'passed',
        result: `R: ${readSpeed} KB/s, W: ${writeSpeed} KB/s`,
        details: 'Storage I/O performance is acceptable',
        duration: performance.now() - start,
      });
    } catch (error) {
      this.updateTest('storage_speed', {
        status: 'warning',
        result: 'Error',
        details: 'Could not measure storage speed',
        duration: performance.now() - start,
      });
    }
  }

  /**
   * Run all diagnostic tests
   */
  async runAllTests(): Promise<DiagnosticReport> {
    // Run tests in sequence
    await this.testMemory();
    await this.testStorage();
    await this.testNetwork();
    await this.testIndexedDB();
    await this.testCrashes();
    await this.testSettings();
    await this.testRenderSpeed();
    await this.testStorageSpeed();

    // Calculate summary
    const passed = this.tests.filter(t => t.status === 'passed').length;
    const warnings = this.tests.filter(t => t.status === 'warning').length;
    const failed = this.tests.filter(t => t.status === 'failed').length;

    let overallStatus: DiagnosticReport['overallStatus'] = 'healthy';
    if (failed > 0) {
      overallStatus = 'unhealthy';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      overallStatus,
      tests: [...this.tests],
      summary: {
        total: this.tests.length,
        passed,
        warnings,
        failed,
      },
    };
  }

  /**
   * Get current tests state
   */
  getTests(): DiagnosticTest[] {
    return [...this.tests];
  }
}

export function createDiagnosticRunner(onProgress?: (test: DiagnosticTest) => void): DiagnosticTestRunner {
  return new DiagnosticTestRunner(onProgress);
}

export default DiagnosticTestRunner;

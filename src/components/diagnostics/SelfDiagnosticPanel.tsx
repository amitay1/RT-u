import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Play,
  Download,
  Cpu,
  HardDrive,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import {
  createDiagnosticRunner,
  type DiagnosticTest,
  type DiagnosticReport,
} from '@/utils/diagnostics/DiagnosticTests';
import { cn } from '@/lib/utils';

interface SelfDiagnosticPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  system: <Cpu className="h-4 w-4" />,
  application: <HardDrive className="h-4 w-4" />,
  performance: <Gauge className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  system: 'System Resources',
  application: 'Application Health',
  performance: 'Performance',
};

function TestStatusIcon({ status }: { status: DiagnosticTest['status'] }) {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'passed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

function OverallStatusBadge({ status }: { status: DiagnosticReport['overallStatus'] }) {
  const styles = {
    healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const icons = {
    healthy: <CheckCircle2 className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    unhealthy: <XCircle className="h-5 w-5" />,
  };

  const labels = {
    healthy: 'All Systems Healthy',
    warning: 'Some Issues Detected',
    unhealthy: 'Problems Found',
  };

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2 rounded-lg', styles[status])}>
      {icons[status]}
      <span className="font-medium">{labels[status]}</span>
    </div>
  );
}

export function SelfDiagnosticPanel({ open, onOpenChange }: SelfDiagnosticPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const handleProgress = useCallback((updatedTest: DiagnosticTest) => {
    setTests(prev => {
      const index = prev.findIndex(t => t.id === updatedTest.id);
      if (index !== -1) {
        const newTests = [...prev];
        newTests[index] = updatedTest;
        return newTests;
      }
      return [...prev, updatedTest];
    });
  }, []);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setReport(null);

    const runner = createDiagnosticRunner(handleProgress);
    setTests(runner.getTests());

    try {
      const result = await runner.runAllTests();
      setReport(result);
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [handleProgress]);

  const exportReport = useCallback(() => {
    if (!report) return;

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rtpt-inspector-diagnostic-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  // Group tests by category
  const testsByCategory = tests.reduce<Record<string, DiagnosticTest[]>>((acc, test) => {
    if (!acc[test.category]) {
      acc[test.category] = [];
    }
    acc[test.category].push(test);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Stethoscope className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
            <div>
              <DialogTitle>System Diagnostics</DialogTitle>
              <DialogDescription>
                Run health checks on your RT Inspector installation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Initial state - no tests run yet */}
        {tests.length === 0 && !isRunning && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Stethoscope className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Ready to Run Diagnostics</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This will check your system resources, application health,
                storage, and performance.
              </p>
            </div>
            <Button onClick={runDiagnostics} size="lg" className="mt-4">
              <Play className="h-4 w-4 mr-2" />
              Run Diagnostics
            </Button>
          </div>
        )}

        {/* Running or completed state */}
        {(tests.length > 0 || isRunning) && (
          <>
            {/* Overall status */}
            {report && (
              <div className="flex justify-center mb-4">
                <OverallStatusBadge status={report.overallStatus} />
              </div>
            )}

            {/* Summary stats */}
            {report && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-lg font-bold">{report.summary.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="text-lg font-bold text-green-600">{report.summary.passed}</div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
                <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                  <div className="text-lg font-bold text-amber-600">{report.summary.warnings}</div>
                  <div className="text-xs text-muted-foreground">Warnings</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-lg font-bold text-red-600">{report.summary.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            )}

            {/* Test results */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {Object.entries(testsByCategory).map(([category, categoryTests]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      {categoryIcons[category]}
                      <span className="font-medium text-sm">{categoryLabels[category]}</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {categoryTests.map(test => (
                        <div
                          key={test.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg',
                            test.status === 'failed' && 'bg-red-50 dark:bg-red-900/10',
                            test.status === 'warning' && 'bg-amber-50 dark:bg-amber-900/10',
                            test.status === 'passed' && 'bg-green-50/50 dark:bg-green-900/5',
                            (test.status === 'pending' || test.status === 'running') && 'bg-muted/30'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <TestStatusIcon status={test.status} />
                            <div>
                              <div className="text-sm font-medium">{test.name}</div>
                              {test.details && test.status !== 'pending' && (
                                <div className="text-xs text-muted-foreground">{test.details}</div>
                              )}
                            </div>
                          </div>
                          {test.result && test.status !== 'pending' && test.status !== 'running' && (
                            <div className="text-sm font-mono text-muted-foreground">
                              {test.result}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2">
          {report && (
            <>
              <Button variant="outline" onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" onClick={runDiagnostics} disabled={isRunning}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isRunning && 'animate-spin')} />
                Run Again
              </Button>
            </>
          )}
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SelfDiagnosticPanel;

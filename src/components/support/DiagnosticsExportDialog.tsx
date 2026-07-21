import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Download,
  HardDrive,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Cpu,
  MemoryStick,
  Clock,
} from 'lucide-react';
import {
  diagnosticsCollector,
  getDiagnosticsSummary,
} from '@/utils/diagnostics/DiagnosticsCollector';

interface DiagnosticsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DiagnosticsSummary {
  systemStatus: 'good' | 'warning' | 'error';
  crashesLast24h: number;
  memoryUsage: string;
  diskSpace: string;
}

export function DiagnosticsExportDialog({
  open,
  onOpenChange,
}: DiagnosticsExportDialogProps) {
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeActivityLog, setIncludeActivityLog] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      const s = getDiagnosticsSummary();
      setSummary(s);
      setExportSuccess(false);
    }
  }, [open]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));

      diagnosticsCollector.exportAsJson();
      setExportSuccess(true);

      // Close dialog after delay
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
            <div>
              <DialogTitle>Export Diagnostics</DialogTitle>
              <DialogDescription>
                Export system and application diagnostics for support
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {exportSuccess ? (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Export Complete!</h3>
              <p className="text-sm text-muted-foreground">
                The diagnostics file has been downloaded.
                <br />
                You can copy it to a USB drive for support.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* System Status Summary */}
            {summary && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm mb-2">System Status</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.systemStatus)}
                    <span className="text-sm">
                      {summary.systemStatus === 'good' ? 'Healthy' :
                       summary.systemStatus === 'warning' ? 'Warning' : 'Issues Detected'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{summary.memoryUsage}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {summary.crashesLast24h} crash{summary.crashesLast24h !== 1 ? 'es' : ''} (24h)
                    </span>
                  </div>
                </div>

                {summary.crashesLast24h >= 3 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Multiple crashes detected. Please export diagnostics and contact support.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Export Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Include in Export</h4>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-settings"
                    checked={includeSettings}
                    onCheckedChange={(checked) => setIncludeSettings(!!checked)}
                  />
                  <Label htmlFor="include-settings" className="text-sm cursor-pointer">
                    Application settings
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-activity"
                    checked={includeActivityLog}
                    onCheckedChange={(checked) => setIncludeActivityLog(!!checked)}
                  />
                  <Label htmlFor="include-activity" className="text-sm cursor-pointer">
                    Recent activity log
                  </Label>
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
              <strong>Privacy:</strong> The export does not include personal information,
              inspection data, or customer details. Only system configuration and error
              logs are included.
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Cpu className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export to File
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DiagnosticsExportDialog;

import React, { useState, useEffect, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Usb,
  FolderOpen,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  RefreshCw,
  FileText,
  Shield,
  HardDrive,
  Calendar,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Type definitions for the electron API
interface UpdatePackageInfo {
  id: string;
  version: string;
  isNewer: boolean;
  releaseDate: string;
  changelog: string;
  size: number;
  actualSize?: number;
  minVersion?: string;
  platform: string;
  installerMissing?: boolean;
}

interface ScanResult {
  found: boolean;
  packages: UpdatePackageInfo[];
  errors: string[];
}

interface ValidationResult {
  valid: boolean;
  checks: {
    version: { valid: boolean; message: string };
    platform: { valid: boolean; message: string };
    installer: { valid: boolean; message: string };
    checksum: { valid: boolean; message: string };
    signature: { valid: boolean; message: string; skipped: boolean };
  };
  errors: string[];
}

interface OfflineUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'browse' | 'scanning' | 'select' | 'validating' | 'ready' | 'installing' | 'complete' | 'error';

// Get electron API with type safety
const getElectronAPI = () => {
  const win = window as unknown as { electron?: {
    offlineUpdate: {
      browse: () => Promise<{ cancelled?: boolean; path?: string }>;
      scan: (path: string) => Promise<ScanResult>;
      validate: (packageId: string) => Promise<ValidationResult>;
      install: (packageId: string, options: { silent?: boolean; autoRestart?: boolean }) => Promise<{ success: boolean; error?: string; message?: string }>;
      getDisplayInfo: (packageId: string) => Promise<{
        version: string;
        currentVersion: string;
        isNewer: boolean;
        releaseDate: string;
        changelog: string;
        size: string;
        platform: string;
      }>;
      getCurrentVersion: () => Promise<string>;
      onProgress: (callback: (progress: { stage: string; percent: number; message: string }) => void) => void;
      removeProgressListener: () => void;
    };
    isElectron: boolean;
  }};
  return win.electron;
};

export function OfflineUpdateDialog({ open, onOpenChange }: OfflineUpdateDialogProps) {
  const [stage, setStage] = useState<Stage>('browse');
  const [scanPath, setScanPath] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<UpdatePackageInfo | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  const electron = getElectronAPI();
  const offlineUpdate = electron?.offlineUpdate;
  const isElectronAvailable = !!offlineUpdate;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStage('browse');
      setScanPath('');
      setScanResult(null);
      setSelectedPackage(null);
      setValidation(null);
      setProgress({ percent: 0, message: '' });
      setError(null);

      // Get current version
      if (offlineUpdate) {
        offlineUpdate.getCurrentVersion().then(setCurrentVersion);
      }
    }
  }, [offlineUpdate, open]);

  // Setup progress listener
  useEffect(() => {
    if (!offlineUpdate) return;

    offlineUpdate.onProgress((prog) => {
      setProgress({ percent: prog.percent, message: prog.message });
    });

    return () => {
      offlineUpdate.removeProgressListener();
    };
  }, [offlineUpdate]);

  const handleBrowse = useCallback(async () => {
    if (!offlineUpdate) return;

    try {
      const result = await offlineUpdate.browse();
      if (result.cancelled || !result.path) return;

      setScanPath(result.path);
      setStage('scanning');
      setProgress({ percent: 0, message: 'Scanning for update packages...' });

      const scanResult = await offlineUpdate.scan(result.path);
      setScanResult(scanResult);

      if (scanResult.found && scanResult.packages.length > 0) {
        setStage('select');
      } else {
        setError('No valid update packages found in the selected folder.');
        setStage('error');
      }
    } catch (err) {
      setError(`Failed to scan: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
    }
  }, [offlineUpdate]);

  const handleSelectPackage = useCallback(async (pkg: UpdatePackageInfo) => {
    if (!offlineUpdate) return;

    setSelectedPackage(pkg);
    setStage('validating');
    setProgress({ percent: 0, message: 'Validating update package...' });

    try {
      const validationResult = await offlineUpdate.validate(pkg.id);
      setValidation(validationResult);

      if (validationResult.valid) {
        setStage('ready');
      } else {
        setError(`Validation failed: ${validationResult.errors.join(', ')}`);
        setStage('error');
      }
    } catch (err) {
      setError(`Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
    }
  }, [offlineUpdate]);

  const handleInstall = useCallback(async () => {
    if (!offlineUpdate || !selectedPackage) return;

    setStage('installing');
    setProgress({ percent: 0, message: 'Starting installation...' });

    try {
      const result = await offlineUpdate.install(selectedPackage.id, {
        silent: false,
        autoRestart: true,
      });

      if (result.success) {
        setStage('complete');
      } else {
        setError(result.error || 'Installation failed');
        setStage('error');
      }
    } catch (err) {
      setError(`Installation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage('error');
    }
  }, [offlineUpdate, selectedPackage]);

  const handleRetry = useCallback(() => {
    setStage('browse');
    setError(null);
    setScanResult(null);
    setSelectedPackage(null);
    setValidation(null);
  }, []);

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Render check item
  const renderCheck = (label: string, check: { valid: boolean; message: string; skipped?: boolean }) => (
    <div className="flex items-center gap-2 py-1">
      {check.skipped ? (
        <Info className="h-4 w-4 text-muted-foreground" />
      ) : check.valid ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="font-medium">{label}:</span>
      <span className={cn(
        'text-sm',
        check.skipped ? 'text-muted-foreground' : check.valid ? 'text-green-600' : 'text-red-600'
      )}>
        {check.message}
      </span>
    </div>
  );

  if (!isElectronAvailable) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Usb className="h-5 w-5" />
              USB Update
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <p className="text-muted-foreground">
              USB updates are only available in the desktop application.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Usb className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            </div>
            <div>
              <DialogTitle>Install Update from USB</DialogTitle>
              <DialogDescription>
                {currentVersion && `Current version: ${currentVersion}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Browse Stage */}
        {stage === 'browse' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Select Update Location</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Browse to the USB drive or folder containing the update package.
              </p>
            </div>
            <Button onClick={handleBrowse} size="lg" className="mt-4">
              <FolderOpen className="h-4 w-4 mr-2" />
              Browse for Update
            </Button>
          </div>
        )}

        {/* Scanning Stage */}
        {stage === 'scanning' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Scanning...</h3>
              <p className="text-sm text-muted-foreground">{scanPath}</p>
            </div>
          </div>
        )}

        {/* Select Package Stage */}
        {stage === 'select' && scanResult && (
          <>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Found {scanResult.packages.length} update package(s)
              </p>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {scanResult.packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      pkg.isNewer ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10' : 'border-border'
                    )}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Package className={cn(
                          'h-8 w-8',
                          pkg.isNewer ? 'text-green-600' : 'text-muted-foreground'
                        )} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">v{pkg.version}</span>
                            {pkg.isNewer && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">
                                Newer
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {pkg.releaseDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {formatBytes(pkg.actualSize || pkg.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Select
                      </Button>
                    </div>
                    {pkg.changelog && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {pkg.changelog}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {scanResult.errors.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">Warnings:</p>
                {scanResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-amber-600 dark:text-amber-500">{err}</p>
                ))}
              </div>
            )}
          </>
        )}

        {/* Validating Stage */}
        {stage === 'validating' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Validating Package</h3>
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
            <Progress value={progress.percent} className="w-64" />
          </div>
        )}

        {/* Ready Stage */}
        {stage === 'ready' && selectedPackage && validation && (
          <>
            <div className="space-y-4">
              {/* Package Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-lg">
                      Version {selectedPackage.version}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ready to install
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Results */}
              <div className="p-4 rounded-lg border">
                <p className="font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Validation Results
                </p>
                {renderCheck('Version', validation.checks.version)}
                {renderCheck('Platform', validation.checks.platform)}
                {renderCheck('Installer', validation.checks.installer)}
                {renderCheck('Checksum', validation.checks.checksum)}
                {renderCheck('Signature', validation.checks.signature)}
              </div>

              {/* Changelog */}
              {selectedPackage.changelog && (
                <div className="p-4 rounded-lg border">
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    What's New
                  </p>
                  <ScrollArea className="h-24">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedPackage.changelog}
                    </p>
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                The application will restart after installation.
              </p>
            </div>
          </>
        )}

        {/* Installing Stage */}
        {stage === 'installing' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Installing Update</h3>
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
            <Progress value={progress.percent} className="w-64" />
            <p className="text-xs text-muted-foreground">Please wait...</p>
          </div>
        )}

        {/* Complete Stage */}
        {stage === 'complete' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Update Started</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                The installer has been launched. The application will restart automatically.
              </p>
            </div>
          </div>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-1">Update Failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400 max-w-sm">
                {error}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {stage === 'select' && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Browse Again
            </Button>
          )}
          {stage === 'ready' && (
            <>
              <Button variant="outline" onClick={handleRetry}>
                Cancel
              </Button>
              <Button onClick={handleInstall}>
                <Download className="h-4 w-4 mr-2" />
                Install Update
              </Button>
            </>
          )}
          {stage === 'error' && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          {(stage === 'browse' || stage === 'complete' || stage === 'error') && (
            <Button variant="default" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OfflineUpdateDialog;

import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Wifi, WifiOff, Cloud, CloudOff, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface StatusBarProps {
  completionPercent: number;
  requiredFieldsComplete: number;
  totalRequiredFields: number;
  autoSaveStatus?: AutoSaveStatus;
  lastSaved?: Date | null;
  completionLabel?: string;
}

export const StatusBar = ({
  completionPercent,
  requiredFieldsComplete,
  totalRequiredFields,
  autoSaveStatus = "idle",
  lastSaved,
  completionLabel = "Required technique fields",
}: StatusBarProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [appVersion, setAppVersion] = useState(`v${__APP_VERSION__}`);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    window.electron?.getAppVersion?.()
      .then((version) => {
        if (mounted && version) {
          setAppVersion(`v${version}`);
        }
      })
      .catch(() => {
        // Keep the build-time fallback when Electron is unavailable.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getAutoSaveDisplay = () => {
    switch (autoSaveStatus) {
      case "pending":
        return {
          icon: <Cloud className="h-4 w-4 text-muted-foreground" />,
          text: "Changes pending...",
          color: "text-muted-foreground",
        };
      case "saving":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
          text: "Saving...",
          color: "text-primary",
        };
      case "saved":
        return {
          icon: <Cloud className="h-4 w-4 text-success" />,
          text: lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : "Saved",
          color: "text-success",
        };
      case "error":
        return {
          icon: <CloudOff className="h-4 w-4 text-destructive" />,
          text: "Save failed",
          color: "text-destructive",
        };
      default:
        return null;
    }
  };

  const autoSaveDisplay = getAutoSaveDisplay();
  const progressStateLabel =
    completionPercent >= 100 ? "Fields complete" : completionPercent >= 75 ? "Almost complete" : completionPercent > 0 ? "In progress" : "Not started";
  const progressToneClass =
    completionPercent > 0 ? "text-primary" : "text-muted-foreground";

  return (
    <footer className="status-ribbon flex h-11 flex-shrink-0 items-center gap-2 overflow-hidden px-2 text-xs text-muted-foreground md:gap-3 md:px-4" aria-label="Application status">
      <span className="sr-only" role="status" aria-live="polite">
        {isOnline ? 'Online' : 'Offline'}{autoSaveDisplay ? `. ${autoSaveDisplay.text}` : ''}. {completionLabel} completion {Math.round(completionPercent)} percent. Controlled release readiness is verified separately.
      </span>
      <div className="flex flex-shrink-0 items-center gap-2 px-1.5">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-success" />
            <span className="hidden text-sm font-medium text-foreground sm:inline">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-warning" />
            <span className="hidden text-sm font-medium text-warning sm:inline">Offline</span>
          </>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-5 md:mx-2" />

      {autoSaveDisplay && (
        <>
          <div className="hidden items-center gap-2 px-1.5 lg:flex">
            {autoSaveDisplay.icon}
            <span className={`${autoSaveDisplay.color} text-xs font-medium`}>{autoSaveDisplay.text}</span>
          </div>
          <Separator orientation="vertical" className="mx-1 hidden h-5 lg:block md:mx-2" />
        </>
      )}

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="flex w-full min-w-0 max-w-[760px] items-center gap-2 md:gap-3">
          {completionPercent === 100 ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:block">{completionLabel}</span>
            <div
              className="workbench-inline-progress-track min-w-16 flex-1"
              role="progressbar"
              aria-label={`${completionLabel} completed`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(completionPercent)}
              aria-valuetext={`${requiredFieldsComplete} of ${totalRequiredFields} required fields, ${Math.round(completionPercent)} percent`}
            >
                <div
                  className="workbench-inline-progress-fill absolute inset-y-0 left-0"
                  style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
                />
            </div>
            <span className={`hidden shrink-0 text-xs font-semibold sm:inline ${progressToneClass}`}>{progressStateLabel}</span>
            <span className="shrink-0 font-mono text-xs font-semibold text-foreground">{Math.round(completionPercent)}%</span>
            <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{requiredFieldsComplete}/{totalRequiredFields}</span>
          </div>
        </div>
      </div>

      <span className="hidden font-mono text-xs font-semibold tracking-wide text-muted-foreground sm:inline-flex">
        {appVersion}
      </span>
    </footer>
  );
};

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
}

export const StatusBar = ({
  completionPercent,
  requiredFieldsComplete,
  totalRequiredFields,
  autoSaveStatus = "idle",
  lastSaved,
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
          icon: <Cloud className="h-5 w-5 text-muted-foreground" />,
          text: "Changes pending...",
          color: "text-muted-foreground",
        };
      case "saving":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
          text: "Saving...",
          color: "text-blue-500",
        };
      case "saved":
        return {
          icon: <Cloud className="h-5 w-5 text-success" />,
          text: lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : "Saved",
          color: "text-success",
        };
      case "error":
        return {
          icon: <CloudOff className="h-5 w-5 text-destructive" />,
          text: "Save failed",
          color: "text-destructive",
        };
      default:
        return null;
    }
  };

  const autoSaveDisplay = getAutoSaveDisplay();
  const progressStateLabel =
    completionPercent >= 100 ? "Complete" : completionPercent >= 75 ? "Almost Done" : completionPercent > 0 ? "In Progress" : "Ready";
  const progressToneClass =
    completionPercent >= 100 ? "text-emerald-400" : completionPercent >= 75 ? "text-cyan-300" : completionPercent > 0 ? "text-amber-300" : "text-slate-400";

  return (
    <div className="status-ribbon flex h-11 flex-shrink-0 items-center gap-2 overflow-hidden px-2 text-xs text-muted-foreground md:h-12 md:gap-3 md:px-4 md:text-sm">
      <div className="flex flex-shrink-0 items-center gap-2 rounded-full border border-border/80 bg-black/10 px-2.5 py-1.5 md:px-3">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 md:h-5 md:w-5 text-success" />
            <span className="hidden text-sm font-semibold text-success md:text-base sm:inline">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 md:h-5 md:w-5 text-warning" />
            <span className="hidden text-sm font-semibold text-warning md:text-base sm:inline">Offline</span>
          </>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-5 md:mx-3 md:h-6" />

      {autoSaveDisplay && (
        <>
          <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-black/10 px-3 py-1.5 lg:flex">
            {autoSaveDisplay.icon}
            <span className={`${autoSaveDisplay.color} text-sm`}>{autoSaveDisplay.text}</span>
          </div>
          <Separator orientation="vertical" className="mx-1 hidden h-5 lg:block md:mx-3 md:h-6" />
        </>
      )}

      <div className="min-w-0 flex-1 flex items-center justify-center">
        <div className="flex min-w-0 w-full max-w-[640px] items-center gap-2 rounded-full border border-border/80 bg-black/15 px-2.5 py-1.5 backdrop-blur-xl md:gap-3 md:px-3">
          {completionPercent === 100 ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-success" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-warning" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:block">
                Completion Dock
              </span>
              <span className={`text-xs font-semibold ${progressToneClass}`}>{progressStateLabel}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-950/80">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-sky-400 shadow-[0_0_18px_rgba(34,211,238,0.28)] transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-foreground md:text-sm">
                {Math.round(completionPercent)}%
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                {requiredFieldsComplete}/{totalRequiredFields}
              </span>
            </div>
          </div>
        </div>
      </div>

      <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-sm font-semibold text-primary sm:inline-flex md:text-base">
        {appVersion}
      </span>
    </div>
  );
};

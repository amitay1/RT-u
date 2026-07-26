/**
 * Update Center — the active update control that lives in the workbench toolbar.
 *
 * The floating pill (UpdateNotification) is a passive notifier; this popover is
 * where the operator *drives* updates: it always answers "am I up to date?",
 * shows real download progress with size / speed / ETA, and offers the USB
 * (air-gapped) path in the same place. All state comes from the pure machine in
 * lib/appUpdateState via the useAppUpdates hook.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  RefreshCw,
  Rocket,
  Usb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  describeUpdatePhase,
  formatDownloadEta,
  formatRelativeTime,
  formatUpdateBytes,
  formatUpdateSpeed,
  primaryUpdateAction,
  type AppUpdateState,
  type UpdatePhase,
  type UpdateTone,
} from "@/lib/appUpdateState";
import { useAppUpdates } from "@/hooks/use-app-updates";

interface UpdateCenterProps {
  /** Opens the USB / offline update dialog (air-gapped factories). */
  onOfflineUpdate?: () => void;
  className?: string;
}

const TONE_TEXT: Record<UpdateTone, string> = {
  idle: "text-muted-foreground",
  progress: "text-primary",
  success: "text-success",
  attention: "text-warning",
  danger: "text-destructive",
};

const TONE_SURFACE: Record<UpdateTone, string> = {
  idle: "border-border/70 bg-muted/40",
  progress: "border-primary/30 bg-primary/10",
  success: "border-success/30 bg-success/10",
  attention: "border-warning/30 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/10",
};

const TONE_DOT: Record<UpdateTone, string> = {
  idle: "bg-muted-foreground",
  progress: "bg-primary",
  success: "bg-success",
  attention: "bg-warning",
  danger: "bg-destructive",
};

function StatusIcon({ phase, className }: { phase: UpdatePhase; className?: string }) {
  switch (phase) {
    case "checking":
      return <Loader2 className={cn("animate-spin", className)} />;
    case "up-to-date":
      return <CheckCircle2 className={className} />;
    case "available":
      return <ArrowDownCircle className={className} />;
    case "downloading":
      return <Download className={className} />;
    case "ready":
      return <Rocket className={className} />;
    case "error":
      return <AlertTriangle className={className} />;
    default:
      return <RefreshCw className={className} />;
  }
}

function DownloadReadout({ state }: { state: AppUpdateState }) {
  const speed = formatUpdateSpeed(state.bytesPerSecond);
  const eta = formatDownloadEta(state);
  const size =
    state.total > 0
      ? `${formatUpdateBytes(state.transferred)} / ${formatUpdateBytes(state.total)}`
      : null;
  const parts = [size, speed, eta].filter(Boolean) as string[];

  return (
    <div className="mt-3 space-y-1.5">
      <Progress value={state.percent} className="h-2" />
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>{parts.join("  •  ")}</span>
        <span className="font-semibold text-foreground">{Math.round(state.percent)}%</span>
      </div>
    </div>
  );
}

export function UpdateCenter({ onOfflineUpdate, className }: UpdateCenterProps) {
  const {
    state,
    currentVersion,
    hasUpdateControls,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useAppUpdates();

  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Keep the "last checked" label fresh while the panel is open.
  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [open]);

  // The web build never exposes an updater — render nothing there.
  if (!hasUpdateControls) return null;

  const description = describeUpdatePhase(state);
  const action = primaryUpdateAction(state.phase);
  const showDot =
    state.phase === "available" ||
    state.phase === "downloading" ||
    state.phase === "ready" ||
    state.phase === "error";
  const triggerTinted =
    state.phase === "ready" || state.phase === "available" || state.phase === "error";

  const runPrimary = () => {
    switch (action.kind) {
      case "download":
        downloadUpdate();
        break;
      case "install":
        installUpdate();
        break;
      case "check":
      case "retry":
      default:
        checkForUpdates();
        break;
    }
  };

  const ActionIcon =
    action.kind === "install" ? Rocket : action.kind === "download" ? Download : RefreshCw;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-10 w-10",
            triggerTinted && TONE_TEXT[description.tone],
            className,
          )}
          title={description.title}
          aria-label={`Software updates — ${description.title}`}
        >
          <StatusIcon phase={state.phase} className="h-4 w-4" />
          {showDot && (
            <span
              className={cn(
                "absolute bottom-1 right-1 h-2 w-2 rounded-full border-2 border-card",
                TONE_DOT[description.tone],
                state.phase === "ready" && "animate-pulse",
              )}
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Software updates</span>
          </div>
          {currentVersion && (
            <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
              v{currentVersion}
            </span>
          )}
        </div>

        {/* Status block */}
        <div className="px-4 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "rounded-lg border p-3",
                TONE_SURFACE[description.tone],
              )}
            >
              <div className="flex items-start gap-3">
                <StatusIcon
                  phase={state.phase}
                  className={cn("mt-0.5 h-5 w-5 flex-shrink-0", TONE_TEXT[description.tone])}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", TONE_TEXT[description.tone])}>
                    {description.title}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {description.detail}
                  </p>
                  {state.phase === "downloading" && <DownloadReadout state={state} />}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Primary action */}
          <Button
            onClick={runPrimary}
            disabled={action.busy}
            variant={action.kind === "check" ? "secondary" : "default"}
            className="mt-3 w-full"
          >
            <ActionIcon className={cn("mr-2 h-4 w-4", action.busy && "animate-spin")} />
            {action.label}
          </Button>

          {/* Meta line */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Last checked:{" "}
              <span className="font-medium text-foreground">
                {formatRelativeTime(state.lastCheckedAt, nowMs)}
              </span>
            </span>
            <span className="hidden sm:inline">Auto-checks every 30 min</span>
          </div>

          {/* Release notes */}
          {state.releaseNotes && (
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20">
              <button
                type="button"
                onClick={() => setNotesOpen((value) => !value)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-foreground"
                aria-expanded={notesOpen}
              >
                <span>What's new{state.version ? ` in v${state.version}` : ""}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    notesOpen && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {notesOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-40 overflow-y-auto whitespace-pre-line px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
                      {state.releaseNotes}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Offline / USB path */}
        {onOfflineUpdate && (
          <div className="border-t border-border/70 px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => {
                setOpen(false);
                onOfflineUpdate();
              }}
            >
              <Usb className="mr-2 h-4 w-4" />
              Install from USB drive
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

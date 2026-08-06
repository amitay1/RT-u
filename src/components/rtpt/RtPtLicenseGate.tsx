import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Database,
  FileKey2,
  KeyRound,
  Loader2,
  MonitorCog,
  Power,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useRtPtLicense,
  type RtPtLicenseStatusCode,
} from "@/contexts/RtPtLicenseContext";
import { RonexBrandMark } from "@/components/rtpt/RonexBrandMark";

interface RtPtLicenseGateProps {
  children: ReactNode;
}

interface ElectronWindowControls {
  electron?: {
    quit?: () => Promise<unknown> | unknown;
  };
}

interface StatusPresentation {
  label: string;
  title: string;
  description: string;
  tone: "neutral" | "warning" | "critical";
  icon: typeof KeyRound;
}

const STATUS_PRESENTATIONS: Record<Exclude<RtPtLicenseStatusCode, "active">, StatusPresentation> = {
  missing: {
    label: "License required",
    title: "Activate this workstation",
    description: "Enter the license issued for the installation code below.",
    tone: "neutral",
    icon: KeyRound,
  },
  expired: {
    label: "License expired",
    title: "A renewed license is required",
    description: "The previous license reached its expiry date. Enter a renewed activation code to continue.",
    tone: "warning",
    icon: Clock3,
  },
  invalid: {
    label: "License not accepted",
    title: "Check the activation code",
    description: "The license format, signature, or stored activation could not be verified.",
    tone: "critical",
    icon: AlertTriangle,
  },
  "installation-mismatch": {
    label: "Installation mismatch",
    title: "This license belongs to another workstation",
    description: "Request a license issued for the installation code shown on this screen.",
    tone: "warning",
    icon: MonitorCog,
  },
  "configuration-required": {
    label: "Configuration required",
    title: "License verification is not configured",
    description: "The trusted RT Inspector licensing key is unavailable or invalid in this build.",
    tone: "critical",
    icon: ShieldCheck,
  },
  "storage-unavailable": {
    label: "Secure storage unavailable",
    title: "The license cannot be stored safely",
    description: "Secure operating-system storage must be available before this workstation can be activated.",
    tone: "critical",
    icon: Database,
  },
  "runtime-unavailable": {
    label: "Desktop service unavailable",
    title: "License verification could not start",
    description: "RT Inspector could not connect to its local desktop license service.",
    tone: "critical",
    icon: MonitorCog,
  },
  "clock-invalid": {
    label: "System clock requires attention",
    title: "License dates cannot be verified",
    description: "Correct the workstation date and time, then retry license verification.",
    tone: "warning",
    icon: Clock3,
  },
};

const ACTIVATABLE_STATES = new Set<RtPtLicenseStatusCode>([
  "missing",
  "expired",
  "invalid",
  "installation-mismatch",
]);

const toneClasses: Record<StatusPresentation["tone"], string> = {
  neutral: "border-primary/25 bg-primary/5 text-primary",
  warning: "border-warning/30 bg-warning/5 text-warning",
  critical: "border-destructive/25 bg-destructive/5 text-destructive",
};

const getWindowControls = (): ElectronWindowControls["electron"] => {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as ElectronWindowControls).electron;
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";
  document.body.appendChild(temporaryInput);
  temporaryInput.select();
  const copied = document.execCommand("copy");
  temporaryInput.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
};

function LicenseLoadingScreen() {
  return (
    <main className="flex min-h-full w-full items-center justify-center overflow-auto bg-background px-5 py-10 text-foreground">
      <section
        className="app-panel flex w-full max-w-md flex-col items-center px-7 py-10 text-center"
        aria-labelledby="license-loading-title"
        aria-busy="true"
      >
        <div className="workbench-brand-mark mb-6 h-14 w-14">
          <ScanLine className="h-7 w-7" aria-hidden="true" />
        </div>
        <Loader2 className="mb-4 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <h1 id="license-loading-title" className="text-xl font-semibold tracking-tight">
          Verifying workstation license
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          RT Inspector is validating the local activation before opening the controlled workspace.
        </p>
      </section>
    </main>
  );
}

export function RtPtLicenseGate({ children }: RtPtLicenseGateProps) {
  const {
    status,
    isLoading,
    isActivating,
    error,
    refresh,
    activate,
  } = useRtPtLicense();
  const [activationCode, setActivationCode] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activationFieldId = useId();
  const installationId = status.installationId;
  const presentation = status.status === "active" ? null : STATUS_PRESENTATIONS[status.status];
  const canActivate = ACTIVATABLE_STATES.has(status.status);
  const canQuit = typeof getWindowControls()?.quit === "function";
  const isBusy = isLoading || isActivating;

  const activationHint = useMemo(() => {
    if (canActivate) return "Paste the raw RTPT1 code or the complete JSON activation package exactly as supplied.";
    if (status.status === "clock-invalid") return "Correct the workstation clock before entering a license.";
    if (status.status === "configuration-required") return "A correctly configured application build is required before activation.";
    if (status.status === "storage-unavailable") return "Secure storage must be restored before activation.";
    return "Reconnect to the RT Inspector desktop service before activation.";
  }, [canActivate, status.status]);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  if (isLoading && status.reason === "verification-pending") {
    return <LicenseLoadingScreen />;
  }

  if (status.active) return <>{children}</>;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canActivate || isBusy || !activationCode.trim()) return;
    const nextStatus = await activate(activationCode);
    if (nextStatus.active) setActivationCode("");
  };

  const handleCopyInstallationId = async () => {
    if (!installationId) return;
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    try {
      await copyText(installationId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  };

  const handleQuit = () => {
    const controls = getWindowControls();
    if (typeof controls?.quit === "function") void controls.quit();
  };

  if (!presentation) return null;
  const StatusIcon = presentation.icon;
  const reportedMessage = error || status.message || presentation.description;

  return (
    <main className="h-full min-h-0 w-full overflow-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-[1240px] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
          <RonexBrandMark variant="page" />
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Offline license validation
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(430px,1.18fr)] lg:gap-14 lg:py-10">
          <section className="max-w-xl lg:pr-4" aria-labelledby="license-page-title">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <FileKey2 className="h-3.5 w-3.5" aria-hidden="true" />
              Workstation activation
            </div>
            <h1 id="license-page-title" className="max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Activate RT Inspector
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Unlock the RT Film, RT Digital/DDA, and Liquid Penetrant technique workspaces with a license issued specifically for this installation.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-xl border border-border/75 bg-card/65 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  Installation-bound
                </div>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Each signed license is verified against this installation code.
                </p>
              </div>
              <div className="rounded-xl border border-border/75 bg-card/65 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MonitorCog className="h-4 w-4 text-primary" aria-hidden="true" />
                  No account required
                </div>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Activation is local; there is no username or password sign-in.
                </p>
              </div>
            </div>
          </section>

          <section className="app-panel overflow-hidden" aria-labelledby="activation-panel-title">
            <div className="border-b border-border/75 bg-card/70 px-5 py-5 sm:px-6">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                  toneClasses[presentation.tone],
                )}
                role={presentation.tone === "neutral" ? "status" : "alert"}
                aria-live="polite"
              >
                <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.13em]">{presentation.label}</div>
                  <h2 id="activation-panel-title" className="mt-1 text-base font-semibold text-foreground">
                    {presentation.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{reportedMessage}</p>
                </div>
              </div>
            </div>

            <form className="space-y-5 px-5 py-5 sm:px-6 sm:py-6" onSubmit={handleSubmit}>
              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Installation code</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Send this code when requesting a license.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyInstallationId}
                    disabled={!installationId}
                    aria-label="Copy installation code"
                  >
                    {copyState === "copied" ? (
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <Clipboard className="h-4 w-4" aria-hidden="true" />
                    )}
                    {copyState === "copied" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div
                  className="min-h-12 break-all rounded-lg border border-border bg-muted/45 px-3.5 py-3 font-mono text-sm font-semibold tracking-[0.055em] text-foreground shadow-inner"
                  aria-label="Installation code"
                >
                  {installationId || "Unavailable"}
                </div>
                <p className={cn("mt-1.5 text-xs", copyState === "failed" ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
                  {copyState === "failed" ? "Could not copy automatically. Select the code and copy it manually." : "The code identifies this RT Inspector installation only."}
                </p>
              </div>

              <div>
                <Label htmlFor={activationFieldId} className="text-sm font-semibold">Activation code</Label>
                <Textarea
                  id={activationFieldId}
                  className="mt-2 min-h-28 resize-y font-mono text-sm leading-6"
                  value={activationCode}
                  onChange={(event) => setActivationCode(event.target.value)}
                  placeholder="RTPT1.eyJ..."
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={200_000}
                  disabled={!canActivate || isBusy}
                  aria-describedby={`${activationFieldId}-hint`}
                  aria-invalid={status.status === "invalid" ? true : undefined}
                />
                <p id={`${activationFieldId}-hint`} className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {activationHint}
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => void refresh()} disabled={isBusy}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
                    Retry
                  </Button>
                  {canQuit ? (
                    <Button type="button" variant="ghost" onClick={handleQuit} disabled={isBusy}>
                      <Power className="h-4 w-4" aria-hidden="true" />
                      Quit
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!canActivate || !activationCode.trim() || isBusy}
                  className="sm:min-w-36"
                >
                  {isActivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isActivating ? "Verifying…" : "Activate"}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <footer className="border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
          License validation is performed locally using the trusted RT Inspector verification key. Activation does not change technique approval or controlled-release requirements.
        </footer>
      </div>
    </main>
  );
}

import { useMemo, useState } from "react";
import { Check, Clipboard, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isConfirmedRtPtLicenseDeactivation,
  useRtPtLicense,
} from "@/contexts/RtPtLicenseContext";

interface RtPtLicenseCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatLicenseDate = (value: string | null | undefined): string => {
  if (!value) return "Perpetual";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Restricted desktop/browser clipboard implementations can reject even
      // when the API exists. Fall through to the synchronous browser fallback.
    }
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.left = "-9999px";
  temporaryInput.style.opacity = "0";
  document.body.appendChild(temporaryInput);

  let copied = false;
  try {
    temporaryInput.focus({ preventScroll: true });
    temporaryInput.select();
    temporaryInput.setSelectionRange(0, value.length);
    copied = typeof document.execCommand === "function" && document.execCommand("copy");
  } finally {
    temporaryInput.remove();
  }

  if (!copied) throw new Error("Clipboard access is unavailable.");
};

export function RtPtLicenseCenterDialog({ open, onOpenChange }: RtPtLicenseCenterDialogProps) {
  const { status, activate, deactivate, isActivating, isDeactivating, error } = useRtPtLicense();
  const [activationCode, setActivationCode] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const license = status.license;

  const expiryDescription = useMemo(() => {
    if (!license?.expiresAt) return "No expiry date";
    const remainingDays = Math.ceil((Date.parse(license.expiresAt) - Date.now()) / 86_400_000);
    if (!Number.isFinite(remainingDays)) return formatLicenseDate(license.expiresAt);
    if (remainingDays < 0) return "Expired";
    if (remainingDays === 0) return "Expires today";
    return `${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining`;
  }, [license?.expiresAt]);

  const copyInstallationId = async () => {
    if (!status.installationId) return;
    try {
      await copyText(status.installationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Installation code copied.");
    } catch {
      toast.error("Unable to copy the installation code.");
    }
  };

  const replaceLicense = async () => {
    const nextStatus = await activate(activationCode);
    if (nextStatus.active) {
      setActivationCode("");
      toast.success("The workstation license was updated and verified.");
    }
  };

  const removeLicense = async () => {
    const expectedInstallationId = status.installationId;
    const nextStatus = await deactivate();
    setConfirmDeactivate(false);
    if (isConfirmedRtPtLicenseDeactivation(nextStatus, expectedInstallationId)) {
      onOpenChange(false);
      toast.success("The local workstation license was removed.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>Workstation license</DialogTitle>
            <DialogDescription>
              View this installation's signed RT Inspector license, renew it early, or remove it from this workstation.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <section className="grid gap-3 rounded-xl border border-border/80 bg-muted/25 p-4 sm:grid-cols-2" aria-label="Current license details">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                Verified and active
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">License holder</div>
              <div className="mt-1 text-sm font-semibold">{license?.customer ?? "Unavailable"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Edition</div>
              <div className="mt-1 text-sm font-semibold capitalize">{license?.edition ?? "Unavailable"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Expiry</div>
              <div className="mt-1 text-sm font-semibold">{formatLicenseDate(license?.expiresAt)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{expiryDescription}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Installation code</div>
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                <code
                  tabIndex={status.installationId ? 0 : -1}
                  aria-label={status.installationId ? `Installation code ${status.installationId}` : "Installation code unavailable"}
                  className="min-w-0 flex-1 select-all truncate rounded-md border border-border/70 bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={status.installationId ?? undefined}
                >
                  {status.installationId ?? "Unavailable"}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={() => void copyInstallationId()} disabled={!status.installationId} aria-label="Copy installation code">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Clipboard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border/80 p-4" aria-labelledby="replace-license-heading">
            <div>
              <h3 id="replace-license-heading" className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                Renew or replace license
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You can install a renewed code before the current license expires. The replacement must be signed for this installation.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtpt-license-replacement">Activation code or JSON package</Label>
              <Textarea
                id="rtpt-license-replacement"
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
                placeholder="RTPT1.…"
                className="min-h-24 resize-y font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Button type="button" onClick={() => void replaceLicense()} disabled={isActivating || !activationCode.trim()}>
              {isActivating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
              Verify replacement
            </Button>
          </section>

          <DialogFooter className="border-t border-border/70 pt-4 sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDeactivate(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove license
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this workstation license?</AlertDialogTitle>
            <AlertDialogDescription>
              RT Inspector will lock immediately. The same installation code remains available so a valid license can be activated again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Keep license</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void removeLicense();
              }}
              disabled={isDeactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeactivating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Remove and lock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Pure update state machine for the RT Inspector desktop shell.
 *
 * The Electron main process (electron/main.cjs) drives auto-updates through
 * electron-updater and pushes `update-status` events over the preload bridge.
 * This module folds that raw event stream into a single, self-describing UI
 * state so the toolbar Update Center (and any other surface) stay in lock-step
 * and always give the operator a clear answer — including the "you're up to
 * date" and "check failed" cases the previous inline toolbar logic dropped.
 *
 * Deliberately free of React/DOM so it can be unit-tested in the `node`
 * vitest environment.
 */

export type UpdatePhase =
  | "idle" // nothing checked yet this session
  | "checking" // a check is in flight
  | "up-to-date" // the last check found no newer build
  | "available" // a newer build exists (download not finished)
  | "downloading" // the package is transferring
  | "ready" // the package is downloaded and ready to install
  | "error"; // the last check/download failed

/** Semantic tone used to colour the indicator and status block. */
export type UpdateTone = "idle" | "progress" | "success" | "attention" | "danger";

export interface AppUpdateState {
  phase: UpdatePhase;
  /** Target version for available/downloading/ready phases. */
  version: string | null;
  /** Download completion 0-100 (only meaningful while downloading/ready). */
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
  /** Human-readable failure reason for the error phase. */
  error: string | null;
  /** Whether an errored check/download can be retried. */
  canRetry: boolean;
  /** Release notes for the target version, when the feed supplies them. */
  releaseNotes: string | null;
  releaseDate: string | null;
  /** Epoch ms of the last completed check (success, "up to date", or error). */
  lastCheckedAt: number | null;
}

export const INITIAL_UPDATE_STATE: AppUpdateState = {
  phase: "idle",
  version: null,
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  error: null,
  canRetry: false,
  releaseNotes: null,
  releaseDate: null,
  lastCheckedAt: null,
};

/** Raw event payload as emitted by electron/main.cjs over `update-status`. */
export interface UpdateStatusEventPayload {
  status:
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "not-available"
    | "error"
    | "restart-scheduled";
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
  canRetry?: boolean;
  releaseNotes?: unknown;
  releaseDate?: string;
  restartIn?: number;
}

/** Snapshot returned by the `get-update-info` IPC channel on mount. */
export interface UpdateInfoSnapshot {
  updateAvailable?: boolean;
  updateDownloaded?: boolean;
  updateVersion?: string;
  releaseNotes?: unknown;
  releaseDate?: string;
  currentVersion?: string;
}

/**
 * Actions the hook layer dispatches. `event` wraps the Electron stream; the
 * others cover the synthetic transitions the raw stream cannot express:
 * a locally initiated check, a check that settled through the resolved IPC
 * promise (dev builds emit no events), a watchdog timeout, and mount hydration.
 */
export type UpdateAction =
  | { type: "event"; payload: UpdateStatusEventPayload }
  | { type: "check-initiated" }
  | { type: "check-settled"; upToDate?: boolean; error?: string }
  | { type: "check-timed-out" }
  | { type: "hydrate"; info: UpdateInfoSnapshot };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * electron-updater delivers release notes as a string of HTML, an array of
 * `{ version, note }` records, or nothing. Normalise everything to trimmed
 * plain text (tags stripped) so the UI can render it safely as text.
 */
export function normalizeReleaseNotes(notes: unknown): string | null {
  const toText = (value: string): string =>
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
      .replace(/ *\n */g, "\n") // trim spaces hugging line breaks
      .replace(/\n{3,}/g, "\n\n") // cap blank runs at a single blank line
      .trim();

  if (typeof notes === "string") {
    const text = toText(notes);
    return text ? text : null;
  }

  if (Array.isArray(notes)) {
    const joined = notes
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "note" in entry) {
          const note = (entry as { note?: unknown }).note;
          return typeof note === "string" ? note : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
    const text = toText(joined);
    return text ? text : null;
  }

  return null;
}

function reduceEvent(
  prev: AppUpdateState,
  payload: UpdateStatusEventPayload,
  nowMs: number,
): AppUpdateState {
  switch (payload.status) {
    case "checking":
      return { ...prev, phase: "checking", error: null, canRetry: false };

    case "not-available":
      return {
        ...prev,
        phase: "up-to-date",
        error: null,
        canRetry: false,
        lastCheckedAt: nowMs,
      };

    case "available":
      return {
        ...prev,
        // The main process auto-starts the download, so an "available" event
        // that arrives mid-download must not knock us back a step.
        phase: prev.phase === "downloading" ? "downloading" : "available",
        version: payload.version ?? prev.version,
        releaseNotes: normalizeReleaseNotes(payload.releaseNotes) ?? prev.releaseNotes,
        releaseDate: payload.releaseDate ?? prev.releaseDate,
        error: null,
        canRetry: false,
        lastCheckedAt: nowMs,
      };

    case "downloading":
      return {
        ...prev,
        phase: "downloading",
        version: payload.version ?? prev.version,
        percent: clampPercent(payload.percent ?? prev.percent),
        bytesPerSecond: payload.bytesPerSecond ?? 0,
        transferred: payload.transferred ?? prev.transferred,
        total: payload.total ?? prev.total,
        error: null,
      };

    case "downloaded":
      return {
        ...prev,
        phase: "ready",
        version: payload.version ?? prev.version,
        percent: 100,
        bytesPerSecond: 0,
        releaseNotes: normalizeReleaseNotes(payload.releaseNotes) ?? prev.releaseNotes,
        error: null,
        canRetry: false,
      };

    case "error":
      return {
        ...prev,
        phase: "error",
        error: payload.error ?? "The update could not be completed.",
        canRetry: payload.canRetry ?? true,
        bytesPerSecond: 0,
      };

    case "restart-scheduled":
      // The restart countdown banner owns this moment; the Update Center just
      // keeps showing the downloaded build as ready to install.
      return { ...prev, phase: "ready", version: payload.version ?? prev.version };

    default:
      return prev;
  }
}

function hydrateFromInfo(
  prev: AppUpdateState,
  info: UpdateInfoSnapshot,
  nowMs: number,
): AppUpdateState {
  if (info?.updateDownloaded && info.updateVersion) {
    return {
      ...prev,
      phase: "ready",
      version: info.updateVersion,
      percent: 100,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? prev.releaseNotes,
      releaseDate: info.releaseDate ?? prev.releaseDate,
      lastCheckedAt: prev.lastCheckedAt ?? nowMs,
    };
  }

  if (info?.updateAvailable && info.updateVersion) {
    return {
      ...prev,
      // Never override a live phase (e.g. a check already running) on hydrate.
      phase: prev.phase === "idle" ? "available" : prev.phase,
      version: info.updateVersion,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? prev.releaseNotes,
      releaseDate: info.releaseDate ?? prev.releaseDate,
    };
  }

  return prev;
}

/** The single reducer that owns every update transition. */
export function reduceUpdate(
  prev: AppUpdateState,
  action: UpdateAction,
  nowMs: number,
): AppUpdateState {
  switch (action.type) {
    case "check-initiated":
      // Preserve the last known version/notes while a fresh check runs.
      return { ...prev, phase: "checking", error: null, canRetry: false };

    case "check-settled": {
      // Only relevant if the resolved IPC promise beat the event stream.
      if (prev.phase !== "checking") return prev;
      if (action.error) {
        return {
          ...prev,
          phase: "error",
          error: action.error,
          canRetry: true,
          lastCheckedAt: nowMs,
        };
      }
      if (action.upToDate) {
        return { ...prev, phase: "up-to-date", lastCheckedAt: nowMs };
      }
      return prev;
    }

    case "check-timed-out":
      if (prev.phase !== "checking") return prev;
      return {
        ...prev,
        phase: "error",
        error: "The update check timed out. Check your connection and try again.",
        canRetry: true,
        lastCheckedAt: nowMs,
      };

    case "hydrate":
      return hydrateFromInfo(prev, action.info, nowMs);

    case "event":
      return reduceEvent(prev, action.payload, nowMs);

    default:
      return prev;
  }
}

// ── Presentation helpers (pure) ─────────────────────────────────────────────

export function phaseTone(phase: UpdatePhase): UpdateTone {
  switch (phase) {
    case "checking":
    case "downloading":
      return "progress";
    case "up-to-date":
    case "ready":
      return "success";
    case "available":
      return "attention";
    case "error":
      return "danger";
    default:
      return "idle";
  }
}

export interface UpdatePhaseDescription {
  tone: UpdateTone;
  title: string;
  detail: string;
}

export function describeUpdatePhase(state: AppUpdateState): UpdatePhaseDescription {
  switch (state.phase) {
    case "checking":
      return {
        tone: "progress",
        title: "Checking for updates...",
        detail: "Contacting the update service.",
      };
    case "up-to-date":
      return {
        tone: "success",
        title: "You're up to date",
        detail: state.version
          ? `Version ${state.version} is the latest available.`
          : "No newer version is available.",
      };
    case "available":
      return {
        tone: "attention",
        title: state.version ? `Update available — v${state.version}` : "Update available",
        detail: "Preparing to download the new version.",
      };
    case "downloading":
      return {
        tone: "progress",
        title: state.version ? `Downloading v${state.version}` : "Downloading update",
        detail: `${Math.round(state.percent)}% complete`,
      };
    case "ready":
      return {
        tone: "success",
        title: state.version ? `Update ready — v${state.version}` : "Update ready",
        detail: "Restart to finish installing.",
      };
    case "error":
      return {
        tone: "danger",
        title: "Update problem",
        detail: state.error ?? "Something went wrong while updating.",
      };
    case "idle":
    default:
      return {
        tone: "idle",
        title: "Check for updates",
        detail: "You haven't checked yet in this session.",
      };
  }
}

export interface UpdatePrimaryAction {
  kind: "check" | "download" | "install" | "retry";
  label: string;
  /** True when the button should be shown but disabled (work already in flight). */
  busy: boolean;
}

export function primaryUpdateAction(phase: UpdatePhase): UpdatePrimaryAction {
  switch (phase) {
    case "available":
      return { kind: "download", label: "Download update", busy: false };
    case "downloading":
      return { kind: "download", label: "Downloading...", busy: true };
    case "ready":
      return { kind: "install", label: "Restart & install", busy: false };
    case "error":
      return { kind: "retry", label: "Try again", busy: false };
    case "checking":
      return { kind: "check", label: "Checking...", busy: true };
    case "idle":
    case "up-to-date":
    default:
      return { kind: "check", label: "Check for updates", busy: false };
  }
}

export function formatUpdateBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatUpdateSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "";
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

/** Remaining download time, or null when it cannot be estimated yet. */
export function formatDownloadEta(state: AppUpdateState): string | null {
  if (state.phase !== "downloading" || state.bytesPerSecond <= 0 || state.total <= 0) {
    return null;
  }
  const remaining = Math.max(0, state.total - state.transferred);
  const seconds = Math.round(remaining / state.bytesPerSecond);
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s left`;
}

/** Compact "how long ago" label for the last completed check. */
export function formatRelativeTime(fromMs: number | null, nowMs: number): string {
  if (!fromMs) return "never";
  const diff = Math.max(0, nowMs - fromMs);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

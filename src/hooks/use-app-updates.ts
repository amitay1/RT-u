import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  INITIAL_UPDATE_STATE,
  reduceUpdate,
  type AppUpdateState,
  type UpdateAction,
  type UpdateInfoSnapshot,
  type UpdateStatusEventPayload,
} from "@/lib/appUpdateState";

/**
 * React binding for the desktop auto-update stream.
 *
 * Owns the subscription to the Electron `update-status` events, hydrates from
 * `get-update-info` on mount, and exposes the imperative actions the Update
 * Center needs. All transition logic lives in the pure reducer so it stays
 * unit-tested; this hook only wires it to the preload bridge and adds a
 * watchdog so a silent check never leaves the UI spinning forever.
 */

const CHECK_TIMEOUT_MS = 25_000;

type UpdateStatusListener = (event: unknown, status: UpdateStatusEventPayload) => void;

interface UpdateElectronBridge {
  getAppVersion?: () => Promise<string>;
  checkForUpdates?: () => Promise<unknown> | void;
  forceCheckUpdates?: () => Promise<unknown> | void;
  downloadUpdate?: () => Promise<unknown> | void;
  installUpdate?: (silent?: boolean) => Promise<unknown> | void;
  getUpdateInfo?: () => Promise<UpdateInfoSnapshot | undefined>;
  onUpdateStatus?: (callback: UpdateStatusListener) => void;
  removeUpdateListener?: (callback: UpdateStatusListener) => void;
}

interface CheckResult {
  isDev?: boolean;
  updateAvailable?: boolean;
  checking?: boolean;
  error?: string;
}

function getUpdateBridge(): UpdateElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    electron?: UpdateElectronBridge;
    electronAPI?: UpdateElectronBridge;
  };
  return scope.electron ?? scope.electronAPI;
}

export interface UseAppUpdatesResult {
  state: AppUpdateState;
  currentVersion: string;
  /** True when running inside the Electron desktop shell. */
  isElectron: boolean;
  /** True when the shell actually exposes an updater (hidden on the web build). */
  hasUpdateControls: boolean;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
}

export function useAppUpdates(): UseAppUpdatesResult {
  const [state, dispatch] = useReducer(
    (prev: AppUpdateState, action: UpdateAction) => reduceUpdate(prev, action, Date.now()),
    INITIAL_UPDATE_STATE,
  );
  const [currentVersion, setCurrentVersion] = useState<string>(
    typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "",
  );

  const bridge = getUpdateBridge();
  const isElectron = Boolean(bridge);
  const hasUpdateControls = Boolean(bridge?.forceCheckUpdates || bridge?.checkForUpdates);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Subscribe to the event stream and hydrate the initial state on mount.
  useEffect(() => {
    const electron = getUpdateBridge();
    if (!electron?.onUpdateStatus) return;

    const handler: UpdateStatusListener = (_event, status) => {
      dispatch({ type: "event", payload: status });
    };
    electron.onUpdateStatus(handler);

    electron
      .getAppVersion?.()
      .then((version) => {
        if (version) setCurrentVersion(version);
      })
      .catch(() => {
        /* keep the build-time fallback */
      });

    electron
      .getUpdateInfo?.()
      .then((info) => {
        if (info) dispatch({ type: "hydrate", info });
      })
      .catch(() => {
        /* nothing cached yet */
      });

    return () => {
      electron.removeUpdateListener?.(handler);
    };
  }, []);

  // Any transition out of "checking" resolves the pending watchdog.
  useEffect(() => {
    if (state.phase !== "checking") clearWatchdog();
    return clearWatchdog;
  }, [state.phase, clearWatchdog]);

  const checkForUpdates = useCallback(() => {
    const electron = getUpdateBridge();
    if (!electron) return;

    dispatch({ type: "check-initiated" });

    clearWatchdog();
    timeoutRef.current = setTimeout(() => {
      dispatch({ type: "check-timed-out" });
    }, CHECK_TIMEOUT_MS);

    const run = electron.forceCheckUpdates ?? electron.checkForUpdates;
    Promise.resolve(run?.())
      .then((value) => {
        const result = value as CheckResult | undefined;
        if (!result) return;
        if (result.error) {
          dispatch({ type: "check-settled", error: result.error });
          return;
        }
        // Dev builds short-circuit with { isDev: true } and emit no events, so
        // the resolved promise is the only signal that the check finished.
        if (result.isDev || (result.updateAvailable === false && !result.checking)) {
          dispatch({ type: "check-settled", upToDate: true });
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "The update check failed.";
        dispatch({ type: "check-settled", error: message });
      });
  }, [clearWatchdog]);

  const downloadUpdate = useCallback(() => {
    void getUpdateBridge()?.downloadUpdate?.();
  }, []);

  const installUpdate = useCallback(() => {
    void getUpdateBridge()?.installUpdate?.(true);
  }, []);

  return {
    state,
    currentVersion,
    isElectron,
    hasUpdateControls,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}

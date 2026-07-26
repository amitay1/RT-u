import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type RtPtLicenseStatusCode =
  | "active"
  | "missing"
  | "configuration-required"
  | "storage-unavailable"
  | "invalid"
  | "expired"
  | "installation-mismatch"
  | "clock-invalid"
  | "runtime-unavailable";

export type RtPtLicenseReason =
  | "license-not-activated"
  | "public-key-not-configured"
  | "public-key-invalid"
  | "encryption-unavailable"
  | "license-format-invalid"
  | "license-signature-invalid"
  | "license-payload-invalid"
  | "license-storage-corrupt"
  | "license-expired"
  | "installation-id-mismatch"
  | "system-clock-rollback"
  | "license-issued-in-future"
  | "clock-record-corrupt"
  | "bridge-unavailable"
  | "verification-failed"
  | "verification-pending"
  | "empty-activation-code"
  | "product-mismatch"
  | "license-deactivated";

export interface RtPtLicenseDetails {
  schemaVersion: 1;
  product: "rt-pt-inspector";
  appId: "com.amitay.rtptinspector";
  licenseId: string;
  customer: string;
  installationId: string;
  issuedAt: string;
  expiresAt: string | null;
  edition: string;
  features: string[];
}

export interface RtPtLicenseStatus {
  status: RtPtLicenseStatusCode;
  active: boolean;
  product: "rt-pt-inspector";
  appId: "com.amitay.rtptinspector";
  installationId: string | null;
  reason: RtPtLicenseReason | null;
  message: string;
  license: RtPtLicenseDetails | null;
}

type MaybePromise<T> = T | Promise<T>;

export interface RtPtLicenseBridge {
  getStatus: () => MaybePromise<unknown>;
  activate: (activationCode: string) => MaybePromise<unknown>;
  deactivate: () => MaybePromise<unknown>;
}

export interface RtPtLicenseContextValue {
  status: RtPtLicenseStatus;
  isLoading: boolean;
  isActivating: boolean;
  isDeactivating: boolean;
  error: string | null;
  refresh: () => Promise<RtPtLicenseStatus>;
  activate: (activationCode: string) => Promise<RtPtLicenseStatus>;
  deactivate: () => Promise<RtPtLicenseStatus>;
}

interface RtPtElectronHost {
  electron?: {
    rtptLicense?: RtPtLicenseBridge;
  };
}

const PRODUCT = "rt-pt-inspector" as const;
const APP_ID = "com.amitay.rtptinspector" as const;
const REQUIRED_FEATURES = ["rt-film", "rt-digital", "pt"] as const;
const LICENSE_REVALIDATION_INTERVAL_MS = 60_000;
const DEACTIVATION_REASON = "license-deactivated" as const;
const DEACTIVATION_MESSAGE = "No license is activated for this installation.";
const DEACTIVATION_NOT_CONFIRMED_MESSAGE =
  "The local license service did not confirm that the workstation license was removed. The existing license state was preserved.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LICENSE_DETAIL_KEYS = [
  "appId",
  "customer",
  "edition",
  "expiresAt",
  "features",
  "installationId",
  "issuedAt",
  "licenseId",
  "product",
  "schemaVersion",
].sort();

const STATUS_CODES = new Set<RtPtLicenseStatusCode>([
  "active",
  "missing",
  "configuration-required",
  "storage-unavailable",
  "invalid",
  "expired",
  "installation-mismatch",
  "clock-invalid",
]);

const REASON_CODES = new Set<RtPtLicenseReason>([
  "license-not-activated",
  "public-key-not-configured",
  "public-key-invalid",
  "encryption-unavailable",
  "license-format-invalid",
  "license-signature-invalid",
  "license-payload-invalid",
  "license-storage-corrupt",
  "license-expired",
  "installation-id-mismatch",
  "system-clock-rollback",
  "license-issued-in-future",
  "clock-record-corrupt",
  "bridge-unavailable",
  "verification-failed",
  "verification-pending",
  "empty-activation-code",
  "product-mismatch",
  "license-deactivated",
]);

const DEFAULT_MESSAGES: Record<RtPtLicenseStatusCode, string> = {
  active: "License verified.",
  missing: "This installation has not been activated.",
  "configuration-required": "License verification is not configured for this installation.",
  "storage-unavailable": "Secure license storage is unavailable.",
  invalid: "The stored license or activation code could not be verified.",
  expired: "The license for this installation has expired.",
  "installation-mismatch": "This license was issued for a different installation.",
  "clock-invalid": "The system clock could not be trusted for license verification.",
  "runtime-unavailable": "The local license service is unavailable.",
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const hasExactKeys = (value: Record<string, unknown>, expectedKeys: string[]): boolean => {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
};

const cleanText = (value: unknown, maximumLength = 500): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximumLength) : null;
};

const normaliseReason = (value: unknown): RtPtLicenseReason | null => (
  typeof value === "string" && REASON_CODES.has(value as RtPtLicenseReason)
    ? value as RtPtLicenseReason
    : null
);

const parseCanonicalIso = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? timestamp : null;
};

const containsControlCharacter = (value: string): boolean => (
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  })
);

const normaliseLicenseDetails = (value: unknown): RtPtLicenseDetails | null => {
  if (!isRecord(value)) return null;

  if (!hasExactKeys(value, LICENSE_DETAIL_KEYS)) return null;

  const issuedAtTimestamp = parseCanonicalIso(value.issuedAt);
  const expiresAtTimestamp = value.expiresAt === null ? null : parseCanonicalIso(value.expiresAt);
  const features = Array.isArray(value.features) ? value.features : [];
  const uniqueFeatures = new Set(features);

  if (
    value.schemaVersion !== 1
    || value.product !== PRODUCT
    || value.appId !== APP_ID
    || typeof value.licenseId !== "string"
    || !UUID_PATTERN.test(value.licenseId)
    || typeof value.installationId !== "string"
    || !UUID_PATTERN.test(value.installationId)
    || typeof value.customer !== "string"
    || value.customer.length < 1
    || value.customer.length > 120
    || value.customer !== value.customer.trim()
    || containsControlCharacter(value.customer)
    || issuedAtTimestamp === null
    || (value.expiresAt !== null && (
      expiresAtTimestamp === null
      || expiresAtTimestamp <= issuedAtTimestamp
    ))
    || value.edition !== "professional"
    || features.length !== REQUIRED_FEATURES.length
    || uniqueFeatures.size !== REQUIRED_FEATURES.length
    || !features.every((feature) => (
      typeof feature === "string"
      && REQUIRED_FEATURES.includes(feature as typeof REQUIRED_FEATURES[number])
    ))
    || !REQUIRED_FEATURES.every((feature) => uniqueFeatures.has(feature))
  ) return null;

  return {
    schemaVersion: 1,
    product: PRODUCT,
    appId: APP_ID,
    licenseId: value.licenseId,
    customer: value.customer,
    installationId: value.installationId,
    issuedAt: value.issuedAt as string,
    expiresAt: value.expiresAt as string | null,
    edition: "professional",
    features: [...features] as string[],
  };
};

const createClosedStatus = (
  message: string,
  reason: RtPtLicenseReason,
  installationId: string | null = null,
  status: RtPtLicenseStatusCode = "runtime-unavailable",
): RtPtLicenseStatus => ({
  status,
  active: false,
  product: PRODUCT,
  appId: APP_ID,
  installationId,
  reason,
  message,
  license: null,
});

// Exported as a pure trust-boundary function so malformed bridge responses can
// be verified independently of the React provider lifecycle.
// eslint-disable-next-line react-refresh/only-export-components
export const normaliseRtPtLicenseStatus = (value: unknown): RtPtLicenseStatus => {
  if (!isRecord(value)) {
    return createClosedStatus(DEFAULT_MESSAGES["runtime-unavailable"], "verification-failed");
  }

  if (value.product !== PRODUCT || value.appId !== APP_ID) {
    return createClosedStatus(
      "The license response does not belong to RT Inspector.",
      "product-mismatch",
      cleanText(value.installationId, 128),
      "invalid",
    );
  }

  const rawStatus = typeof value.status === "string" ? value.status : "";
  if (!STATUS_CODES.has(rawStatus as RtPtLicenseStatusCode)) {
    return createClosedStatus(
      DEFAULT_MESSAGES["runtime-unavailable"],
      "verification-failed",
      cleanText(value.installationId, 128),
    );
  }

  const status = rawStatus as Exclude<RtPtLicenseStatusCode, "runtime-unavailable">;
  const installationId = cleanText(value.installationId, 128);
  const hasValidActiveInstallationId = typeof value.installationId === "string"
    && value.installationId === installationId
    && UUID_PATTERN.test(value.installationId);
  const license = status === "active" && value.active === true
    ? normaliseLicenseDetails(value.license)
    : null;
  const isActive = status === "active"
    && value.active === true
    && value.reason === null
    && hasValidActiveInstallationId
    && license !== null
    && license.installationId === installationId;

  if (status === "active" && !isActive) {
    return createClosedStatus(
      "License verification returned incomplete or inconsistent active details.",
      "verification-failed",
      installationId && UUID_PATTERN.test(installationId) ? installationId : null,
      "invalid",
    );
  }

  if (
    isActive
    && license?.expiresAt
    && Date.parse(license.expiresAt) <= Date.now()
  ) {
    return createClosedStatus(
      DEFAULT_MESSAGES.expired,
      "license-expired",
      installationId,
      "expired",
    );
  }

  const resolvedStatus: RtPtLicenseStatusCode = status;
  const reason = status === "active"
    ? null
    : normaliseReason(value.reason) ?? "verification-failed";

  return {
    status: resolvedStatus,
    active: isActive,
    product: PRODUCT,
    appId: APP_ID,
    installationId,
    reason,
    message: cleanText(value.message) ?? DEFAULT_MESSAGES[resolvedStatus],
    license: isActive ? license : null,
  };
};

export type RtPtLicenseMutationKind = "activation" | "deactivation";

export interface RtPtLicenseMutationResolution {
  authoritativeStatus: RtPtLicenseStatus;
  mutationStatus: RtPtLicenseStatus;
  succeeded: boolean;
  error: string | null;
}

// A deactivation response is authoritative only when it matches the complete
// contract returned after the local license record has actually been removed.
// eslint-disable-next-line react-refresh/only-export-components
export const isConfirmedRtPtLicenseDeactivation = (
  status: RtPtLicenseStatus,
  expectedInstallationId: string | null = null,
): boolean => (
  status.status === "missing"
  && status.active === false
  && status.reason === DEACTIVATION_REASON
  && status.message === DEACTIVATION_MESSAGE
  && status.license === null
  && status.installationId !== null
  && (expectedInstallationId === null || status.installationId === expectedInstallationId)
);

// Mutation responses describe the attempted change, not necessarily the
// license still stored on disk. Failed mutations therefore retain the last
// verified global status and expose their message through the separate error
// channel instead of closing an active workspace.
// eslint-disable-next-line react-refresh/only-export-components
export const resolveRtPtLicenseMutation = (
  kind: RtPtLicenseMutationKind,
  currentStatus: RtPtLicenseStatus,
  mutationStatus: RtPtLicenseStatus,
): RtPtLicenseMutationResolution => {
  const succeeded = kind === "activation"
    ? mutationStatus.status === "active" && mutationStatus.active
    : isConfirmedRtPtLicenseDeactivation(
      mutationStatus,
      currentStatus.installationId,
    );
  const error = succeeded
    ? null
    : kind === "deactivation"
      && (mutationStatus.status === "missing" || mutationStatus.status === "active")
      ? DEACTIVATION_NOT_CONFIRMED_MESSAGE
      : mutationStatus.message;

  return {
    authoritativeStatus: succeeded ? mutationStatus : currentStatus,
    mutationStatus,
    succeeded,
    error,
  };
};

const describeError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 500);
  return fallback;
};

const parseActivationInput = (value: string): { token: string } | { error: string } => {
  const trimmed = value.trim();
  if (!trimmed) return { error: "Enter the complete activation code supplied for this installation." };
  if (trimmed.length > 200_000) return { error: "The activation data is too large to process safely." };
  if (!trimmed.startsWith("{")) return { token: trimmed };

  try {
    const activationPackage: unknown = JSON.parse(trimmed);
    if (!isRecord(activationPackage)) {
      return { error: "The activation package must be a JSON object containing a token." };
    }
    const token = cleanText(activationPackage.token, 100_000);
    if (!token) return { error: "The activation package does not contain a valid token." };
    return { token };
  } catch {
    return { error: "The activation package is not valid JSON. Paste the package again or use the raw RTPT1 code." };
  }
};

const requestLocalLicenseApi = async (
  fetchImplementation: typeof fetch,
  path: "status" | "activate" | "deactivate",
  token?: string,
): Promise<unknown> => {
  const isActivation = path === "activate";
  const response = await fetchImplementation(`/api/rtpt-license/${path}`, {
    method: path === "status" ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      ...(isActivation ? { "Content-Type": "application/json" } : {}),
    },
    ...(isActivation ? { body: JSON.stringify({ token }) } : {}),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The local license service returned an invalid response.");
  }

  if (!response.ok) {
    const isClosedLicenseResponse = isRecord(payload)
      && payload.product === PRODUCT
      && payload.appId === APP_ID
      && payload.active !== true
      && payload.status !== "active";
    if (!isClosedLicenseResponse) {
      const message = isRecord(payload)
        && payload.active !== true
        && payload.status !== "active"
        ? cleanText(payload.message) ?? cleanText(payload.error)
        : null;
      throw new Error(message ?? "The local license service rejected the request.");
    }
  }

  return payload;
};

// Browser/PWA builds use the same independent licensing contract over a
// same-origin local API. Electron continues to prefer its isolated preload
// bridge and never silently downgrades a malformed desktop bridge to HTTP.
// eslint-disable-next-line react-refresh/only-export-components
export const createRtPtLicenseHttpBridge = (
  fetchImplementation: typeof fetch,
): RtPtLicenseBridge => ({
  getStatus: () => requestLocalLicenseApi(fetchImplementation, "status"),
  activate: (token) => requestLocalLicenseApi(fetchImplementation, "activate", token),
  deactivate: () => requestLocalLicenseApi(fetchImplementation, "deactivate"),
});

const getLicenseBridge = (): RtPtLicenseBridge | null => {
  if (typeof window === "undefined") return null;
  const host = window as unknown as RtPtElectronHost;
  const bridge = host.electron?.rtptLicense;
  if (host.electron) {
    if (
      !bridge
      || typeof bridge.getStatus !== "function"
      || typeof bridge.activate !== "function"
      || typeof bridge.deactivate !== "function"
    ) {
      return null;
    }
    return bridge;
  }

  return typeof window.fetch === "function"
    ? createRtPtLicenseHttpBridge(window.fetch.bind(window))
    : null;
};

const initialStatus = createClosedStatus(
  "License verification is starting.",
  "verification-pending",
);

const RtPtLicenseContext = createContext<RtPtLicenseContextValue | null>(null);

interface RtPtLicenseProviderProps {
  children: ReactNode;
}

export function RtPtLicenseProvider({ children }: RtPtLicenseProviderProps) {
  const [status, setStatus] = useState<RtPtLicenseStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  const mountedRef = useRef(false);
  const operationRef = useRef(0);
  const foregroundCheckOperationRef = useRef<number | null>(null);
  const mutationOperationRef = useRef<number | null>(null);
  const backgroundCheckRef = useRef<Promise<RtPtLicenseStatus> | null>(null);

  const commitStatus = useCallback((nextStatus: RtPtLicenseStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatus(nextStatus);
    return nextStatus;
  }, []);

  const checkStatus = useCallback(async (showLoading: boolean): Promise<RtPtLicenseStatus> => {
    const operation = ++operationRef.current;
    if (showLoading) foregroundCheckOperationRef.current = operation;
    if (mountedRef.current && showLoading) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const bridge = getLicenseBridge();
      if (!bridge) {
        const nextStatus = createClosedStatus(
          "RT Inspector must connect to its local license service before it can open.",
          "bridge-unavailable",
          statusRef.current.installationId,
        );
        if (operation === operationRef.current) {
          commitStatus(nextStatus);
          if (mountedRef.current) setError(nextStatus.message);
        }
        return nextStatus;
      }

      const nextStatus = normaliseRtPtLicenseStatus(await bridge.getStatus());
      if (operation === operationRef.current) {
        commitStatus(nextStatus);
        if (mountedRef.current && nextStatus.active) setError(null);
      }
      return nextStatus;
    } catch (caughtError) {
      const message = describeError(caughtError, "License verification failed unexpectedly.");
      const nextStatus = createClosedStatus(message, "verification-failed", statusRef.current.installationId);
      if (operation === operationRef.current) {
        commitStatus(nextStatus);
        if (mountedRef.current) setError(message);
      }
      return nextStatus;
    } finally {
      if (foregroundCheckOperationRef.current === operation) {
        foregroundCheckOperationRef.current = null;
      }
      if (showLoading && operation === operationRef.current && mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [commitStatus]);

  const refresh = useCallback((): Promise<RtPtLicenseStatus> => (
    checkStatus(true)
  ), [checkStatus]);

  const activate = useCallback(async (activationCode: string): Promise<RtPtLicenseStatus> => {
    const parsedInput = parseActivationInput(activationCode);
    if ("error" in parsedInput) {
      // Supersede an in-flight status check so it cannot immediately clear the
      // local validation error after this synchronous mutation attempt.
      operationRef.current += 1;
      foregroundCheckOperationRef.current = null;
      const mutationStatus = createClosedStatus(
        parsedInput.error,
        activationCode.trim() ? "license-format-invalid" : "empty-activation-code",
        statusRef.current.installationId,
        "invalid",
      );
      const resolution = resolveRtPtLicenseMutation(
        "activation",
        statusRef.current,
        mutationStatus,
      );
      if (mountedRef.current) {
        setIsLoading(false);
        setError(resolution.error);
      }
      return mutationStatus;
    }

    const operation = ++operationRef.current;
    foregroundCheckOperationRef.current = null;
    mutationOperationRef.current = operation;
    if (mountedRef.current) {
      setIsLoading(false);
      setIsActivating(true);
      setError(null);
    }

    try {
      const bridge = getLicenseBridge();
      if (!bridge) {
        const mutationStatus = createClosedStatus(
          "The local license service is unavailable. Reload or reopen RT Inspector and try again.",
          "bridge-unavailable",
          statusRef.current.installationId,
        );
        const resolution = resolveRtPtLicenseMutation(
          "activation",
          statusRef.current,
          mutationStatus,
        );
        if (operation === operationRef.current) {
          if (mountedRef.current) setError(resolution.error);
        }
        return mutationStatus;
      }

      const mutationStatus = normaliseRtPtLicenseStatus(await bridge.activate(parsedInput.token));
      const resolution = resolveRtPtLicenseMutation(
        "activation",
        statusRef.current,
        mutationStatus,
      );
      if (operation === operationRef.current) {
        if (resolution.succeeded) commitStatus(resolution.authoritativeStatus);
        if (mountedRef.current) setError(resolution.error);
      }
      return mutationStatus;
    } catch (caughtError) {
      const message = describeError(caughtError, "The activation could not be completed.");
      const mutationStatus = createClosedStatus(
        message,
        "verification-failed",
        statusRef.current.installationId,
      );
      const resolution = resolveRtPtLicenseMutation(
        "activation",
        statusRef.current,
        mutationStatus,
      );
      if (operation === operationRef.current) {
        if (mountedRef.current) setError(resolution.error);
      }
      return mutationStatus;
    } finally {
      if (mutationOperationRef.current === operation) {
        mutationOperationRef.current = null;
        if (mountedRef.current) setIsActivating(false);
      }
    }
  }, [commitStatus]);

  const deactivate = useCallback(async (): Promise<RtPtLicenseStatus> => {
    const operation = ++operationRef.current;
    foregroundCheckOperationRef.current = null;
    mutationOperationRef.current = operation;
    if (mountedRef.current) {
      setIsLoading(false);
      setIsDeactivating(true);
      setError(null);
    }

    try {
      const bridge = getLicenseBridge();
      if (!bridge) {
        const mutationStatus = createClosedStatus(
          "The local license service is unavailable.",
          "bridge-unavailable",
          statusRef.current.installationId,
        );
        const resolution = resolveRtPtLicenseMutation(
          "deactivation",
          statusRef.current,
          mutationStatus,
        );
        if (operation === operationRef.current) {
          if (mountedRef.current) setError(resolution.error);
        }
        return mutationStatus;
      }

      const mutationStatus = normaliseRtPtLicenseStatus(await bridge.deactivate());
      const resolution = resolveRtPtLicenseMutation(
        "deactivation",
        statusRef.current,
        mutationStatus,
      );
      if (operation === operationRef.current) {
        if (resolution.succeeded) commitStatus(resolution.authoritativeStatus);
        if (mountedRef.current) setError(resolution.error);
      }
      return mutationStatus;
    } catch (caughtError) {
      const message = describeError(caughtError, "The license could not be deactivated.");
      const mutationStatus = createClosedStatus(
        message,
        "verification-failed",
        statusRef.current.installationId,
      );
      const resolution = resolveRtPtLicenseMutation(
        "deactivation",
        statusRef.current,
        mutationStatus,
      );
      if (operation === operationRef.current) {
        if (mountedRef.current) setError(resolution.error);
      }
      return mutationStatus;
    } finally {
      if (mutationOperationRef.current === operation) {
        mutationOperationRef.current = null;
        if (mountedRef.current) setIsDeactivating(false);
      }
    }
  }, [commitStatus]);

  const revalidateActiveLicense = useCallback(() => {
    if (
      !mountedRef.current
      || !statusRef.current.active
      || foregroundCheckOperationRef.current !== null
      || mutationOperationRef.current !== null
      || backgroundCheckRef.current !== null
    ) return;

    const backgroundCheck = checkStatus(false);
    backgroundCheckRef.current = backgroundCheck;
    void backgroundCheck.finally(() => {
      if (backgroundCheckRef.current === backgroundCheck) {
        backgroundCheckRef.current = null;
      }
    });
  }, [checkStatus]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") revalidateActiveLicense();
    };
    const intervalId = window.setInterval(
      revalidateActiveLicense,
      LICENSE_REVALIDATION_INTERVAL_MS,
    );
    window.addEventListener("focus", revalidateActiveLicense);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", revalidateActiveLicense);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      mountedRef.current = false;
      operationRef.current += 1;
      foregroundCheckOperationRef.current = null;
      mutationOperationRef.current = null;
      backgroundCheckRef.current = null;
    };
  }, [refresh, revalidateActiveLicense]);

  const value = useMemo<RtPtLicenseContextValue>(() => ({
    status,
    isLoading,
    isActivating,
    isDeactivating,
    error,
    refresh,
    activate,
    deactivate,
  }), [status, isLoading, isActivating, isDeactivating, error, refresh, activate, deactivate]);

  return (
    <RtPtLicenseContext.Provider value={value}>
      {children}
    </RtPtLicenseContext.Provider>
  );
}

// This hook intentionally shares the provider module so the context remains private.
// eslint-disable-next-line react-refresh/only-export-components
export function useRtPtLicense(): RtPtLicenseContextValue {
  const context = useContext(RtPtLicenseContext);
  if (!context) {
    throw new Error("useRtPtLicense must be used within an RtPtLicenseProvider");
  }
  return context;
}

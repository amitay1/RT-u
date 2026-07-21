export const TECHNIQUE_SHEET_DRAFT_KEY = "rtpt_inspector_document_draft_v1";
export const UPDATE_RECOVERY_KEY = "rtpt_inspector_update_recovery_v1";

export type UpdateRecoveryReason = "manual-install" | "scheduled-restart" | "update-on-quit";

export interface UpdateRecoveryRecord {
  cardName: string;
  savedAt: string;
  reason: UpdateRecoveryReason;
  version?: string;
  activeTab?: string;
  reportMode?: "Technique" | "Report";
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTechniqueSheetDraft<T = unknown>(): T | null {
  const storage = getStorage();
  try {
    const raw = storage?.getItem(TECHNIQUE_SHEET_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeTechniqueSheetDraft(snapshot: unknown): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(TECHNIQUE_SHEET_DRAFT_KEY, JSON.stringify(snapshot));
  } catch {
    // Recovery storage is best-effort and must never crash an inspection form.
  }
}

export function clearTechniqueSheetDraft(): void {
  const storage = getStorage();
  try {
    storage?.removeItem(TECHNIQUE_SHEET_DRAFT_KEY);
  } catch {
    // Ignore unavailable or locked browser storage.
  }
}

export function readUpdateRecoveryRecord(): UpdateRecoveryRecord | null {
  const storage = getStorage();
  try {
    const raw = storage?.getItem(UPDATE_RECOVERY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UpdateRecoveryRecord;
  } catch {
    return null;
  }
}

export function writeUpdateRecoveryRecord(record: UpdateRecoveryRecord): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(UPDATE_RECOVERY_KEY, JSON.stringify(record));
  } catch {
    // Recovery metadata is best-effort and must not block an update.
  }
}

export function clearUpdateRecoveryRecord(): void {
  const storage = getStorage();
  try {
    storage?.removeItem(UPDATE_RECOVERY_KEY);
  } catch {
    // Ignore unavailable or locked browser storage.
  }
}

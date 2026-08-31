import { useCallback, useState } from 'react';
import {
  createEmptyRtMaterialCatalog,
  parseRtMaterialCatalogPayload,
  removeRtMaterialInState,
  RT_MATERIAL_CATALOG_STORAGE_KEY,
  upsertRtMaterialInState,
  type RtMaterialCatalogPayload,
  type RtMaterialCatalogWorkingState,
  type RtMaterialRecord,
  type RtMaterialRecordInput,
} from '@/lib/rtMaterialCatalogStore';

const loadInitialState = (): RtMaterialCatalogWorkingState => {
  if (typeof globalThis.localStorage === 'undefined') {
    return { payload: createEmptyRtMaterialCatalog(), error: null, storeUnreadable: false };
  }
  const raw = globalThis.localStorage.getItem(RT_MATERIAL_CATALOG_STORAGE_KEY);
  if (raw === null) {
    return { payload: createEmptyRtMaterialCatalog(), error: null, storeUnreadable: false };
  }
  try {
    return { payload: parseRtMaterialCatalogPayload(JSON.parse(raw)), error: null, storeUnreadable: false };
  } catch (error) {
    return {
      payload: createEmptyRtMaterialCatalog(),
      error: `The stored material catalog could not be read and was left untouched: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      // Refuse writes for the whole session so the stored data is never clobbered.
      storeUnreadable: true,
    };
  }
};

/** User-authored, revisioned site materials catalog persisted per workstation. */
export function useRtMaterialCatalog() {
  const [state, setState] = useState<RtMaterialCatalogWorkingState>(loadInitialState);

  const persist = useCallback((payload: RtMaterialCatalogPayload): string | null => {
    if (typeof globalThis.localStorage === 'undefined') {
      return 'Browser storage is unavailable; the material catalog cannot be persisted.';
    }
    try {
      globalThis.localStorage.setItem(RT_MATERIAL_CATALOG_STORAGE_KEY, JSON.stringify(payload));
      return null;
    } catch (error) {
      return `The material catalog could not be persisted: ${
        error instanceof Error ? error.message : 'unknown error'
      }`;
    }
  }, []);

  const upsertMaterial = useCallback((input: RtMaterialRecordInput): RtMaterialRecord | null => {
    let saved: RtMaterialRecord | null = null;
    setState((current) => {
      const next = upsertRtMaterialInState(current, input, new Date().toISOString());
      if (next.record === null) return next.state;
      const persistError = persist(next.state.payload);
      if (persistError) return { ...current, error: persistError };
      saved = next.record;
      return next.state;
    });
    return saved;
  }, [persist]);

  const removeMaterial = useCallback((id: string) => {
    setState((current) => {
      const next = removeRtMaterialInState(current, id);
      if (next.storeUnreadable) return next;
      const persistError = persist(next.payload);
      return persistError ? { ...current, error: persistError } : next;
    });
  }, [persist]);

  /** Clears only the transient message; an unreadable store keeps refusing writes. */
  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  return {
    materials: state.payload.materials,
    revisions: state.payload.revisions,
    error: state.error,
    storeUnreadable: state.storeUnreadable,
    upsertMaterial,
    removeMaterial,
    clearError,
  };
}

export type RtMaterialCatalogController = ReturnType<typeof useRtMaterialCatalog>;

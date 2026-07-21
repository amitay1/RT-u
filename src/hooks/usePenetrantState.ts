import { useCallback, useState } from 'react';
import {
  emptyPtSheet,
  type PtAcceptance,
  type PtApplication,
  type PtDevelopment,
  type PtGeneralInfo,
  type PtInspectionConditions,
  type PtMaterials,
  type PtPostCleaning,
  type PtRemoval,
  type PtSheet,
  type PtSurfacePreparation,
} from '@/types/penetrant';
import { normalizePtSheet } from '@/lib/rtPtDocumentCodec';

const prepareSheet = (value: unknown): PtSheet => {
  const normalized = normalizePtSheet(value);
  if (normalized.materials.penetrantType !== 'Type II' || !normalized.materials.sensitivityLevel) return normalized;
  return {
    ...normalized,
    materials: { ...normalized.materials, sensitivityLevel: '' },
  };
};

export function usePenetrantState() {
  const [sheet, setSheet] = useState<PtSheet>(() => prepareSheet(emptyPtSheet));

  const replaceSheet = useCallback((nextSheet: unknown) => {
    setSheet(prepareSheet(nextSheet));
  }, []);

  const resetSheet = useCallback(() => {
    setSheet(prepareSheet(emptyPtSheet));
  }, []);

  const updateGeneral = useCallback((general: PtGeneralInfo) => {
    setSheet((current) => ({ ...current, general }));
  }, []);

  const updateMaterials = useCallback((materials: PtMaterials) => {
    setSheet((current) => ({
      ...current,
      materials: materials.penetrantType === 'Type II'
        ? { ...materials, sensitivityLevel: '' }
        : materials,
    }));
  }, []);

  const updateSurfacePrep = useCallback((surfacePrep: PtSurfacePreparation) => {
    setSheet((current) => ({ ...current, surfacePrep }));
  }, []);

  const updateApplication = useCallback((application: PtApplication) => {
    setSheet((current) => ({ ...current, application }));
  }, []);

  const updateRemoval = useCallback((removal: PtRemoval) => {
    setSheet((current) => ({ ...current, removal }));
  }, []);

  const updateDevelopment = useCallback((development: PtDevelopment) => {
    setSheet((current) => ({ ...current, development }));
  }, []);

  const updateConditions = useCallback((conditions: PtInspectionConditions) => {
    setSheet((current) => ({ ...current, conditions }));
  }, []);

  const updateAcceptance = useCallback((acceptance: PtAcceptance) => {
    setSheet((current) => ({ ...current, acceptance }));
  }, []);

  const updatePostCleaning = useCallback((postCleaning: PtPostCleaning) => {
    setSheet((current) => ({ ...current, postCleaning }));
  }, []);

  const updateTechniqueNotes = useCallback((techniqueNotes: string) => {
    setSheet((current) => ({ ...current, techniqueNotes }));
  }, []);

  return {
    sheet,
    replaceSheet,
    resetSheet,
    updateGeneral,
    updateMaterials,
    updateSurfacePrep,
    updateApplication,
    updateRemoval,
    updateDevelopment,
    updateConditions,
    updateAcceptance,
    updatePostCleaning,
    updateTechniqueNotes,
  };
}

export type PenetrantStateController = ReturnType<typeof usePenetrantState>;

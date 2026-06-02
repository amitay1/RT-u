import { useCallback, useState } from 'react';
import {
  emptyPtSheet,
  type PtSheet,
  type PtGeneralInfo,
  type PtMaterials,
  type PtSurfacePreparation,
  type PtApplication,
  type PtDevelopment,
  type PtInspectionConditions,
  type PtAcceptance,
  type PtPostCleaning,
} from '@/types/penetrant';

export function usePenetrantState() {
  const [sheet, setSheet] = useState<PtSheet>(emptyPtSheet);

  const updateGeneral = useCallback((general: PtGeneralInfo) => {
    setSheet(prev => ({ ...prev, general }));
  }, []);
  const updateMaterials = useCallback((materials: PtMaterials) => {
    setSheet(prev => ({ ...prev, materials }));
  }, []);
  const updateSurfacePrep = useCallback((surfacePrep: PtSurfacePreparation) => {
    setSheet(prev => ({ ...prev, surfacePrep }));
  }, []);
  const updateApplication = useCallback((application: PtApplication) => {
    setSheet(prev => ({ ...prev, application }));
  }, []);
  const updateDevelopment = useCallback((development: PtDevelopment) => {
    setSheet(prev => ({ ...prev, development }));
  }, []);
  const updateConditions = useCallback((conditions: PtInspectionConditions) => {
    setSheet(prev => ({ ...prev, conditions }));
  }, []);
  const updateAcceptance = useCallback((acceptance: PtAcceptance) => {
    setSheet(prev => ({ ...prev, acceptance }));
  }, []);
  const updatePostCleaning = useCallback((postCleaning: PtPostCleaning) => {
    setSheet(prev => ({ ...prev, postCleaning }));
  }, []);

  return {
    sheet,
    updateGeneral,
    updateMaterials,
    updateSurfacePrep,
    updateApplication,
    updateDevelopment,
    updateConditions,
    updateAcceptance,
    updatePostCleaning,
  };
}

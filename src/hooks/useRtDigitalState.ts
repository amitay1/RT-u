import { useCallback, useState } from 'react';
import {
  emptyRtDigitalSheet,
  type RtDigitalAcceptance,
  type RtDigitalAcquisition,
  type RtDigitalAcquisitionDefaults,
  type RtDigitalDetectorPerformance,
  type RtDigitalDisplayAndStorage,
  type RtDigitalGeneralInfo,
  type RtDigitalImageProcessing,
  type RtDigitalIqi,
  type RtDigitalSheet,
  type RtDigitalSource,
  type RtDigitalSystem,
  type RtDigitalWorkflow,
} from '@/types/rtDigital';
import {
  createRtDigitalAcquisition,
  duplicateRtDigitalAcquisition,
  normalizeRtDigitalSheet,
} from '@/lib/rtPtDocumentCodec';
import { applyDigitalAutoMagnification } from '@/lib/rtGeometry';

type AcquisitionPatch = Partial<Omit<RtDigitalAcquisition, 'id'>>;
type MoveDirection = 'up' | 'down';

const withAutoMagnification = <T extends RtDigitalAcquisitionDefaults>(acquisition: T): T => (
  applyDigitalAutoMagnification(acquisition) as T
);

const prepareSheet = (value: unknown): RtDigitalSheet => {
  const normalized = normalizeRtDigitalSheet(value);
  return {
    ...normalized,
    acquisitionDefaults: withAutoMagnification(normalized.acquisitionDefaults),
    acquisitions: normalized.acquisitions.map(withAutoMagnification),
  };
};

export function useRtDigitalState() {
  const [sheet, setSheet] = useState<RtDigitalSheet>(() => prepareSheet(emptyRtDigitalSheet));

  const replaceSheet = useCallback((nextSheet: unknown) => {
    setSheet(prepareSheet(nextSheet));
  }, []);

  const resetSheet = useCallback(() => {
    setSheet(prepareSheet(emptyRtDigitalSheet));
  }, []);

  const updateGeneral = useCallback((general: RtDigitalGeneralInfo) => {
    setSheet((current) => ({ ...current, general }));
  }, []);

  const updateWorkflow = useCallback((workflow: RtDigitalWorkflow) => {
    setSheet((current) => ({ ...current, workflow }));
  }, []);

  const updateSource = useCallback((source: RtDigitalSource) => {
    setSheet((current) => ({ ...current, source }));
  }, []);

  const updateAcquisitionDefaults = useCallback((acquisitionDefaults: RtDigitalAcquisitionDefaults) => {
    setSheet((current) => ({
      ...current,
      acquisitionDefaults: withAutoMagnification(acquisitionDefaults),
    }));
  }, []);

  const updateSystem = useCallback((system: RtDigitalSystem) => {
    setSheet((current) => ({ ...current, system }));
  }, []);

  const updateDetectorPerformance = useCallback((detectorPerformance: RtDigitalDetectorPerformance) => {
    setSheet((current) => ({ ...current, detectorPerformance }));
  }, []);

  const updateImageProcessing = useCallback((imageProcessing: RtDigitalImageProcessing) => {
    setSheet((current) => ({ ...current, imageProcessing }));
  }, []);

  const updateDisplayAndStorage = useCallback((displayAndStorage: RtDigitalDisplayAndStorage) => {
    setSheet((current) => ({ ...current, displayAndStorage }));
  }, []);

  const updateIqi = useCallback((iqi: RtDigitalIqi) => {
    setSheet((current) => ({ ...current, iqi }));
  }, []);

  const updateAcceptance = useCallback((acceptance: RtDigitalAcceptance) => {
    setSheet((current) => ({ ...current, acceptance }));
  }, []);

  const updateTechniqueNotes = useCallback((techniqueNotes: string) => {
    setSheet((current) => ({ ...current, techniqueNotes }));
  }, []);

  const addAcquisition = useCallback((overrides: AcquisitionPatch = {}) => {
    setSheet((current) => ({
      ...current,
      acquisitions: [
        ...current.acquisitions,
        withAutoMagnification(createRtDigitalAcquisition({
          ...current.acquisitionDefaults,
          ...overrides,
        })),
      ],
    }));
  }, []);

  const updateAcquisition = useCallback((id: string, patch: AcquisitionPatch) => {
    setSheet((current) => ({
      ...current,
      acquisitions: current.acquisitions.map((acquisition) => (
        acquisition.id === id ? withAutoMagnification({ ...acquisition, ...patch }) : acquisition
      )),
    }));
  }, []);

  const duplicateAcquisition = useCallback((id: string) => {
    setSheet((current) => {
      const source = current.acquisitions.find((acquisition) => acquisition.id === id);
      if (!source) return current;
      return {
        ...current,
        acquisitions: [
          ...current.acquisitions,
          withAutoMagnification(duplicateRtDigitalAcquisition(source)),
        ],
      };
    });
  }, []);

  const moveAcquisition = useCallback((id: string, direction: MoveDirection) => {
    setSheet((current) => {
      const fromIndex = current.acquisitions.findIndex((acquisition) => acquisition.id === id);
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.acquisitions.length) return current;

      const acquisitions = [...current.acquisitions];
      [acquisitions[fromIndex], acquisitions[toIndex]] = [acquisitions[toIndex], acquisitions[fromIndex]];
      return { ...current, acquisitions };
    });
  }, []);

  const deleteAcquisition = useCallback((id: string) => {
    setSheet((current) => ({
      ...current,
      acquisitions: current.acquisitions.filter((acquisition) => acquisition.id !== id),
    }));
  }, []);

  return {
    sheet,
    replaceSheet,
    resetSheet,
    updateGeneral,
    updateWorkflow,
    updateSource,
    updateAcquisitionDefaults,
    updateSystem,
    updateDetectorPerformance,
    updateImageProcessing,
    updateDisplayAndStorage,
    updateIqi,
    updateAcceptance,
    updateTechniqueNotes,
    addAcquisition,
    updateAcquisition,
    duplicateAcquisition,
    moveAcquisition,
    deleteAcquisition,
  };
}

export type RtDigitalStateController = ReturnType<typeof useRtDigitalState>;

import { useCallback, useState } from 'react';
import {
  createEmptyRtDigitalAcquisitionPlan,
  createEmptyRtDigitalSheet,
  type RtDigitalAcceptance,
  type RtDigitalAcquisition,
  type RtDigitalAcquisitionDefaults,
  type RtDigitalAcquisitionPlan,
  type RtDigitalDetectorPerformance,
  type RtDigitalDisplayAndStorage,
  type RtDigitalGeneralInfo,
  type RtDigitalImageProcessing,
  type RtDigitalIqi,
  type RtDigitalIqiZoneOutput,
  type RtDigitalNormalizedSheet,
  type RtDigitalPlanning,
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
import type { RtDigitalExposureGridDescriptor } from '@/lib/rtDigitalPlanning';

type AcquisitionPatch = Partial<Omit<RtDigitalAcquisition, 'id'>>;
type MoveDirection = 'up' | 'down';

const withAutoMagnification = <T extends RtDigitalAcquisitionDefaults>(acquisition: T): T => (
  applyDigitalAutoMagnification(acquisition) as T
);

const prepareSheet = (value: unknown): RtDigitalNormalizedSheet => {
  const normalized = normalizeRtDigitalSheet(value);
  return {
    ...normalized,
    acquisitionDefaults: withAutoMagnification(normalized.acquisitionDefaults),
    acquisitions: normalized.acquisitions.map((acquisition) => withAutoMagnification({
      ...acquisition,
      plan: acquisition.plan ?? createEmptyRtDigitalAcquisitionPlan(),
    })),
  };
};

export function useRtDigitalState() {
  const [sheet, setSheet] = useState<RtDigitalNormalizedSheet>(() => prepareSheet(createEmptyRtDigitalSheet()));

  const replaceSheet = useCallback((nextSheet: unknown) => {
    setSheet(prepareSheet(nextSheet));
  }, []);

  const resetSheet = useCallback(() => {
    setSheet(prepareSheet(createEmptyRtDigitalSheet()));
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

  const updatePlanning = useCallback((planning: RtDigitalPlanning) => {
    setSheet((current) => ({ ...current, planning }));
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

  const updateAcquisitionPlan = useCallback((id: string, plan: RtDigitalAcquisitionPlan) => {
    setSheet((current) => ({
      ...current,
      acquisitions: current.acquisitions.map((acquisition) => (
        acquisition.id === id ? { ...acquisition, plan } : acquisition
      )),
    }));
  }, []);

  const applyAutoExposureGrid = useCallback((
    grid: RtDigitalExposureGridDescriptor[],
    inspectionAreaId: string,
    governingIqi?: RtDigitalIqiZoneOutput,
  ) => {
    setSheet((current) => {
      const retainedAcquisitions = current.acquisitions.filter((acquisition) => (
        (acquisition.plan?.visual.inspectionAreaId || acquisition.inspectionZone) !== inspectionAreaId
      ));
      const plannedAreaAcquisitions = grid.map((descriptor) => {
        const base = createRtDigitalAcquisition({
          ...current.acquisitionDefaults,
          viewId: descriptor.id,
          description: `Automatic coverage position ${descriptor.row}/${descriptor.column}`,
          inspectionZone: inspectionAreaId,
          imageNaming: descriptor.id,
          coverage: `Grid row ${descriptor.row}, column ${descriptor.column}`,
        });
        const plan = base.plan ?? createEmptyRtDigitalAcquisitionPlan();
        return withAutoMagnification({
          ...base,
          viewId: descriptor.id,
          orientation: descriptor.orientation,
          inspectionZone: inspectionAreaId,
          plan: {
            ...plan,
            gridPlacement: {
              ...plan.gridPlacement,
              row: descriptor.row,
              column: descriptor.column,
              centerX: descriptor.centerXmm,
              centerY: descriptor.centerYmm,
              unit: 'mm' as const,
              detectorOrientation: descriptor.orientation,
            },
            visual: {
              ...current.planning.visual,
              id: plan.visual.id,
              sourcePosition: { ...current.planning.visual.sourcePosition },
              detectorPosition: { ...current.planning.visual.detectorPosition },
              beamCenter: { ...current.planning.visual.beamCenter },
              inspectionAreaId,
            },
            iqiAssignment: governingIqi
              ? {
                  ...plan.iqiAssignment,
                  zoneOutputId: governingIqi.id,
                  designation: governingIqi.designation,
                  requiredWire: governingIqi.requiredWire,
                  requiredHole: governingIqi.requiredHole,
                  shimRequirement: governingIqi.shimRequirement,
                }
              : plan.iqiAssignment,
          },
        });
      });
      const acquisitions = [...retainedAcquisitions, ...plannedAreaAcquisitions].map((acquisition, index) => {
        const viewId = `EXP-${String(index + 1).padStart(Math.max(3, String(retainedAcquisitions.length + plannedAreaAcquisitions.length).length), '0')}`;
        const generatedImageName = !acquisition.imageNaming.trim() || /^EXP-\d+$/i.test(acquisition.imageNaming.trim());
        return {
          ...acquisition,
          viewId,
          imageNaming: generatedImageName ? viewId : acquisition.imageNaming,
        };
      });
      return { ...current, acquisitions };
    });
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
    updatePlanning,
    updateTechniqueNotes,
    addAcquisition,
    updateAcquisition,
    updateAcquisitionPlan,
    applyAutoExposureGrid,
    duplicateAcquisition,
    moveAcquisition,
    deleteAcquisition,
  };
}

export type RtDigitalStateController = ReturnType<typeof useRtDigitalState>;

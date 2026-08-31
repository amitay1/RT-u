import { useCallback, useState } from 'react';
import {
  emptyRtCrSheet,
  type RtCrAcceptance,
  type RtCrExposureDefaults,
  type RtCrExposureView,
  type RtCrGeneralInfo,
  type RtCrImageQuality,
  type RtCrIqi,
  type RtCrPlateSystem,
  type RtCrScanner,
  type RtCrSheet,
  type RtCrSource,
} from '@/types/rtCr';
import {
  createRtCrExposureView,
  duplicateRtCrExposureView,
  normalizeRtCrSheet,
} from '@/lib/rtPtDocumentCodec';
import { applyFilmAutoMagnification } from '@/lib/rtGeometry';
import type { RtCircumferentialPlan } from '@/types/rtFilm';

type ExposureViewPatch = Partial<Omit<RtCrExposureView, 'id'>>;
type MoveDirection = 'up' | 'down';

// CR shares the SFD-based magnification math with film; the helper is structural.
const withAutoMagnification = <T extends RtCrExposureDefaults>(exposure: T): T => (
  applyFilmAutoMagnification(exposure)
);

const prepareSheet = (value: unknown): RtCrSheet => {
  const normalized = normalizeRtCrSheet(value);
  return {
    ...normalized,
    exposureDefaults: withAutoMagnification(normalized.exposureDefaults),
    exposureViews: normalized.exposureViews.map(withAutoMagnification),
  };
};

export function useRtCrState() {
  const [sheet, setSheet] = useState<RtCrSheet>(() => prepareSheet(emptyRtCrSheet));

  const replaceSheet = useCallback((nextSheet: unknown) => {
    setSheet(prepareSheet(nextSheet));
  }, []);

  const resetSheet = useCallback(() => {
    setSheet(prepareSheet(emptyRtCrSheet));
  }, []);

  const updateGeneral = useCallback((general: RtCrGeneralInfo) => {
    setSheet((current) => ({ ...current, general }));
  }, []);

  const updateIso17636TestClass = useCallback((testClass: 'A' | 'B' | '') => {
    setSheet((current) => {
      // The key is deleted (never '') so untouched documents keep their canonical form.
      const { iso17636TestClass: _previous, ...rest } = current;
      return testClass === '' ? rest : { ...rest, iso17636TestClass: testClass };
    });
  }, []);

  const updateCircumferentialPlan = useCallback((plan: RtCircumferentialPlan | null) => {
    setSheet((current) => {
      const { circumferentialPlan: _previous, ...rest } = current;
      return plan === null ? rest : { ...rest, circumferentialPlan: plan };
    });
  }, []);

  const updateExposureDefaults = useCallback((exposureDefaults: RtCrExposureDefaults) => {
    setSheet((current) => ({
      ...current,
      exposureDefaults: withAutoMagnification(exposureDefaults),
    }));
  }, []);

  const updateSource = useCallback((source: RtCrSource) => {
    setSheet((current) => ({ ...current, source }));
  }, []);

  const updatePlateSystem = useCallback((plateSystem: RtCrPlateSystem) => {
    setSheet((current) => ({ ...current, plateSystem }));
  }, []);

  const updateScanner = useCallback((scanner: RtCrScanner) => {
    setSheet((current) => ({ ...current, scanner }));
  }, []);

  const updateImageQuality = useCallback((imageQuality: RtCrImageQuality) => {
    setSheet((current) => ({ ...current, imageQuality }));
  }, []);

  const updateIqi = useCallback((iqi: RtCrIqi) => {
    setSheet((current) => ({ ...current, iqi }));
  }, []);

  const updateAcceptance = useCallback((acceptance: RtCrAcceptance) => {
    setSheet((current) => ({ ...current, acceptance }));
  }, []);

  const updateTechniqueNotes = useCallback((techniqueNotes: string) => {
    setSheet((current) => ({ ...current, techniqueNotes }));
  }, []);

  const addExposureView = useCallback((overrides: ExposureViewPatch = {}) => {
    setSheet((current) => ({
      ...current,
      exposureViews: [
        ...current.exposureViews,
        withAutoMagnification(createRtCrExposureView({
          ...current.exposureDefaults,
          ...overrides,
        })),
      ],
    }));
  }, []);

  const updateExposureView = useCallback((id: string, patch: ExposureViewPatch) => {
    setSheet((current) => ({
      ...current,
      exposureViews: current.exposureViews.map((view) => (
        view.id === id ? withAutoMagnification({ ...view, ...patch }) : view
      )),
    }));
  }, []);

  const duplicateExposureView = useCallback((id: string) => {
    setSheet((current) => {
      const source = current.exposureViews.find((view) => view.id === id);
      if (!source) return current;
      return {
        ...current,
        exposureViews: [
          ...current.exposureViews,
          withAutoMagnification(duplicateRtCrExposureView(source)),
        ],
      };
    });
  }, []);

  const moveExposureView = useCallback((id: string, direction: MoveDirection) => {
    setSheet((current) => {
      const fromIndex = current.exposureViews.findIndex((view) => view.id === id);
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.exposureViews.length) return current;

      const exposureViews = [...current.exposureViews];
      [exposureViews[fromIndex], exposureViews[toIndex]] = [exposureViews[toIndex], exposureViews[fromIndex]];
      return { ...current, exposureViews };
    });
  }, []);

  const deleteExposureView = useCallback((id: string) => {
    setSheet((current) => ({
      ...current,
      exposureViews: current.exposureViews.filter((view) => view.id !== id),
    }));
  }, []);

  return {
    sheet,
    replaceSheet,
    resetSheet,
    updateGeneral,
    updateIso17636TestClass,
    updateCircumferentialPlan,
    updateExposureDefaults,
    updateSource,
    updatePlateSystem,
    updateScanner,
    updateImageQuality,
    updateIqi,
    updateAcceptance,
    updateTechniqueNotes,
    addExposureView,
    updateExposureView,
    duplicateExposureView,
    moveExposureView,
    deleteExposureView,
  };
}

export type RtCrStateController = ReturnType<typeof useRtCrState>;

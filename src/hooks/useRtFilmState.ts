import { useCallback, useState } from 'react';
import {
  emptyRtFilmSheet,
  type RtCircumferentialPlan,
  type RtFilmAcceptance,
  type RtFilmExposureDefaults,
  type RtFilmExposureView,
  type RtFilmGeneralInfo,
  type RtFilmIqi,
  type RtFilmSheet,
  type RtFilmSource,
  type RtFilmSystem,
} from '@/types/rtFilm';
import {
  createRtFilmExposureView,
  duplicateRtFilmExposureView,
  normalizeRtFilmSheet,
} from '@/lib/rtPtDocumentCodec';
import { applyFilmAutoMagnification } from '@/lib/rtGeometry';
import { lookupPs811000DensityRequirement } from '@/lib/ps811000';

type ExposureViewPatch = Partial<Omit<RtFilmExposureView, 'id'>>;
type MoveDirection = 'up' | 'down';

const withAutoMagnification = <T extends RtFilmExposureDefaults>(exposure: T): T => (
  applyFilmAutoMagnification(exposure) as T
);

const withPs811000Density = (sheet: RtFilmSheet): RtFilmSheet => {
  if (!sheet.ps811000Applicable || !sheet.filmSystem.viewingMode) return sheet;
  const requirement = lookupPs811000DensityRequirement(sheet.filmSystem.viewingMode);
  return {
    ...sheet,
    filmSystem: {
      ...sheet.filmSystem,
      requiredDensityMin: requirement.combinedMinimum,
      requiredDensityMax: requirement.maximum,
      individualFilmDensityMinimum: requirement.individualFilmMinimum ?? '',
    },
  };
};

const prepareSheet = (value: unknown): RtFilmSheet => {
  const normalized = normalizeRtFilmSheet(value);
  return withPs811000Density({
    ...normalized,
    exposureDefaults: withAutoMagnification(normalized.exposureDefaults),
    exposureViews: normalized.exposureViews.map(withAutoMagnification),
  });
};

export function useRtFilmState() {
  const [sheet, setSheet] = useState<RtFilmSheet>(() => prepareSheet(emptyRtFilmSheet));

  const replaceSheet = useCallback((nextSheet: unknown) => {
    setSheet(prepareSheet(nextSheet));
  }, []);

  const resetSheet = useCallback(() => {
    setSheet(prepareSheet(emptyRtFilmSheet));
  }, []);

  const updateGeneral = useCallback((general: RtFilmGeneralInfo) => {
    setSheet((current) => ({ ...current, general }));
  }, []);

  const updatePs811000Applicable = useCallback((ps811000Applicable: boolean) => {
    setSheet((current) => withPs811000Density({ ...current, ps811000Applicable }));
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

  const updateExposureDefaults = useCallback((exposureDefaults: RtFilmExposureDefaults) => {
    setSheet((current) => ({
      ...current,
      exposureDefaults: withAutoMagnification(exposureDefaults),
    }));
  }, []);

  const updateSource = useCallback((source: RtFilmSource) => {
    setSheet((current) => ({ ...current, source }));
  }, []);

  const updateFilmSystem = useCallback((filmSystem: RtFilmSystem) => {
    setSheet((current) => withPs811000Density({ ...current, filmSystem }));
  }, []);

  const updateIqi = useCallback((iqi: RtFilmIqi) => {
    setSheet((current) => ({ ...current, iqi }));
  }, []);

  const updateAcceptance = useCallback((acceptance: RtFilmAcceptance) => {
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
        withAutoMagnification(createRtFilmExposureView({
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
          withAutoMagnification(duplicateRtFilmExposureView(source)),
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
    updatePs811000Applicable,
    updateIso17636TestClass,
    updateCircumferentialPlan,
    updateExposureDefaults,
    updateSource,
    updateFilmSystem,
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

export type RtFilmStateController = ReturnType<typeof useRtFilmState>;

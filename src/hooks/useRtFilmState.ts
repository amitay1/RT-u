import { useCallback, useState } from 'react';
import {
  emptyRtFilmSheet,
  type RtFilmSheet,
  type RtFilmGeneralInfo,
  type RtFilmExposureSetup,
  type RtFilmEquipment,
  type RtFilmFilmSystem,
  type RtFilmIqc,
  type RtFilmAcceptance,
  type RtFilmIdentification,
} from '@/types/rtFilm';

export function useRtFilmState() {
  const [sheet, setSheet] = useState<RtFilmSheet>(emptyRtFilmSheet);

  const updateGeneral = useCallback((general: RtFilmGeneralInfo) => {
    setSheet(prev => ({ ...prev, general }));
  }, []);
  const updateExposure = useCallback((exposure: RtFilmExposureSetup) => {
    setSheet(prev => ({ ...prev, exposure }));
  }, []);
  const updateEquipment = useCallback((equipment: RtFilmEquipment) => {
    setSheet(prev => ({ ...prev, equipment }));
  }, []);
  const updateFilmSystem = useCallback((filmSystem: RtFilmFilmSystem) => {
    setSheet(prev => ({ ...prev, filmSystem }));
  }, []);
  const updateIqc = useCallback((iqc: RtFilmIqc) => {
    setSheet(prev => ({ ...prev, iqc }));
  }, []);
  const updateAcceptance = useCallback((acceptance: RtFilmAcceptance) => {
    setSheet(prev => ({ ...prev, acceptance }));
  }, []);
  const updateIdentification = useCallback((identification: RtFilmIdentification) => {
    setSheet(prev => ({ ...prev, identification }));
  }, []);

  return {
    sheet,
    updateGeneral,
    updateExposure,
    updateEquipment,
    updateFilmSystem,
    updateIqc,
    updateAcceptance,
    updateIdentification,
  };
}

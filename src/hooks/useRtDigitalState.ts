import { useCallback, useState } from 'react';
import {
  emptyRtDigitalSheet,
  type RtDigitalSheet,
  type RtDigitalGeneralInfo,
  type RtDigitalExposureSetup,
  type RtDigitalSystemConfig,
  type RtDigitalDetector,
  type RtDigitalImageProcessing,
  type RtDigitalIqc,
  type RtDigitalAcceptance,
  type RtDigitalIdentification,
} from '@/types/rtDigital';

export function useRtDigitalState() {
  const [sheet, setSheet] = useState<RtDigitalSheet>(emptyRtDigitalSheet);

  const updateGeneral = useCallback((general: RtDigitalGeneralInfo) => {
    setSheet(prev => ({ ...prev, general }));
  }, []);
  const updateExposure = useCallback((exposure: RtDigitalExposureSetup) => {
    setSheet(prev => ({ ...prev, exposure }));
  }, []);
  const updateSystem = useCallback((system: RtDigitalSystemConfig) => {
    setSheet(prev => ({ ...prev, system }));
  }, []);
  const updateDetector = useCallback((detector: RtDigitalDetector) => {
    setSheet(prev => ({ ...prev, detector }));
  }, []);
  const updateImageProcessing = useCallback((imageProcessing: RtDigitalImageProcessing) => {
    setSheet(prev => ({ ...prev, imageProcessing }));
  }, []);
  const updateIqc = useCallback((iqc: RtDigitalIqc) => {
    setSheet(prev => ({ ...prev, iqc }));
  }, []);
  const updateAcceptance = useCallback((acceptance: RtDigitalAcceptance) => {
    setSheet(prev => ({ ...prev, acceptance }));
  }, []);
  const updateIdentification = useCallback((identification: RtDigitalIdentification) => {
    setSheet(prev => ({ ...prev, identification }));
  }, []);

  return {
    sheet,
    updateGeneral,
    updateExposure,
    updateSystem,
    updateDetector,
    updateImageProcessing,
    updateIqc,
    updateAcceptance,
    updateIdentification,
  };
}

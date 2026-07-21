import { useState, useEffect, useCallback } from 'react';

const FIRST_RUN_KEY = 'rtpt_inspector_first_run_completed';
const FIRST_RUN_DATA_KEY = 'rtpt_inspector_first_run_data';

export interface FirstRunData {
  completedAt?: string;
  selectedLanguage?: string;
  selectedUnits?: 'metric' | 'imperial';
  defaultStandard?: string;
  organizationName?: string;
  organizationLogo?: string;
  skippedTutorial?: boolean;
  licenseActivated?: boolean;
  version?: string;
}

export interface UseFirstRunReturn {
  isFirstRun: boolean;
  isLoading: boolean;
  firstRunData: FirstRunData | null;
  completeFirstRun: (data?: Partial<FirstRunData>) => void;
  resetFirstRun: () => void;
  updateFirstRunData: (data: Partial<FirstRunData>) => void;
}

export function useFirstRun(): UseFirstRunReturn {
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [firstRunData, setFirstRunData] = useState<FirstRunData | null>(null);

  const normalizeFirstRunData = useCallback((data: FirstRunData | null): FirstRunData | null => {
    if (!data) {
      return null;
    }

    return {
      ...data,
      selectedLanguage: 'en',
    };
  }, []);

  // Check if this is the first run
  useEffect(() => {
    try {
      const completed = localStorage.getItem(FIRST_RUN_KEY);
      const data = localStorage.getItem(FIRST_RUN_DATA_KEY);

      if (completed === 'true') {
        setIsFirstRun(false);
        if (data) {
          const parsedData = normalizeFirstRunData(JSON.parse(data));
          setFirstRunData(parsedData);
          localStorage.setItem(FIRST_RUN_DATA_KEY, JSON.stringify(parsedData));
        }
      } else {
        setIsFirstRun(true);
      }
    } catch (error) {
      console.error('Error checking first run status:', error);
      setIsFirstRun(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeFirstRun = useCallback((data?: Partial<FirstRunData>) => {
    try {
      const completionData = normalizeFirstRunData({
        ...data,
        completedAt: new Date().toISOString(),
        version: '1.0.102',
      }) as FirstRunData;

      localStorage.setItem(FIRST_RUN_KEY, 'true');
      localStorage.setItem(FIRST_RUN_DATA_KEY, JSON.stringify(completionData));

      setIsFirstRun(false);
      setFirstRunData(completionData);
    } catch (error) {
      console.error('Error completing first run:', error);
    }
  }, [normalizeFirstRunData]);

  const resetFirstRun = useCallback(() => {
    try {
      localStorage.removeItem(FIRST_RUN_KEY);
      localStorage.removeItem(FIRST_RUN_DATA_KEY);
      setIsFirstRun(true);
      setFirstRunData(null);
    } catch (error) {
      console.error('Error resetting first run:', error);
    }
  }, []);

  const updateFirstRunData = useCallback((data: Partial<FirstRunData>) => {
    try {
      const currentData = firstRunData || {};
      const newData = normalizeFirstRunData({ ...currentData, ...data }) as FirstRunData;
      localStorage.setItem(FIRST_RUN_DATA_KEY, JSON.stringify(newData));
      setFirstRunData(newData);
    } catch (error) {
      console.error('Error updating first run data:', error);
    }
  }, [firstRunData, normalizeFirstRunData]);

  return {
    isFirstRun,
    isLoading,
    firstRunData,
    completeFirstRun,
    resetFirstRun,
    updateFirstRunData
  };
}

export default useFirstRun;

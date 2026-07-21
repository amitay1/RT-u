import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { getStorageData, setStorageData, STORAGE_KEYS } from '@/services/unifiedStorage';

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface GeneralSettings {
  language: 'en' | 'he';
  theme: 'light' | 'dark' | 'system';
  uiFont: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  timezone: string;
}

export interface UnitsSettings {
  lengthUnit: 'mm' | 'inch';
  angleUnit: 'degrees' | 'radians';
  temperatureUnit: 'celsius' | 'fahrenheit';
}

export interface ExportSettings {
  defaultExportFormat: 'pdf' | 'docx' | 'both';
  includeCompanyLogo: boolean;
  includeCoverPage: boolean;
  includeTableOfContents: boolean;
  includeDrawings: boolean;
  pdfQuality: 'draft' | 'standard' | 'high';
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
}

export interface CompanySettings {
  companyName: string;
  companyLogo: string; // Base64 or URL
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  certificationNumber: string;
  nadcapNumber: string;
  iso17025Number: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  validationWarnings: boolean;
  autoSaveReminder: boolean;
  autoSaveInterval: number; // minutes
  showTooltips: boolean;
  soundEffects: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  units: UnitsSettings;
  export: ExportSettings;
  company: CompanySettings;
  notifications: NotificationSettings;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const defaultSettings: AppSettings = {
  general: {
    language: 'en',
    theme: 'dark',
    uiFont: 'IBM Plex Sans',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  },
  units: {
    lengthUnit: 'mm',
    angleUnit: 'degrees',
    temperatureUnit: 'celsius',
  },
  export: {
    defaultExportFormat: 'pdf',
    includeCompanyLogo: true,
    includeCoverPage: true,
    includeTableOfContents: true,
    includeDrawings: true,
    pdfQuality: 'standard',
    pageSize: 'A4',
    orientation: 'portrait',
  },
  company: {
    companyName: '',
    companyLogo: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: '',
    certificationNumber: '',
    nadcapNumber: '',
    iso17025Number: '',
  },
  notifications: {
    emailNotifications: false,
    validationWarnings: true,
    autoSaveReminder: true,
    autoSaveInterval: 5,
    showTooltips: true,
    soundEffects: false,
  },
};

// ============================================================================
// CONTEXT
// ============================================================================

export interface SettingsContextType {
  settings: AppSettings;
  updateSettings: <K extends keyof AppSettings>(
    category: K,
    updates: Partial<AppSettings[K]>
  ) => void;
  resetSettings: (category?: keyof AppSettings) => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
  isLoading: boolean;
}

// This context remains public for the existing hook while its persistence provider stays co-located.
// eslint-disable-next-line react-refresh/only-export-components
export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================================================
// PROVIDER (uses unified storage for cross-browser persistence)
// ============================================================================

const STORAGE_KEY = STORAGE_KEYS.SETTINGS;

function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    general: {
      ...settings.general,
      language: 'en',
    },
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Load settings from unified storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await getStorageData<AppSettings>(STORAGE_KEY, defaultSettings);
        if (stored) {
          // Merge with defaults to handle new settings
          setSettings(normalizeSettings(deepMerge(defaultSettings, stored)));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };

    loadSettings();
  }, []);

  // Save settings to unified storage on change
  useEffect(() => {
    if (!isLoading && initialLoadDone.current) {
      const saveSettings = async () => {
        try {
          await setStorageData(STORAGE_KEY, settings);
        } catch (error) {
          console.error('Failed to save settings:', error);
        }
      };

      saveSettings();
    }
  }, [settings, isLoading]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.general.theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      root.classList.toggle('dark', settings.general.theme === 'dark');
    }
  }, [settings.general.theme]);

  const updateSettings = <K extends keyof AppSettings>(
    category: K,
    updates: Partial<AppSettings[K]>
  ) => {
    setSettings(prev => normalizeSettings({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  };

  const resetSettings = (category?: keyof AppSettings) => {
    if (category) {
      setSettings(prev => ({
        ...prev,
        [category]: defaultSettings[category],
      }));
    } else {
      setSettings(defaultSettings);
    }
  };

  const exportSettings = (): string => {
    return JSON.stringify(settings, null, 2);
  };

  const importSettings = (json: string): boolean => {
    try {
      const imported: unknown = JSON.parse(json);
      if (!isPlainObject(imported)) {
        return false;
      }
      setSettings(normalizeSettings(deepMerge(defaultSettings, imported)));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        exportSettings,
        importSettings,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// NOTE: useSettings hook is in @/hooks/useSettings

// ============================================================================
// UTILITIES
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T extends object>(target: T, source: unknown): T {
  if (!isPlainObject(source)) {
    return { ...target };
  }

  const targetRecord = target as Record<string, unknown>;
  const result: Record<string, unknown> = { ...targetRecord };

  for (const key of Object.keys(targetRecord)) {
    const targetValue = targetRecord[key];
    const sourceValue = source[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (isPlainObject(targetValue)) {
      if (isPlainObject(sourceValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      }
      continue;
    }

    if (typeof sourceValue === typeof targetValue) {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

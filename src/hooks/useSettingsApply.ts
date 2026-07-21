/**
 * Hook for applying settings throughout the application
 * This hook provides utility functions that use the current settings
 */

import { useSettings } from '@/hooks/useSettings';
import { useTheme } from 'next-themes';
import { useEffect, useCallback } from 'react';

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useSettingsApply() {
  const { settings } = useSettings();
  const { setTheme } = useTheme();

  // Sync theme with next-themes
  useEffect(() => {
    setTheme(settings.general.theme);
  }, [settings.general.theme, setTheme]);

  // Format date according to settings
  const formatDate = useCallback((date: Date | string | number): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    switch (settings.general.dateFormat) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }, [settings.general.dateFormat]);

  // Format time according to settings
  const formatTime = useCallback((date: Date | string | number): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    if (settings.general.timeFormat === '24h') {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }, [settings.general.timeFormat]);

  // Format datetime
  const formatDateTime = useCallback((date: Date | string | number): string => {
    return `${formatDate(date)} ${formatTime(date)}`;
  }, [formatDate, formatTime]);

  // Convert length to display unit
  const formatLength = useCallback((valueInMm: number, showUnit = true, decimals = 2): string => {
    if (settings.units.lengthUnit === 'inch') {
      const inches = valueInMm / 25.4;
      return showUnit ? `${inches.toFixed(decimals)} in` : inches.toFixed(decimals);
    }
    return showUnit ? `${valueInMm.toFixed(decimals)} mm` : valueInMm.toFixed(decimals);
  }, [settings.units.lengthUnit]);

  // Convert from display unit to mm
  const parseLengthToMm = useCallback((value: number): number => {
    if (settings.units.lengthUnit === 'inch') {
      return value * 25.4;
    }
    return value;
  }, [settings.units.lengthUnit]);

  // Format angle
  const formatAngle = useCallback((valueInDegrees: number, showUnit = true, decimals = 1): string => {
    if (settings.units.angleUnit === 'radians') {
      const radians = valueInDegrees * (Math.PI / 180);
      return showUnit ? `${radians.toFixed(decimals)} rad` : radians.toFixed(decimals);
    }
    return showUnit ? `${valueInDegrees.toFixed(decimals)}°` : valueInDegrees.toFixed(decimals);
  }, [settings.units.angleUnit]);

  // Format temperature
  const formatTemperature = useCallback((valueInCelsius: number, showUnit = true, decimals = 1): string => {
    if (settings.units.temperatureUnit === 'fahrenheit') {
      const fahrenheit = (valueInCelsius * 9/5) + 32;
      return showUnit ? `${fahrenheit.toFixed(decimals)}°F` : fahrenheit.toFixed(decimals);
    }
    return showUnit ? `${valueInCelsius.toFixed(decimals)}°C` : valueInCelsius.toFixed(decimals);
  }, [settings.units.temperatureUnit]);

  // Get current unit labels
  const getUnitLabels = useCallback(() => ({
    length: settings.units.lengthUnit === 'mm' ? 'mm' : 'in',
    angle: settings.units.angleUnit === 'degrees' ? '°' : 'rad',
    temperature: settings.units.temperatureUnit === 'celsius' ? '°C' : '°F',
  }), [settings.units]);

  // Get current date/time
  const getCurrentDate = useCallback((): string => {
    return formatDate(new Date());
  }, [formatDate]);

  const getCurrentTime = useCallback((): string => {
    return formatTime(new Date());
  }, [formatTime]);

  const getCurrentDateTime = useCallback((): string => {
    return formatDateTime(new Date());
  }, [formatDateTime]);

  return {
    // Date/Time formatters
    formatDate,
    formatTime,
    formatDateTime,
    getCurrentDate,
    getCurrentTime,
    getCurrentDateTime,
    
    // Unit formatters
    formatLength,
    parseLengthToMm,
    formatAngle,
    formatTemperature,
    getUnitLabels,
    
    // Direct access to settings
    settings,
    
    // Commonly used settings
    theme: settings.general.theme,
    language: settings.general.language,
    lengthUnit: settings.units.lengthUnit,
    dateFormat: settings.general.dateFormat,
    
    // Company info shortcuts
    companyName: settings.company.companyName,
    companyLogo: settings.company.companyLogo,
    
    // Export settings
    defaultExportFormat: settings.export.defaultExportFormat,
    pageSize: settings.export.pageSize,
    includeCompanyLogo: settings.export.includeCompanyLogo,
  };
}

// ============================================================================
// SIMPLE FORMATTERS (for use without hook)
// ============================================================================

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Parse a localized number string
 */
export function parseLocalNumber(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

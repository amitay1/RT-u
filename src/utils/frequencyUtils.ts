// @ts-nocheck
import { StandardType } from "@/types/techniqueSheet";

/**
 * Get resolution values based on frequency (MIL-STD-2154 Table II)
 */
export const getResolutionValues = (frequency: string): { entry: number; back: number } => {
  const resolutions: Record<string, { entry: number; back: number }> = {
    "0.5": { entry: 1.000, back: 0.400 },   // 0.5 MHz (BS EN 10228-4)
    "1.0": { entry: 0.500, back: 0.200 },   // 1 MHz
    "2.0": { entry: 0.300, back: 0.120 },   // 2 MHz
    "2.25": { entry: 0.250, back: 0.100 },  // 2.25 MHz
    "4.0": { entry: 0.150, back: 0.060 },   // 4 MHz
    "5.0": { entry: 0.125, back: 0.050 },   // 5 MHz
    // 6.0 MHz is used by BS EN 10228-4 upper nominal limit.
    // Keep this as UI guidance value between 5 and 10 MHz.
    "6.0": { entry: 0.100, back: 0.040 },   // interpolated guidance
    "10.0": { entry: 0.050, back: 0.025 },  // 10 MHz
    "15.0": { entry: 0.035, back: 0.020 },  // 15 MHz
    "20.0": { entry: 0.025, back: 0.015 },  // 20 MHz (composite guidance)
  };
  return resolutions[frequency] || { entry: 0.125, back: 0.05 };
};

/**
 * Frequency options available for each standard
 */
export const frequencyOptionsByStandard: Record<StandardType, string[]> = {
  "MIL-STD-2154": ["1.0", "2.25", "5.0", "10.0", "15.0"],
  "AMS-STD-2154E": ["1.0", "2.25", "5.0", "10.0", "15.0"],
  "ASTM-A388": ["1.0", "2.25", "5.0"],
  "ASTM-E2375": ["1.0", "2.25", "5.0", "10.0", "15.0"],
  "ASTM-E1001": ["2.25", "5.0", "10.0", "15.0"],
  "ASTM-E2580": ["0.5", "1.0", "2.25", "5.0", "10.0", "15.0", "20.0"],
  "ASTM-E588": ["10.0"],
  "ASTM-E127": ["2.25", "5.0", "10.0", "15.0"],
  "ASTM-E164": ["1.0", "2.25", "5.0"],
  "BS-EN-10228-3": ["1.0", "2.0", "4.0", "5.0", "6.0"],
  "BS-EN-10228-4": ["0.5", "1.0", "2.0", "4.0", "5.0", "6.0"],
  "EN-ISO-16810": ["0.5", "1.0", "2.0", "4.0", "5.0", "10.0", "15.0"],
  "AMS-2630": ["2.25", "5.0", "10.0", "15.0"],
  "AMS-2631": ["2.25", "5.0", "10.0"],
  "AMS-2632": ["5.0", "10.0", "15.0"],
  "NDIP-1226": ["5.0"],
  "NDIP-1227": ["5.0"],
  "NDIP-1254": ["5.0"],
  "NDIP-1257": ["5.0"],
  "NDIP-1260": ["5.0"],
  "PWA-SIM": ["5.0"],
};

/**
 * Get frequency options for a specific standard
 */
export const getFrequencyOptionsForStandard = (standard: StandardType): string[] => {
  return frequencyOptionsByStandard[standard] || frequencyOptionsByStandard["AMS-STD-2154E"];
};

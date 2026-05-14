/**
 * useExportCaptures - Smart hook for managing export captures
 *
 * Automatically captures visual elements when tabs change,
 * caches results, and provides ready-to-use images for export.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  smartCapture,
  preCaptureForExport,
  clearCaptureCache,
  type CaptureOptions,
  type CaptureResult,
} from '@/utils/export/captureEngine';

export interface ExportCaptures {
  technicalDrawing?: string;
  calibrationBlockDiagram?: string;        // Straight beam FBH diagram
  angleBeamCalibrationDiagram?: string;    // Angle beam calibration block
  e2375Diagram?: string;                   // ASTM E2375 scan directions diagram
  threeDView?: string;
  scanDirectionsView?: string;
}

export interface UseExportCapturesReturn {
  captures: ExportCaptures;
  isCapturing: boolean;
  lastCaptureTime: number | null;
  captureTechnicalDrawing: () => Promise<boolean>;
  captureCalibrationBlock: () => Promise<boolean>;
  captureAngleBeamBlock: () => Promise<boolean>;
  captureE2375Diagram: () => Promise<boolean>;
  capture3DView: () => Promise<boolean>;
  captureScanDirections: () => Promise<boolean>;
  captureAll: () => Promise<ExportCaptures>;
  clearCaptures: () => void;
  hasAllRequiredCaptures: boolean;
}

const TECHNICAL_DRAWING_SELECTORS = [
  '#technical-drawing-canvas',
  'canvas#technical-drawing-canvas',
  '[data-testid="technical-drawing"] canvas',
  '.technical-drawing-container canvas',
  '.real-time-drawing canvas',
  '.real-time-technical-drawing canvas',
];

const CALIBRATION_BLOCK_SELECTORS = [
  // Container with ALL FBH blocks (captures all 3 blocks together)
  '#calibration-blocks-container',
  '[data-testid="calibration-blocks-container"]',
  '.calibration-blocks-preview',
  // Individual SVG fallbacks
  '#calibration-block-svg',
  'svg#calibration-block-svg',
  '[data-testid="calibration-block-diagram"]',
  'svg[data-testid="calibration-block-diagram"]',
  '.fbh-straight-beam-drawing',
  'svg.fbh-straight-beam-drawing',
  '.angle-beam-drawing',
  'svg.angle-beam-drawing',
  '.calibration-drawing svg',
  '.calibration-tab svg',
];

const THREE_D_SELECTORS = [
  '.react-three-fiber canvas',
  '[data-testid="3d-viewer"] canvas',
  '.three-d-viewer canvas',
  'canvas[data-engine="three.js"]',
];

const SCAN_DIRECTIONS_SELECTORS = [
  '#scan-directions-canvas',
  '[data-testid="scan-directions-canvas"]',
  '.inspection-plan-viewer canvas',
];

// Angle beam calibration block selectors
const ANGLE_BEAM_SELECTORS = [
  '[data-testid="tube-angle-beam-reference-image"]',
  '[data-testid="tube-angle-beam-reference-drawing"] img',
  '[data-testid="tube-angle-beam-reference-drawing"]',
  '[data-testid="angle-beam-export-capture"]',
  '[data-testid="angle-beam-image-capture"]',  // New - image capture container
  '.angle-beam-image-capture',                  // New - class selector
  '.angle-beam-calibration-image',              // New - direct image selector
  '[data-testid="angle-beam-calibration-block"]',
  '.angle-beam-calibration-block',
];

// E2375 scan directions diagram selectors (supports both SVG diagrams and images)
const E2375_DIAGRAM_SELECTORS = [
  // SVG-based diagrams (TubeScanDiagram, ConeScanDiagram)
  '[data-testid="scan-direction-svg"]',
  'svg[data-testid="scan-direction-svg"]',
  '#scan-direction-svg',
  'svg.scan-direction-diagram',
  // Container with SVG inside
  '[data-testid="e2375-diagram"]',
  '[data-testid="e2375-diagram"] svg',
  // Legacy image-based diagrams
  '[data-testid="e2375-diagram-img"]',
  '.e2375-diagram-image img',
  '.e2375-diagram-container img',
];

export function useExportCaptures(): UseExportCapturesReturn {
  const [captures, setCaptures] = useState<ExportCaptures>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const waitForCaptureTarget = useCallback(async (selectors: string[], timeoutMs = 4000): Promise<void> => {
    const start = Date.now();

    const isReadyElement = (element: Element | null): boolean => {
      if (!element) return false;

      if (element instanceof HTMLCanvasElement) {
        return element.width > 0 && element.height > 0;
      }

      if (element instanceof SVGElement) {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }

      if (element instanceof HTMLImageElement) {
        return element.complete && element.naturalWidth > 0;
      }

      if (element instanceof HTMLElement) {
        const nested =
          element.querySelector('canvas') ||
          element.querySelector('svg') ||
          element.querySelector('img');

        if (nested) {
          return isReadyElement(nested);
        }

        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }

      return false;
    };

    while (Date.now() - start < timeoutMs) {
      for (const selector of selectors) {
        if (isReadyElement(document.querySelector(selector))) {
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }, []);

  // Capture technical drawing
  const captureTechnicalDrawing = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);

    try {
      // Wait for canvas to fully render
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await smartCapture(TECHNICAL_DRAWING_SELECTORS, {
        scale: 3, // Higher scale for better quality
        quality: 1.0, // Maximum quality
        backgroundColor: 'white',
      });

      if (result.success && result.data) {
        console.log('Technical drawing captured successfully');
        setCaptures(prev => ({ ...prev, technicalDrawing: result.data }));
        setLastCaptureTime(Date.now());
        return true;
      }

      console.warn('Technical drawing capture failed:', result.error);
      return false;
    } catch (error) {
      console.error('Error capturing technical drawing:', error);
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Capture calibration block diagram
  const captureCalibrationBlock = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);

    try {
      // Wait longer for SVG to fully render
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await smartCapture(CALIBRATION_BLOCK_SELECTORS, {
        scale: 3, // Higher scale for better quality
        quality: 1.0, // Maximum quality
        backgroundColor: 'white',
        maxWidth: 1800,
        maxHeight: 1200,
      });

      if (result.success && result.data) {
        console.log('Calibration block diagram captured successfully');
        setCaptures(prev => ({ ...prev, calibrationBlockDiagram: result.data }));
        setLastCaptureTime(Date.now());
        return true;
      }

      console.warn('Calibration block capture failed:', result.error);
      return false;
    } catch (error) {
      console.error('Error capturing calibration block:', error);
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Capture 3D view
  const capture3DView = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);

    try {
      const result = await smartCapture(THREE_D_SELECTORS, {
        scale: 1.5,
        quality: 0.9,
      });

      if (result.success && result.data) {
        setCaptures(prev => ({ ...prev, threeDView: result.data }));
        setLastCaptureTime(Date.now());
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error capturing 3D view:', error);
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Capture angle beam calibration block diagram
  const captureAngleBeamBlock = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);

    try {
      await waitForCaptureTarget(ANGLE_BEAM_SELECTORS, 5000);

      let result: CaptureResult = { success: false, error: 'Angle beam target not ready' };
      for (let attempt = 0; attempt < 4; attempt++) {
        result = await smartCapture(ANGLE_BEAM_SELECTORS, {
          scale: 3,
          quality: 1.0,
          backgroundColor: 'white',
          maxWidth: 1800,
          maxHeight: 1200,
        });

        if (result.success && result.data) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 250));
      }

      if (result.success && result.data) {
        console.log('Angle beam calibration block captured successfully');
        setCaptures(prev => ({ ...prev, angleBeamCalibrationDiagram: result.data }));
        setLastCaptureTime(Date.now());
        return true;
      }

      console.warn('Angle beam capture failed:', result.error);
      return false;
    } catch (error) {
      console.error('Error capturing angle beam block:', error);
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, [waitForCaptureTarget]);

  // Capture E2375 scan directions diagram
  const captureE2375Diagram = useCallback(async (): Promise<boolean> => {
    setIsCapturing(true);

    try {
      // Wait for image to render
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await smartCapture(E2375_DIAGRAM_SELECTORS, {
        scale: 2,
        quality: 1.0,
        backgroundColor: 'white',
        maxWidth: 1200,
        maxHeight: 800,
      });

      if (result.success && result.data) {
        console.log('E2375 diagram captured successfully');
        setCaptures(prev => ({ ...prev, e2375Diagram: result.data }));
        setLastCaptureTime(Date.now());
        return true;
      }

      console.warn('E2375 diagram capture failed:', result.error);
      return false;
    } catch (error) {
      console.error('Error capturing E2375 diagram:', error);
      return false;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Capture scan directions drawing
  // NOTE: Scan directions are now displayed via E2375 PDF iframe, not canvas
  // We don't capture this anymore - the PDF is used directly in exports
  const captureScanDirections = useCallback(async (): Promise<boolean> => {
    console.log('Scan directions: Using E2375 PDF directly (no capture needed)');
    // Return true to indicate "success" but we're not actually capturing anything
    return true;
  }, []);

  // Capture all at once
  const captureAllFn = useCallback(async (): Promise<ExportCaptures> => {
    setIsCapturing(true);

    try {
      // Pre-capture with built-in function
      const preCaptures = await preCaptureForExport();

      const newCaptures: ExportCaptures = {
        technicalDrawing: preCaptures.technicalDrawing,
        calibrationBlockDiagram: preCaptures.calibrationBlock,
        threeDView: preCaptures.threeDView,
      };

      // Remove undefined values
      Object.keys(newCaptures).forEach(key => {
        if (newCaptures[key as keyof ExportCaptures] === undefined) {
          delete newCaptures[key as keyof ExportCaptures];
        }
      });

      setCaptures(newCaptures);
      setLastCaptureTime(Date.now());

      return newCaptures;
    } catch (error) {
      console.error('Error capturing all:', error);
      return {};
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // Clear all captures
  const clearCaptures = useCallback(() => {
    setCaptures({});
    setLastCaptureTime(null);
    clearCaptureCache();
  }, []);

  // Check if we have required captures
  const hasAllRequiredCaptures = Boolean(captures.technicalDrawing);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
    };
  }, []);

  return {
    captures,
    isCapturing,
    lastCaptureTime,
    captureTechnicalDrawing,
    captureCalibrationBlock,
    captureAngleBeamBlock,
    captureE2375Diagram,
    capture3DView,
    captureScanDirections,
    captureAll: captureAllFn,
    clearCaptures,
    hasAllRequiredCaptures,
  };
}

/**
 * Hook for auto-capturing when a specific tab becomes active
 */
export function useAutoCaptureOnTab(
  activeTab: string,
  targetTab: string,
  captureFunction: () => Promise<boolean>,
  delay: number = 500
): void {
  const hasCapuredRef = useRef(false);

  useEffect(() => {
    if (activeTab === targetTab && !hasCapuredRef.current) {
      const timer = setTimeout(async () => {
        const success = await captureFunction();
        if (success) {
          hasCapuredRef.current = true;
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [activeTab, targetTab, captureFunction, delay]);

  // Reset when tab changes away
  useEffect(() => {
    if (activeTab !== targetTab) {
      hasCapuredRef.current = false;
    }
  }, [activeTab, targetTab]);
}

export default useExportCaptures;

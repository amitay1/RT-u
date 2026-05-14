/**
 * Capture Engine - Universal Visual Element Capture System
 *
 * Captures ANY visual element (Canvas, SVG, DOM) and converts to Base64 PNG
 * with automatic retry, quality control, and caching.
 */

export interface CaptureOptions {
  quality?: number;        // 0-1, default 0.92
  scale?: number;          // Resolution multiplier, default 2 for retina
  backgroundColor?: string; // Background color, default 'white'
  maxWidth?: number;       // Max width in pixels
  maxHeight?: number;      // Max height in pixels
  timeout?: number;        // Max wait time in ms, default 3000
  retries?: number;        // Number of retries, default 3
}

export interface CaptureResult {
  success: boolean;
  data?: string;           // Base64 PNG data URL
  width?: number;
  height?: number;
  error?: string;
}

// Cache for captured images
const captureCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds
const MIN_CHILD_CAPTURE_AREA = 2500; // Ignore small UI icons inside capture containers

function getRenderedArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function getBestCapturableChild(element: HTMLElement): HTMLCanvasElement | HTMLImageElement | SVGElement | null {
  const candidates = Array.from(element.querySelectorAll('canvas, img, svg'))
    .map((child) => {
      const area = getRenderedArea(child);
      const priority =
        child instanceof HTMLImageElement ? 3 :
        child instanceof HTMLCanvasElement ? 2 :
        child instanceof SVGElement ? 1 :
        0;

      return { child, area, priority };
    })
    .filter(({ child, area }) => {
      if (area < MIN_CHILD_CAPTURE_AREA) return false;
      if (child instanceof HTMLCanvasElement) return child.width > 0 && child.height > 0;
      if (child instanceof HTMLImageElement) return true;
      if (child instanceof SVGElement) return true;
      return false;
    })
    .sort((a, b) => {
      const areaDelta = b.area - a.area;
      if (areaDelta !== 0) return areaDelta;
      return b.priority - a.priority;
    });

  const best = candidates[0]?.child;
  if (
    best instanceof HTMLCanvasElement ||
    best instanceof HTMLImageElement ||
    best instanceof SVGElement
  ) {
    return best;
  }

  return null;
}

/**
 * Capture a canvas element to Base64 PNG
 */
export async function captureCanvas(
  canvasOrId: HTMLCanvasElement | string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const { quality = 0.92, timeout = 3000, retries = 3 } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const canvas = typeof canvasOrId === 'string'
        ? document.getElementById(canvasOrId) as HTMLCanvasElement
        : canvasOrId;

      if (!canvas) {
        if (attempt < retries - 1) {
          await sleep(timeout / retries);
          continue;
        }
        return { success: false, error: 'Canvas element not found' };
      }

      // Wait for canvas to have content
      if (canvas.width === 0 || canvas.height === 0) {
        await sleep(100);
        continue;
      }

      const data = canvas.toDataURL('image/png', quality);

      // Validate data
      if (!data || data.length < 100 || data === 'data:,') {
        if (attempt < retries - 1) {
          await sleep(100);
          continue;
        }
        return { success: false, error: 'Canvas is empty or invalid' };
      }

      return {
        success: true,
        data,
        width: canvas.width,
        height: canvas.height,
      };
    } catch (error) {
      if (attempt === retries - 1) {
        return { success: false, error: String(error) };
      }
      await sleep(100);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Capture an IMG element to Base64 PNG
 */
export async function captureImage(
  imgOrSelector: HTMLImageElement | string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const {
    scale = 2,
    backgroundColor = 'white',
    maxWidth = 1800,
    maxHeight = 1200,
    quality = 0.92
  } = options;

  try {
    // Get IMG element
    const img = typeof imgOrSelector === 'string'
      ? document.querySelector(imgOrSelector) as HTMLImageElement
      : imgOrSelector;

    if (!img) {
      return { success: false, error: 'Image element not found' };
    }

    // Wait for image to load if not already loaded
    if (!img.complete) {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        setTimeout(reject, 3000); // Timeout after 3s
      });
    }

    if (img.naturalWidth === 0) {
      return { success: false, error: 'Image failed to load or has no dimensions' };
    }

    // Calculate dimensions
    let width = img.naturalWidth * scale;
    let height = img.naturalHeight * scale;

    // Apply max dimensions while maintaining aspect ratio
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height *= ratio;
    }
    if (height > maxHeight) {
      const ratio = maxHeight / height;
      height = maxHeight;
      width *= ratio;
    }

    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return { success: false, error: 'Failed to get canvas context' };
    }

    // For cross-origin images, we need to handle CORS properly
    // If the image has crossOrigin set or is from external source, try to load fresh
    const isExternal = img.crossOrigin !== null || !img.src.startsWith(window.location.origin);
    
    if (isExternal) {
      // For external/CORS images, create a new image with crossOrigin
      const corsImg = new Image();
      corsImg.crossOrigin = 'anonymous';
      
      try {
        await new Promise<void>((resolve, reject) => {
          corsImg.onload = () => resolve();
          corsImg.onerror = () => reject(new Error('CORS image load failed'));
          // Add cache-busting to avoid cached non-CORS response
          const separator = img.src.includes('?') ? '&' : '?';
          corsImg.src = img.src + separator + '_cors=' + Date.now();
          setTimeout(() => reject(new Error('CORS image timeout')), 5000);
        });
        
        // Use the CORS-enabled image
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(corsImg, 0, 0, width, height);
        
        const data = canvas.toDataURL('image/png', quality);
        return { success: true, data, width, height };
      } catch (corsError) {
        // CORS failed, try direct draw as fallback (might work for same-origin)
        console.warn('CORS capture failed, trying direct:', corsError);
      }
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw image
    ctx.drawImage(img, 0, 0, width, height);

    const data = canvas.toDataURL('image/png', quality);

    return {
      success: true,
      data,
      width,
      height,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Capture an SVG element to Base64 PNG
 */
export async function captureSVG(
  svgOrSelector: SVGElement | string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const {
    scale = 2,
    backgroundColor = 'white',
    maxWidth = 1800,
    maxHeight = 1200,
    quality = 0.92
  } = options;

  try {
    // Get SVG element
    const svg = typeof svgOrSelector === 'string'
      ? document.querySelector(svgOrSelector) as SVGElement
      : svgOrSelector;

    if (!svg) {
      return { success: false, error: 'SVG element not found' };
    }

    // Clone SVG to avoid modifying original
    const clonedSvg = svg.cloneNode(true) as SVGElement;

    // Get dimensions
    const bbox = svg.getBoundingClientRect();
    let width = bbox.width * scale;
    let height = bbox.height * scale;

    // Validate dimensions - SVG might not be rendered yet
    if (width <= 0 || height <= 0) {
      return { success: false, error: 'SVG has zero dimensions - not rendered or hidden' };
    }

    // Apply max dimensions
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height *= ratio;
    }
    if (height > maxHeight) {
      const ratio = maxHeight / height;
      height = maxHeight;
      width *= ratio;
    }

    // Set SVG dimensions
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));

    // Ensure viewBox is set
    if (!clonedSvg.getAttribute('viewBox')) {
      clonedSvg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
    }

    // Inline all styles
    inlineStyles(clonedSvg);

    // Convert to data URL
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      URL.revokeObjectURL(svgUrl);
      return { success: false, error: 'Failed to get canvas context' };
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Load and draw image with timeout to prevent hanging
    const img = new Image();
    const LOAD_TIMEOUT = 5000; // 5 second timeout

    const result = await new Promise<CaptureResult>((resolve) => {
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(svgUrl);
          resolve({ success: false, error: 'SVG image load timeout (5s)' });
        }
      }, LOAD_TIMEOUT);

      img.onload = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(svgUrl);

        const data = canvas.toDataURL('image/png', quality);
        resolve({
          success: true,
          data,
          width,
          height,
        });
      };

      img.onerror = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        URL.revokeObjectURL(svgUrl);
        resolve({ success: false, error: 'Failed to load SVG as image' });
      };

      img.src = svgUrl;
    });

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Capture any DOM element to Base64 PNG using html2canvas-like approach
 */
export async function captureElement(
  elementOrSelector: HTMLElement | string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const { scale = 2, backgroundColor = 'white', quality = 0.92, maxWidth = 1800, maxHeight = 1200 } = options;

  try {
    const element = typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector) as HTMLElement
      : elementOrSelector;

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    const bestChild = getBestCapturableChild(element);
    if (bestChild instanceof HTMLCanvasElement) {
      return captureCanvas(bestChild, options);
    }
    if (bestChild instanceof HTMLImageElement) {
      return captureImage(bestChild, options);
    }
    if (bestChild instanceof SVGElement) {
      return captureSVG(bestChild, options);
    }

    // For other elements, try to find a WebGL canvas (Three.js)
    const webglCanvas = element.querySelector('canvas[data-engine]') ||
                        element.querySelector('.react-three-fiber canvas') ||
                        element.querySelector('canvas');
    if (webglCanvas) {
      return captureCanvas(webglCanvas as HTMLCanvasElement, options);
    }

    return { success: false, error: 'No capturable element found (canvas, SVG, or image)' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Smart capture - automatically detects and captures the best available element
 */
export async function smartCapture(
  selectors: string[],
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  for (const selector of selectors) {
    // Check cache first
    const cached = captureCache.get(selector);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { success: true, data: cached.data };
    }

    const element = document.querySelector(selector);
    if (!element) continue;

    let result: CaptureResult;

    if (element instanceof HTMLCanvasElement) {
      result = await captureCanvas(element, options);
    } else if (element instanceof SVGElement) {
      result = await captureSVG(element, options);
    } else if (element instanceof HTMLImageElement) {
      result = await captureImage(element, options);
    } else if (element instanceof HTMLElement) {
      result = await captureElement(element, options);
    } else {
      continue;
    }

    if (result.success && result.data) {
      captureCache.set(selector, { data: result.data, timestamp: Date.now() });
      return result;
    }
  }

  return { success: false, error: 'No capturable elements found' };
}

/**
 * Capture multiple elements and return all results
 */
export async function captureAll(
  captures: { id: string; selectors: string[]; options?: CaptureOptions }[]
): Promise<Record<string, CaptureResult>> {
  const results: Record<string, CaptureResult> = {};

  await Promise.all(
    captures.map(async ({ id, selectors, options }) => {
      results[id] = await smartCapture(selectors, options);
    })
  );

  return results;
}

/**
 * Pre-capture all drawings for export (call before opening export dialog)
 */
export async function preCaptureForExport(): Promise<{
  technicalDrawing?: string;
  calibrationBlock?: string;
  threeDView?: string;
  scanDirections?: string;
}> {
  const results: Record<string, string | undefined> = {};

  // Technical Drawing - multiple possible selectors
  const techDrawing = await smartCapture([
    '#technical-drawing-canvas',
    '[data-testid="technical-drawing"] canvas',
    '.technical-drawing-container canvas',
    '.technical-drawing svg',
  ], { scale: 2, quality: 0.95 });
  if (techDrawing.success) results.technicalDrawing = techDrawing.data;

  // Calibration Block Diagram - SVG based
  const calibrationBlock = await smartCapture([
    '[data-testid="calibration-block-diagram"] svg',
    '.fbh-drawing svg',
    '.calibration-drawing svg',
    '#calibration-block-svg',
  ], { scale: 2, backgroundColor: 'white' });
  if (calibrationBlock.success) results.calibrationBlock = calibrationBlock.data;

  // 3D Viewer
  const threeD = await smartCapture([
    '.react-three-fiber canvas',
    '[data-testid="3d-viewer"] canvas',
    '.three-d-viewer canvas',
  ], { scale: 1.5, quality: 0.9 });
  if (threeD.success) results.threeDView = threeD.data;

  return results;
}

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function inlineStyles(element: Element): void {
  const computed = window.getComputedStyle(element);
  const styles: string[] = [];

  // Copy relevant styles
  const relevantStyles = [
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight',
    'text-anchor', 'dominant-baseline', 'transform'
  ];

  for (const prop of relevantStyles) {
    const value = computed.getPropertyValue(prop);
    if (value) {
      styles.push(`${prop}: ${value}`);
    }
  }

  if (styles.length > 0) {
    const existingStyle = element.getAttribute('style') || '';
    element.setAttribute('style', existingStyle + '; ' + styles.join('; '));
  }

  // Recurse to children
  Array.from(element.children).forEach(child => inlineStyles(child));
}

// Clear cache
export function clearCaptureCache(): void {
  captureCache.clear();
}

export default {
  captureCanvas,
  captureImage,
  captureSVG,
  captureElement,
  smartCapture,
  captureAll,
  preCaptureForExport,
  clearCaptureCache,
};

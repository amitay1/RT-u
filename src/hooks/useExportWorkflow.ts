import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useExportCaptures } from "@/hooks/useExportCaptures";
import { getBeamRequirement, requiresAngleBeam } from "@/utils/beamTypeClassification";
import { captureFBHContainer, clearCaptureCache, smartCapture } from "@/utils/export/captureEngine";
import type { CurrentPartData } from "@/hooks/useTechniqueSheetState";
import type { InspectionSetupData } from "@/types/techniqueSheet";

interface UseExportWorkflowParams {
  activeTab: string;
  reportMode: "Technique" | "Report";
  currentData: CurrentPartData;
  isSplitMode: boolean;
  activePart: "A" | "B";
  inspectionSetup: InspectionSetupData;
  inspectionSetupB: InspectionSetupData;
  setActiveTab: (tab: string) => void;
}

export function useExportWorkflow({
  activeTab,
  reportMode,
  currentData,
  isSplitMode,
  activePart,
  inspectionSetup,
  inspectionSetupB,
  setActiveTab,
}: UseExportWorkflowParams) {
  // Capture state
  const [capturedDrawing, setCapturedDrawing] = useState<string | undefined>();
  const [calibrationBlockDiagram, setCalibrationBlockDiagram] = useState<string | undefined>();
  const [capturedScanDirections, setCapturedScanDirections] = useState<string | undefined>();
  const [angleBeamDiagram, setAngleBeamDiagram] = useState<string | undefined>();
  const [e2375Diagram, setE2375Diagram] = useState<string | undefined>();

  const {
    captures: exportCaptures,
    captureTechnicalDrawing,
    captureCalibrationBlock,
    captureAngleBeamBlock,
    captureE2375Diagram: captureE2375DiagramFn,
    captureScanDirections,
    isCapturing: isCaptureInProgress,
  } = useExportCaptures();

  // Guard so the auto-capture useEffects below don't fire while handleExportPDF
  // is mid-flight. The export flow temporarily switches tabs, which would
  // otherwise trigger the per-tab auto-capture and race with the composite
  // capture, sometimes overwriting it with a worse single-SVG image.
  const exportInProgressRef = useRef(false);

  useEffect(() => {
    if (exportCaptures.technicalDrawing) {
      setCapturedDrawing(exportCaptures.technicalDrawing);
    }
    if (exportCaptures.calibrationBlockDiagram) {
      setCalibrationBlockDiagram(exportCaptures.calibrationBlockDiagram);
    }
    if (exportCaptures.angleBeamCalibrationDiagram) {
      setAngleBeamDiagram(exportCaptures.angleBeamCalibrationDiagram);
    }
    if (exportCaptures.e2375Diagram) {
      setE2375Diagram(exportCaptures.e2375Diagram);
    }
    if (exportCaptures.scanDirectionsView) {
      setCapturedScanDirections(exportCaptures.scanDirectionsView);
    }
  }, [
    exportCaptures.technicalDrawing,
    exportCaptures.calibrationBlockDiagram,
    exportCaptures.angleBeamCalibrationDiagram,
    exportCaptures.e2375Diagram,
    exportCaptures.scanDirectionsView,
  ]);

  // ── Auto-capture technical drawing on setup tab ────────────────────────
  useEffect(() => {
    if (activeTab === "setup" && reportMode === "Technique") {
      const timer = setTimeout(async () => {
        if (exportInProgressRef.current) return;
        const success = await captureTechnicalDrawing();
        if (success && exportCaptures.technicalDrawing) {
          setCapturedDrawing(exportCaptures.technicalDrawing);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [activeTab, reportMode, captureTechnicalDrawing, exportCaptures.technicalDrawing]);

  // ── Auto-capture calibration block on calibration tab ──────────────────
  useEffect(() => {
    if (activeTab === "calibration" && reportMode === "Technique") {
      const timer = setTimeout(async () => {
        if (exportInProgressRef.current) return;
        const success = await captureCalibrationBlock();
        if (success && exportCaptures.calibrationBlockDiagram) {
          setCalibrationBlockDiagram(exportCaptures.calibrationBlockDiagram);
        }
        const currentPartType = isSplitMode && activePart === "B" ? inspectionSetupB.partType : inspectionSetup.partType;
        const currentIsHollow = isSplitMode && activePart === "B" ? inspectionSetupB.isHollow : inspectionSetup.isHollow;
        const partNeedsAngleBeam = requiresAngleBeam(currentPartType, currentIsHollow);
        if (partNeedsAngleBeam) {
          const angleSuccess = await captureAngleBeamBlock();
          if (angleSuccess && exportCaptures.angleBeamCalibrationDiagram) {
            setAngleBeamDiagram(exportCaptures.angleBeamCalibrationDiagram);
          }
        } else {
          setAngleBeamDiagram(undefined);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab, reportMode, captureCalibrationBlock, captureAngleBeamBlock,
    exportCaptures.calibrationBlockDiagram, exportCaptures.angleBeamCalibrationDiagram,
    inspectionSetup.partType, inspectionSetup.isHollow,
    isSplitMode, activePart, inspectionSetupB.partType, inspectionSetupB.isHollow,
  ]);

  // ── Auto-capture E2375 on scan details tab ─────────────────────────────
  useEffect(() => {
    if (activeTab === "scandetails" && reportMode === "Technique") {
      const timer = setTimeout(async () => {
        if (exportInProgressRef.current) return;
        const success = await captureE2375DiagramFn();
        if (success && exportCaptures.e2375Diagram) {
          setE2375Diagram(exportCaptures.e2375Diagram);
        }
        const scanSuccess = await captureScanDirections();
        if (scanSuccess && exportCaptures.scanDirectionsView) {
          setCapturedScanDirections(exportCaptures.scanDirectionsView);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, reportMode, captureE2375DiagramFn, captureScanDirections, exportCaptures.e2375Diagram, exportCaptures.scanDirectionsView]);

  // ── Reset captured drawings when Part A geometry changes ──────────────
  useEffect(() => {
    setCapturedDrawing(undefined);
    setCapturedScanDirections(undefined);
    setCalibrationBlockDiagram(undefined);
    setAngleBeamDiagram(undefined);
    setE2375Diagram(undefined);
  }, [
    inspectionSetup.partType, inspectionSetup.diameter, inspectionSetup.innerDiameter,
    inspectionSetup.partThickness, inspectionSetup.partLength, inspectionSetup.partWidth,
    inspectionSetup.isHollow, inspectionSetup.coneTopDiameter,
    inspectionSetup.coneBottomDiameter, inspectionSetup.coneHeight,
  ]);

  // ── Reset for Part B in split mode ────────────────────────────────────
  useEffect(() => {
    if (isSplitMode) {
      // When Part B geometry changes, drawings will be re-captured on export
    }
  }, [
    isSplitMode, inspectionSetupB.partType, inspectionSetupB.diameter,
    inspectionSetupB.innerDiameter, inspectionSetupB.partThickness,
    inspectionSetupB.partLength, inspectionSetupB.partWidth, inspectionSetupB.isHollow,
  ]);

  // ── handleExportPDF – captures all drawings then opens dialog ─────────
  const handleExportPDF = useCallback(async () => {
    if (reportMode !== "Technique") {
      return { shouldOpenDialog: true };
    }

    toast.loading("Preparing export...", { id: "export-prep" });

    // Suppress the per-tab auto-capture useEffects so they don't race with
    // (and overwrite) the composite capture below when we switch tabs.
    exportInProgressRef.current = true;

    // Clear capture cache to ensure fresh captures (prevents stale cached images)
    clearCaptureCache();

    let capturedTechnicalDrawing: string | undefined;
    let capturedFBHDiagram: string | undefined;
    let capturedAngleBeam: string | undefined;
    let capturedE2375: string | undefined;

    const originalTab = activeTab;
    let currentTab = activeTab;
    let switchedTab = false;

    // Switch to the given tab if needed, then poll the DOM until `isReady`
    // returns true (Radix Tabs unmounts inactive panels — without this the
    // capture targets aren't in the DOM when the user exports from another
    // tab). Falls back to a fixed delay so canvases that re-draw via useEffect
    // get a chance to finish.
    const ensureTabReady = async (
      requiredTab: string,
      isReady: () => boolean,
      pollTimeoutMs = 2500,
      postDelayMs = 200,
    ): Promise<boolean> => {
      if (isReady()) {
        if (postDelayMs > 0) {
          await new Promise((r) => setTimeout(r, postDelayMs));
        }
        return true;
      }
      if (currentTab !== requiredTab) {
        flushSync(() => setActiveTab(requiredTab));
        currentTab = requiredTab;
        switchedTab = true;
      }
      const start = Date.now();
      while (Date.now() - start < pollTimeoutMs) {
        if (isReady()) {
          if (postDelayMs > 0) {
            await new Promise((r) => setTimeout(r, postDelayMs));
          }
          return true;
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      return false;
    };

    try {
      // Step 1: Setup tab – technical drawing (canvas)
      const techReady = await ensureTabReady(
        "setup",
        () => {
          const c = document.querySelector<HTMLCanvasElement>("#technical-drawing-canvas");
          return !!c && c.width > 0 && c.height > 0;
        },
        2500,
        400, // canvas renders via useEffect — give it a beat
      );
      if (techReady) {
        const drawingResult = await smartCapture([
          "#technical-drawing-canvas",
          "canvas#technical-drawing-canvas",
          '[data-testid="technical-drawing"] canvas',
          ".technical-drawing-container canvas",
          ".real-time-drawing canvas",
          ".real-time-technical-drawing canvas",
        ], { scale: 3, quality: 1.0, backgroundColor: "white" });

        if (drawingResult.success && drawingResult.data) {
          capturedTechnicalDrawing = drawingResult.data;
        }
      }

      // Step 2: Calibration tab – FBH composite diagram (all holes together)
      const fbhReady = await ensureTabReady(
        "calibration",
        () => {
          const el = document.querySelector<HTMLElement>("#calibration-blocks-container");
          if (!el) return false;
          const svgs = el.querySelectorAll<SVGElement>(".fbh-straight-beam-drawing");
          if (svgs.length === 0) return false;
          const rect = svgs[0].getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        2500,
        150,
      );

      if (fbhReady) {
        const fbhContainer = document.querySelector<HTMLElement>("#calibration-blocks-container");
        if (fbhContainer) {
          const compositeResult = await captureFBHContainer(fbhContainer, {
            scale: 2.5,
            quality: 1.0,
            backgroundColor: "white",
            maxWidth: 2400,
            maxHeight: 1400,
          });
          if (compositeResult.success && compositeResult.data) {
            capturedFBHDiagram = compositeResult.data;
          }
        }
      }

      // Fallback to the legacy single-SVG capture if the composite path failed
      // (e.g. older DOM layouts without the dedicated container class).
      if (!capturedFBHDiagram) {
        const calibrationResult = await smartCapture([
          "#calibration-block-svg", 'svg#calibration-block-svg',
          '[data-testid="calibration-block-diagram"]', 'svg[data-testid="calibration-block-diagram"]',
          ".fbh-straight-beam-drawing", "svg.fbh-straight-beam-drawing",
          ".calibration-drawing svg", ".calibration-tab svg",
        ], { scale: 3, quality: 1.0, backgroundColor: "white", maxWidth: 1800, maxHeight: 1200 });

        if (calibrationResult.success && calibrationResult.data) {
          capturedFBHDiagram = calibrationResult.data;
        }
      }

      // Step 2b: Angle beam if needed (also on the Calibration tab)
      const beamRequirement = getBeamRequirement(currentData.inspectionSetup.partType, currentData.inspectionSetup.isHollow);
      const needsAngleBeam = beamRequirement === "both" || beamRequirement === "angle_only";
      if (needsAngleBeam) {
        const angleBeamSelectors = [
          '[data-testid="tube-angle-beam-reference-image"]',
          '[data-testid="tube-angle-beam-reference-drawing"] img',
          '[data-testid="tube-angle-beam-reference-drawing"]',
          '[data-testid="angle-beam-export-capture"]',
          '[data-testid="angle-beam-image-capture"]', ".angle-beam-image-capture",
          ".angle-beam-calibration-image", '[data-testid="angle-beam-calibration-block"]',
        ];

        await ensureTabReady(
          "calibration",
          () => angleBeamSelectors.some((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }),
          2000,
          150,
        );

        const angleBeamResult = await smartCapture(
          angleBeamSelectors,
          { scale: 3, quality: 1.0, backgroundColor: "white", maxWidth: 1800, maxHeight: 1200 }
        );
        if (angleBeamResult.success && angleBeamResult.data) {
          capturedAngleBeam = angleBeamResult.data;
        }
      }

      // Step 3: Scan details tab – E2375
      const e2375Selectors = [
        '[data-testid="scan-direction-svg"]', 'svg[data-testid="scan-direction-svg"]',
        "#scan-direction-svg", "svg.scan-direction-diagram",
        '[data-testid="e2375-diagram"]', '[data-testid="e2375-diagram"] svg',
        '[data-testid="e2375-diagram-img"]', '[data-testid="e2375-diagram"] img',
        ".e2375-diagram-image img", ".e2375-diagram-container img",
      ];

      const e2375Ready = await ensureTabReady(
        "scandetails",
        () => e2375Selectors.some((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }),
        2500,
        200,
      );
      if (e2375Ready) {
        const e2375Result = await smartCapture(
          e2375Selectors,
          { scale: 3, quality: 1.0, backgroundColor: "white", maxWidth: 1800, maxHeight: 1200 }
        );
        if (e2375Result.success && e2375Result.data) {
          capturedE2375 = e2375Result.data;
        }
      }

      console.log("[PDF Export] Capture Summary:");
      console.log("  - Technical Drawing:", capturedTechnicalDrawing ? "captured" : "using PDF fallback");
      console.log("  - FBH Calibration:", capturedFBHDiagram ? "captured" : "using PDF fallback");
      console.log("  - Angle Beam:", needsAngleBeam ? (capturedAngleBeam ? "captured" : "not available") : "not required");
      console.log("  - E2375 Diagram:", capturedE2375 ? "captured" : "not available");

      flushSync(() => {
        if (capturedTechnicalDrawing) setCapturedDrawing(capturedTechnicalDrawing);
        if (capturedFBHDiagram) setCalibrationBlockDiagram(capturedFBHDiagram);
        if (capturedAngleBeam) setAngleBeamDiagram(capturedAngleBeam);
        if (capturedE2375) setE2375Diagram(capturedE2375);
      });

      if (switchedTab && originalTab && currentTab !== originalTab) {
        setActiveTab(originalTab);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      toast.dismiss("export-prep");
      toast.success("Export ready");
      return { shouldOpenDialog: true };
    } catch (error) {
      console.error("Error capturing drawings:", error);
      if (switchedTab && originalTab && currentTab !== originalTab) {
        setActiveTab(originalTab);
      }
      toast.dismiss("export-prep");
      toast.warning("Export will use built-in drawing fallbacks");
      return { shouldOpenDialog: true };
    } finally {
      exportInProgressRef.current = false;
    }
  }, [
    reportMode, currentData, activeTab, setActiveTab,
  ]);

  return {
    capturedDrawing,
    calibrationBlockDiagram,
    capturedScanDirections,
    angleBeamDiagram,
    e2375Diagram,
    isCaptureInProgress,
    handleExportPDF,
  };
}

import { useEffect, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RtPtControlApprovalTab } from '@/components/rtpt/RtPtControlApprovalTab';
import { RtPtWorkflowOverview } from '@/components/rtpt/RtPtWorkflowOverview';
import type { RtPtWorkspaceController } from '@/hooks/useRtPtWorkspaceState';
import {
  AlertTriangle,
  BookOpenCheck,
  Camera,
  Check,
  Droplets,
  Film,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { RT_PT_METHOD_LABEL, RT_PT_REFERENCE_SUGGESTIONS, type RtPtMethod } from '@/types/rtPtDocument';
import type { RtPtValidationSummary } from '@/lib/rtPtValidation';
import {
  buildRtPtWorkflowSnapshot,
  type RtPtWorkflowTabDefinition,
} from '@/lib/rtPtWorkflow';

import { RtFilmGeneralTab } from '@/components/tabs/rt-film/RtFilmGeneralTab';
import { RtFilmExposureTab } from '@/components/tabs/rt-film/RtFilmExposureTab';
import { RtFilmEquipmentTab } from '@/components/tabs/rt-film/RtFilmEquipmentTab';
import { RtFilmFilmSystemTab } from '@/components/tabs/rt-film/RtFilmFilmSystemTab';
import { RtFilmIqcTab } from '@/components/tabs/rt-film/RtFilmIqcTab';
import { RtFilmAcceptanceTab } from '@/components/tabs/rt-film/RtFilmAcceptanceTab';
import { RtFilmExposureViewsTab } from '@/components/tabs/rt-film/RtFilmExposureViewsTab';

import { RtCrGeneralTab } from '@/components/tabs/rt-cr/RtCrGeneralTab';
import { RtCrExposureTab } from '@/components/tabs/rt-cr/RtCrExposureTab';
import { RtCrEquipmentTab } from '@/components/tabs/rt-cr/RtCrEquipmentTab';
import { RtCrPlateScannerTab } from '@/components/tabs/rt-cr/RtCrPlateScannerTab';
import { RtCrImageQualityTab } from '@/components/tabs/rt-cr/RtCrImageQualityTab';
import { RtCrExposureViewsTab } from '@/components/tabs/rt-cr/RtCrExposureViewsTab';

import { RtDigitalGeneralTab } from '@/components/tabs/rt-digital/RtDigitalGeneralTab';
import { RtDigitalExposureTab } from '@/components/tabs/rt-digital/RtDigitalExposureTab';
import { RtDigitalDetectorTab } from '@/components/tabs/rt-digital/RtDigitalDetectorTab';
import { RtDigitalEngineeringTab } from '@/components/tabs/rt-digital/RtDigitalEngineeringTab';
import { RtDigitalVisualPlannerTab } from '@/components/tabs/rt-digital/RtDigitalVisualPlannerTab';
import { RtDigitalImageProcessingTab } from '@/components/tabs/rt-digital/RtDigitalImageProcessingTab';
import { RtDigitalIqcTab } from '@/components/tabs/rt-digital/RtDigitalIqcTab';
import { RtDigitalAcceptanceTab } from '@/components/tabs/rt-digital/RtDigitalAcceptanceTab';
import { RtDigitalAcquisitionPlanTab } from '@/components/tabs/rt-digital/RtDigitalAcquisitionPlanTab';
import { RtDigitalInterpretationTab } from '@/components/tabs/rt-digital/RtDigitalInterpretationTab';

import { PtGeneralTab } from '@/components/tabs/penetrant/PtGeneralTab';
import { PtMaterialsTab } from '@/components/tabs/penetrant/PtMaterialsTab';
import { PtSurfacePreparationTab } from '@/components/tabs/penetrant/PtSurfacePreparationTab';
import { PtApplicationTab } from '@/components/tabs/penetrant/PtApplicationTab';
import { PtDevelopmentTab } from '@/components/tabs/penetrant/PtDevelopmentTab';
import { PtInspectionConditionsTab } from '@/components/tabs/penetrant/PtInspectionConditionsTab';
import { PtAcceptanceTab } from '@/components/tabs/penetrant/PtAcceptanceTab';
import { PtPostCleaningTab } from '@/components/tabs/penetrant/PtPostCleaningTab';

export type { RtPtMethod } from '@/types/rtPtDocument';

interface RtPtWorkspaceProps {
  workspace: RtPtWorkspaceController;
  validation?: RtPtValidationSummary;
}

const workbenchTabListClass = 'inline-flex h-auto w-max min-w-full flex-nowrap items-center justify-start gap-1';
const workbenchTabTriggerClass = 'group rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap';

const METHOD_ICONS: Record<RtPtMethod, typeof Film> = {
  'RT-Film': Film,
  'RT-Digital': Camera,
  'RT-CR': ScanLine,
  PT: Droplets,
};

const WORKSPACE_DISPLAY_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'RT Film Technique',
  'RT-Digital': 'RT Digital / DDA Technique',
  'RT-CR': 'RT Computed Radiography Technique',
  PT: 'Penetrant Technique',
};

const TAB_DEFINITIONS: Record<RtPtMethod, ReadonlyArray<RtPtWorkflowTabDefinition>> = {
  'RT-Film': [
    { value: 'general', label: 'General', shortLabel: 'General' },
    { value: 'exposure', label: 'Exposure Defaults', shortLabel: 'Exposure' },
    { value: 'equipment', label: 'Source', shortLabel: 'Source' },
    { value: 'film', label: 'Film System', shortLabel: 'Film' },
    { value: 'iqc', label: 'Image Quality', shortLabel: 'IQI' },
    { value: 'acceptance', label: 'Acceptance', shortLabel: 'Acceptance' },
    { value: 'views', label: 'Exposure Views', shortLabel: 'Views' },
    { value: 'control', label: 'Control & Approval', shortLabel: 'Control' },
  ],
  'RT-Digital': [
    { value: 'general', label: 'Part & Inspection Definition', shortLabel: 'Definition' },
    { value: 'source', label: 'X-Ray Source', shortLabel: 'Source' },
    { value: 'detector', label: 'Detector / DDA', shortLabel: 'Detector' },
    { value: 'engineering', label: 'Geometry & Coverage', shortLabel: 'Geometry' },
    { value: 'planner', label: 'Visual Planner', shortLabel: 'Planner' },
    { value: 'iqc', label: 'IQI / Sensitivity', shortLabel: 'IQI' },
    { value: 'acquisitions', label: 'Exposure List', shortLabel: 'Exposures' },
    { value: 'interpretation', label: 'Interpretation Areas', shortLabel: 'Interpretation' },
    { value: 'processing', label: 'Processing & Viewing', shortLabel: 'Processing' },
    { value: 'acceptance', label: 'Acceptance Profiles', shortLabel: 'Acceptance' },
    { value: 'control', label: 'Control & Approval', shortLabel: 'Control' },
  ],
  'RT-CR': [
    { value: 'general', label: 'General', shortLabel: 'General' },
    { value: 'exposure', label: 'Exposure Defaults', shortLabel: 'Exposure' },
    { value: 'equipment', label: 'Source', shortLabel: 'Source' },
    { value: 'plate', label: 'Plate & Scanner', shortLabel: 'Plate' },
    { value: 'image', label: 'Image Quality', shortLabel: 'Image' },
    { value: 'iqc', label: 'IQI', shortLabel: 'IQI' },
    { value: 'acceptance', label: 'Acceptance', shortLabel: 'Acceptance' },
    { value: 'views', label: 'Exposure Views', shortLabel: 'Views' },
    { value: 'control', label: 'Control & Approval', shortLabel: 'Control' },
  ],
  PT: [
    { value: 'general', label: 'General', shortLabel: 'General' },
    { value: 'materials', label: 'Materials', shortLabel: 'Materials' },
    { value: 'surface', label: 'Surface Preparation', shortLabel: 'Surface' },
    { value: 'application', label: 'Application', shortLabel: 'Application' },
    { value: 'development', label: 'Development', shortLabel: 'Develop' },
    { value: 'conditions', label: 'Inspection Conditions', shortLabel: 'Conditions' },
    { value: 'acceptance', label: 'Acceptance', shortLabel: 'Acceptance' },
    { value: 'postcleaning', label: 'Post Cleaning', shortLabel: 'Cleaning' },
    { value: 'control', label: 'Control & Approval', shortLabel: 'Control' },
  ],
};

export const RtPtWorkspace = ({ workspace, validation }: RtPtWorkspaceProps) => {
  const { method, activeTabs, setActiveTab, rtFilm, rtDigital, rtCr, penetrant } = workspace;
  const activeTab = method === 'RT-Film'
    ? activeTabs.rtFilm
    : method === 'RT-Digital'
      ? activeTabs.rtDigital
      : method === 'RT-CR'
        ? activeTabs.rtCr
        : activeTabs.pt;
  const MethodIcon = METHOD_ICONS[method];
  const tabs = TAB_DEFINITIONS[method];
  const activeStep = Math.max(0, tabs.findIndex((tab) => tab.value === activeTab));
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const workflowSnapshot = useMemo(
    () => validation
      ? buildRtPtWorkflowSnapshot(method, tabs, activeTab, validation)
      : null,
    [activeTab, method, tabs, validation],
  );
  const tabWorkflowStates = useMemo(
    () => new Map(workflowSnapshot?.tabs.map((tab) => [tab.value, tab]) ?? []),
    [workflowSnapshot],
  );

  const selectWorkflowTab = (tab: string) => {
    setActiveTab(method, tab);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-rtpt-workspace-scroll]')?.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    });
  };

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeTab, method]);

  return (
    <Tabs
      key={method}
      value={activeTab}
      onValueChange={(tab) => setActiveTab(method, tab)}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="flex-shrink-0 px-1 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5">
        <div className="workbench-header">
          <div className="flex items-center gap-3 border-b border-border/70 px-3 py-3 md:px-4">
            <div className="workbench-brand-mark h-10 w-10 flex-none">
              <MethodIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Technique planning workspace</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <h2
                  className="truncate text-lg font-semibold tracking-tight md:text-xl"
                  aria-label={RT_PT_METHOD_LABEL[method]}
                  title={RT_PT_METHOD_LABEL[method]}
                >
                  <span className="wide:hidden" aria-hidden="true">{WORKSPACE_DISPLAY_LABEL[method]}</span>
                  <span className="hidden wide:inline" aria-hidden="true">{RT_PT_METHOD_LABEL[method]}</span>
                </h2>
                <span className="hidden h-1 w-1 rounded-full bg-border sm:block" aria-hidden="true" />
                <span
                  className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground xl:flex"
                  title={RT_PT_REFERENCE_SUGGESTIONS[method]}
                >
                  <BookOpenCheck className="h-3.5 w-3.5 flex-none" />
                  {RT_PT_REFERENCE_SUGGESTIONS[method]}
                </span>
              </div>
            </div>
            <div className="hidden flex-none items-center gap-3 text-right md:flex">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workflow position</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">Step {activeStep + 1} of {tabs.length}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground" title="Controlled planning document">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </div>
          {workflowSnapshot && (
            <RtPtWorkflowOverview
              snapshot={workflowSnapshot}
              onSelectTab={selectWorkflowTab}
            />
          )}
          <div className="workbench-tabstrip workbench-tabstrip-compact sticky top-0 z-10 w-full max-w-full overflow-x-auto overscroll-x-contain" aria-label="Technique workflow steps">
            <TabsList className={workbenchTabListClass} aria-label={`${RT_PT_METHOD_LABEL[method]} sections`}>
              {tabs.map((tab, index) => {
                const workflowState = tabWorkflowStates.get(tab.value);
                const issueCount = workflowState ?? { errors: 0, warnings: 0, status: 'ready' as const };
                const statusText = issueCount.errors > 0
                  ? `${issueCount.errors} required correction${issueCount.errors === 1 ? '' : 's'}`
                  : issueCount.warnings > 0
                    ? `${issueCount.warnings} warning${issueCount.warnings === 1 ? '' : 's'}`
                    : workflowSnapshot ? 'section clear' : '';
                return (
                  <TabsTrigger
                    key={tab.value}
                    ref={tab.value === activeTab ? activeTabRef : undefined}
                    value={tab.value}
                    className={workbenchTabTriggerClass}
                    aria-label={`${tab.label}${statusText ? `, ${statusText}` : ''}`}
                    title={`${tab.label}${statusText ? ` — ${statusText}` : ''}`}
                  >
                    <span
                      className={`tab-step-index ${
                        workflowSnapshot ? `tab-step-index--${issueCount.status}` : ''
                      }`}
                      aria-hidden="true"
                    >
                      {!workflowSnapshot
                        ? index + 1
                        : issueCount.status === 'correction'
                          ? <ShieldAlert className="h-3 w-3" />
                          : issueCount.status === 'review'
                            ? <AlertTriangle className="h-3 w-3" />
                            : <Check className="h-3 w-3" />}
                    </span>
                    <span className="wide:hidden" aria-hidden="true">{tab.shortLabel}</span>
                    <span className="hidden wide:inline" aria-hidden="true">{tab.label}</span>
                    {(issueCount.errors > 0 || issueCount.warnings > 0) && (
                      <span
                        className={issueCount.errors > 0
                          ? 'grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full border border-destructive/30 px-1 font-mono text-[10px] font-semibold tabular-nums text-destructive/90'
                          : 'grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full border border-warning/35 px-1 font-mono text-[10px] font-semibold tabular-nums text-warning'}
                        aria-hidden="true"
                      >
                        {issueCount.errors || issueCount.warnings}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 pb-3 outline-none md:px-3"
        data-rtpt-workspace-scroll
        tabIndex={-1}
      >
        <div className="app-panel workbench-surface max-w-full p-2 md:p-4">
          {method === 'RT-Film' && (
            <>
              <TabsContent value="general" className="m-0">
                <RtFilmGeneralTab
                  data={rtFilm.sheet.general}
                  onChange={rtFilm.updateGeneral}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onPs811000ApplicableChange={rtFilm.updatePs811000Applicable}
                  iso17636TestClass={rtFilm.sheet.iso17636TestClass}
                  onIso17636TestClassChange={rtFilm.updateIso17636TestClass}
                />
              </TabsContent>
              <TabsContent value="exposure" className="m-0">
                <RtFilmExposureTab
                  data={rtFilm.sheet.exposureDefaults}
                  source={rtFilm.sheet.source}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onChange={rtFilm.updateExposureDefaults}
                  circumferentialPlan={rtFilm.sheet.circumferentialPlan}
                  onCircumferentialPlanChange={rtFilm.updateCircumferentialPlan}
                  iso17636TestClass={rtFilm.sheet.iso17636TestClass}
                  nominalThickness={rtFilm.sheet.general.thickness}
                  nominalThicknessUnit={rtFilm.sheet.general.thicknessUnit}
                />
              </TabsContent>
              <TabsContent value="equipment" className="m-0"><RtFilmEquipmentTab data={rtFilm.sheet.source} general={rtFilm.sheet.general} onChange={rtFilm.updateSource} /></TabsContent>
              <TabsContent value="film" className="m-0">
                <RtFilmFilmSystemTab
                  data={rtFilm.sheet.filmSystem}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onChange={rtFilm.updateFilmSystem}
                />
              </TabsContent>
              <TabsContent value="iqc" className="m-0">
                <RtFilmIqcTab
                  data={rtFilm.sheet.iqi}
                  general={rtFilm.sheet.general}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onChange={rtFilm.updateIqi}
                />
              </TabsContent>
              <TabsContent value="acceptance" className="m-0">
                <RtFilmAcceptanceTab
                  data={rtFilm.sheet.acceptance}
                  onChange={rtFilm.updateAcceptance}
                  techniqueNotes={rtFilm.sheet.techniqueNotes}
                  onTechniqueNotesChange={rtFilm.updateTechniqueNotes}
                />
              </TabsContent>
              <TabsContent value="views" className="m-0">
                <RtFilmExposureViewsTab
                  data={rtFilm.sheet.exposureViews}
                  source={rtFilm.sheet.source}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onAdd={rtFilm.addExposureView}
                  onChange={rtFilm.updateExposureView}
                  onDuplicate={rtFilm.duplicateExposureView}
                  onMove={rtFilm.moveExposureView}
                  onDelete={rtFilm.deleteExposureView}
                />
              </TabsContent>
            </>
          )}
          {method === 'RT-Digital' && (
            <>
              <TabsContent value="general" className="m-0">
                <RtDigitalGeneralTab
                  data={rtDigital.sheet.general}
                  planning={rtDigital.sheet.planning}
                  onChange={rtDigital.updateGeneral}
                  onPlanningChange={rtDigital.updatePlanning}
                />
              </TabsContent>
              <TabsContent value="source" className="m-0">
                <RtDigitalExposureTab
                  workflow={rtDigital.sheet.workflow}
                  onWorkflowChange={rtDigital.updateWorkflow}
                  source={rtDigital.sheet.source}
                  onSourceChange={rtDigital.updateSource}
                  selection={rtDigital.sheet.planning.sourceSelection}
                  onSelectionChange={(sourceSelection) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    sourceSelection,
                  })}
                />
              </TabsContent>
              <TabsContent value="detector" className="m-0">
                <RtDigitalDetectorTab
                  system={rtDigital.sheet.system}
                  onSystemChange={rtDigital.updateSystem}
                  performance={rtDigital.sheet.detectorPerformance}
                  onPerformanceChange={rtDigital.updateDetectorPerformance}
                  selection={rtDigital.sheet.planning.detectorSelection}
                  onSelectionChange={(detectorSelection) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    detectorSelection,
                  })}
                />
              </TabsContent>
              <TabsContent value="engineering" className="m-0">
                <RtDigitalEngineeringTab
                  planning={rtDigital.sheet.planning}
                  source={rtDigital.sheet.source}
                  system={rtDigital.sheet.system}
                  defaults={rtDigital.sheet.acquisitionDefaults}
                  onPlanningChange={rtDigital.updatePlanning}
                  onSourceChange={rtDigital.updateSource}
                  onSystemChange={rtDigital.updateSystem}
                  onDefaultsChange={rtDigital.updateAcquisitionDefaults}
                />
              </TabsContent>
              <TabsContent value="planner" className="m-0">
                <RtDigitalVisualPlannerTab
                  planning={rtDigital.sheet.planning}
                  source={rtDigital.sheet.source}
                  system={rtDigital.sheet.system}
                  defaults={rtDigital.sheet.acquisitionDefaults}
                  visual={rtDigital.sheet.planning.visual}
                  onPlanningChange={rtDigital.updatePlanning}
                  onDefaultsChange={rtDigital.updateAcquisitionDefaults}
                  onVisualChange={(visual) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    visual,
                  })}
                  onCommitGrid={(grid, inspectionAreaId, governingIqi) => {
                    const areaExposureCount = rtDigital.sheet.acquisitions.filter((acquisition) => (
                      (acquisition.plan.visual.inspectionAreaId || acquisition.inspectionZone) === inspectionAreaId
                    )).length;
                    if (rtDigital.sheet.acquisitions.length > 0) {
                      const message = areaExposureCount > 0
                        ? `Rebuild the ${areaExposureCount} exposure setup(s) for this inspection area as a ${grid.length}-position automatic layout? Existing images, interpretation areas, and exposure-specific entries for this area will be reset. Other inspection areas remain and all EXP IDs are renumbered.`
                        : `Add this ${grid.length}-position automatic layout? Existing inspection-area setups remain, but all EXP IDs are renumbered into one controlled sequence.`;
                      if (!window.confirm(message)) return;
                    }
                    rtDigital.applyAutoExposureGrid(grid, inspectionAreaId, governingIqi);
                  }}
                />
              </TabsContent>
              <TabsContent value="iqc" className="m-0">
                <RtDigitalIqcTab
                  data={rtDigital.sheet.iqi}
                  planning={rtDigital.sheet.planning}
                  onChange={rtDigital.updateIqi}
                  onPlanningChange={rtDigital.updatePlanning}
                />
              </TabsContent>
              <TabsContent value="acquisitions" className="m-0">
                <RtDigitalAcquisitionPlanTab
                  data={rtDigital.sheet.acquisitions}
                  source={rtDigital.sheet.source}
                  system={rtDigital.sheet.system}
                  planning={rtDigital.sheet.planning}
                  onAdd={rtDigital.addAcquisition}
                  onChange={rtDigital.updateAcquisition}
                  onDuplicate={rtDigital.duplicateAcquisition}
                  onMove={rtDigital.moveAcquisition}
                  onDelete={rtDigital.deleteAcquisition}
                />
              </TabsContent>
              <TabsContent value="interpretation" className="m-0">
                <RtDigitalInterpretationTab
                  acquisitions={rtDigital.sheet.acquisitions}
                  planning={rtDigital.sheet.planning}
                  viewingPresets={rtDigital.sheet.planning.viewingPresets}
                  acceptanceProfiles={rtDigital.sheet.planning.acceptanceProfiles}
                  onRepresentativeImageChange={(acquisitionId, representativeImage) => {
                    const acquisition = rtDigital.sheet.acquisitions.find(({ id }) => id === acquisitionId);
                    if (!acquisition) return;
                    rtDigital.updateAcquisitionPlan(acquisitionId, {
                      ...acquisition.plan,
                      representativeImage,
                    });
                  }}
                  onInterpretationAreasChange={(acquisitionId, interpretationAreas) => {
                    const acquisition = rtDigital.sheet.acquisitions.find(({ id }) => id === acquisitionId);
                    if (!acquisition) return;
                    rtDigital.updateAcquisitionPlan(acquisitionId, {
                      ...acquisition.plan,
                      interpretationAreas,
                    });
                  }}
                />
              </TabsContent>
              <TabsContent value="processing" className="m-0">
                <RtDigitalImageProcessingTab
                  data={rtDigital.sheet.imageProcessing}
                  onChange={rtDigital.updateImageProcessing}
                  displayAndStorage={rtDigital.sheet.displayAndStorage}
                  onDisplayAndStorageChange={rtDigital.updateDisplayAndStorage}
                  processingPolicy={rtDigital.sheet.planning.processingPolicy}
                  viewingPresets={rtDigital.sheet.planning.viewingPresets}
                  onProcessingPolicyChange={(processingPolicy) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    processingPolicy,
                  })}
                  onViewingPresetsChange={(viewingPresets) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    viewingPresets,
                  })}
                />
              </TabsContent>
              <TabsContent value="acceptance" className="m-0">
                <RtDigitalAcceptanceTab
                  data={rtDigital.sheet.acceptance}
                  onChange={rtDigital.updateAcceptance}
                  techniqueNotes={rtDigital.sheet.techniqueNotes}
                  onTechniqueNotesChange={rtDigital.updateTechniqueNotes}
                  acceptanceProfiles={rtDigital.sheet.planning.acceptanceProfiles}
                  onAcceptanceProfilesChange={(acceptanceProfiles) => rtDigital.updatePlanning({
                    ...rtDigital.sheet.planning,
                    acceptanceProfiles,
                  })}
                />
              </TabsContent>
            </>
          )}
          {method === 'RT-CR' && (
            <>
              <TabsContent value="general" className="m-0">
                <RtCrGeneralTab
                  data={rtCr.sheet.general}
                  onChange={rtCr.updateGeneral}
                  iso17636TestClass={rtCr.sheet.iso17636TestClass}
                  onIso17636TestClassChange={rtCr.updateIso17636TestClass}
                />
              </TabsContent>
              <TabsContent value="exposure" className="m-0">
                <RtCrExposureTab
                  data={rtCr.sheet.exposureDefaults}
                  source={rtCr.sheet.source}
                  onChange={rtCr.updateExposureDefaults}
                  circumferentialPlan={rtCr.sheet.circumferentialPlan}
                  onCircumferentialPlanChange={rtCr.updateCircumferentialPlan}
                  iso17636TestClass={rtCr.sheet.iso17636TestClass}
                  nominalThickness={rtCr.sheet.general.thickness}
                  nominalThicknessUnit={rtCr.sheet.general.thicknessUnit}
                />
              </TabsContent>
              <TabsContent value="equipment" className="m-0">
                <RtCrEquipmentTab data={rtCr.sheet.source} general={rtCr.sheet.general} onChange={rtCr.updateSource} />
              </TabsContent>
              <TabsContent value="plate" className="m-0">
                <RtCrPlateScannerTab
                  plateSystem={rtCr.sheet.plateSystem}
                  scanner={rtCr.sheet.scanner}
                  onPlateSystemChange={rtCr.updatePlateSystem}
                  onScannerChange={rtCr.updateScanner}
                />
              </TabsContent>
              <TabsContent value="image" className="m-0">
                <RtCrImageQualityTab data={rtCr.sheet.imageQuality} onChange={rtCr.updateImageQuality} />
              </TabsContent>
              <TabsContent value="iqc" className="m-0">
                <RtFilmIqcTab
                  data={rtCr.sheet.iqi}
                  general={rtCr.sheet.general}
                  ps811000Applicable={false}
                  onChange={rtCr.updateIqi}
                />
              </TabsContent>
              <TabsContent value="acceptance" className="m-0">
                <RtFilmAcceptanceTab
                  data={rtCr.sheet.acceptance}
                  onChange={rtCr.updateAcceptance}
                  techniqueNotes={rtCr.sheet.techniqueNotes}
                  onTechniqueNotesChange={rtCr.updateTechniqueNotes}
                />
              </TabsContent>
              <TabsContent value="views" className="m-0">
                <RtCrExposureViewsTab
                  data={rtCr.sheet.exposureViews}
                  source={rtCr.sheet.source}
                  plateSystem={rtCr.sheet.plateSystem}
                  onAdd={rtCr.addExposureView}
                  onChange={rtCr.updateExposureView}
                  onDuplicate={rtCr.duplicateExposureView}
                  onMove={rtCr.moveExposureView}
                  onDelete={rtCr.deleteExposureView}
                />
              </TabsContent>
            </>
          )}

          {method === 'PT' && (
            <>
              <TabsContent value="general" className="m-0"><PtGeneralTab data={penetrant.sheet.general} onChange={penetrant.updateGeneral} /></TabsContent>
              <TabsContent value="materials" className="m-0"><PtMaterialsTab data={penetrant.sheet.materials} onChange={penetrant.updateMaterials} /></TabsContent>
              <TabsContent value="surface" className="m-0"><PtSurfacePreparationTab data={penetrant.sheet.surfacePrep} onChange={penetrant.updateSurfacePrep} /></TabsContent>
              <TabsContent value="application" className="m-0">
                <PtApplicationTab
                  data={penetrant.sheet.application}
                  onChange={penetrant.updateApplication}
                  method={penetrant.sheet.materials.method}
                  removal={penetrant.sheet.removal}
                  onRemovalChange={penetrant.updateRemoval}
                />
              </TabsContent>
              <TabsContent value="development" className="m-0"><PtDevelopmentTab data={penetrant.sheet.development} onChange={penetrant.updateDevelopment} /></TabsContent>
              <TabsContent value="conditions" className="m-0">
                <PtInspectionConditionsTab
                  data={penetrant.sheet.conditions}
                  onChange={penetrant.updateConditions}
                  penetrantType={penetrant.sheet.materials.penetrantType}
                />
              </TabsContent>
              <TabsContent value="acceptance" className="m-0">
                <PtAcceptanceTab
                  data={penetrant.sheet.acceptance}
                  onChange={penetrant.updateAcceptance}
                  techniqueNotes={penetrant.sheet.techniqueNotes}
                  onTechniqueNotesChange={penetrant.updateTechniqueNotes}
                />
              </TabsContent>
              <TabsContent value="postcleaning" className="m-0"><PtPostCleaningTab data={penetrant.sheet.postCleaning} onChange={penetrant.updatePostCleaning} /></TabsContent>
            </>
          )}
          <TabsContent value="control" className="m-0">
            <RtPtControlApprovalTab workspace={workspace} validation={validation} />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
};

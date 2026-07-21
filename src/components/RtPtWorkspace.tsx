import { useEffect, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RtPtControlApprovalTab } from '@/components/rtpt/RtPtControlApprovalTab';
import type { RtPtWorkspaceController } from '@/hooks/useRtPtWorkspaceState';
import { BookOpenCheck, Camera, Droplets, Film, ShieldCheck } from 'lucide-react';
import { RT_PT_METHOD_LABEL, RT_PT_REFERENCE_SUGGESTIONS, type RtPtMethod } from '@/types/rtPtDocument';
import type { RtPtValidationSummary } from '@/lib/rtPtValidation';

import { RtFilmGeneralTab } from '@/components/tabs/rt-film/RtFilmGeneralTab';
import { RtFilmExposureTab } from '@/components/tabs/rt-film/RtFilmExposureTab';
import { RtFilmEquipmentTab } from '@/components/tabs/rt-film/RtFilmEquipmentTab';
import { RtFilmFilmSystemTab } from '@/components/tabs/rt-film/RtFilmFilmSystemTab';
import { RtFilmIqcTab } from '@/components/tabs/rt-film/RtFilmIqcTab';
import { RtFilmAcceptanceTab } from '@/components/tabs/rt-film/RtFilmAcceptanceTab';
import { RtFilmExposureViewsTab } from '@/components/tabs/rt-film/RtFilmExposureViewsTab';

import { RtDigitalGeneralTab } from '@/components/tabs/rt-digital/RtDigitalGeneralTab';
import { RtDigitalExposureTab } from '@/components/tabs/rt-digital/RtDigitalExposureTab';
import { RtDigitalSystemTab } from '@/components/tabs/rt-digital/RtDigitalSystemTab';
import { RtDigitalDetectorTab } from '@/components/tabs/rt-digital/RtDigitalDetectorTab';
import { RtDigitalImageProcessingTab } from '@/components/tabs/rt-digital/RtDigitalImageProcessingTab';
import { RtDigitalIqcTab } from '@/components/tabs/rt-digital/RtDigitalIqcTab';
import { RtDigitalAcceptanceTab } from '@/components/tabs/rt-digital/RtDigitalAcceptanceTab';
import { RtDigitalAcquisitionPlanTab } from '@/components/tabs/rt-digital/RtDigitalAcquisitionPlanTab';

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
  PT: Droplets,
};

const WORKSPACE_DISPLAY_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'RT Film Technique',
  'RT-Digital': 'RT Digital / DDA Technique',
  PT: 'Penetrant Technique',
};

interface TechniqueTabDefinition {
  value: string;
  label: string;
  shortLabel: string;
}

const TAB_DEFINITIONS: Record<RtPtMethod, ReadonlyArray<TechniqueTabDefinition>> = {
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
    { value: 'general', label: 'General', shortLabel: 'General' },
    { value: 'exposure', label: 'Exposure Defaults', shortLabel: 'Exposure' },
    { value: 'system', label: 'System', shortLabel: 'System' },
    { value: 'detector', label: 'Detector', shortLabel: 'Detector' },
    { value: 'processing', label: 'Image Processing', shortLabel: 'Processing' },
    { value: 'iqc', label: 'Image Quality', shortLabel: 'IQI' },
    { value: 'acceptance', label: 'Acceptance', shortLabel: 'Acceptance' },
    { value: 'acquisitions', label: 'Acquisition Plan', shortLabel: 'Plan' },
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
  const { method, activeTabs, setActiveTab, rtFilm, rtDigital, penetrant } = workspace;
  const activeTab = method === 'RT-Film'
    ? activeTabs.rtFilm
    : method === 'RT-Digital'
      ? activeTabs.rtDigital
      : activeTabs.pt;
  const MethodIcon = METHOD_ICONS[method];
  const tabs = TAB_DEFINITIONS[method];
  const activeStep = Math.max(0, tabs.findIndex((tab) => tab.value === activeTab));
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const tabIssueCounts = useMemo(() => {
    const counts = new Map<string, { errors: number; warnings: number }>();
    for (const issue of validation?.issues ?? []) {
      const tab = issue.tab === 'source'
        ? method === 'RT-Film' ? 'equipment' : 'exposure'
        : issue.tab === 'storage'
          ? 'processing'
          : issue.tab;
      const current = counts.get(tab) ?? { errors: 0, warnings: 0 };
      if (issue.severity === 'error') current.errors += 1;
      else current.warnings += 1;
      counts.set(tab, current);
    }
    return counts;
  }, [method, validation?.issues]);

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
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Technique planning workspace</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <h2
                  className="truncate text-base font-semibold tracking-tight md:text-lg"
                  aria-label={RT_PT_METHOD_LABEL[method]}
                  title={RT_PT_METHOD_LABEL[method]}
                >
                  <span className="2xl:hidden" aria-hidden="true">{WORKSPACE_DISPLAY_LABEL[method]}</span>
                  <span className="hidden 2xl:inline" aria-hidden="true">{RT_PT_METHOD_LABEL[method]}</span>
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
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workflow position</div>
                <div className="mt-0.5 text-sm font-semibold">Step {activeStep + 1} of {tabs.length}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground" title="Controlled planning document">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="workbench-tabstrip workbench-tabstrip-compact sticky top-0 z-10 w-full max-w-full overflow-x-auto overscroll-x-contain" aria-label="Technique workflow steps">
            <TabsList className={workbenchTabListClass} aria-label={`${RT_PT_METHOD_LABEL[method]} sections`}>
              {tabs.map((tab, index) => {
                const issueCount = tabIssueCounts.get(tab.value) ?? { errors: 0, warnings: 0 };
                const statusText = issueCount.errors > 0
                  ? `${issueCount.errors} required correction${issueCount.errors === 1 ? '' : 's'}`
                  : issueCount.warnings > 0
                    ? `${issueCount.warnings} warning${issueCount.warnings === 1 ? '' : 's'}`
                    : '';
                return (
                  <TabsTrigger
                    key={tab.value}
                    ref={tab.value === activeTab ? activeTabRef : undefined}
                    value={tab.value}
                    className={workbenchTabTriggerClass}
                    aria-label={`${tab.label}${statusText ? `, ${statusText}` : ''}`}
                    title={`${tab.label}${statusText ? ` — ${statusText}` : ''}`}
                  >
                    <span className="tab-step-index" aria-hidden="true">{index + 1}</span>
                    <span className="2xl:hidden" aria-hidden="true">{tab.shortLabel}</span>
                    <span className="hidden 2xl:inline" aria-hidden="true">{tab.label}</span>
                    {(issueCount.errors > 0 || issueCount.warnings > 0) && (
                      <span
                        className={issueCount.errors > 0
                          ? 'grid h-5 min-w-5 place-items-center rounded-full bg-destructive/10 px-1 text-[10px] font-bold tabular-nums text-destructive'
                          : 'grid h-5 min-w-5 place-items-center rounded-full bg-warning/15 px-1 text-[10px] font-bold tabular-nums text-warning'}
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
                />
              </TabsContent>
              <TabsContent value="exposure" className="m-0">
                <RtFilmExposureTab
                  data={rtFilm.sheet.exposureDefaults}
                  source={rtFilm.sheet.source}
                  ps811000Applicable={rtFilm.sheet.ps811000Applicable}
                  onChange={rtFilm.updateExposureDefaults}
                />
              </TabsContent>
              <TabsContent value="equipment" className="m-0"><RtFilmEquipmentTab data={rtFilm.sheet.source} onChange={rtFilm.updateSource} /></TabsContent>
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
              <TabsContent value="general" className="m-0"><RtDigitalGeneralTab data={rtDigital.sheet.general} onChange={rtDigital.updateGeneral} /></TabsContent>
              <TabsContent value="exposure" className="m-0">
                <RtDigitalExposureTab
                  workflow={rtDigital.sheet.workflow}
                  onWorkflowChange={rtDigital.updateWorkflow}
                  source={rtDigital.sheet.source}
                  onSourceChange={rtDigital.updateSource}
                  data={rtDigital.sheet.acquisitionDefaults}
                  onChange={rtDigital.updateAcquisitionDefaults}
                />
              </TabsContent>
              <TabsContent value="system" className="m-0"><RtDigitalSystemTab data={rtDigital.sheet.system} onChange={rtDigital.updateSystem} /></TabsContent>
              <TabsContent value="detector" className="m-0"><RtDigitalDetectorTab data={rtDigital.sheet.detectorPerformance} onChange={rtDigital.updateDetectorPerformance} /></TabsContent>
              <TabsContent value="processing" className="m-0">
                <RtDigitalImageProcessingTab
                  data={rtDigital.sheet.imageProcessing}
                  onChange={rtDigital.updateImageProcessing}
                  displayAndStorage={rtDigital.sheet.displayAndStorage}
                  onDisplayAndStorageChange={rtDigital.updateDisplayAndStorage}
                />
              </TabsContent>
              <TabsContent value="iqc" className="m-0"><RtDigitalIqcTab data={rtDigital.sheet.iqi} onChange={rtDigital.updateIqi} /></TabsContent>
              <TabsContent value="acceptance" className="m-0">
                <RtDigitalAcceptanceTab
                  data={rtDigital.sheet.acceptance}
                  onChange={rtDigital.updateAcceptance}
                  techniqueNotes={rtDigital.sheet.techniqueNotes}
                  onTechniqueNotesChange={rtDigital.updateTechniqueNotes}
                />
              </TabsContent>
              <TabsContent value="acquisitions" className="m-0">
                <RtDigitalAcquisitionPlanTab
                  data={rtDigital.sheet.acquisitions}
                  source={rtDigital.sheet.source}
                  onAdd={rtDigital.addAcquisition}
                  onChange={rtDigital.updateAcquisition}
                  onDuplicate={rtDigital.duplicateAcquisition}
                  onMove={rtDigital.moveAcquisition}
                  onDelete={rtDigital.deleteAcquisition}
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
            <RtPtControlApprovalTab workspace={workspace} />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
};

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useRtFilmState } from '@/hooks/useRtFilmState';
import { useRtDigitalState } from '@/hooks/useRtDigitalState';
import { usePenetrantState } from '@/hooks/usePenetrantState';

import { RtFilmGeneralTab } from '@/components/tabs/rt-film/RtFilmGeneralTab';
import { RtFilmExposureTab } from '@/components/tabs/rt-film/RtFilmExposureTab';
import { RtFilmEquipmentTab } from '@/components/tabs/rt-film/RtFilmEquipmentTab';
import { RtFilmFilmSystemTab } from '@/components/tabs/rt-film/RtFilmFilmSystemTab';
import { RtFilmIqcTab } from '@/components/tabs/rt-film/RtFilmIqcTab';
import { RtFilmAcceptanceTab } from '@/components/tabs/rt-film/RtFilmAcceptanceTab';
import { RtFilmIdentificationTab } from '@/components/tabs/rt-film/RtFilmIdentificationTab';

import { RtDigitalGeneralTab } from '@/components/tabs/rt-digital/RtDigitalGeneralTab';
import { RtDigitalExposureTab } from '@/components/tabs/rt-digital/RtDigitalExposureTab';
import { RtDigitalSystemTab } from '@/components/tabs/rt-digital/RtDigitalSystemTab';
import { RtDigitalDetectorTab } from '@/components/tabs/rt-digital/RtDigitalDetectorTab';
import { RtDigitalImageProcessingTab } from '@/components/tabs/rt-digital/RtDigitalImageProcessingTab';
import { RtDigitalIqcTab } from '@/components/tabs/rt-digital/RtDigitalIqcTab';
import { RtDigitalAcceptanceTab } from '@/components/tabs/rt-digital/RtDigitalAcceptanceTab';
import { RtDigitalIdentificationTab } from '@/components/tabs/rt-digital/RtDigitalIdentificationTab';

import { PtGeneralTab } from '@/components/tabs/penetrant/PtGeneralTab';
import { PtMaterialsTab } from '@/components/tabs/penetrant/PtMaterialsTab';
import { PtSurfacePreparationTab } from '@/components/tabs/penetrant/PtSurfacePreparationTab';
import { PtApplicationTab } from '@/components/tabs/penetrant/PtApplicationTab';
import { PtDevelopmentTab } from '@/components/tabs/penetrant/PtDevelopmentTab';
import { PtInspectionConditionsTab } from '@/components/tabs/penetrant/PtInspectionConditionsTab';
import { PtAcceptanceTab } from '@/components/tabs/penetrant/PtAcceptanceTab';
import { PtPostCleaningTab } from '@/components/tabs/penetrant/PtPostCleaningTab';

export type RtPtMethod = 'RT-Film' | 'RT-Digital' | 'PT';

interface RtPtWorkspaceProps {
  method: RtPtMethod;
}

// Re-use the same tabstrip styling as the UT workspace so the visual style matches the rest of the app.
const workbenchTabListClass = 'inline-flex h-auto w-max min-w-full flex-nowrap items-center justify-start gap-1.5 xl:gap-2';
const workbenchTabTriggerClass = 'data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap';

const STANDARD_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'ASTM E1742 — Radiographic Testing (Film)',
  'RT-Digital': 'ASTM E2698 — Radiographic Testing (Digital / DDA)',
  PT: 'ASTM E1417 — Penetrant Testing',
};

export const RtPtWorkspace = ({ method }: RtPtWorkspaceProps) => {
  const [rtFilmTab, setRtFilmTab] = useState('general');
  const [rtDigitalTab, setRtDigitalTab] = useState('general');
  const [ptTab, setPtTab] = useState('general');

  const rtFilm = useRtFilmState();
  const rtDigital = useRtDigitalState();
  const pt = usePenetrantState();

  return (
    <Tabs
      key={method}
      value={method === 'RT-Film' ? rtFilmTab : method === 'RT-Digital' ? rtDigitalTab : ptTab}
      onValueChange={method === 'RT-Film' ? setRtFilmTab : method === 'RT-Digital' ? setRtDigitalTab : setPtTab}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="px-1 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5 flex-shrink-0">
        <div className="workbench-header">
          <div className="border-b border-border/70 px-3 py-2 md:px-4 md:py-2.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {STANDARD_LABEL[method]}
            </div>
          </div>
          <div className="workbench-tabstrip workbench-tabstrip-compact w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-hide sticky top-0 z-10">
            {method === 'RT-Film' && (
              <TabsList className={workbenchTabListClass}>
                <TabsTrigger value="general" className={workbenchTabTriggerClass}>General</TabsTrigger>
                <TabsTrigger value="exposure" className={workbenchTabTriggerClass}>Exposure</TabsTrigger>
                <TabsTrigger value="equipment" className={workbenchTabTriggerClass}>Equipment</TabsTrigger>
                <TabsTrigger value="film" className={workbenchTabTriggerClass}>Film System</TabsTrigger>
                <TabsTrigger value="iqc" className={workbenchTabTriggerClass}>Image Quality</TabsTrigger>
                <TabsTrigger value="acceptance" className={workbenchTabTriggerClass}>Acceptance</TabsTrigger>
                <TabsTrigger value="identification" className={workbenchTabTriggerClass}>Identification</TabsTrigger>
              </TabsList>
            )}
            {method === 'RT-Digital' && (
              <TabsList className={workbenchTabListClass}>
                <TabsTrigger value="general" className={workbenchTabTriggerClass}>General</TabsTrigger>
                <TabsTrigger value="exposure" className={workbenchTabTriggerClass}>Exposure</TabsTrigger>
                <TabsTrigger value="system" className={workbenchTabTriggerClass}>System</TabsTrigger>
                <TabsTrigger value="detector" className={workbenchTabTriggerClass}>Detector</TabsTrigger>
                <TabsTrigger value="processing" className={workbenchTabTriggerClass}>Image Processing</TabsTrigger>
                <TabsTrigger value="iqc" className={workbenchTabTriggerClass}>Image Quality</TabsTrigger>
                <TabsTrigger value="acceptance" className={workbenchTabTriggerClass}>Acceptance</TabsTrigger>
                <TabsTrigger value="identification" className={workbenchTabTriggerClass}>Identification</TabsTrigger>
              </TabsList>
            )}
            {method === 'PT' && (
              <TabsList className={workbenchTabListClass}>
                <TabsTrigger value="general" className={workbenchTabTriggerClass}>General</TabsTrigger>
                <TabsTrigger value="materials" className={workbenchTabTriggerClass}>Materials</TabsTrigger>
                <TabsTrigger value="surface" className={workbenchTabTriggerClass}>Surface Prep</TabsTrigger>
                <TabsTrigger value="application" className={workbenchTabTriggerClass}>Application</TabsTrigger>
                <TabsTrigger value="development" className={workbenchTabTriggerClass}>Development</TabsTrigger>
                <TabsTrigger value="conditions" className={workbenchTabTriggerClass}>Conditions</TabsTrigger>
                <TabsTrigger value="acceptance" className={workbenchTabTriggerClass}>Acceptance</TabsTrigger>
                <TabsTrigger value="postcleaning" className={workbenchTabTriggerClass}>Post Cleaning</TabsTrigger>
              </TabsList>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 md:px-3 pb-3 min-h-0">
        <div className="app-panel workbench-surface rounded-[1.5rem] max-w-full p-2 md:p-4">
          {method === 'RT-Film' && (
            <>
              <TabsContent value="general" className="m-0"><RtFilmGeneralTab data={rtFilm.sheet.general} onChange={rtFilm.updateGeneral} /></TabsContent>
              <TabsContent value="exposure" className="m-0"><RtFilmExposureTab data={rtFilm.sheet.exposure} onChange={rtFilm.updateExposure} /></TabsContent>
              <TabsContent value="equipment" className="m-0"><RtFilmEquipmentTab data={rtFilm.sheet.equipment} onChange={rtFilm.updateEquipment} /></TabsContent>
              <TabsContent value="film" className="m-0"><RtFilmFilmSystemTab data={rtFilm.sheet.filmSystem} onChange={rtFilm.updateFilmSystem} /></TabsContent>
              <TabsContent value="iqc" className="m-0"><RtFilmIqcTab data={rtFilm.sheet.iqc} onChange={rtFilm.updateIqc} /></TabsContent>
              <TabsContent value="acceptance" className="m-0"><RtFilmAcceptanceTab data={rtFilm.sheet.acceptance} onChange={rtFilm.updateAcceptance} /></TabsContent>
              <TabsContent value="identification" className="m-0"><RtFilmIdentificationTab data={rtFilm.sheet.identification} onChange={rtFilm.updateIdentification} /></TabsContent>
            </>
          )}
          {method === 'RT-Digital' && (
            <>
              <TabsContent value="general" className="m-0"><RtDigitalGeneralTab data={rtDigital.sheet.general} onChange={rtDigital.updateGeneral} /></TabsContent>
              <TabsContent value="exposure" className="m-0"><RtDigitalExposureTab data={rtDigital.sheet.exposure} onChange={rtDigital.updateExposure} /></TabsContent>
              <TabsContent value="system" className="m-0"><RtDigitalSystemTab data={rtDigital.sheet.system} onChange={rtDigital.updateSystem} /></TabsContent>
              <TabsContent value="detector" className="m-0"><RtDigitalDetectorTab data={rtDigital.sheet.detector} onChange={rtDigital.updateDetector} /></TabsContent>
              <TabsContent value="processing" className="m-0"><RtDigitalImageProcessingTab data={rtDigital.sheet.imageProcessing} onChange={rtDigital.updateImageProcessing} /></TabsContent>
              <TabsContent value="iqc" className="m-0"><RtDigitalIqcTab data={rtDigital.sheet.iqc} onChange={rtDigital.updateIqc} /></TabsContent>
              <TabsContent value="acceptance" className="m-0"><RtDigitalAcceptanceTab data={rtDigital.sheet.acceptance} onChange={rtDigital.updateAcceptance} /></TabsContent>
              <TabsContent value="identification" className="m-0"><RtDigitalIdentificationTab data={rtDigital.sheet.identification} onChange={rtDigital.updateIdentification} /></TabsContent>
            </>
          )}
          {method === 'PT' && (
            <>
              <TabsContent value="general" className="m-0"><PtGeneralTab data={pt.sheet.general} onChange={pt.updateGeneral} /></TabsContent>
              <TabsContent value="materials" className="m-0"><PtMaterialsTab data={pt.sheet.materials} onChange={pt.updateMaterials} /></TabsContent>
              <TabsContent value="surface" className="m-0"><PtSurfacePreparationTab data={pt.sheet.surfacePrep} onChange={pt.updateSurfacePrep} /></TabsContent>
              <TabsContent value="application" className="m-0"><PtApplicationTab data={pt.sheet.application} onChange={pt.updateApplication} /></TabsContent>
              <TabsContent value="development" className="m-0"><PtDevelopmentTab data={pt.sheet.development} onChange={pt.updateDevelopment} /></TabsContent>
              <TabsContent value="conditions" className="m-0"><PtInspectionConditionsTab data={pt.sheet.conditions} onChange={pt.updateConditions} /></TabsContent>
              <TabsContent value="acceptance" className="m-0"><PtAcceptanceTab data={pt.sheet.acceptance} onChange={pt.updateAcceptance} /></TabsContent>
              <TabsContent value="postcleaning" className="m-0"><PtPostCleaningTab data={pt.sheet.postCleaning} onChange={pt.updatePostCleaning} /></TabsContent>
            </>
          )}
        </div>
      </div>
    </Tabs>
  );
};

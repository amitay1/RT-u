import { describe, expect, it } from 'vitest';
import {
  buildRtPtWorkflowSnapshot,
  resolveRtPtWorkflowTab,
  type RtPtWorkflowTabDefinition,
  type RtPtWorkflowValidation,
} from '@/lib/rtPtWorkflow';

const tabs: RtPtWorkflowTabDefinition[] = [
  { value: 'general', label: 'General', shortLabel: 'General' },
  { value: 'application', label: 'Application', shortLabel: 'Application' },
  { value: 'acceptance', label: 'Acceptance', shortLabel: 'Acceptance' },
  { value: 'control', label: 'Control & Approval', shortLabel: 'Control' },
];

const validation = (
  issues: RtPtWorkflowValidation['issues'],
): RtPtWorkflowValidation => ({
  issues,
  completionPercent: 62,
  completedFieldsCount: 31,
  totalRequiredFields: 50,
});

describe('RT/PT workflow visualization', () => {
  it('maps validation-only section names to their visible workspace tabs', () => {
    expect(resolveRtPtWorkflowTab('RT-Film', 'source')).toBe('equipment');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'source')).toBe('source');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'system')).toBe('detector');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'geometry')).toBe('engineering');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'visual')).toBe('planner');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'iqi')).toBe('iqc');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'exposure')).toBe('acquisitions');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'interpretation')).toBe('interpretation');
    expect(resolveRtPtWorkflowTab('RT-Digital', 'storage')).toBe('processing');
    expect(resolveRtPtWorkflowTab('PT', 'removal')).toBe('application');
  });

  it('prioritizes the next forward section with a blocking correction', () => {
    const snapshot = buildRtPtWorkflowSnapshot('PT', tabs, 'general', validation([
      {
        path: 'technique.acceptance.acceptanceText',
        label: 'Acceptance Text',
        tab: 'acceptance',
        message: 'Required planned field is missing.',
        severity: 'error',
        scope: 'draft',
      },
      {
        path: 'approvals',
        label: 'NDT Level III Approval',
        tab: 'control',
        message: 'Approval is required.',
        severity: 'warning',
        scope: 'approval',
      },
      {
        path: 'technique.removal.methodA.instructions',
        label: 'Rinse Instructions',
        tab: 'removal',
        message: 'Required planned field is missing.',
        severity: 'error',
        scope: 'draft',
      },
    ]));

    expect(snapshot.nextTab?.value).toBe('application');
    expect(snapshot.tabs.find((tab) => tab.value === 'application')).toMatchObject({
      errors: 1,
      warnings: 0,
      status: 'correction',
    });
    expect(snapshot.errors).toBe(2);
    expect(snapshot.warnings).toBe(1);
    expect(snapshot.readySections).toBe(1);
  });

  it('falls back to review items when no blocking corrections remain', () => {
    const snapshot = buildRtPtWorkflowSnapshot('PT', tabs, 'acceptance', validation([
      {
        path: 'controlledReferences',
        label: 'Controlled References',
        tab: 'control',
        message: 'A controlled reference is required.',
        severity: 'warning',
        scope: 'approval',
      },
    ]));

    expect(snapshot.nextTab?.value).toBe('control');
    expect(snapshot.tabs.find((tab) => tab.value === 'control')?.status).toBe('review');
  });
});

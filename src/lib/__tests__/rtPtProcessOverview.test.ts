import { describe, expect, it } from 'vitest';
import { buildRtProcessOverview } from '@/lib/rtPtProcessOverview';
import type { RtPtWorkflowValidation } from '@/lib/rtPtWorkflow';
import { emptyRtFilmSheet } from '@/types/rtFilm';
import { createRtPtDocument } from '@/lib/rtPtDocumentCodec';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';

const validation: RtPtWorkflowValidation = {
  issues: [],
  completionPercent: 74,
  completedFieldsCount: 37,
  totalRequiredFields: 50,
};

const emptyFilmDocument = (): Extract<RtPtDocumentV3, { method: 'RT-Film' }> =>
  createRtPtDocument({
    method: 'RT-Film',
    technique: emptyRtFilmSheet,
  }) as Extract<RtPtDocumentV3, { method: 'RT-Film' }>;

describe('RT process overview', () => {
  it('reports no radiographic pipeline for a penetrant technique', () => {
    expect(buildRtProcessOverview(createCompletePtDocument(), validation)).toBeNull();
  });

  it('restates the six film planning stages from the live document', () => {
    const overview = buildRtProcessOverview(createCompleteFilmDocument(), validation);

    expect(overview?.stages.map((stage) => stage.id)).toEqual([
      'part',
      'geometry',
      'unsharpness',
      'exposure',
      'detector',
      'card',
    ]);
    expect(overview?.stages[0].headline).toBe('Test casting · PART-100');
    expect(overview?.stages[1].headline).toBe('110 mm');
    expect(overview?.stages[4].headline).toBe('4 views');
    expect(overview?.completionPercent).toBe(74);
  });

  // Ug is the calculated value, not the entered limit: 1 mm focal spot × 10 mm OFD / 100 mm SOD.
  it('shows the calculated unsharpness beside the required limit', () => {
    const overview = buildRtProcessOverview(createCompleteFilmDocument(), validation);
    const stage = overview?.stages.find((entry) => entry.id === 'unsharpness');

    expect(stage?.headline).toBe('0.1 mm');
    expect(stage?.metrics[0]).toEqual({ label: 'Required max Ug', value: '0.1 mm' });
    expect(stage?.targetTab).toBe('iqc');
  });

  it('uses detector distances and acquisitions for a digital technique', () => {
    const overview = buildRtProcessOverview(createCompleteDigitalDocument(), validation);
    const geometry = overview?.stages.find((stage) => stage.id === 'geometry');
    const detector = overview?.stages.find((stage) => stage.id === 'detector');

    expect(overview?.methodLabel).toBe('RT Digital / DDA');
    expect(geometry?.headlineLabel).toBe('SDD');
    expect(geometry?.metrics.map((metric) => metric.label)).toEqual([
      'SOD',
      'ODD',
      'Magnification',
    ]);
    expect(detector?.targetTab).toBe('acquisitions');
  });

  it('marks stages the operator has not filled in as pending rather than complete', () => {
    const overview = buildRtProcessOverview(emptyFilmDocument(), validation);

    expect(overview?.stages.every((stage) => stage.status === 'pending')).toBe(true);
    expect(overview?.completeStages).toBe(0);
    expect(overview?.populatedStages).toBe(0);
    expect(overview?.callouts.every((callout) => callout.primary === null)).toBe(true);
  });
});

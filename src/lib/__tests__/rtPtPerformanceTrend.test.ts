import { describe, expect, it } from 'vitest';
import { decodeRtPtDocument, fingerprintRtPtApprovedContent } from '@/lib/rtPtDocumentCodec';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import { getRtPtExportSections } from '@/utils/export/RtPtTechniquePDF';
import type { RtPerformanceTrendEntry } from '@/types/rtFilm';
import { createCompleteCrDocument, createCompleteDigitalDocument } from './rtPtV3Fixtures';

const trendEntry = (id: string, date: string, overrides: Partial<RtPerformanceTrendEntry> = {}): RtPerformanceTrendEntry => ({
  id,
  date,
  measuredSrb: 100,
  measuredSrbUnit: 'um',
  measuredSnr: 120,
  reference: `PHANTOM-${id}`,
  notes: '',
  ...overrides,
});

describe('E2737-style performance trend log', () => {
  it('round-trips the optional trend and keeps prior fingerprints stable', () => {
    const baseline = fingerprintRtPtApprovedContent(createCompleteDigitalDocument());

    const withTrend = createCompleteDigitalDocument();
    withTrend.technique.detectorPerformance.performanceTrend = [
      trendEntry('t-1', '2026-06-01'),
      trendEntry('t-2', '2026-07-01'),
    ];
    expect(fingerprintRtPtApprovedContent(withTrend)).not.toBe(baseline);
    expect(fingerprintRtPtApprovedContent(createCompleteDigitalDocument())).toBe(baseline);

    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(withTrend)));
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.document.method !== 'RT-Digital') return;
    expect(decoded.document.technique.detectorPerformance.performanceTrend).toHaveLength(2);

    // An empty array is dropped from the canonical form entirely.
    const withEmpty = JSON.parse(JSON.stringify(createCompleteDigitalDocument()));
    withEmpty.technique.detectorPerformance.performanceTrend = [];
    const decodedEmpty = decodeRtPtDocument(withEmpty);
    expect(decodedEmpty.status).toBe('success');
    if (decodedEmpty.status !== 'success') return;
    expect(JSON.stringify(decodedEmpty.document)).not.toContain('performanceTrend');
  });

  it('enforces chronology, real dates, and positive measurements on the DR trend', () => {
    const document = createCompleteDigitalDocument();
    document.technique.detectorPerformance.performanceTrend = [
      trendEntry('t-1', '2026-07-01'),
      trendEntry('t-2', '2026-06-01'),
    ];
    const summary = validateRtPtDocument(document);
    expect(summary.issues.some((issue) => issue.label === 'Detector Performance Trend Chronology')).toBe(true);

    const badDate = createCompleteDigitalDocument();
    badDate.technique.detectorPerformance.performanceTrend = [trendEntry('t-1', '01/06/2026')];
    expect(validateRtPtDocument(badDate).issues.some((issue) => issue.label.includes('Detector Performance Trend Entry 1 Date'))).toBe(true);

    const badSnr = createCompleteDigitalDocument();
    badSnr.technique.detectorPerformance.performanceTrend = [trendEntry('t-1', '2026-06-01', { measuredSnr: -5 })];
    expect(validateRtPtDocument(badSnr).issues.some((issue) => issue.label.includes('Measured SNR'))).toBe(true);
  });

  it('enforces the same trend rules on the CR scanner and prints trend sections', () => {
    const document = createCompleteCrDocument();
    document.technique.scanner.performanceTrend = [
      trendEntry('t-1', '2026-06-01'),
      trendEntry('t-2', '2026-07-01'),
    ];
    expect(validateRtPtDocument(document).issues).toEqual([]);

    const sections = JSON.stringify(getRtPtExportSections(document));
    expect(sections).toContain('Scanner Performance Trend (E2737-style)');
    expect(sections).toContain('PHANTOM-t-2');

    const digital = createCompleteDigitalDocument();
    digital.technique.detectorPerformance.performanceTrend = [trendEntry('t-1', '2026-06-01')];
    const digitalSections = JSON.stringify(getRtPtExportSections(digital));
    expect(digitalSections).toContain('Detector Performance Trend (E2737-style)');

    document.technique.scanner.performanceTrend = [
      trendEntry('dup', '2026-06-01'),
      trendEntry('dup', '2026-07-01'),
    ];
    expect(validateRtPtDocument(document).issues.some((issue) => issue.label === 'Scanner Performance Trend Entry IDs')).toBe(true);
  });
});

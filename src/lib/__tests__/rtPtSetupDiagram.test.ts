import { describe, expect, it } from 'vitest';
import {
  formatRtSetupLength,
  normalizeRtSetupDiagram,
} from '@/lib/rtPtSetupDiagram';

describe('RT setup diagram display data', () => {
  it('uses Film terminology and normalizes free-text callouts', () => {
    const diagram = normalizeRtSetupDiagram({
      mode: 'film',
      title: '  Root   joint setup  ',
      sourceLabel: '  Tube bay 3\n  ',
      partLabel: '  LH   root joint ',
      receptorLabel: ' Cassette A ',
      viewId: ' V-01 ',
      callout: ' Root weld ',
      orientation: ' 0°   / clockwise ',
      inspectionZone: ' Zone   A ',
      iqiPlacement: ' Source side ',
      markerPlacement: ' Film edge ',
      distances: {
        sourceToReceptor: { value: 110, unit: 'mm' },
        sourceToObject: { value: 100, unit: 'mm' },
        objectToReceptor: { value: 10, unit: 'mm' },
      },
    });

    expect(diagram).toMatchObject({
      methodLabel: 'RT Film',
      title: 'Root joint setup',
      sourceHeading: 'Radiation source',
      sourceLabel: 'Tube bay 3',
      partLabel: 'LH root joint',
      receptorHeading: 'Film / cassette',
      receptorLabel: 'Cassette A',
      viewCallout: 'V-01 · Root weld',
      orientation: '0° / clockwise',
      inspectionZone: 'Zone A',
      iqiPlacement: 'Source side',
      markerPlacement: 'Film edge',
    });
    expect(diagram.dimensions.sourceToReceptor).toMatchObject({
      code: 'SFD',
      name: 'Source-to-film distance',
      value: '110 mm',
      display: 'SFD · 110 mm',
      isSpecified: true,
    });
    expect(diagram.dimensions.sourceToObject.code).toBe('SOD');
    expect(diagram.dimensions.objectToReceptor.code).toBe('OFD');
  });

  it('uses X-ray-only DDA terminology and detector dimension labels', () => {
    const diagram = normalizeRtSetupDiagram({
      mode: 'dda',
      viewId: 'D-04',
      distances: {
        sourceToReceptor: { value: '1250.500000', unit: 'mm' },
        sourceToObject: { value: '10.2500', unit: 'inch' },
        objectToReceptor: { value: 0, unit: 'mm' },
      },
    });

    expect(diagram.sourceHeading).toBe('X-ray source');
    expect(diagram.receptorHeading).toBe('DDA detector');
    expect(diagram.viewCallout).toBe('D-04');
    expect(diagram.dimensions.sourceToReceptor).toMatchObject({
      code: 'SDD',
      name: 'Source-to-detector distance',
      value: '1,250.5 mm',
    });
    expect(diagram.dimensions.sourceToObject.value).toBe('10.25 in');
    expect(diagram.dimensions.objectToReceptor).toMatchObject({
      code: 'ODD',
      name: 'Object-to-detector distance',
      value: '0 mm',
    });
  });

  it('does not display invalid or inferred dimension values', () => {
    const diagram = normalizeRtSetupDiagram({
      mode: 'film',
      distances: {
        sourceToReceptor: { value: '110 mm', unit: 'mm' },
        sourceToObject: { value: -1, unit: 'mm' },
        objectToReceptor: { value: Number.POSITIVE_INFINITY, unit: 'mm' },
      },
    });

    expect(diagram.dimensions.sourceToReceptor.value).toBe('Not specified');
    expect(diagram.dimensions.sourceToObject.value).toBe('Not specified');
    expect(diagram.dimensions.objectToReceptor.value).toBe('Not specified');
    expect(diagram.dimensions.sourceToReceptor.isSpecified).toBe(false);
    expect(formatRtSetupLength({ value: '', unit: 'mm' })).toBe('Not specified');
    expect(formatRtSetupLength()).toBe('Not specified');
  });

  it('removes display-control characters and bounds unusually long labels', () => {
    const diagram = normalizeRtSetupDiagram({
      mode: 'film',
      orientation: 'North\u0000\u202eeast',
      inspectionZone: 'A'.repeat(120),
    });

    expect(diagram.orientation).toBe('North east');
    expect(diagram.inspectionZone).toHaveLength(96);
    expect(diagram.inspectionZone.endsWith('…')).toBe(true);
  });

  it('preserves useful small decimals without adding an unspecified unit', () => {
    expect(formatRtSetupLength({ value: '.000125', unit: 'mm' })).toBe('0.000125 mm');
    expect(formatRtSetupLength({ value: -0 })).toBe('0');
  });
});

import { describe, expect, it } from 'vitest';
import {
  duplexElementResolvedBySrb,
  resolveRtDuplexElement,
  RT_DUPLEX_ELEMENTS,
} from '@/lib/rtDuplexIqi';
import { validateRtPtDocument } from '@/lib/rtPtValidation';
import { decodeRtPtDocument } from '@/lib/rtPtDocumentCodec';
import { createCompleteCrDocument, createCompleteDigitalDocument } from './rtPtV3Fixtures';

describe('duplex-wire IQI (ISO 19232-5 / ASTM E2002)', () => {
  it('carries the 13D..1D element identity series', () => {
    expect(RT_DUPLEX_ELEMENTS).toHaveLength(13);
    expect(RT_DUPLEX_ELEMENTS[0]).toMatchObject({ element: '13D', wireDiameterMm: 0.05, unsharpnessMm: 0.1 });
    expect(RT_DUPLEX_ELEMENTS[12]).toMatchObject({ element: '1D', wireDiameterMm: 0.8, unsharpnessMm: 1.6 });
    const d8 = RT_DUPLEX_ELEMENTS.find((entry) => entry.element === '8D');
    expect(d8).toMatchObject({ wireDiameterMm: 0.16, unsharpnessMm: 0.32 });
  });

  it('resolves common element spellings and rejects unknown text', () => {
    expect(resolveRtDuplexElement('13D')?.element).toBe('13D');
    expect(resolveRtDuplexElement('D 8')?.element).toBe('8D');
    expect(resolveRtDuplexElement('Duplex D10 per controlled reference')?.element).toBe('10D');
    expect(resolveRtDuplexElement('wire W12')).toBeNull();
    expect(resolveRtDuplexElement('')).toBeNull();
    expect(resolveRtDuplexElement('D99')).toBeNull();
  });

  it('judges SRb resolvability with unit conversion', () => {
    const d10 = resolveRtDuplexElement('10D')!; // d = 0.1 mm
    expect(duplexElementResolvedBySrb(d10, 100, 'um')).toBe(true);
    expect(duplexElementResolvedBySrb(d10, 0.1, 'mm')).toBe(true);
    expect(duplexElementResolvedBySrb(d10, 130, 'um')).toBe(false);
    expect(duplexElementResolvedBySrb(d10, '', 'um')).toBeNull();
  });

  it('accepts the Duplex IQI type through the digital codec', () => {
    const document = createCompleteDigitalDocument();
    document.technique.iqi.type = 'Duplex';
    document.technique.iqi.designation = '10D';
    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(document)));
    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.document.method !== 'RT-Digital') return;
    expect(decoded.document.technique.iqi.type).toBe('Duplex');
  });

  it('flags a DR duplex plan the planned image SRb cannot resolve', () => {
    const document = createCompleteDigitalDocument();
    document.technique.iqi.type = 'Duplex';
    document.technique.iqi.designation = '13D'; // requires SRb <= 0.05 mm
    document.technique.detectorPerformance.imageSrb = 100; // 0.1 mm
    document.technique.detectorPerformance.imageSrbUnit = 'um';
    const summary = validateRtPtDocument(document);
    expect(summary.issues.some((issue) => issue.label === 'Duplex Element vs Image SRb')).toBe(true);

    const unresolvable = createCompleteDigitalDocument();
    unresolvable.technique.iqi.type = 'Duplex';
    unresolvable.technique.iqi.designation = 'not an element';
    expect(validateRtPtDocument(unresolvable).issues.some((issue) => issue.label === 'Duplex Element Designation')).toBe(true);
  });

  it('flags a CR required SRb inconsistent with the planned duplex element', () => {
    const document = createCompleteCrDocument();
    // Fixture: 'Duplex D8 per controlled reference' (d = 0.16 mm) with required SRb 100 um — consistent.
    expect(validateRtPtDocument(document).issues).toEqual([]);

    document.technique.imageQuality.requiredSrb = 200; // 0.2 mm > 0.16 mm
    const summary = validateRtPtDocument(document);
    expect(summary.issues.some((issue) => issue.label === 'Duplex Element vs Required SRb')).toBe(true);
  });
});

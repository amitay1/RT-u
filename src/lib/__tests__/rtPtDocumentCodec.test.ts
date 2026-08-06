import { describe, expect, it } from 'vitest';
import {
  createRtFilmExposureView,
  decodeRtPtDocument,
  duplicateRtFilmExposureView,
  fingerprintRtPtContent,
  hydratePtSheet,
  hydrateRtDigitalSheet,
  hydrateRtFilmSheet,
} from '@/lib/rtPtDocumentCodec';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePs811000FilmDocument,
  createCompletePtDocument,
} from './rtPtV3Fixtures';

const v1FilmDocument = {
  documentKind: 'rtpt-document',
  schemaVersion: 1,
  method: 'RT-Film',
  activeTabs: { rtFilm: 'identification' },
  sheets: {
    rtFilm: {
      general: {
        partName: 'Legacy part',
        partNumber: 'LEG-1',
        material: 'Legacy material',
        thickness: 10,
        thicknessUnit: 'mm',
        drawingReference: 'LEG-DWG',
        procedureNumber: 'LEG-PROC',
        inspectionStage: 'Final',
        inspectorLevel: 'II',
        date: '2025-01-01',
      },
      exposure: {
        techniqueType: 'SWSI',
        radiationType: 'X-ray',
        sfd: 110,
        sfdUnit: 'mm',
        sod: 100,
        sodUnit: 'mm',
        ofd: 10,
        ofdUnit: 'mm',
        geometricMagnificationAuto: true,
        geometricMagnification: 1.1,
        focalSpotSize: 1,
        beamAngle: 90,
        numberOfExposures: 4,
        exposurePattern: 'Multiple',
        coverage: 100,
      },
      equipment: {
        radiationSourceType: 'X-ray',
        manufacturer: 'Legacy source maker',
        model: 'LEG-XR',
        serialNumber: 'LEG-SN',
        calibrationStatus: 'Expired',
        viewingEquipment: 'Legacy viewer',
      },
      filmSystem: {
        filmType: 'LEG-FILM',
        filmClass: 'I',
        screenType: 'Lead',
        screenThickness: 0.1,
        cassetteType: 'Rigid',
        processingMethod: 'Automatic',
      },
      iqc: {
        iqiType: 'Hole',
        iqiStandard: 'ASTM E1025',
        iqiMaterial: 'Same as part',
        iqiSize: 10,
        iqiPlacement: 'Source side',
        requiredSensitivity: '2-2T',
        achievedSensitivity: 'PERFORMED-SENSITIVITY-SECRET',
        opticalDensityMin: 2,
        opticalDensityMax: 3,
        imageQualityLevel: '2',
      },
      acceptance: {
        acceptanceStandard: 'PRODUCT-SPEC',
        qualityLevel: 'Legacy quality',
        linearIndications: 1,
        specialRequirements: 'Legacy note',
      },
      identification: {
        filmNumber: 'LEG-FILM-1',
        exposureNumber: 1,
        partIdentification: 'LEG-PART-ID',
        inspectionDate: '2025-01-02',
        inspector: 'PERFORMED-INSPECTOR-SECRET',
        result: 'Reject',
        remarks: 'PERFORMED-RESULT-SECRET',
      },
    },
    rtDigital: {},
    penetrant: {},
  },
};

const v2DigitalDocument = {
  documentKind: 'rtpt-document',
  schemaVersion: 2,
  documentType: 'technique',
  documentId: 'legacy-v2-digital',
  status: 'approved',
  documentControl: {
    number: 'LEG-DDA',
    title: 'Legacy DDA',
    revision: 'A',
    revisionDate: '',
    effectiveDate: '',
    changeSummary: '',
  },
  organization: { name: 'Legacy org', site: '' },
  job: { customer: '', contract: '', purchaseOrder: '', workOrder: '' },
  unitSystem: 'SI',
  controlledReferences: [],
  approvals: [],
  method: 'RT-Digital',
  technique: {
    general: v1FilmDocument.sheets.rtFilm.general,
    exposure: {
      radiationType: 'X-ray',
      tubeVoltage: 120,
      tubeCurrent: 5,
      exposureTime: 2,
      frameRate: '',
      framesAveraged: 4,
      sdd: 110,
      sod: 100,
      odd: 10,
      magnificationAuto: true,
      magnification: 1.1,
      focalSpotSize: 1,
      filters: 'None',
      coverage: 100,
    },
    system: {
      ddaType: 'Flat Panel',
      manufacturer: 'Legacy detector maker',
      model: 'LEG-DDA',
      pixelSize: 200,
      detectorMode: 'Full',
      gainSetting: 1,
      calibrationStatus: 'Valid',
    },
    detector: {
      spatialResolutionSRb: 200,
      pixelDensity: 5,
      imageUnsharpness: 0.2,
      badPixelCorrection: 'Yes',
      detectorCorrections: 'Gain + Offset',
    },
    imageProcessing: {
      windowLevel: 100,
      windowWidth: 500,
      zoom: 100,
      noiseReduction: 'Low',
      contrastEnhancement: 'On',
      imageFormat: 'DICONDE',
    },
    iqc: {
      iqiType: 'Wire',
      iqiStandard: 'ASTM E747',
      requiredSensitivity: '2-2T',
      cnr: 9.9,
    },
    acceptance: v1FilmDocument.sheets.rtFilm.acceptance,
    identification: {
      filmNumber: 'LEG-IMAGE-1',
      exposureNumber: 1,
      partIdentification: 'LEG-ID',
      inspectionDate: '2025-01-01',
      inspector: 'LEGACY-DDA-INSPECTOR',
      result: 'Accept',
      remarks: 'LEGACY-DDA-RESULT',
    },
  },
  migration: {
    sourceSchemaVersion: 1,
    warnings: ['Prior V1 warning'],
    legacyPerformedData: { iqc: { cnr: 12.3 } },
  },
};

describe('RT/PT V3 codec', () => {
  it('keeps pre-binding Draft V3 documents backward compatible', () => {
    const olderDraft = JSON.parse(JSON.stringify(createCompleteFilmDocument())) as Record<string, unknown>;
    delete olderDraft.approvalFingerprint;

    const result = decodeRtPtDocument(olderDraft);

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.document.status).toBe('draft');
    expect(result.document).not.toHaveProperty('approvalFingerprint');
  });

  it('round-trips native V3 while stripping every unknown field', () => {
    const input = JSON.parse(JSON.stringify(createCompleteFilmDocument())) as Record<string, unknown>;
    input.unknownTop = 'strip me';
    const technique = input.technique as Record<string, unknown>;
    technique.unknownTechnique = 'strip me too';
    const views = technique.exposureViews as Array<Record<string, unknown>>;
    views[0].unknownView = 'strip view';

    const result = decodeRtPtDocument(input);
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.document.schemaVersion).toBe(3);
    expect(result.document).not.toHaveProperty('unknownTop');
    expect(result.document.technique).not.toHaveProperty('unknownTechnique');
    if (result.document.method === 'RT-Film') {
      expect(result.document.technique.exposureViews[0]).not.toHaveProperty('unknownView');
    }
  });

  it('round-trips the allowlisted PS811000E planning fields and defaults older V3 files safely', () => {
    const current = decodeRtPtDocument(createCompletePs811000FilmDocument());
    expect(current.status).toBe('success');
    if (current.status !== 'success' || current.document.method !== 'RT-Film') return;
    expect(current.document.technique.ps811000Applicable).toBe(true);
    expect(current.document.technique.exposureViews[0]).toMatchObject({
      ps811000EnergyCurve: 'aluminum-magnesium',
      ps811000ThicknessBasis: 'entered-thickness',
      machineTechniqueReference: 'MACHINE-TABLE-1 REV A',
    });

    const olderV3 = JSON.parse(JSON.stringify(createCompleteFilmDocument())) as Record<string, unknown>;
    const technique = olderV3.technique as Record<string, unknown>;
    delete technique.ps811000Applicable;
    const views = technique.exposureViews as Array<Record<string, unknown>>;
    delete views[0].ps811000EnergyCurve;
    delete views[0].ps811000ThicknessBasis;
    delete views[0].machineTechniqueReference;
    const decodedOlder = decodeRtPtDocument(olderV3);
    expect(decodedOlder.status).toBe('success');
    if (decodedOlder.status === 'success' && decodedOlder.document.method === 'RT-Film') {
      expect(decodedOlder.document.technique.ps811000Applicable).toBe(false);
      expect(decodedOlder.document.technique.exposureViews[0].ps811000EnergyCurve).toBe('');
    }
  });

  it('round-trips machine exposure-chart anchors and loads V3 files saved before they existed', () => {
    const withAnchors = JSON.parse(JSON.stringify(createCompletePs811000FilmDocument())) as Record<string, unknown>;
    const technique = withAnchors.technique as Record<string, unknown>;
    (technique.source as Record<string, unknown>).exposureChartAnchors = [{
      id: 'anchor-1',
      description: 'Qualified step wedge',
      thickness: 10,
      thicknessUnit: 'mm',
      tubeVoltage: 120,
      tubeCurrent: 5,
      exposureTime: 60,
      exposureTimeUnit: 's',
      sfd: 1000,
      sfdUnit: 'mm',
      measuredDensity: 2.5,
    }];
    const decoded = decodeRtPtDocument(withAnchors);
    expect(decoded.status).toBe('success');
    if (decoded.status === 'success' && decoded.document.method === 'RT-Film') {
      expect(decoded.document.technique.source.exposureChartAnchors).toHaveLength(1);
      expect(decoded.document.technique.source.exposureChartAnchors[0]).toMatchObject({
        id: 'anchor-1',
        tubeVoltage: 120,
        tubeCurrent: 5,
      });
    }

    // Files saved before the field existed must still open, with an empty chart.
    const olderV3 = JSON.parse(JSON.stringify(createCompletePs811000FilmDocument())) as Record<string, unknown>;
    const olderSource = (olderV3.technique as Record<string, unknown>).source as Record<string, unknown>;
    delete olderSource.exposureChartAnchors;
    const decodedOlder = decodeRtPtDocument(olderV3);
    expect(decodedOlder.status).toBe('success');
    if (decodedOlder.status === 'success' && decodedOlder.document.method === 'RT-Film') {
      expect(decodedOlder.document.technique.source.exposureChartAnchors).toEqual([]);
    }
  });

  it('migrates V1 to a draft without cloning four global exposures and quarantines performed/ambiguous fields', () => {
    const result = decodeRtPtDocument(v1FilmDocument);
    expect(result.status).toBe('success');
    if (result.status !== 'success' || result.document.method !== 'RT-Film') return;

    expect(result.document).toMatchObject({ schemaVersion: 3, status: 'draft' });
    expect(result.document.technique.exposureViews).toEqual([]);
    expect(result.document.migration?.sourceSchemaVersion).toBe(1);
    expect(result.document.migration?.warnings.join(' ')).toContain('no exposure views were generated');
    const quarantine = result.document.migration?.quarantine ?? [];
    expect(quarantine).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: 'technique.iqc.achievedSensitivity', reason: 'performed-result' }),
      expect.objectContaining({ sourcePath: 'technique.identification.result', value: 'Reject' }),
      expect.objectContaining({ sourcePath: 'technique.equipment.calibrationStatus', value: 'Expired' }),
      expect.objectContaining({ sourcePath: 'technique.identification.filmNumber', reason: 'manual-mapping-required' }),
    ]));
    expect(result.document.technique.source).not.toHaveProperty('calibrationStatus');
  });

  it('migrates V2 to a draft with zero acquisitions and quarantines ambiguous SRb, CNR, status, and identification', () => {
    const legacyApprovedDocument = {
      ...v2DigitalDocument,
      approvals: [{
        role: 'ndt-level-3',
        name: 'Legacy approver',
        personnelId: 'OLD-L3',
        certificationBasis: 'Legacy written practice',
        certificationRevision: 'A',
        date: '2025-01-01',
      }],
    };
    const result = decodeRtPtDocument(legacyApprovedDocument);
    expect(result.status).toBe('success');
    if (result.status !== 'success' || result.document.method !== 'RT-Digital') return;

    expect(result.document).toMatchObject({ schemaVersion: 3, status: 'draft', documentId: 'legacy-v2-digital' });
    expect(result.document.technique.acquisitions).toEqual([]);
    expect(result.document.migration?.sourceSchemaVersion).toBe(2);
    expect(result.document.approvals).toEqual([]);
    const serialized = JSON.stringify(result.document.migration?.quarantine);
    expect(serialized).toContain('spatialResolutionSRb');
    expect(serialized).toContain('cnr');
    expect(serialized).toContain('calibrationStatus');
    expect(serialized).toContain('filmNumber');
    expect(result.document.technique.detectorPerformance.detectorSrb).toBe('');
    expect(result.document.technique.detectorPerformance.imageSrb).toBe('');
  });

  it('never hydrates quarantined performed values into any editable technique sheet', () => {
    const documents = [
      createCompleteFilmDocument(),
      createCompleteDigitalDocument(),
      createCompletePtDocument(),
    ].map((document) => ({
      ...document,
      migration: {
        sourceSchemaVersion: 2 as const,
        warnings: ['manual review'],
        quarantine: [{
          sourcePath: 'legacy.result',
          reason: 'performed-result' as const,
          value: 'PERFORMED-QUARANTINE-SECRET',
        }],
      },
    }));

    expect(JSON.stringify(hydrateRtFilmSheet(documents[0]))).not.toContain('PERFORMED-QUARANTINE-SECRET');
    expect(JSON.stringify(hydrateRtDigitalSheet(documents[1]))).not.toContain('PERFORMED-QUARANTINE-SECRET');
    expect(JSON.stringify(hydratePtSheet(documents[2]))).not.toContain('PERFORMED-QUARANTINE-SECRET');
  });

  it('keeps stable IDs unique when a view is created or duplicated', () => {
    const original = createRtFilmExposureView({ viewId: 'V1' });
    const duplicate = duplicateRtFilmExposureView(original);
    expect(original.id).not.toBe(duplicate.id);
    expect(duplicate.viewId).toBe('');
  });

  it('lets a V2-era client reject V3 before any V3 parsing', () => {
    const result = decodeRtPtDocument(createCompletePtDocument(), { maxSupportedVersion: 2 });
    expect(result).toMatchObject({ status: 'unsupported-version', version: 3 });
  });

  it('excludes migration quarantine from controlled-content fingerprints', () => {
    const document = createCompletePtDocument();
    const withQuarantine = {
      ...document,
      migration: {
        sourceSchemaVersion: 2 as const,
        warnings: ['manual review'],
        quarantine: [{
          sourcePath: 'legacy.result',
          reason: 'performed-result' as const,
          value: 'SECRET',
        }],
      },
    };
    expect(fingerprintRtPtContent(withQuarantine)).toBe(fingerprintRtPtContent(document));
  });
});

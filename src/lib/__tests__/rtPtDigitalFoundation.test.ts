import { describe, expect, it } from 'vitest';
import {
  calculateRtDigitalCoverage,
  calculateRtDigitalGeometry,
  convertRtDigitalLength,
  optimizeRtDigitalDetectorOrientation,
  resolveRtDigitalInspectionArea,
} from '@/lib/rtDigitalPlanning';
import {
  createRtDigitalAcquisition,
  decodeRtPtDocument,
  duplicateRtDigitalAcquisition,
  hydrateRtDigitalSheet,
  normalizeRtDigitalSheet,
} from '@/lib/rtPtDocumentCodec';
import {
  createEmptyRtDigitalAcquisitionPlan,
  createEmptyRtDigitalPlanning,
  type DetectorLengthUnit,
  type NumberOrEmpty,
  type RtDigitalLengthInput,
} from '@/types/rtDigital';
import { createCompleteDigitalDocument } from './rtPtV3Fixtures';

const length = (value: NumberOrEmpty, unit: DetectorLengthUnit = 'mm'): RtDigitalLengthInput => ({
  value,
  unit,
});

describe('RT Digital V3 structured planning codec', () => {
  it('preserves absent structured domains in strict old-V3 decoding and fills them only for normalized state', () => {
    const oldV3 = JSON.parse(JSON.stringify(createCompleteDigitalDocument())) as Record<string, unknown>;
    const technique = oldV3.technique as Record<string, unknown>;
    delete technique.planning;
    for (const acquisition of technique.acquisitions as Array<Record<string, unknown>>) delete acquisition.plan;

    const decoded = decodeRtPtDocument(oldV3);

    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.document.method !== 'RT-Digital') return;
    expect(decoded.document.technique).not.toHaveProperty('planning');
    expect(decoded.document.technique.acquisitions[0]).not.toHaveProperty('plan');

    const normalized = normalizeRtDigitalSheet(decoded.document.technique);
    expect(normalized.planning.part.geometry.geometryType).toBe('');
    expect(normalized.acquisitions[0].plan.interpretationAreas).toEqual([]);
    expect(normalized.acquisitions[0].plan.id).not.toBe(normalized.acquisitions[1].plan.id);
    expect(hydrateRtDigitalSheet(decoded.document).planning.id).toBeTruthy();
  });

  it('compatibly defaults a missing planning visual template with a deterministic stable ID', () => {
    const earlierV3 = JSON.parse(JSON.stringify(createCompleteDigitalDocument())) as Record<string, unknown>;
    const technique = earlierV3.technique as Record<string, unknown>;
    const planning = technique.planning as Record<string, unknown>;
    const planningId = planning.id as string;
    delete planning.visual;

    const firstDecode = decodeRtPtDocument(earlierV3);
    const secondDecode = decodeRtPtDocument(earlierV3);

    expect(firstDecode.status).toBe('success');
    expect(secondDecode.status).toBe('success');
    if (firstDecode.status !== 'success' || firstDecode.document.method !== 'RT-Digital') return;
    if (secondDecode.status !== 'success' || secondDecode.document.method !== 'RT-Digital') return;
    expect(firstDecode.document.technique.planning?.visual).toMatchObject({
      id: `${planningId}-visual`,
      inspectionAreaId: '',
      sourcePosition: { x: '', y: '' },
      detectorPosition: { x: '', y: '' },
    });
    expect(secondDecode.document.technique.planning?.visual.id).toBe(`${planningId}-visual`);
  });

  it('round-trips allowlisted planning domains while stripping unknown and inactive geometry fields', () => {
    const document = createCompleteDigitalDocument();
    const planning = document.technique.planning;
    if (!planning) throw new Error('Fixture planning was not normalized.');

    planning.part.manufacturingProcess = 'Casting';
    planning.part.geometry = {
      id: planning.part.geometry.id,
      geometryType: 'Cone',
      unit: 'inch',
      majorDiameter: 12,
      minorDiameter: 8,
      height: 6,
      wallThickness: 0.5,
    };
    planning.part.thickness = {
      id: planning.part.thickness.id,
      mode: 'Multiple Thickness Zones',
      unit: 'mm',
      zones: [{
        id: 'zone-stable-1',
        zoneId: 'TZ-01',
        description: 'Cone wall',
        minimum: 10,
        maximum: 12,
        governing: 12,
        position: { x: 10, y: 20, width: 30, height: 40, rotationDegrees: 0 },
      }],
    };
    planning.part.technique = {
      wallTechnique: 'Double Wall',
      imageTechnique: 'Elliptical',
      otherImageTechnique: '',
    };
    planning.part.attachments = [{
      id: 'asset-1',
      name: 'part.png',
      mimeType: 'image/png',
      size: 1234,
      sha256: 'a'.repeat(64),
    }];
    planning.visual = {
      ...planning.visual,
      sourcePosition: { x: 0.1, y: 0.5 },
      detectorPosition: { x: 0.9, y: 0.5 },
      detectorRotationDegrees: 90,
      beamCenter: { x: 0.5, y: 0.5 },
      beamAngleDegrees: 0,
      inspectionAreaId: 'area-1',
      leadMarkers: 'A / B',
    };
    planning.viewingPresets.push({
      id: 'vp-1',
      name: 'Thin wall',
      windowLevel: 100,
      windowWidth: 400,
      zoom: 2,
      sharpness: 'Qualified setting',
      permittedProcessing: 'Window/level only',
      lut: 'Linear',
      invert: false,
    });
    planning.acceptanceProfiles.push({
      id: 'ac-1',
      name: 'Cone acceptance',
      standard: 'Controlled standard',
      revision: 'A',
      acceptanceClass: 'Class 1',
      grade: 'A',
      level: '1',
      applicableClause: '4.2',
      drawingRequirement: 'Drawing note 7',
      customerRequirement: 'Contract requirement',
      requirementText: 'Controlled acceptance text',
    });
    const firstPlan = document.technique.acquisitions[0].plan;
    if (!firstPlan) throw new Error('Fixture acquisition plan was not normalized.');
    firstPlan.interpretationAreas.push({
      id: 'ia-stable-1',
      areaId: 'IA-01',
      description: 'Thin region',
      inspectionAreaId: 'area-1',
      thicknessZoneId: 'zone-stable-1',
      position: { x: 1, y: 2, width: 3, height: 4, rotationDegrees: 0 },
      thicknessMinimum: 10,
      thicknessMaximum: 12,
      thicknessUnit: 'mm',
      viewingPresetId: 'vp-1',
      windowLevel: 100,
      windowWidth: 400,
      zoom: 2,
      sharpness: 'Qualified setting',
      permittedProcessing: 'Window/level only',
      lut: 'Linear',
      invert: false,
      acceptanceProfileId: 'ac-1',
    });

    (planning.part.geometry as unknown as Record<string, unknown>).inactivePlateWidth = 99;
    (planning as unknown as Record<string, unknown>).unknownPlanning = 'strip';
    (planning.visual as unknown as Record<string, unknown>).calculatedSdd = 110;
    (firstPlan as unknown as Record<string, unknown>).calculatedUg = 0.05;

    const decoded = decodeRtPtDocument(document);

    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success' || decoded.document.method !== 'RT-Digital') return;
    expect(decoded.document.technique.planning?.part.technique).toEqual({
      wallTechnique: 'Double Wall',
      imageTechnique: 'Elliptical',
      otherImageTechnique: '',
    });
    expect(decoded.document.technique.planning?.part.geometry).not.toHaveProperty('inactivePlateWidth');
    expect(decoded.document.technique.planning).not.toHaveProperty('unknownPlanning');
    expect(decoded.document.technique.planning?.visual).toMatchObject({
      sourcePosition: { x: 0.1, y: 0.5 },
      detectorPosition: { x: 0.9, y: 0.5 },
      inspectionAreaId: 'area-1',
    });
    expect(decoded.document.technique.planning?.visual).not.toHaveProperty('calculatedSdd');
    expect(decoded.document.technique.acquisitions[0].plan).not.toHaveProperty('calculatedUg');
    const preservedInterpretationArea = decoded.document.technique.acquisitions[0].plan?.interpretationAreas
      .find(({ id }) => id === 'ia-stable-1');
    expect(preservedInterpretationArea).toMatchObject({
      id: 'ia-stable-1',
      viewingPresetId: 'vp-1',
      acceptanceProfileId: 'ac-1',
    });
  });

  it('creates fresh deep defaults without sharing IDs or mutable arrays', () => {
    const first = createEmptyRtDigitalPlanning();
    const second = createEmptyRtDigitalPlanning();
    const firstAcquisition = createEmptyRtDigitalAcquisitionPlan();
    const secondAcquisition = createEmptyRtDigitalAcquisitionPlan();

    first.viewingPresets.push({
      id: 'vp-test', name: '', windowLevel: '', windowWidth: '', zoom: '', sharpness: '',
      permittedProcessing: '', lut: '', invert: false,
    });
    firstAcquisition.interpretationAreas.push({
      id: 'ia-test', areaId: '', description: '', inspectionAreaId: '', thicknessZoneId: '',
      position: { x: '', y: '', width: '', height: '', rotationDegrees: '' },
      thicknessMinimum: '', thicknessMaximum: '', thicknessUnit: 'mm', viewingPresetId: '',
      windowLevel: '', windowWidth: '', zoom: '', sharpness: '', permittedProcessing: '', lut: '',
      invert: false, acceptanceProfileId: '',
    });

    expect(second.viewingPresets).toEqual([]);
    expect(secondAcquisition.interpretationAreas).toEqual([]);
    expect(first.id).not.toBe(second.id);
    expect(first.part.id).not.toBe(second.part.id);
    expect(first.visual.id).not.toBe(second.visual.id);
    expect(first.visual.sourcePosition).not.toBe(second.visual.sourcePosition);
    expect(firstAcquisition.id).not.toBe(secondAcquisition.id);
  });

  it('creates and duplicates acquisitions with independently keyed structured plans', () => {
    const original = createRtDigitalAcquisition({ viewId: 'EXP-001' });
    const duplicate = duplicateRtDigitalAcquisition(original);

    expect(original.plan).toBeDefined();
    expect(duplicate.plan).toBeDefined();
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.viewId).toBe('');
    expect(duplicate.plan.id).not.toBe(original.plan.id);
    expect(duplicate.plan.gridPlacement.id).not.toBe(original.plan.gridPlacement.id);
    expect(duplicate.plan.visual.id).not.toBe(original.plan.visual.id);
    expect(duplicate.plan.iqiAssignment.id).not.toBe(original.plan.iqiAssignment.id);
  });
});

describe('RT Digital pure engineering calculations', () => {
  it('derives an entire-part coverage footprint from controlled Section 01 geometry', () => {
    const planning = createEmptyRtDigitalPlanning();
    planning.part.inspectionAreas.mode = 'Entire Part';
    planning.part.geometry = {
      id: planning.part.geometry.id,
      geometryType: 'Rectangular',
      unit: 'inch',
      length: 12,
      width: 8,
      height: 2,
    };

    expect(resolveRtDigitalInspectionArea(planning.part)).toMatchObject({
      areaId: 'ENTIRE-PART',
      width: 12,
      height: 8,
      unit: 'inch',
      position: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  it('derives mixed-unit geometry, unsharpness, object pixel and FOV', () => {
    const result = calculateRtDigitalGeometry({
      distanceBasis: 'SOD + ODD',
      sod: length(10, 'inch'),
      sdd: length(''),
      odd: length(25.4),
      focalSpotSize: length(1000, 'um'),
      requiredMaximumUg: length(0.1),
      detectorPixelSize: length(200, 'um'),
      detectorActiveWidth: length(10, 'inch'),
      detectorActiveHeight: length(127),
      requiredMaximumEffectivePixel: length(0.2),
    });

    expect(convertRtDigitalLength(1, 'inch')).toBe(25.4);
    expect(result).toMatchObject({
      status: 'complete',
      derivedDistance: 'sdd',
      sodMm: 254,
      sddMm: 279.4,
      oddMm: 25.4,
      magnification: 1.1,
      ugMm: 0.1,
      minimumSodMm: 254,
      maximumOddMm: 25.4,
      ugStatus: 'pass',
      resolutionStatus: 'pass',
    });
    expect(result.effectiveObjectPixelMm).toBeCloseTo(0.181818182, 8);
    expect(result.objectFovWidthMm).toBeCloseTo(230.909090909, 8);
    expect(result.objectFovHeightMm).toBeCloseTo(115.454545455, 8);
  });

  it('fails closed with null calculations for inconsistent or blank geometry', () => {
    const inconsistent = calculateRtDigitalGeometry({
      sod: length(100),
      sdd: length(120),
      odd: length(10),
      focalSpotSize: length(1),
      requiredMaximumUg: length(0.1),
      detectorPixelSize: length(200, 'um'),
      detectorActiveWidth: length(200),
      detectorActiveHeight: length(100),
    });
    const blank = calculateRtDigitalGeometry({
      sod: length(''), sdd: length(''), odd: length(''), focalSpotSize: length(''),
      requiredMaximumUg: length(''), detectorPixelSize: length(''),
      detectorActiveWidth: length(''), detectorActiveHeight: length(''),
    });

    expect(inconsistent.status).toBe('invalid');
    expect(inconsistent.magnification).toBeNull();
    expect(inconsistent.ugStatus).toBeNull();
    expect(blank.status).toBe('incomplete');
    expect(blank.objectFovWidthMm).toBeNull();
    expect(convertRtDigitalLength('', 'mm')).toBeNull();
  });

  it('builds a deterministic coverage grid and warns when a manual count creates underlap', () => {
    const automatic = calculateRtDigitalCoverage({
      inspectionAreaWidth: length(500),
      inspectionAreaHeight: length(300),
      objectFovWidth: length(200),
      objectFovHeight: length(150),
      requiredOverlapPercent: 20,
      orientation: 'Landscape',
    });
    const manualUnderlap = calculateRtDigitalCoverage({
      inspectionAreaWidth: length(500),
      inspectionAreaHeight: length(150),
      objectFovWidth: length(200),
      objectFovHeight: length(150),
      requiredOverlapPercent: 20,
      exposureCountX: 2,
      exposureCountY: 1,
    });

    expect(automatic.status).toBe('complete');
    expect(automatic.totalExposureCount).toBe(9);
    expect(automatic.x).toMatchObject({ count: 3, pitchMm: 150, actualOverlapPercent: 25 });
    expect(automatic.y).toMatchObject({ count: 3, pitchMm: 75, actualOverlapPercent: 50 });
    expect(automatic.grid[0]).toMatchObject({ id: 'EXP-001', row: 1, column: 1, centerXmm: 100, centerYmm: 75 });
    expect(automatic.grid[8]).toMatchObject({ id: 'EXP-009', row: 3, column: 3, centerXmm: 400, centerYmm: 225 });
    expect(manualUnderlap.warnings).toContain('underlap');
    expect(manualUnderlap.x?.actualOverlapPercent).toBe(-50);
  });

  it('compares portrait and landscape and uses a deterministic landscape tie-break', () => {
    const result = optimizeRtDigitalDetectorOrientation({
      inspectionAreaWidth: length(500),
      inspectionAreaHeight: length(250),
      detectorActiveWidth: length(200),
      detectorActiveHeight: length(100),
      magnification: 1,
      requiredOverlapPercent: 0,
    });

    expect(result.status).toBe('complete');
    expect(result.landscape.coverage.totalExposureCount).toBe(9);
    expect(result.portrait.coverage.totalExposureCount).toBe(10);
    expect(result.preferredOrientation).toBe('Landscape');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRtPtDocument } from '../src/lib/rtPtDocumentCodec';
import { validateRtPtDocument } from '../src/lib/rtPtValidation';
import { emptyRtFilmSheet } from '../src/types/rtFilm';
import { buildRtPtTechniquePdf } from '../src/utils/export/RtPtTechniquePDF';

const document = createRtPtDocument({
  documentId: 'rtpt-render-fixture',
  method: 'RT-Film',
  status: 'in-review',
  documentControl: {
    number: 'RT-ASB-014',
    title: 'Aerospace Support Bracket Film RT Technique',
    revision: 'B',
    revisionDate: '2026-07-20',
    effectiveDate: '',
    changeSummary: 'Added four-view exposure plan.',
  },
  organization: { name: 'Example Aerospace', site: 'Plant 2' },
  job: { customer: 'Example Customer', contract: 'C-100', purchaseOrder: 'PO-200', workOrder: 'WO-300' },
  controlledReferences: [{
    type: 'Drawing',
    title: 'Aerospace Support Bracket',
    number: 'DRW-ASB-014',
    revision: 'C',
    clauseOrNote: 'NDT Note 12',
  }],
  approvals: [{
    role: 'prepared',
    name: 'Example Inspector',
    personnelId: 'NDT-200',
    certificationBasis: 'Employer written practice',
    certificationRevision: '7',
    date: '2026-07-20',
  }],
  technique: {
      ...emptyRtFilmSheet,
      general: {
        ...emptyRtFilmSheet.general,
        partName: 'Aerospace Support Bracket',
        partNumber: 'ASB-2026-014',
        material: '17-4PH Stainless Steel',
        thickness: 18,
        drawingReference: 'DRW-ASB-014 Rev C',
        procedureNumber: 'RT-PROC-004 Rev B',
        inspectorLevel: 'II',
        date: '2026-07-20',
      },
      exposure: {
        ...emptyRtFilmSheet.exposure,
        techniqueType: 'SWSI',
        radiationType: 'X-ray',
        sfd: 900,
        sod: 850,
        ofd: 50,
        geometricMagnification: 1.0588,
        focalSpotSize: 1,
        beamAngle: 0,
        numberOfExposures: 4,
        exposurePattern: 'Multiple',
        coverage: 100,
      },
      equipment: {
        ...emptyRtFilmSheet.equipment,
        radiationSourceType: 'X-ray',
        manufacturer: 'Example Manufacturer',
        model: 'XG-300',
        serialNumber: 'XG300-7712',
        calibrationStatus: 'Valid',
        viewingEquipment: 'High-intensity film viewer',
      },
      acceptance: {
        ...emptyRtFilmSheet.acceptance,
        acceptanceStandard: 'DRW-ASB-014 Rev C, Note 12',
        qualityLevel: 'Per engineering drawing',
      },
  },
});

const outputPath = process.argv[2] || path.join(os.tmpdir(), 'rtpt-technique-fixture.pdf');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const pdf = buildRtPtTechniquePdf(document, validateRtPtDocument(document));
fs.writeFileSync(outputPath, Buffer.from(pdf.output('arraybuffer')));
process.stdout.write(outputPath);

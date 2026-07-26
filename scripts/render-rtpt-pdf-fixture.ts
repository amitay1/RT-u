import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePs811000FilmDocument,
  createCompletePtDocument,
} from '../src/lib/__tests__/rtPtV3Fixtures';
import { validateRtPtDocument } from '../src/lib/rtPtValidation';
import type { RtPtDocumentStatus, RtPtDocumentV3, RtPtMethod } from '../src/types/rtPtDocument';
import { buildRtPtTechniquePdf } from '../src/utils/export/RtPtTechniquePDF';

const method = (process.argv[3] || 'RT-Film') as RtPtMethod;
const status = (process.argv[4] || 'draft') as RtPtDocumentStatus;
const variant = process.argv[5] || '';

const createFixture = (): RtPtDocumentV3 => {
  if (method === 'RT-Digital') return createCompleteDigitalDocument(status);
  if (method === 'PT') return createCompletePtDocument('D', 'Type I', status);
  if (variant === 'ps811000') {
    const document = createCompletePs811000FilmDocument(status);
    document.technique.filmSystem.viewingMode = 'superimposed';
    document.technique.filmSystem.requiredDensityMin = 2;
    document.technique.filmSystem.individualFilmDensityMinimum = 1;
    return document;
  }
  const document = createCompleteFilmDocument(status);
  if (variant === 'long-cover') {
    const longText = 'LONG CONTROLLED CONTENT FOR COVER LAYOUT VERIFICATION '.repeat(10).trim();
    document.documentControl.title = longText;
    document.documentControl.changeSummary = longText;
    document.organization.name = longText;
    document.job.customer = longText;
    document.controlledReferences = [0, 1, 2].map((index) => ({
      type: `Reference ${index + 1}`,
      title: longText,
      number: `LONG-REF-${index + 1}`,
      revision: 'A',
      clauseOrNote: longText,
    }));
    document.approvals = [
      { ...document.approvals[0], name: longText, certificationBasis: longText },
      { ...document.approvals[0], role: 'reviewed', name: longText, certificationBasis: longText },
      { ...document.approvals[0], role: 'prepared', name: longText, certificationBasis: longText },
    ];
  }
  return document;
};

const document = createFixture();
const outputPath = process.argv[2] || path.join(os.tmpdir(), `rtpt-${method}-${status}-fixture.pdf`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const pdf = buildRtPtTechniquePdf(document, validateRtPtDocument(document));
fs.writeFileSync(outputPath, Buffer.from(pdf.output('arraybuffer')));
process.stdout.write(outputPath);

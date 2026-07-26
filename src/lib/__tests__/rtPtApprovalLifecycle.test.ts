import { describe, expect, it } from 'vitest';
import {
  bindRtPtApprovedContent,
  reconcileRtPtApprovedContent,
} from '@/lib/rtPtApprovalLifecycle';
import {
  decodeRtPtDocument,
  fingerprintRtPtApprovedContent,
} from '@/lib/rtPtDocumentCodec';
import {
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from '@/lib/__tests__/rtPtV3Fixtures';
import type { RtPtDocumentV3 } from '@/types/rtPtDocument';

const clone = <T>(value: T): T => structuredClone(value);

describe('RT/PT approval lifecycle', () => {
  it('keeps an exact approved document bound to its canonical approval basis', () => {
    const document = createCompleteFilmDocument('approved');
    const canonicalClone = clone(document);

    const result = reconcileRtPtApprovedContent(canonicalClone);

    expect(result).toEqual({ document: canonicalClone, invalidated: false });
    expect(document.approvalFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(document.approvalFingerprint).toBe(fingerprintRtPtApprovedContent(document));
  });

  it('creates a compact persisted binding when a document is approved', () => {
    const draft = createCompleteDigitalDocument('draft');
    const approved = bindRtPtApprovedContent(draft);

    expect(approved.status).toBe('approved');
    expect(approved.approvalFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(approved.approvalFingerprint).toBe(fingerprintRtPtApprovedContent(approved));
    expect(draft).not.toHaveProperty('approvalFingerprint');
  });

  it('fails closed when an approved document has no approval basis', () => {
    const document = createCompleteFilmDocument('approved');
    delete document.approvalFingerprint;
    const original = clone(document);

    const result = reconcileRtPtApprovedContent(document);

    expect(result.invalidated).toBe(true);
    expect(result.document.status).toBe('draft');
    expect(result.document.approvals).toEqual([]);
    expect(result.document).not.toHaveProperty('approvalFingerprint');
    expect(document).toEqual(original);
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'not-a-sha256-binding'],
    ['mismatched', `sha256:${'0'.repeat(64)}`],
  ])('demotes hydrated Approved V3 content with a %s persisted binding', (_label, fingerprint) => {
    const approved = createCompleteFilmDocument('approved');
    if (fingerprint === undefined) delete approved.approvalFingerprint;
    else approved.approvalFingerprint = fingerprint;

    const decoded = decodeRtPtDocument(clone(approved));

    expect(decoded.status).toBe('success');
    if (decoded.status !== 'success') return;
    expect(decoded.document).toMatchObject({ status: 'draft', approvals: [] });
    expect(decoded.document).not.toHaveProperty('approvalFingerprint');
  });

  it('preserves a valid persisted approval binding through V3 serialization and hydration', () => {
    const approved = createCompletePtDocument('D', 'Type I', 'approved');

    const decoded = decodeRtPtDocument(JSON.parse(JSON.stringify(approved)));

    expect(decoded).toEqual({ status: 'success', document: approved });
  });

  it.each([
    ['document identity', (document: RtPtDocumentV3) => { document.documentId = `${document.documentId}-changed`; }],
    ['document control', (document: RtPtDocumentV3) => { document.documentControl.title = 'Revised controlled title'; }],
    ['revision history', (document: RtPtDocumentV3) => { document.revisionHistory[0].author = 'Different author'; }],
    ['organization', (document: RtPtDocumentV3) => { document.organization.name = 'Different organization'; }],
    ['job', (document: RtPtDocumentV3) => { document.job.customer = 'Different customer'; }],
    ['unit system', (document: RtPtDocumentV3) => { document.unitSystem = 'US-customary'; }],
    ['controlled reference', (document: RtPtDocumentV3) => { document.controlledReferences[0].revision = 'C'; }],
    ['approval record', (document: RtPtDocumentV3) => { document.approvals[0].name = 'Different approver'; }],
  ])('invalidates approved %s changes', (_label, mutate) => {
    const approved = createCompleteFilmDocument('approved');
    const edited = clone(approved);
    mutate(edited);

    const result = reconcileRtPtApprovedContent(edited);

    expect(result.invalidated).toBe(true);
    expect(result.document).toMatchObject({ status: 'draft', approvals: [] });
  });

  it.each([
    ['Film RT', () => createCompleteFilmDocument('approved')],
    ['DDA RT', () => createCompleteDigitalDocument('approved')],
    ['PT', () => createCompletePtDocument('D', 'Type I', 'approved')],
  ])('invalidates a still-valid %s technique edit', (_label, createDocument) => {
    const approved = createDocument();
    const edited = clone(approved);
    edited.technique.techniqueNotes = 'A revised but still complete planned instruction.';

    const result = reconcileRtPtApprovedContent(edited);

    expect(result.invalidated).toBe(true);
    expect(result.document).toMatchObject({ status: 'draft', approvals: [] });
  });

  it('excludes lifecycle status and migration quarantine from the approval basis', () => {
    const approved = createCompleteFilmDocument('approved');
    const draftWithMigration = clone(approved);
    draftWithMigration.status = 'draft';
    draftWithMigration.migration = {
      sourceSchemaVersion: 2,
      warnings: ['Migration review is pending.'],
      quarantine: [{
        sourcePath: 'legacy.result',
        reason: 'performed-result',
        value: 'Accept',
      }],
    };

    expect(fingerprintRtPtApprovedContent(draftWithMigration)).toBe(
      fingerprintRtPtApprovedContent(approved),
    );
  });

  it.each(['draft', 'in-review', 'superseded'] as const)(
    'does not rewrite a %s document without an approval basis',
    (status) => {
      const document = createCompleteFilmDocument(status);
      const result = reconcileRtPtApprovedContent(document);

      expect(result).toEqual({ document, invalidated: false });
    },
  );
});

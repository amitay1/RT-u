import type { PtSheet, PtTechnique } from '@/types/penetrant';
import type { RtDigitalSheet, RtDigitalTechnique } from '@/types/rtDigital';
import type { RtFilmSheet, RtFilmTechnique } from '@/types/rtFilm';

export const RT_PT_DOCUMENT_KIND = 'rtpt-document' as const;
export const RT_PT_DOCUMENT_VERSION = 3 as const;
export const RT_PT_DOCUMENT_TYPE = 'technique' as const;

export type RtPtMethod = 'RT-Film' | 'RT-Digital' | 'PT';
export type RtPtDocumentStatus = 'draft' | 'in-review' | 'approved' | 'superseded';
export type RtPtUnitSystem = 'SI' | 'US-customary';
export type RtPtApprovalRole =
  | 'prepared'
  | 'reviewed'
  | 'cognizant-engineering'
  | 'ndt-level-3';

export interface RtPtActiveTabs {
  rtFilm: string;
  rtDigital: string;
  pt: string;
}

export interface RtPtDocumentControl {
  number: string;
  title: string;
  revision: string;
  revisionDate: string;
  effectiveDate: string;
  changeSummary: string;
}

export interface RtPtRevisionHistoryEntry {
  id: string;
  revision: string;
  date: string;
  description: string;
  author: string;
}

export interface RtPtOrganization {
  name: string;
  site: string;
}

export interface RtPtJob {
  customer: string;
  contract: string;
  purchaseOrder: string;
  workOrder: string;
}

export interface RtPtControlledReference {
  type: string;
  title: string;
  number: string;
  revision: string;
  clauseOrNote: string;
}

export interface RtPtApproval {
  role: RtPtApprovalRole;
  name: string;
  personnelId: string;
  certificationBasis: string;
  certificationRevision: string;
  date: string;
}

export type RtPtQuarantineReason =
  | 'performed-result'
  | 'ambiguous-legacy-field'
  | 'manual-mapping-required';

export type RtPtQuarantinedScalar = string | number | boolean | null;

/**
 * Legacy data is flattened into scalar entries so it can be preserved without
 * allowing an untyped object graph back into the controlled technique model.
 */
export interface RtPtQuarantineEntry {
  sourcePath: string;
  reason: RtPtQuarantineReason;
  value: RtPtQuarantinedScalar;
}

export interface RtPtMigrationMetadata {
  sourceSchemaVersion: 1 | 2;
  warnings: string[];
  quarantine: RtPtQuarantineEntry[];
}

interface RtPtDocumentV3Base {
  documentKind: typeof RT_PT_DOCUMENT_KIND;
  schemaVersion: typeof RT_PT_DOCUMENT_VERSION;
  documentType: typeof RT_PT_DOCUMENT_TYPE;
  documentId: string;
  status: RtPtDocumentStatus;
  /**
   * Persisted SHA-256 binding for the exact controlled content approved at
   * release. Older Draft V3 documents may legitimately omit this field.
   */
  approvalFingerprint?: string;
  documentControl: RtPtDocumentControl;
  revisionHistory: RtPtRevisionHistoryEntry[];
  organization: RtPtOrganization;
  job: RtPtJob;
  unitSystem: RtPtUnitSystem;
  controlledReferences: RtPtControlledReference[];
  approvals: RtPtApproval[];
  migration?: RtPtMigrationMetadata;
}

/** `method` is the persisted discriminator for the single active V3 payload. */
export type RtPtDocumentV3 = RtPtDocumentV3Base & (
  | { method: 'RT-Film'; technique: RtFilmTechnique }
  | { method: 'RT-Digital'; technique: RtDigitalTechnique }
  | { method: 'PT'; technique: PtTechnique }
);

export type RtPtDocument = RtPtDocumentV3;

/** Read-only migration input. V2 structures are never accepted as V3 writes. */
interface RtPtDocumentV2Base {
  documentKind: typeof RT_PT_DOCUMENT_KIND;
  schemaVersion: 2;
  documentType: typeof RT_PT_DOCUMENT_TYPE;
  documentId: string;
  status: RtPtDocumentStatus;
  documentControl: RtPtDocumentControl;
  organization: RtPtOrganization;
  job: RtPtJob;
  unitSystem: RtPtUnitSystem;
  controlledReferences: RtPtControlledReference[];
  approvals: RtPtApproval[];
  migration?: unknown;
}

export type RtPtDocumentV2 = RtPtDocumentV2Base & (
  | { method: 'RT-Film'; technique: unknown }
  | { method: 'RT-Digital'; technique: unknown }
  | { method: 'PT'; technique: unknown }
);

export interface RtPtLegacyDocumentSheets {
  rtFilm: unknown;
  rtDigital: unknown;
  penetrant: unknown;
}

export interface RtPtLegacyDocumentV1 {
  documentKind: typeof RT_PT_DOCUMENT_KIND;
  schemaVersion: 1;
  method: RtPtMethod;
  activeTabs?: Partial<RtPtActiveTabs>;
  sheets: RtPtLegacyDocumentSheets;
}

/** @deprecated Read-only schema V1 migration input. */
export type RtPtDocumentV1 = RtPtLegacyDocumentV1;

export const DEFAULT_RT_PT_ACTIVE_TABS: RtPtActiveTabs = {
  rtFilm: 'general',
  rtDigital: 'general',
  pt: 'general',
};

export const EMPTY_RT_PT_DOCUMENT_CONTROL: RtPtDocumentControl = {
  number: '',
  title: '',
  revision: '',
  revisionDate: '',
  effectiveDate: '',
  changeSummary: '',
};

export const EMPTY_RT_PT_REVISION_HISTORY: RtPtRevisionHistoryEntry[] = [];
export const EMPTY_RT_PT_ORGANIZATION: RtPtOrganization = { name: '', site: '' };
export const EMPTY_RT_PT_JOB: RtPtJob = {
  customer: '',
  contract: '',
  purchaseOrder: '',
  workOrder: '',
};

export const RT_PT_METHOD_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'Film radiographic testing',
  'RT-Digital': 'Digital radiographic testing (DDA)',
  PT: 'Liquid penetrant testing',
};

/** Advisory UI copy only. It is never inserted into controlled references. */
export const RT_PT_REFERENCE_SUGGESTIONS: Record<RtPtMethod, string> = {
  'RT-Film': 'Suggested reference to verify: ASTM E1742/E1742M (select the contractually applicable revision)',
  'RT-Digital': 'Suggested reference to verify: ASTM E2698 (select the contractually applicable revision)',
  PT: 'Suggested reference to verify: ASTM E1417/E1417M (select the contractually applicable revision)',
};

/** @deprecated Neutral metadata label retained for integrations that have not renamed the field. */
export const RT_PT_STANDARD_LABEL: Record<RtPtMethod, string> = {
  'RT-Film': 'Film RT - controlled reference not selected',
  'RT-Digital': 'Digital RT - controlled reference not selected',
  PT: 'PT - controlled reference not selected',
};

export type RtPtDecodeResult =
  | { status: 'success'; document: RtPtDocumentV3 }
  | { status: 'legacy-ut'; message: string }
  | { status: 'unsupported-version'; version: number; message: string }
  | { status: 'invalid'; message: string };

export type { PtSheet, PtTechnique, RtDigitalSheet, RtDigitalTechnique, RtFilmSheet, RtFilmTechnique };

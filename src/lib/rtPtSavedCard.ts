import { decodeRtPtDocument } from '@/lib/rtPtDocumentCodec';
import type { RtPtDocumentV3, RtPtMethod } from '@/types/rtPtDocument';

type UnknownRecord = Record<string, unknown>;

export interface RtPtSavedCard {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  standard: string;
  createdAt: string;
  updatedAt: string;
  completionPercent: number;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
  data: RtPtDocumentV3;
}

export interface RtPtSavedCardsFilter {
  method?: RtPtMethod | 'all';
  searchQuery?: string;
  tags?: string[];
  showArchived?: boolean;
  showFavoritesOnly?: boolean;
  sortBy?: 'name' | 'updatedAt' | 'createdAt' | 'completionPercent';
  sortOrder?: 'asc' | 'desc';
}

export interface RtPtCardImportReport {
  imported: number;
  rejected: number;
  errors: string[];
}

export interface RtPtSavedCardDecodeReport extends RtPtCardImportReport {
  cards: RtPtSavedCard[];
}

interface DecodeEnvelopeOptions {
  mode: 'storage' | 'import';
  profileId: string;
  idFactory: () => string;
  now: string;
}

export interface DecodeStoredRtPtCardsOptions {
  fallbackProfileId?: string;
}

export interface ImportRtPtCardsOptions {
  profileId: string;
  idFactory: () => string;
  now?: string;
}

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isTimestamp = (value: unknown): value is string => (
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
);

function readOptionalString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error(`Metadata field "${key}" must be a string.`);
  }
  return value;
}

function readBoolean(record: UnknownRecord, key: string, fallback: boolean): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Metadata field "${key}" must be true or false.`);
  }
  return value;
}

function readCompletionPercent(record: UnknownRecord): number {
  const value = record.completionPercent;
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Metadata field "completionPercent" must be a number from 0 to 100.');
  }
  return value;
}

function readTags(record: UnknownRecord): string[] {
  const value = record.tags;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    throw new Error('Metadata field "tags" must be an array of strings.');
  }

  return [...new Set(value.map((tag) => tag.trim()).filter(Boolean))];
}

function defaultCardName(method: RtPtMethod): string {
  if (method === 'RT-Film') return 'Imported Film RT Technique';
  if (method === 'RT-Digital') return 'Imported Digital RT Technique';
  return 'Imported PT Technique';
}

function defaultStandardLabel(method: RtPtMethod): string {
  if (method === 'RT-Film') return 'Film RT reference not provided';
  if (method === 'RT-Digital') return 'Digital RT reference not provided';
  return 'PT reference not provided';
}

function decodeEnvelope(
  value: unknown,
  options: DecodeEnvelopeOptions,
): { card?: RtPtSavedCard; error?: string } {
  if (!isRecord(value)) {
    return { error: 'The saved-card envelope is not an object.' };
  }

  const isDirectDocument = !Object.prototype.hasOwnProperty.call(value, 'data');
  const documentCandidate = isDirectDocument ? value : value.data;
  const decoded = decodeRtPtDocument(documentCandidate);
  if (decoded.status !== 'success') {
    return { error: decoded.message };
  }
  if (isDirectDocument && options.mode === 'storage') {
    return { error: 'Stored cards must include an RT-PT saved-card envelope.' };
  }

  try {
    const envelope = isDirectDocument ? {} : value;
    const document = options.mode === 'import' && decoded.document.status === 'approved'
      ? { ...decoded.document, status: 'draft' as const, approvals: [] }
      : decoded.document;
    const method = document.method;
    const suppliedName = readOptionalString(envelope, 'name')
      ?? readOptionalString(envelope, 'sheetName');
    const suppliedStandard = readOptionalString(envelope, 'standard');
    const description = readOptionalString(envelope, 'description');

    let id: string;
    let profileId: string;
    let createdAt: string;
    let updatedAt: string;

    if (options.mode === 'storage') {
      if (!isNonEmptyString(envelope.id)) {
        throw new Error('Stored card metadata is missing a valid "id".');
      }
      if (!isTimestamp(envelope.createdAt) || !isTimestamp(envelope.updatedAt)) {
        throw new Error('Stored card metadata must include valid "createdAt" and "updatedAt" timestamps.');
      }

      id = envelope.id;
      profileId = isNonEmptyString(envelope.profileId) ? envelope.profileId : options.profileId;
      createdAt = envelope.createdAt;
      updatedAt = envelope.updatedAt;
    } else {
      id = options.idFactory();
      profileId = options.profileId;
      createdAt = options.now;
      updatedAt = options.now;
    }

    return {
      card: {
        id,
        profileId,
        name: suppliedName?.trim() || defaultCardName(method),
        ...(description === undefined ? {} : { description }),
        standard: suppliedStandard?.trim() || defaultStandardLabel(method),
        createdAt,
        updatedAt,
        completionPercent: readCompletionPercent(envelope),
        tags: readTags(envelope),
        isFavorite: readBoolean(envelope, 'isFavorite', false),
        isArchived: readBoolean(envelope, 'isArchived', false),
        data: document,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'The saved-card metadata is invalid.',
    };
  }
}

function decodeItems(
  items: unknown[],
  options: DecodeEnvelopeOptions,
): RtPtSavedCardDecodeReport {
  const cards: RtPtSavedCard[] = [];
  const errors: string[] = [];

  items.forEach((item, index) => {
    const result = decodeEnvelope(item, options);
    if (result.card) {
      cards.push(result.card);
      return;
    }
    errors.push(`Item ${index + 1}: ${result.error || 'Unknown saved-card error.'}`);
  });

  return {
    cards,
    imported: cards.length,
    rejected: errors.length,
    errors,
  };
}

export function decodeStoredRtPtCards(
  value: unknown,
  options: DecodeStoredRtPtCardsOptions = {},
): RtPtSavedCardDecodeReport {
  if (!Array.isArray(value)) {
    return {
      cards: [],
      imported: 0,
      rejected: 1,
      errors: ['Saved-card storage must contain an array.'],
    };
  }

  return decodeItems(value, {
    mode: 'storage',
    profileId: options.fallbackProfileId || 'default',
    idFactory: () => {
      throw new Error('Stored cards must preserve their existing IDs.');
    },
    now: '',
  });
}

export function importRtPtCardsFromJson(
  json: string,
  options: ImportRtPtCardsOptions,
): RtPtSavedCardDecodeReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      cards: [],
      imported: 0,
      rejected: 1,
      errors: ['The selected file is not valid JSON.'],
    };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) {
    return {
      cards: [],
      imported: 0,
      rejected: 0,
      errors: ['The selected file does not contain any cards.'],
    };
  }

  return decodeItems(items, {
    mode: 'import',
    profileId: options.profileId,
    idFactory: options.idFactory,
    now: options.now || new Date().toISOString(),
  });
}

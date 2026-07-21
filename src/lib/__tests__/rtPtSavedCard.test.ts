import { describe, expect, it } from 'vitest';
import { createRtPtDocument } from '@/lib/rtPtDocumentCodec';
import {
  decodeStoredRtPtCards,
  importRtPtCardsFromJson,
} from '@/lib/rtPtSavedCard';
import { emptyPtSheet } from '@/types/penetrant';
import { emptyRtDigitalSheet } from '@/types/rtDigital';
import { emptyRtFilmSheet } from '@/types/rtFilm';

const buildDocument = (method: 'RT-Film' | 'RT-Digital' | 'PT' = 'RT-Film') => (
  createRtPtDocument({
    method,
    sheets: {
      rtFilm: emptyRtFilmSheet,
      rtDigital: emptyRtDigitalSheet,
      penetrant: emptyPtSheet,
    },
  })
);

const storedEnvelope = {
  id: 'stored-id',
  profileId: 'stored-profile',
  name: 'Existing film card',
  description: 'Keep this metadata',
  standard: 'Customer RT procedure',
  createdAt: '2025-01-02T03:04:05.000Z',
  updatedAt: '2025-02-03T04:05:06.000Z',
  completionPercent: 42,
  tags: ['customer', 'customer', '  film  '],
  isFavorite: true,
  isArchived: false,
  data: buildDocument(),
  type: 'technique',
  isSplitMode: true,
  partA: { legacy: true },
};

describe('RT/PT saved-card boundary', () => {
  it('preserves stored identity and timestamps while stripping legacy envelope fields', () => {
    const report = decodeStoredRtPtCards([storedEnvelope]);

    expect(report.imported).toBe(1);
    expect(report.rejected).toBe(0);
    expect(report.cards[0]).toMatchObject({
      id: 'stored-id',
      profileId: 'stored-profile',
      createdAt: '2025-01-02T03:04:05.000Z',
      updatedAt: '2025-02-03T04:05:06.000Z',
      tags: ['customer', 'film'],
    });
    expect(report.cards[0]).not.toHaveProperty('type');
    expect(report.cards[0]).not.toHaveProperty('isSplitMode');
    expect(report.cards[0]).not.toHaveProperty('partA');
  });

  it('accepts old local/server envelopes only when their data is valid RT/PT V1', () => {
    const report = importRtPtCardsFromJson(JSON.stringify([
      storedEnvelope,
      {
        sheetName: 'Server PT card',
        standard: 'PT-PROC-1',
        data: buildDocument('PT'),
        userId: 'ignored-server-user',
        orgId: 'ignored-server-org',
      },
    ]), {
      profileId: 'current-profile',
      idFactory: (() => {
        let next = 0;
        return () => `fresh-${++next}`;
      })(),
      now: '2026-07-20T10:00:00.000Z',
    });

    expect(report).toMatchObject({ imported: 2, rejected: 0, errors: [] });
    expect(report.cards.map((card) => card.id)).toEqual(['fresh-1', 'fresh-2']);
    expect(report.cards.every((card) => card.profileId === 'current-profile')).toBe(true);
    expect(report.cards.every((card) => card.createdAt === '2026-07-20T10:00:00.000Z')).toBe(true);
    expect(report.cards[1]).toMatchObject({ name: 'Server PT card', standard: 'PT-PROC-1' });
    expect(report.cards[1]).not.toHaveProperty('userId');
  });

  it('reports valid and rejected items independently for mixed imports', () => {
    const report = importRtPtCardsFromJson(JSON.stringify([
      buildDocument('RT-Digital'),
      { partA: {}, inspectionSetup: {} },
      { name: 'Legacy UT', data: { partA: {}, inspectionSetup: {} } },
      {
        name: 'Future RT/PT',
        data: {
          documentKind: 'rtpt-document',
          schemaVersion: 99,
          method: 'PT',
          sheets: {},
        },
      },
      'not-an-envelope',
    ]), {
      profileId: 'profile',
      idFactory: () => 'fresh-id',
      now: '2026-07-20T10:00:00.000Z',
    });

    expect(report.imported).toBe(1);
    expect(report.rejected).toBe(4);
    expect(report.errors).toHaveLength(4);
    expect(report.cards[0].standard).toBe('Digital RT reference not provided');
    expect(report.errors.join(' ')).toContain('unsupported legacy inspection data model');
    expect(report.errors.join(' ')).toContain('newer than this application supports');
    expect(report.errors.join(' ')).toContain('not an object');
  });

  it('rejects malformed allowlisted metadata instead of copying it into a card', () => {
    const report = importRtPtCardsFromJson(JSON.stringify({
      name: 'Bad metadata',
      tags: 'not-an-array',
      data: buildDocument('PT'),
    }), {
      profileId: 'profile',
      idFactory: () => 'fresh-id',
    });

    expect(report.imported).toBe(0);
    expect(report.rejected).toBe(1);
    expect(report.errors[0]).toContain('tags');
  });

  it('returns a clear report for malformed JSON', () => {
    const report = importRtPtCardsFromJson('{not-json', {
      profileId: 'profile',
      idFactory: () => 'fresh-id',
    });

    expect(report).toMatchObject({ imported: 0, rejected: 1 });
    expect(report.errors[0]).toContain('not valid JSON');
  });
});

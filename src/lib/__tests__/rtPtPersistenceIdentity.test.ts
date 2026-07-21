import { describe, expect, it } from 'vitest';
import { resolvePersistenceSaveTarget } from '@/hooks/useSheetPersistence';

describe('RT/PT persistence identity', () => {
  it('targets the loaded local card only when no database identity is active', () => {
    expect(resolvePersistenceSaveTarget({
      currentSheetId: null,
      currentSheetName: 'Local technique',
      currentLocalCardId: 'local-1',
      localCardExists: true,
    })).toEqual({ storage: 'local', cardId: 'local-1' });
  });

  it('targets the loaded database sheet only when no local identity is active', () => {
    expect(resolvePersistenceSaveTarget({
      currentSheetId: 'sheet-1',
      currentSheetName: 'Database technique',
      currentLocalCardId: null,
      localCardExists: false,
    })).toEqual({
      storage: 'database',
      sheetId: 'sheet-1',
      sheetName: 'Database technique',
    });
  });

  it('fails closed instead of selecting a stale target when both source IDs exist', () => {
    expect(resolvePersistenceSaveTarget({
      currentSheetId: 'sheet-stale',
      currentSheetName: 'Ambiguous technique',
      currentLocalCardId: 'local-stale',
      localCardExists: true,
    })).toBeNull();
  });

  it('does not target a deleted local card', () => {
    expect(resolvePersistenceSaveTarget({
      currentSheetId: null,
      currentSheetName: 'Deleted local technique',
      currentLocalCardId: 'missing-local',
      localCardExists: false,
    })).toBeNull();
  });
});

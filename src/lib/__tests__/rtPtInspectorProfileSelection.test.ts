import { describe, expect, it } from 'vitest';
import { resolveStoredInspectorProfileId } from '@/lib/rtPtInspectorProfileSelection';
import type { InspectorProfile, InspectorProfileStorage } from '@/types/inspectorProfile';

const profile: InspectorProfile = {
  id: 'inspector-1',
  name: 'Inspector One',
  initials: 'IO',
  certificationLevel: 'Level II',
  certificationNumber: 'CERT-1',
  certifyingOrganization: 'ASNT',
  createdAt: '2026-08-09T00:00:00.000Z',
  updatedAt: '2026-08-09T00:00:00.000Z',
  isDefault: true,
};

function createStoredProfileState(
  overrides: Partial<InspectorProfileStorage> = {},
): InspectorProfileStorage {
  return {
    profiles: [profile],
    currentProfileId: null,
    rememberSelection: false,
    lastUsedProfileId: null,
    ...overrides,
  };
}

describe('RT/PT inspector profile selection persistence', () => {
  it('restores the active inspector even when suggestion mode is disabled', () => {
    expect(resolveStoredInspectorProfileId(
      [profile],
      createStoredProfileState({ currentProfileId: profile.id }),
    )).toBe(profile.id);
  });

  it('uses the last remembered inspector when no active profile was stored', () => {
    expect(resolveStoredInspectorProfileId(
      [profile],
      createStoredProfileState({
        rememberSelection: true,
        lastUsedProfileId: profile.id,
      }),
    )).toBe(profile.id);
  });

  it('does not restore a profile that no longer exists', () => {
    expect(resolveStoredInspectorProfileId(
      [profile],
      createStoredProfileState({ currentProfileId: 'deleted-inspector' }),
    )).toBeNull();
  });
});
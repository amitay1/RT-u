import type { InspectorProfile, InspectorProfileStorage } from '@/types/inspectorProfile';

export function resolveStoredInspectorProfileId(
  profiles: InspectorProfile[],
  stored: InspectorProfileStorage,
): string | null {
  const storedProfileId = stored.currentProfileId
    || (stored.rememberSelection ? stored.lastUsedProfileId : null)
    || null;

  return storedProfileId && profiles.some((profile) => profile.id === storedProfileId)
    ? storedProfileId
    : null;
}
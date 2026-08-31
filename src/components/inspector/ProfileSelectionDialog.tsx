import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useInspectorProfile } from '@/contexts/InspectorProfileContext';
import { InspectorProfile } from '@/types/inspectorProfile';
import { User, UserPlus, Settings, Star, Check } from 'lucide-react';
import { ProfileManagerDialog } from './ProfileManagerDialog';
import { cn } from '@/lib/utils';

interface ProfileSelectionDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  allowClose?: boolean;
}

export function ProfileSelectionDialog({
  open,
  onOpenChange,
  allowClose = false,
}: ProfileSelectionDialogProps) {
  const {
    profiles,
    currentProfile,
    preferredProfileId,
    rememberSelection,
    selectProfile,
    setRememberSelection,
  } = useInspectorProfile();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [managerInitialMode, setManagerInitialMode] = useState<'list' | 'create'>('list');

  useEffect(() => {
    if (!open) {
      return;
    }

    const suggestedProfile =
      (preferredProfileId && profiles.find((profile) => profile.id === preferredProfileId)) ||
      profiles.find((profile) => profile.isDefault) ||
      profiles[0] ||
      null;

    setSelectedId(currentProfile?.id || suggestedProfile?.id || null);
  }, [open, profiles, currentProfile?.id, preferredProfileId]);

  const handleSelect = (profile: InspectorProfile) => {
    setSelectedId(profile.id);
  };

  const handleContinue = () => {
    if (selectedId) {
      selectProfile(selectedId);
      onOpenChange?.(false);
    }
  };

  const handleCreateNew = () => {
    setManagerInitialMode('create');
    setShowManager(true);
  };

  const handleManage = () => {
    setManagerInitialMode('list');
    setShowManager(true);
  };

  const handleManagerClose = () => {
    setShowManager(false);
  };

  // Avatar component for profile initials
  const ProfileAvatar = ({ profile, selected }: { profile: InspectorProfile; selected: boolean }) => (
    <div
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-md border text-sm font-semibold tabular-nums transition-colors',
        selected
          ? 'border-primary/50 bg-accent text-accent-foreground'
          : 'border-border bg-muted/60 text-muted-foreground'
      )}
    >
      {profile.initials}
    </div>
  );

  return (
    <>
      <Dialog open={open && !showManager} onOpenChange={allowClose ? onOpenChange : undefined}>
        <DialogContent
          className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card p-0 text-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl"
          hideCloseButton={!allowClose}
          onPointerDownOutside={allowClose ? undefined : (e) => e.preventDefault()}
          onEscapeKeyDown={allowClose ? undefined : (e) => e.preventDefault()}
        >
          <DialogHeader className="flex-none border-b border-border bg-muted/40 px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border bg-muted/60 text-muted-foreground">
                  <User className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Workstation profile
                    </span>
                    <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {profiles.length} profile{profiles.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <DialogTitle className="text-xl text-foreground">Select Working Inspector</DialogTitle>
                  <DialogDescription className="max-w-xl text-muted-foreground">
                    Choose the workstation profile used for quick access. Controlled authorship, revision history, and approvals are recorded separately in the document.
                  </DialogDescription>
                </div>
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:max-w-[320px]">
                <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2.5">
                  <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Suggested identity</div>
                  <div
                    className="mt-0.5 block truncate text-sm font-semibold text-foreground"
                    title={(preferredProfileId && profiles.find((profile) => profile.id === preferredProfileId)?.name) || 'Auto'}
                  >
                    {(preferredProfileId && profiles.find((profile) => profile.id === preferredProfileId)?.name) || 'Auto'}
                  </div>
                </div>
                <div className="min-w-0 rounded-md border border-border bg-background px-3 py-2.5">
                  <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Current identity</div>
                  <div
                    className="mt-0.5 block truncate text-sm font-semibold text-foreground"
                    title={currentProfile?.name || 'None'}
                  >
                    {currentProfile?.name || 'None'}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {profiles.length === 0 ? (
              <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <UserPlus className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No inspector identities yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create an inspector profile for this workstation
                  </p>
                </div>
                <Button onClick={handleCreateNew} className="mt-1 rounded-md">
                  <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create Inspector Profile
                </Button>
              </div>
            ) : (
              <>
                {/* Profile List */}
                <div className="max-h-[min(42dvh,380px)] space-y-2 overflow-y-auto pr-1">
                  {profiles.map((profile) => {
                    const isSelected = selectedId === profile.id;
                    return (
                      <button
                        type="button"
                        key={profile.id}
                        onClick={() => handleSelect(profile)}
                        aria-pressed={isSelected}
                        aria-label={`Use ${profile.name}, ${profile.certificationLevel}, certification ${profile.certificationNumber}, as the active workstation inspector`}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors sm:p-4',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          isSelected
                            ? 'border-primary/55 bg-accent/70'
                            : 'border-border bg-card hover:border-ring/45 hover:bg-muted/35'
                        )}
                      >
                        <ProfileAvatar profile={profile} selected={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 flex-1 truncate font-semibold text-foreground" title={profile.name}>
                              {profile.name}
                            </span>
                            {preferredProfileId === profile.id && (
                              <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                                Suggested
                              </span>
                            )}
                            {profile.isDefault && (
                              <Star className="h-3.5 w-3.5 flex-shrink-0 fill-warning text-warning" aria-label="Default profile" />
                            )}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {profile.certificationLevel} · {profile.certificationNumber}
                          </p>
                          <p className="truncate text-xs text-muted-foreground/80">
                            {profile.certifyingOrganization}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Selected</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
                  <Button variant="outline" size="sm" onClick={handleCreateNew} className="w-full rounded-md">
                    <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New Profile
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleManage} className="w-full rounded-md">
                    <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                    Manage
                  </Button>
                </div>

                {/* Remember Selection */}
                <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-3">
                  <Checkbox
                    id="remember"
                    checked={rememberSelection}
                    onCheckedChange={(checked) => setRememberSelection(!!checked)}
                  />
                  <label
                    htmlFor="remember"
                    className="cursor-pointer select-none text-sm text-muted-foreground"
                  >
                    Suggest this inspector next time
                  </label>
                </div>

                {/* Continue Button */}
                <Button
                  onClick={handleContinue}
                  disabled={!selectedId}
                  className="w-full rounded-md"
                  size="lg"
                >
                  Use Inspector
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProfileManagerDialog
        open={showManager}
        onOpenChange={handleManagerClose}
        initialMode={managerInitialMode}
      />
    </>
  );
}

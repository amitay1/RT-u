import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useInspectorProfile } from '@/contexts/InspectorProfileContext';
import { ProfileSelectionDialog } from './ProfileSelectionDialog';
import { ProfileManagerDialog } from './ProfileManagerDialog';
import { User, ChevronDown, Settings, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileIndicatorProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export function ProfileIndicator({ variant = 'default', className }: ProfileIndicatorProps) {
  const { currentProfile, profiles, selectProfile } = useInspectorProfile();
  const [showSelection, setShowSelection] = useState(false);
  const [showManager, setShowManager] = useState(false);

  if (!currentProfile) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSelection(true)}
                aria-label="Select inspector profile"
                className={cn(
                  'h-9 gap-2 rounded-md border-border bg-card px-2.5 text-foreground shadow-sm hover:border-ring/50 hover:bg-accent',
                  className
                )}
              >
                <span className="grid h-6 w-6 place-items-center rounded-sm border border-border bg-muted/60 text-muted-foreground">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {variant === 'default' && <span>Select Profile</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select inspector profile</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ProfileSelectionDialog
          open={showSelection}
          onOpenChange={setShowSelection}
          allowClose
        />
      </>
    );
  }

  const otherProfiles = profiles.filter(p => p.id !== currentProfile.id);

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Current inspector: ${currentProfile.name}. Open profile menu`}
                  className={cn(
                    'group h-9 min-w-0 gap-2 rounded-md border-border bg-card px-2 text-foreground shadow-sm',
                    'hover:border-ring/50 hover:bg-accent data-[state=open]:border-ring/60 data-[state=open]:bg-accent',
                    className
                  )}
                >
                  <div
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-sm border text-xs font-semibold tabular-nums',
                      'border-primary/35 bg-primary/10 text-primary'
                    )}
                  >
                    {currentProfile.initials}
                  </div>
                  {variant === 'default' && (
                    <span className="block max-w-[100px] truncate text-sm" title={currentProfile.name}>
                      {currentProfile.name}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium">{currentProfile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentProfile.certificationLevel} · {currentProfile.certificationNumber}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent align="end" className="w-64 rounded-lg border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {/* Current Profile Info */}
          <DropdownMenuLabel className="rounded-md bg-muted/35 px-3 py-3 font-normal">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-md border font-semibold tabular-nums',
                  'border-primary/35 bg-primary/10 text-primary'
                )}
              >
                {currentProfile.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentProfile.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentProfile.certificationLevel}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentProfile.certificationNumber}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Quick Switch to Other Profiles */}
          {otherProfiles.length > 0 && (
            <>
              <DropdownMenuLabel className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Switch Profile
              </DropdownMenuLabel>
              {otherProfiles.slice(0, 3).map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => selectProfile(profile.id)}
                  className="min-h-9 gap-3 rounded-md px-2.5 py-2"
                >
                  <div
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-border bg-muted/60 text-xs font-medium text-muted-foreground'
                    )}
                  >
                    {profile.initials}
                  </div>
                  <span className="flex-1 truncate">{profile.name}</span>
                  {profile.isDefault && (
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-label="Default profile" />
                  )}
                </DropdownMenuItem>
              ))}
              {otherProfiles.length > 3 && (
                <DropdownMenuItem
                  onClick={() => setShowSelection(true)}
                  className="min-h-9 rounded-md px-2.5 py-2 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  View all profiles...
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Actions */}
          <DropdownMenuItem onClick={() => setShowSelection(true)} className="min-h-9 rounded-md px-2.5 py-2">
            <RefreshCw className="h-4 w-4 mr-2 text-muted-foreground" />
            Change Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowManager(true)} className="min-h-9 rounded-md px-2.5 py-2">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            Manage Profiles
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSelectionDialog
        open={showSelection}
        onOpenChange={setShowSelection}
        allowClose
      />

      <ProfileManagerDialog
        open={showManager}
        onOpenChange={setShowManager}
      />
    </>
  );
}

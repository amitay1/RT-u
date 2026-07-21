import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInspectorProfile } from '@/contexts/InspectorProfileContext';
import {
  InspectorProfile,
  InspectorProfileFormData,
  CERTIFICATION_LEVELS,
  CERTIFYING_ORGANIZATIONS,
  createEmptyProfile,
  validateProfileForm,
} from '@/types/inspectorProfile';
import {
  User,
  UserPlus,
  Pencil,
  Trash2,
  Star,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogMode = 'list' | 'create' | 'edit';

interface ProfileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: DialogMode;
}

export function ProfileManagerDialog({
  open,
  onOpenChange,
  initialMode = 'list',
}: ProfileManagerDialogProps) {
  const {
    profiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
  } = useInspectorProfile();

  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [editingProfile, setEditingProfile] = useState<InspectorProfile | null>(null);
  const [formData, setFormData] = useState<InspectorProfileFormData>(createEmptyProfile());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEditingProfile(null);
      setFormData(createEmptyProfile());
      setErrors({});
    }
  }, [open, initialMode]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBack = () => {
    setMode('list');
    setEditingProfile(null);
    setFormData(createEmptyProfile());
    setErrors({});
  };

  const handleCreate = () => {
    setMode('create');
    setFormData(createEmptyProfile());
    setErrors({});
  };

  const handleEdit = (profile: InspectorProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      certificationLevel: profile.certificationLevel,
      certificationNumber: profile.certificationNumber,
      certifyingOrganization: profile.certifyingOrganization,
      employeeId: profile.employeeId || '',
      department: profile.department || '',
      email: profile.email || '',
      phone: profile.phone || '',
    });
    setMode('edit');
    setErrors({});
  };

  const handleSave = () => {
    const validationErrors = validateProfileForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (mode === 'create') {
      createProfile(formData);
      handleClose();
    } else if (mode === 'edit' && editingProfile) {
      updateProfile(editingProfile.id, formData);
      handleBack();
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteProfile(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleSetDefault = (id: string) => {
    setDefaultProfile(id);
  };

  const updateFormField = (field: keyof InspectorProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Render profile list
  const renderList = () => (
    <>
      <DialogHeader className="flex-none border-b border-border bg-card px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border bg-muted/60 text-muted-foreground">
            <User className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Workstation profiles
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {profiles.length} profile{profiles.length === 1 ? '' : 's'}
              </span>
            </div>
            <DialogTitle className="text-xl text-foreground">Manage Inspector Profiles</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Maintain local identity presets for this workstation. Controlled document authorship and approvals remain explicit document fields.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-10 text-center text-muted-foreground">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md border border-border bg-card">
              <UserPlus className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-medium text-foreground">No profiles created yet</p>
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
                  {profile.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-foreground">{profile.name}</span>
                    {profile.isDefault && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile.certificationLevel} · {profile.certificationNumber}
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center justify-end gap-1 border-t border-border pt-2 sm:w-auto sm:border-0 sm:pt-0">
                {!profile.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md border border-transparent text-muted-foreground hover:border-border"
                    onClick={() => handleSetDefault(profile.id)}
                    title="Set as default"
                    aria-label={`Set ${profile.name} as default`}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-md border border-transparent text-muted-foreground hover:border-border"
                  onClick={() => handleEdit(profile)}
                  title="Edit profile"
                  aria-label={`Edit ${profile.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-md border border-transparent text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(profile.id)}
                  title="Delete profile"
                  aria-label={`Delete ${profile.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <DialogFooter className="flex-none border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <Button variant="outline" onClick={handleClose} className="w-full rounded-md sm:w-auto">
          Close
        </Button>
        <Button onClick={handleCreate} className="w-full rounded-md sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          New Profile
        </Button>
      </DialogFooter>
    </>
  );

  // Render create/edit form
  const renderForm = () => (
    <>
      <DialogHeader className="flex-none border-b border-border bg-card px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14">
        <div className="flex items-start gap-3">
          {mode === 'list' ? null : (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-md"
              onClick={handleBack}
              aria-label="Back to profile list"
              title="Back to profile list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Inspector identity
            </span>
            <DialogTitle className="text-xl text-foreground">
              {mode === 'create' ? 'Create Profile' : 'Edit Profile'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {mode === 'create'
                ? 'Enter the inspector identity and qualification details saved on this workstation.'
                : 'Update the inspector identity and qualification details saved on this workstation.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="required-identity-heading">
          <div className="border-b border-border pb-2">
            <h3 id="required-identity-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Required identity details
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="John Smith"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                className={cn('h-10 rounded-md', errors.name ? 'border-destructive' : '')}
              />
              {errors.name && (
                <p id="name-error" className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Certification Level */}
            <div className="space-y-2">
              <Label htmlFor="certLevel" className="text-sm font-medium text-foreground">
                Certification Level <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.certificationLevel}
                onValueChange={(value) => updateFormField('certificationLevel', value)}
              >
                <SelectTrigger id="certLevel" className="h-10 rounded-md">
                  <SelectValue placeholder="Select level..." />
                </SelectTrigger>
                <SelectContent>
                  {CERTIFICATION_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Certification Number */}
            <div className="space-y-2">
              <Label htmlFor="certNumber" className="text-sm font-medium text-foreground">
                Certification Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="certNumber"
                value={formData.certificationNumber}
                onChange={(e) => updateFormField('certificationNumber', e.target.value)}
                placeholder="ASNT-12345"
                aria-invalid={!!errors.certificationNumber}
                aria-describedby={errors.certificationNumber ? 'cert-number-error' : undefined}
                className={cn('h-10 rounded-md', errors.certificationNumber ? 'border-destructive' : '')}
              />
              {errors.certificationNumber && (
                <p id="cert-number-error" className="text-xs text-destructive">{errors.certificationNumber}</p>
              )}
            </div>

            {/* Certifying Organization */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="certOrg" className="text-sm font-medium text-foreground">
                Certifying Organization <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.certifyingOrganization}
                onValueChange={(value) => updateFormField('certifyingOrganization', value)}
              >
                <SelectTrigger
                  id="certOrg"
                  className={cn('h-10 rounded-md', errors.certifyingOrganization ? 'border-destructive' : '')}
                  aria-invalid={!!errors.certifyingOrganization}
                  aria-describedby={errors.certifyingOrganization ? 'cert-org-error' : undefined}
                >
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent>
                  {CERTIFYING_ORGANIZATIONS.map((org) => (
                    <SelectItem key={org} value={org}>
                      {org}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.certifyingOrganization && (
                <p id="cert-org-error" className="text-xs text-destructive">{errors.certifyingOrganization}</p>
              )}
            </div>
          </div>
        </section>

        {/* Optional Fields */}
        <section className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:p-5" aria-labelledby="optional-information-heading">
          <div className="border-b border-border pb-2">
            <h3 id="optional-information-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Optional information
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Employee ID */}
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="text-sm font-medium text-foreground">Employee ID</Label>
              <Input
                id="employeeId"
                value={formData.employeeId || ''}
                onChange={(e) => updateFormField('employeeId', e.target.value)}
                placeholder="EMP-001"
                className="h-10 rounded-md bg-background"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm font-medium text-foreground">Department</Label>
              <Input
                id="department"
                value={formData.department || ''}
                onChange={(e) => updateFormField('department', e.target.value)}
                placeholder="NDT Lab"
                className="h-10 rounded-md bg-background"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateFormField('email', e.target.value)}
                placeholder="john@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={cn('h-10 rounded-md bg-background', errors.email ? 'border-destructive' : '')}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => updateFormField('phone', e.target.value)}
                placeholder="+1 234 567 8900"
                className="h-10 rounded-md bg-background"
              />
            </div>
          </div>
        </section>
      </div>

      <DialogFooter className="flex-none border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <Button
          variant="outline"
          onClick={mode === 'create' && profiles.length === 0 ? handleClose : handleBack}
          className="w-full rounded-md sm:w-auto"
        >
          Cancel
        </Button>
        <Button onClick={handleSave} className="w-full rounded-md sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {mode === 'create' ? 'Create Profile' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
          {mode === 'list' ? renderList() : renderForm()}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-lg border border-border bg-background text-foreground shadow-xl sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. The profile will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-md border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

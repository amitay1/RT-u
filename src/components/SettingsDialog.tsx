import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Settings,
  Globe,
  ChevronRight,
  Check,
  RotateCcw,
  Download,
  Upload,
  Moon,
  Sun,
  Monitor,
  Save,
  Usb,
} from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { AppSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { APP_FONT_OPTIONS, AppFontOption, getAvailableAppFonts, normalizeAppFontValue } from '@/lib/appFonts';

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = 
  | 'general'
  | 'units'
  | 'export'
  | 'company'
  | 'notifications';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfflineUpdate?: () => void;
}

// ============================================================================
// SETTINGS TABS CONFIGURATION
// ============================================================================

const settingsTabs: { id: SettingsTab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'general', label: 'Appearance', icon: <Globe className="w-4 h-4" />, description: 'Theme and interface typography' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SettingsDialog({ open, onOpenChange, onOfflineUpdate }: SettingsDialogProps) {
  const { resetSettings, exportSettings, importSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const reduceMotion = useReducedMotion();

  const handleExportSettings = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rtpt-inspector-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported successfully');
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const json = e.target?.result as string;
          if (importSettings(json)) {
            toast.success('Settings imported successfully');
          } else {
            toast.error('Failed to import settings - invalid format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleResetCategory = () => {
    resetSettings(activeTab);
    toast.success(`${settingsTabs.find(t => t.id === activeTab)?.label} settings reset to defaults`);
  };

  const handleResetAll = () => {
    resetSettings('general');
    toast.success('Appearance preferences reset to defaults');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-xl sm:h-[min(840px,calc(100dvh-2rem))] sm:w-[calc(100vw-2rem)]">
        {/* Header */}
        <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-primary/20 bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-[0.16em] text-primary">
                  Workstation Preferences
                </span>
                <span className="border-l border-border pl-2 font-medium">
                  {onOfflineUpdate ? '2 sections' : '1 section'}
                </span>
              </div>
              <DialogTitle className="text-xl font-semibold text-card-foreground">Settings</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Configure your RT-PT Inspector preferences
              </DialogDescription>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportSettings}
                    className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="Export settings"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleImportSettings}
                    className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="Import settings"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="mx-1 h-5 bg-border" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAll}
                    className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Reset appearance preferences"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset Appearance</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Sidebar */}
          <div className="w-full flex-none border-b border-border bg-muted/20 md:w-56 md:border-b-0 md:border-r">
            <ScrollArea className="w-full md:h-full">
              <div className="grid grid-cols-1 gap-1 p-2 md:block md:space-y-1 md:p-3">
                {settingsTabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:gap-3 md:px-3 md:py-2.5 ${
                      activeTab === tab.id
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className={activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                    {activeTab === tab.id && (
                      <ChevronRight className="ml-auto hidden h-4 w-4 text-primary md:block" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Tab Header */}
            <div className="flex-none border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {settingsTabs.find(t => t.id === activeTab)?.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {settingsTabs.find(t => t.id === activeTab)?.description}
                  </p>
                </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetCategory}
                    className="rounded-md border-input bg-background text-foreground"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <ScrollArea className="min-h-0 flex-1 bg-background px-4 py-4 sm:px-6 sm:py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  {activeTab === 'general' && <GeneralSettings onOfflineUpdate={onOfflineUpdate} />}
                  {activeTab === 'units' && <UnitsSettings />}
                  {activeTab === 'export' && <ExportSettings />}
                  {activeTab === 'company' && <CompanySettings />}
                  {activeTab === 'notifications' && <NotificationSettings />}
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Save className="w-4 h-4" />
            Settings are saved automatically
          </p>
          <Button onClick={() => onOpenChange(false)} className="rounded-md px-6">
            <Check className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// GENERAL SETTINGS
// ============================================================================

function GeneralSettings({ onOfflineUpdate }: { onOfflineUpdate?: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [availableFonts, setAvailableFonts] = useState<AppFontOption[]>(APP_FONT_OPTIONS);
  const normalizedUiFont = normalizeAppFontValue(settings.general.uiFont);

  useEffect(() => {
    let mounted = true;

    getAvailableAppFonts().then((fonts) => {
      if (mounted && fonts.length > 0) {
        setAvailableFonts(fonts);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (settings.general.uiFont !== normalizedUiFont) {
      updateSettings('general', { uiFont: normalizedUiFont });
    }
  }, [normalizedUiFont, settings.general.uiFont, updateSettings]);

  const selectedFont =
    availableFonts.find((font) => font.value === normalizedUiFont) ??
    APP_FONT_OPTIONS.find((font) => font.value === normalizedUiFont) ??
    availableFonts[0] ??
    APP_FONT_OPTIONS[0];
  const curatedFonts = availableFonts.filter((font) => font.source === 'curated');
  const systemFonts = availableFonts.filter((font) => font.source === 'system');

  return (
    <div className="space-y-6">
      {/* Theme */}
      <SettingsSection title="Appearance">
        <SettingsRow
          label="Theme"
          description="Choose your preferred color theme"
        >
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
              { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
              { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
            ].map((theme) => (
              <Button
                key={theme.value}
                variant={settings.general.theme === theme.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings('general', { theme: theme.value as AppSettings['general']['theme'] })}
                className="rounded-md"
                aria-pressed={settings.general.theme === theme.value}
              >
                {theme.icon}
                <span className="ml-2">{theme.label}</span>
              </Button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Application Font"
          description="Choose the main font used across the interface"
        >
          <div className="space-y-3">
            <Select
              value={normalizedUiFont}
              onValueChange={(value) => updateSettings('general', { uiFont: value as AppSettings['general']['uiFont'] })}
            >
              <SelectTrigger className="w-[340px] max-w-full" aria-label="Application font">
                <SelectValue placeholder="Select interface font" />
              </SelectTrigger>
              <SelectContent className="max-h-[360px]">
                <SelectGroup>
                  <SelectLabel>Recommended</SelectLabel>
                  {curatedFonts.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {systemFonts.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Detected On This Computer</SelectLabel>
                      {systemFonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>

            <div
              className="rounded-md border border-border bg-muted/30 px-4 py-3"
              style={{ fontFamily: selectedFont.stack }}
            >
              <div className="text-sm font-semibold text-foreground">
                {selectedFont.label}
              </div>
              <div className="text-sm text-foreground/90">
                RT-PT Inspector Technique Preview 123
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedFont.sample}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {systemFonts.length > 0
                ? `${availableFonts.length} fonts available, including ${systemFonts.length} detected from this workstation.`
                : `${availableFonts.length} fonts available in the selector.`}
            </div>
          </div>
        </SettingsRow>
      </SettingsSection>

      {onOfflineUpdate && (
        <SettingsSection title="Desktop Updates">
          <SettingsRow
            label="Install Update from USB"
            description="Select and verify a signed offline update package for this workstation"
          >
            <Button variant="outline" onClick={onOfflineUpdate} className="w-full sm:w-auto">
              <Usb className="mr-2 h-4 w-4" />
              Choose Update Package
            </Button>
          </SettingsRow>
        </SettingsSection>
      )}

      <p className="rounded-lg border border-border/80 bg-muted/25 px-4 py-3 text-sm leading-6 text-muted-foreground">
        Units, controlled organization data, and PDF release content are set inside each technique so they remain part of the reviewed document.
      </p>
    </div>
  );
}

// ============================================================================
// UNITS SETTINGS
// ============================================================================

function UnitsSettings() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsSection title="Measurement Units">
        <SettingsRow
          label="Length Unit"
          description="Primary unit for dimensions"
        >
          <Select
            value={settings.units.lengthUnit}
            onValueChange={(value) => updateSettings('units', { lengthUnit: value as AppSettings['units']['lengthUnit'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mm">Millimeters (mm)</SelectItem>
              <SelectItem value="inch">Inches (in)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Angle Unit"
          description="Unit for angle measurements"
        >
          <Select
            value={settings.units.angleUnit}
            onValueChange={(value) => updateSettings('units', { angleUnit: value as AppSettings['units']['angleUnit'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="degrees">Degrees (°)</SelectItem>
              <SelectItem value="radians">Radians (rad)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Temperature Unit"
          description="For material temperature references"
        >
          <Select
            value={settings.units.temperatureUnit}
            onValueChange={(value) => updateSettings('units', { temperatureUnit: value as AppSettings['units']['temperatureUnit'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="celsius">Celsius (°C)</SelectItem>
              <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

      </SettingsSection>
    </div>
  );
}

// ============================================================================
// EXPORT SETTINGS
// ============================================================================

function ExportSettings() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsSection title="Export Preferences">
        <SettingsRow
          label="Default Format"
          description="Preferred export file format"
        >
          <Select
            value={settings.export.defaultExportFormat}
            onValueChange={(value) => updateSettings('export', { defaultExportFormat: value as AppSettings['export']['defaultExportFormat'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Only</SelectItem>
              <SelectItem value="docx">DOCX Only</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Page Size"
          description="Document page size"
        >
          <Select
            value={settings.export.pageSize}
            onValueChange={(value) => updateSettings('export', { pageSize: value as AppSettings['export']['pageSize'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="Letter">Letter</SelectItem>
              <SelectItem value="Legal">Legal</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="PDF Quality"
          description="Image and rendering quality"
        >
          <Select
            value={settings.export.pdfQuality}
            onValueChange={(value) => updateSettings('export', { pdfQuality: value as AppSettings['export']['pdfQuality'] })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (fast)</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="high">High Quality</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Content Options">
        <SettingsRow
          label="Include Cover Page"
          description="Add a professional cover page"
        >
          <Switch
            checked={settings.export.includeCoverPage}
            onCheckedChange={(checked) => updateSettings('export', { includeCoverPage: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Include Table of Contents"
          description="Generate automatic TOC"
        >
          <Switch
            checked={settings.export.includeTableOfContents}
            onCheckedChange={(checked) => updateSettings('export', { includeTableOfContents: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Include Technical Drawings"
          description="Embed part diagrams and drawings"
        >
          <Switch
            checked={settings.export.includeDrawings}
            onCheckedChange={(checked) => updateSettings('export', { includeDrawings: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Include Company Logo"
          description="Add your company logo to documents"
        >
          <Switch
            checked={settings.export.includeCompanyLogo}
            onCheckedChange={(checked) => updateSettings('export', { includeCompanyLogo: checked })}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ============================================================================
// COMPANY SETTINGS
// ============================================================================

function CompanySettings() {
  const { settings, updateSettings } = useSettings();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateSettings('company', { companyLogo: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Company Information">
        <SettingsRow
          label="Company Name"
          description="Your organization's name"
        >
          <Input
            value={settings.company.companyName}
            onChange={(e) => updateSettings('company', { companyName: e.target.value })}
            className="w-64"
            placeholder="Enter company name"
          />
        </SettingsRow>

        <SettingsRow
          label="Company Logo"
          description="Logo for documents and exports"
        >
          <div className="flex flex-wrap items-center gap-3">
            {settings.company.companyLogo && (
              <img
                src={settings.company.companyLogo}
                alt="Company Logo"
                className="h-10 w-auto rounded-md border border-border bg-white object-contain px-2 py-1"
              />
            )}
            <label className="cursor-pointer rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                <Upload className="w-4 h-4" />
                Upload Logo
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="sr-only"
              />
            </label>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Address"
          description="Company address for documents"
        >
          <Textarea
            value={settings.company.companyAddress}
            onChange={(e) => updateSettings('company', { companyAddress: e.target.value })}
            className="w-64 h-20"
            placeholder="Enter company address"
          />
        </SettingsRow>

        <SettingsRow
          label="Phone"
          description="Contact phone number"
        >
          <Input
            value={settings.company.companyPhone}
            onChange={(e) => updateSettings('company', { companyPhone: e.target.value })}
            className="w-48"
            placeholder="+1 (555) 000-0000"
          />
        </SettingsRow>

        <SettingsRow
          label="Email"
          description="Contact email address"
        >
          <Input
            value={settings.company.companyEmail}
            onChange={(e) => updateSettings('company', { companyEmail: e.target.value })}
            className="w-48"
            placeholder="contact@company.com"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Certifications">
        <SettingsRow
          label="NADCAP Number"
          description="NADCAP accreditation number"
        >
          <Input
            value={settings.company.nadcapNumber}
            onChange={(e) => updateSettings('company', { nadcapNumber: e.target.value })}
            className="w-48"
            placeholder="e.g., NDT-12345"
          />
        </SettingsRow>

        <SettingsRow
          label="ISO 17025 Number"
          description="ISO 17025 certification number"
        >
          <Input
            value={settings.company.iso17025Number}
            onChange={(e) => updateSettings('company', { iso17025Number: e.target.value })}
            className="w-48"
            placeholder="e.g., L12345"
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

function NotificationSettings() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsSection title="Reminders & Alerts">
        <SettingsRow
          label="Validation Warnings"
          description="Show warnings when fields don't meet standards"
        >
          <Switch
            checked={settings.notifications.validationWarnings}
            onCheckedChange={(checked) => updateSettings('notifications', { validationWarnings: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Auto-Save Reminder"
          description="Remind to save work periodically"
        >
          <Switch
            checked={settings.notifications.autoSaveReminder}
            onCheckedChange={(checked) => updateSettings('notifications', { autoSaveReminder: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Auto-Save Interval"
          description="Minutes between save reminders"
        >
          <div className="flex items-center gap-4 w-48">
            <Slider
              value={[settings.notifications.autoSaveInterval]}
              onValueChange={([value]) => updateSettings('notifications', { autoSaveInterval: value })}
              min={1}
              max={30}
              step={1}
              className="flex-1"
            />
            <span className="w-12 text-sm tabular-nums text-muted-foreground">{settings.notifications.autoSaveInterval} min</span>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Interface">
        <SettingsRow
          label="Show Tooltips"
          description="Display helpful hints on hover"
        >
          <Switch
            checked={settings.notifications.showTooltips}
            onCheckedChange={(checked) => updateSettings('notifications', { showTooltips: checked })}
          />
        </SettingsRow>

        <SettingsRow
          label="Sound Effects"
          description="Play sounds for notifications"
        >
          <Switch
            checked={settings.notifications.soundEffects}
            onCheckedChange={(checked) => updateSettings('notifications', { soundEffects: checked })}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div
      className="flex flex-col gap-4 rounded-md border border-border bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
    >
      <div className="min-w-0 flex-1 sm:pr-6">
        <Label id={labelId} className="block text-sm font-medium text-foreground">{label}</Label>
        <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="w-full flex-shrink-0 sm:w-auto [&_input]:max-w-full [&_input]:rounded-md [&_input]:border-input [&_input]:bg-background [&_input]:text-foreground [&_button]:max-w-full [&_button]:rounded-md [&_textarea]:max-w-full [&_textarea]:rounded-md [&_textarea]:border-input [&_textarea]:bg-background [&_textarea]:text-foreground [&_[role=combobox]]:max-w-full [&_[role=combobox]]:rounded-md">{children}</div>
    </div>
  );
}

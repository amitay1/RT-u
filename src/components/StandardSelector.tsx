import type { StandardType } from "@/types/techniqueSheet";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CircleDot,
  Clock,
  DollarSign,
  Factory,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  Info,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Target,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLicense } from "@/contexts/LicenseContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HIDDEN_LEGACY_OEM_STANDARD_CODES } from "@/utils/mroPolicy";
import { getOEMRulesFromStandard, isOEMStandard } from "@/utils/oemRuleEngine";

interface StandardSelectorProps {
  value: StandardType;
  onChange: (value: StandardType) => void;
  showComparisonIndicator?: boolean;
  variant?: "default" | "compact";
}

type StandardFamily = "Aerospace" | "ASTM" | "European" | "OEM";
type StandardFamilyFilter = StandardFamily | "All";
type ThemeKey =
  | "red"
  | "rose"
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "amber"
  | "indigo"
  | "cyan"
  | "teal"
  | "pink"
  | "slate";
type IconKey = "shield" | "factory" | "globe" | "flask" | "wrench" | "file" | "dot" | "zap" | "layers" | "book";

interface StandardOption {
  value: StandardType;
  label: string;
  description: string;
  stringency: string;
  badge: string;
  icon: LucideIcon;
  iconBg: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  features: string[];
}

const ICONS: Record<IconKey, LucideIcon> = {
  shield: ShieldCheck,
  factory: Factory,
  globe: Globe,
  flask: FlaskConical,
  wrench: Wrench,
  file: FileText,
  dot: CircleDot,
  zap: Zap,
  layers: Layers,
  book: BookOpen,
};

const THEMES: Record<ThemeKey, Omit<StandardOption, "value" | "label" | "description" | "stringency" | "badge" | "icon" | "features">> = {
  red: { iconBg: "bg-red-600", borderColor: "border-red-300", badgeBg: "#fef2f2", badgeText: "#dc2626", badgeBorder: "#fca5a5" },
  rose: { iconBg: "bg-rose-600", borderColor: "border-rose-300", badgeBg: "#fff1f2", badgeText: "#e11d48", badgeBorder: "#fda4af" },
  blue: { iconBg: "bg-blue-600", borderColor: "border-blue-300", badgeBg: "#eff6ff", badgeText: "#2563eb", badgeBorder: "#93c5fd" },
  green: { iconBg: "bg-green-600", borderColor: "border-green-300", badgeBg: "#f0fdf4", badgeText: "#16a34a", badgeBorder: "#86efac" },
  purple: { iconBg: "bg-purple-600", borderColor: "border-purple-300", badgeBg: "#faf5ff", badgeText: "#9333ea", badgeBorder: "#d8b4fe" },
  orange: { iconBg: "bg-orange-600", borderColor: "border-orange-300", badgeBg: "#fff7ed", badgeText: "#ea580c", badgeBorder: "#fdba74" },
  amber: { iconBg: "bg-amber-600", borderColor: "border-amber-300", badgeBg: "#fffbeb", badgeText: "#d97706", badgeBorder: "#fcd34d" },
  indigo: { iconBg: "bg-indigo-600", borderColor: "border-indigo-300", badgeBg: "#eef2ff", badgeText: "#4f46e5", badgeBorder: "#a5b4fc" },
  cyan: { iconBg: "bg-cyan-600", borderColor: "border-cyan-300", badgeBg: "#ecfeff", badgeText: "#0891b2", badgeBorder: "#67e8f9" },
  teal: { iconBg: "bg-teal-600", borderColor: "border-teal-300", badgeBg: "#f0fdfa", badgeText: "#0d9488", badgeBorder: "#5eead4" },
  pink: { iconBg: "bg-pink-600", borderColor: "border-pink-300", badgeBg: "#fdf2f8", badgeText: "#db2777", badgeBorder: "#f9a8d4" },
  slate: { iconBg: "bg-slate-600", borderColor: "border-slate-300", badgeBg: "#f8fafc", badgeText: "#475569", badgeBorder: "#cbd5e1" },
};

const STANDARD_DEFS: ReadonlyArray<
  readonly [StandardType, string, string, string, string, IconKey, ThemeKey, readonly string[]]
> = [
  ["AMS-STD-2154E", "AMS-STD-2154E (Revision E)", "Ultrasonic Inspection of Wrought Metals - Aerospace", "Most Stringent", "Aerospace", "shield", "red", ["5 classes (AAA-C)", "#1 FBH (0.4mm)", "30% overlap", "90% linearity"]],
  ["MIL-STD-2154", "MIL-STD-2154", "Legacy military alias to the AMS-STD-2154E inspection model", "Legacy Aerospace", "Military", "shield", "rose", ["AMS-equivalent logic", "5 classes (AAA-C)", "Aerospace legacy", "Wrought metals"]],
  ["ASTM-A388", "ASTM A388/A388M", "Ultrasonic Examination of Heavy Steel Forgings", "Standard", "Industrial", "factory", "blue", ["4 quality levels", "DGS method", "10-15% overlap", "Heavy forgings"]],
  ["BS-EN-10228-3", "BS EN 10228-3:2016", "Ultrasonic Testing of Ferritic/Martensitic Steel Forgings", "European", "EU Ferritic", "globe", "green", ["4 quality classes", "DAC curve", "1-6 MHz", "Ferritic steel"]],
  ["BS-EN-10228-4", "BS EN 10228-4:2016", "Ultrasonic Testing of Austenitic-Ferritic Stainless Steel Forgings", "Specialized", "EU Austenitic", "flask", "purple", ["Coarse grain", "0.5-6 MHz", "20% overlap", "Austenitic steel"]],
  ["NDIP-1226", "NDIP-1226 Rev F", "V2500 1st Stage HPT Disk - Immersion UT Inspection", "OEM Specific", "PW Aerospace", "wrench", "orange", ["5 MHz immersion", "#1 FBH (1/64\")", "±45° shear wave", "100% coverage"]],
  ["NDIP-1227", "NDIP-1227 Rev D", "V2500 2nd Stage HPT Disk - Immersion UT Inspection", "OEM Specific", "PW Aerospace", "wrench", "orange", ["5 MHz immersion", "#1 FBH (1/64\")", "±45° shear wave", "100% coverage"]],
  ["NDIP-1254", "NDIP-1254", "PW1100G HPT 1st Stage Hub - Angled Ultrasonic Inspection (AUSI)", "OEM Specific", "PW GTF", "wrench", "orange", ["AUSI immersion", "Powder metal inspection", "FAA AD 2023-16-07", "PW1100G-JM / PW1400G-JM"]],
  ["NDIP-1257", "NDIP-1257", "PW1100G HPT 2nd Stage Hub - Angled Ultrasonic Inspection (AUSI)", "OEM Specific", "PW GTF", "wrench", "orange", ["AUSI immersion", "Powder metal inspection", "FAA AD 2023-16-07", "PW1100G-JM / PW1400G-JM"]],
  ["NDIP-1260", "NDIP-1260", "PW1100G HPC 8th Stage Disc (IBR-8) - Angled Ultrasonic Inspection", "OEM Specific", "PW GTF", "wrench", "orange", ["AUSI immersion", "IBR disc inspection", "Powder metal screening", "PW1100G-JM"]],
  ["PWA-SIM", "PWA SIM (Sonic Inspection Method)", "Pratt & Whitney Sonic Inspection of Bar, Billet & Forging Stock", "OEM Specific", "PW Material", "wrench", "amber", ["5 MHz immersion", "FBH + EDM notch", "Bar/Billet/Rod", "PWA 127 compliant"]],
  ["ASTM-E2375", "ASTM E2375-22", "Ultrasonic Testing of Wrought Products (Adopted from MIL-STD-2154)", "Most Stringent", "General UT", "file", "indigo", ["5 classes (AAA-C)", "MIL-STD-2154 based", "30% overlap", "All wrought metals"]],
  ["ASTM-E1001", "ASTM E1001-21", "Immersed Pulse-Echo Ultrasonic Testing Using Longitudinal Waves", "Practice", "Immersion UT", "file", "cyan", ["Immersion pulse-echo", "2.25-15 MHz", "Contract acceptance", "DAC/alarm guidance"]],
  ["ASTM-E2580", "ASTM E2580-24", "Ultrasonic Testing of Flat Panel Composites and Sandwich Core Materials", "Composite", "Aerospace Composite", "layers", "teal", ["Pulse-echo / through-transmission", "0.5-20 MHz", "SNR 3:1", "25% overlap"]],
  ["ASTM-E588", "ASTM E588-03(2020)", "Detection of Large Inclusions in Bearing Quality Steel by Ultrasonic Method", "Cleanliness", "Bearing Steel", "dot", "slate", ["10 MHz focused immersion", "1/64\" FBH equivalent", "Cleanliness rating", "0.050\" index"]],
  ["ASTM-E127", "ASTM E127-20", "Fabrication of FBH Ultrasonic Reference Blocks", "Calibration", "Calibration", "dot", "cyan", ["FBH 1/64\"-8/64\"", "5 MHz immersion", "Block fabrication", "Reference standard"]],
  ["ASTM-E164", "ASTM E164-19", "Contact Ultrasonic Testing of Weldments", "Standard", "Welding", "zap", "amber", ["Weld inspection", "45°/60°/70° angles", "0.25\"-8\" thick", "Ferrous/Aluminum"]],
  ["AMS-2630", "AMS 2630E", "Ultrasonic Inspection of Products Over 0.5\" Thick", "Aerospace", "Thick Parts", "layers", "rose", ["Classes AA/A1/A/B/C", ">0.5\" thickness", "70% EBW index", "Contact/immersion"]],
  ["AMS-2631", "AMS 2631G", "Ultrasonic Inspection of Titanium Bar, Billet and Plate", "Aerospace Ti", "Titanium", "shield", "teal", ["Classes AA/A/A1/B", "Ti-6Al-4V blocks", "≤250 µin surface", "Grain flow aware"]],
  ["AMS-2632", "AMS 2632C", "Ultrasonic Inspection of Thin Materials (≤0.5\" / 12.7mm)", "Aerospace Thin", "Thin Parts", "layers", "pink", ["Classes AA/A/B/C", "≤0.5\" thickness", "High frequency", "Near-surface critical"]],
  ["EN-ISO-16810", "EN ISO 16810:2024", "Non-destructive Testing - Ultrasonic Testing - General Principles", "Framework", "EU/ISO", "book", "slate", ["General principles", "EN 12668 equipment", "Framework standard", "Ref. other standards"]],
];

const standards: StandardOption[] = STANDARD_DEFS.map(
  ([value, label, description, stringency, badge, iconKey, themeKey, features]) => ({
    value,
    label,
    description,
    stringency,
    badge,
    icon: ICONS[iconKey],
    ...THEMES[themeKey],
    features: [...features],
  })
);

const hiddenLegacyOemStandardSet = new Set<StandardType>(HIDDEN_LEGACY_OEM_STANDARD_CODES);
const visibleStandards = standards.filter((standard) => !hiddenLegacyOemStandardSet.has(standard.value));

const FAMILY_ORDER: StandardFamily[] = ["Aerospace", "ASTM", "European", "OEM"];
const FAMILY_FILTER_ORDER: StandardFamilyFilter[] = ["All", ...FAMILY_ORDER];
const FAMILY_LABELS: Record<StandardFamily, string> = {
  Aerospace: "Aerospace Core",
  ASTM: "ASTM Library",
  European: "European / ISO",
  OEM: "OEM Procedures",
};

const CHANGE_IMPACTS = [
  "Acceptance class and rejection logic",
  "Calibration blocks, FBH/SDH sizing, and DAC/TCG assumptions",
  "Recommended scan parameters, overlap, and frequency range",
  "Documentation rules, OEM constraints, and report wording",
];

const getStandardFamily = (standardCode: StandardType): StandardFamily => {
  if (standardCode.startsWith("NDIP") || standardCode.startsWith("PWA")) return "OEM";
  if (standardCode.startsWith("ASTM")) return "ASTM";
  if (standardCode.startsWith("BS-EN") || standardCode.startsWith("EN-ISO")) return "European";
  return "Aerospace";
};

const StandardCard = ({
  standard,
  current,
  locked,
  onClick,
  interactive = true,
}: {
  standard: StandardOption;
  current?: boolean;
  locked?: boolean;
  onClick?: () => void;
  interactive?: boolean;
}) => {
  const Comp = interactive ? "button" : "div";

  return (
    <Comp
      {...(interactive ? { type: "button", onClick } : {})}
      className={cn(
        "group relative w-full min-w-0 overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all",
        current ? cn("border-2 shadow-sm ring-2 ring-primary/15", standard.borderColor) : "border-border",
        interactive && !current && "hover:border-border/90 hover:bg-muted/30",
        locked && "opacity-60"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", standard.iconBg, interactive && !current && "opacity-70 group-hover:opacity-100")} />
      <div className="flex flex-col items-start gap-3 min-[360px]:flex-row min-[360px]:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-xl p-2 shadow-sm", standard.iconBg)}>
              <standard.icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{standard.value}</span>
                {current && <Check className="h-4 w-4 shrink-0 text-green-600" />}
                {locked && <Lock className="h-4 w-4 shrink-0 text-amber-500" />}
              </div>
              <p className="truncate text-xs text-muted-foreground">{standard.label}</p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="max-w-full shrink-0 whitespace-normal font-medium"
          style={{ backgroundColor: standard.badgeBg, color: standard.badgeText, borderColor: standard.badgeBorder }}
        >
          {standard.badge}
        </Badge>
      </div>
      <p className="mt-3 break-words text-sm leading-relaxed text-foreground/80">{standard.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {standard.features.slice(0, 3).map((feature) => (
          <span key={feature} className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {feature}
          </span>
        ))}
      </div>
    </Comp>
  );
};

export const StandardSelector = ({
  value,
  onChange,
  showComparisonIndicator = false,
  variant = "default",
}: StandardSelectorProps) => {
  const { canUseStandard, license, isElectron } = useLicense();
  const isCompact = variant === "compact";
  const currentStandard =
    standards.find((standard) => standard.value === value) ??
    visibleStandards[0] ??
    standards[0];
  const [searchTerm, setSearchTerm] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeFamily, setActiveFamily] = useState<StandardFamilyFilter>("All");

  useEffect(() => {
    if (!isLibraryOpen) {
      setSearchTerm("");
      setActiveFamily("All");
    }
  }, [isLibraryOpen]);

  const oemRules = useMemo(() => (!value || !isOEMStandard(value) ? null : getOEMRulesFromStandard(value)), [value]);

  const isStandardPurchased = (standardCode: StandardType) => !isElectron || canUseStandard(standardCode);

  const filteredStandards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return visibleStandards.filter((standard) => {
      const family = getStandardFamily(standard.value);
      if (activeFamily !== "All" && family !== activeFamily) return false;
      if (!term) return true;
      const familyLabel = FAMILY_LABELS[family].toLowerCase();
      return (
        standard.value.toLowerCase().includes(term) ||
        standard.label.toLowerCase().includes(term) ||
        standard.description.toLowerCase().includes(term) ||
        standard.badge.toLowerCase().includes(term) ||
        familyLabel.includes(term) ||
        standard.features.some((feature) => feature.toLowerCase().includes(term))
      );
    });
  }, [activeFamily, searchTerm]);

  const familyCounts = useMemo(
    () =>
      FAMILY_ORDER.reduce(
        (accumulator, family) => ({
          ...accumulator,
          [family]: visibleStandards.filter((standard) => getStandardFamily(standard.value) === family).length,
        }),
        {} as Record<StandardFamily, number>
      ),
    []
  );

  const groupedStandards = useMemo(
    () =>
      FAMILY_ORDER.map((family) => ({
        family,
        label: FAMILY_LABELS[family],
        items: filteredStandards.filter((standard) => getStandardFamily(standard.value) === family),
      })).filter((section) => section.items.length > 0),
    [filteredStandards]
  );

  const handleStandardChange = (newStandard: StandardType) => {
    if (!isStandardPurchased(newStandard)) {
      toast.error("Standard Locked", {
        description: `${newStandard} is not included in your license. Contact Scan Master to purchase it.`,
        action: {
          label: "Contact Sales",
          onClick: () => {
            if (window.electron) {
              window.open(`mailto:sales@scanmaster.com?subject=Purchase Standard: ${newStandard}`);
            }
          },
        },
      });
      return;
    }

    onChange(newStandard);
    setIsLibraryOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="w-full min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-1 text-xs font-medium text-foreground">
            Standard
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="mb-1 font-semibold">Standard Selection Impact</p>
                <p className="text-xs">Changing standards updates calibration, acceptance logic, scan rules, and documentation.</p>
              </TooltipContent>
            </Tooltip>
          </label>
          <Badge
            variant="outline"
            className="max-w-full shrink-0 whitespace-normal text-right font-medium"
            style={{ backgroundColor: currentStandard.badgeBg, color: currentStandard.badgeText, borderColor: currentStandard.badgeBorder }}
          >
            {currentStandard.stringency}
          </Badge>
        </div>

        <div className="space-y-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className={cn("h-1.5 w-full", currentStandard.iconBg)} />
          <div className="min-w-0 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Active Standard</span>
              {!isStandardPurchased(value) && isElectron && (
                <Badge variant="outline" className="border-amber-400/60 bg-amber-50 text-amber-700">
                  Locked
                </Badge>
              )}
            </div>
            {isCompact ? (
              <>
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-xl p-2 shadow-sm", currentStandard.iconBg)}>
                      <currentStandard.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 text-sm font-semibold text-foreground break-words">
                          {currentStandard.value}
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-green-600" />
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">{currentStandard.label}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      {FAMILY_LABELS[getStandardFamily(currentStandard.value)]}
                    </Badge>
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      {currentStandard.stringency}
                    </Badge>
                  </div>
                </div>
                <Button type="button" size="sm" onClick={() => setIsLibraryOpen(true)} className="w-full">
                  Change Standard
                </Button>
              </>
            ) : (
              <>
                <StandardCard standard={currentStandard} current interactive={false} />
                <div className="mt-4 grid grid-cols-1 gap-2 text-xs min-[340px]:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Family</div>
                    <div className="mt-1 break-words font-medium text-foreground">{FAMILY_LABELS[getStandardFamily(currentStandard.value)]}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Profile</div>
                    <div className="mt-1 break-words font-medium text-foreground">{currentStandard.stringency}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                  <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    <span className="break-words">Only open the full library when project requirements change.</span>
                  </div>
                  <Button type="button" size="sm" onClick={() => setIsLibraryOpen(true)} className="w-full shrink-0 min-[360px]:w-auto">
                    Change Standard
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
          <DialogContent className="max-h-[85vh] max-w-[1100px] gap-0 overflow-y-auto p-0 md:overflow-hidden">
            <div className="grid md:h-[85vh] md:max-h-[85vh] md:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-border bg-muted/30 p-5 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl">Standard Library</DialogTitle>
                  <DialogDescription>
                    Keep the workspace focused on the active rule set, and open the full catalog only when you need to switch standards.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Current Selection</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className={cn("rounded-xl p-2 shadow-sm", currentStandard.iconBg)}>
                      <currentStandard.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{currentStandard.value}</div>
                      <div className="truncate text-xs text-muted-foreground">{currentStandard.label}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/80">{currentStandard.description}</p>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Browse By Family</p>
                  <div className="grid gap-2">
                    {FAMILY_FILTER_ORDER.map((family) => {
                      const isActive = activeFamily === family;
                      const count = family === "All" ? visibleStandards.length : familyCounts[family];
                      return (
                        <button
                          key={family}
                          type="button"
                          onClick={() => setActiveFamily(family)}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                            isActive ? "border-primary bg-primary/8 text-foreground shadow-sm" : "border-border bg-background hover:bg-muted/40"
                          )}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {family === "All" ? "All Standards" : FAMILY_LABELS[family]}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">What Changes</p>
                  {CHANGE_IMPACTS.map((impact) => (
                    <div key={impact} className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground/80">
                      {impact}
                    </div>
                  ))}
                  {isElectron && (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                      Locked standards stay visible in the library, but require a purchased license before they can be activated.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="border-b border-border bg-background px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">Change Standard</p>
                  <p className="text-xs text-muted-foreground">
                    {filteredStandards.length} {filteredStandards.length === 1 ? "match" : "matches"}
                    {activeFamily === "All" ? " across the standard catalog" : ` in ${FAMILY_LABELS[activeFamily]}`}
                  </p>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by code, family, use case, or feature..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto px-5 py-4">
                  {groupedStandards.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                      <p className="text-sm font-medium text-foreground">No standards matched your search.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try another code, family name, or inspection keyword.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedStandards.map((section, sectionIndex) => (
                        <div key={section.family} className="space-y-3">
                          {sectionIndex > 0 && <Separator />}
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                            <p className="text-xs text-muted-foreground">
                              {section.items.length} {section.items.length === 1 ? "standard" : "standards"}
                            </p>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            {section.items.map((standard) => (
                              <StandardCard
                                key={standard.value}
                                standard={standard}
                                current={standard.value === value}
                                locked={!isStandardPurchased(standard.value)}
                                onClick={() => handleStandardChange(standard.value)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!isStandardPurchased(value) && isElectron && (
          <div className="flex w-full flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-xs font-medium text-amber-900">Standard Not Purchased</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-700">
                This standard is not included in your license. Contact Scan Master to add it to your account.
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <DollarSign className="h-3 w-3" />
                <span className="font-medium">Starting from $500</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (window.electron) {
                  window.open(`mailto:sales@scanmaster.com?subject=Add Standard to License&body=Factory ID: ${license?.factoryId}%0A%0AStandard to add: ${value}`);
                }
              }}
              className="w-full bg-amber-600 text-xs hover:bg-amber-700"
              data-testid="button-purchase-standard"
            >
              Contact Sales to Purchase
            </Button>
          </div>
        )}

        {showComparisonIndicator && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span className="break-words text-[10px] text-amber-700 sm:text-xs">
              Values highlighted in yellow have changed due to standard requirements
            </span>
          </div>
        )}

        {oemRules && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Factory className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-foreground">{oemRules.vendorName} Requirements</span>
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-600">
                {oemRules.specReference}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Coverage",
                  icon: Target,
                  tone: "blue",
                  value: `${oemRules.coverageRequirements.minCoverage}%`,
                  note: `Overlap: ${oemRules.coverageRequirements.overlapRequirement}%`,
                },
                {
                  label: "Calibration",
                  icon: Clock,
                  tone: "green",
                  value: `Every ${oemRules.calibrationRules.interval}h`,
                  note: oemRules.calibrationRules.dacCurveRequired ? "DAC Required" : "DAC Optional",
                },
                {
                  label: "Frequency",
                  icon: Gauge,
                  tone: "purple",
                  value: `${oemRules.frequencyConstraints.min}-${oemRules.frequencyConstraints.max} MHz`,
                  note: `Preferred: ${oemRules.frequencyConstraints.preferred.join(", ")} MHz`,
                },
                {
                  label: "Transfer",
                  icon: Zap,
                  tone: "amber",
                  value: `Max ${oemRules.calibrationRules.transferCorrectionMax} dB`,
                  note: oemRules.calibrationRules.tcgRequired ? "TCG Required" : "TCG Optional",
                },
              ].map((item) => (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <div className={`cursor-help rounded-lg border p-2 ${item.tone === "blue" ? "border-blue-500/30 bg-blue-500/10" : item.tone === "green" ? "border-green-500/30 bg-green-500/10" : item.tone === "purple" ? "border-purple-500/30 bg-purple-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                      <div className="mb-1 flex items-center gap-1">
                        <item.icon className={`h-3 w-3 ${item.tone === "blue" ? "text-blue-500" : item.tone === "green" ? "text-green-500" : item.tone === "purple" ? "text-purple-500" : "text-amber-500"}`} />
                        <span className={`text-[10px] font-medium ${item.tone === "blue" ? "text-blue-600" : item.tone === "green" ? "text-green-600" : item.tone === "purple" ? "text-purple-600" : "text-amber-600"}`}>{item.label}</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">{item.value}</div>
                      <div className="text-[9px] text-muted-foreground">{item.note}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{item.label} requirement per {oemRules.vendorName}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {!isCompact && oemRules.warnings?.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                <div className="mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] font-medium text-red-600">Warnings</span>
                </div>
                <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                  {oemRules.warnings.slice(0, 3).map((warning, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-red-500">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isCompact && oemRules.notes?.length > 0 && (
              <div className="rounded-lg border border-slate-500/30 bg-slate-500/10 p-2">
                <div className="mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3 text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-600">Notes</span>
                </div>
                <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                  {oemRules.notes.slice(0, 3).map((note, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-slate-500">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

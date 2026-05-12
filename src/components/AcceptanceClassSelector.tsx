/**
 * Acceptance Class Selector Component
 *
 * A visually prominent selector for choosing acceptance class/quality level
 * that dynamically adapts to the selected standard.
 */

import { useState, useEffect, useMemo } from "react";
import { StandardType, AcceptanceClass } from "@/types/techniqueSheet";
import { acceptanceClassesByStandard, AcceptanceClassOption } from "@/data/standardsDifferences";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Star,
  Sparkles,
  Info,
  ChevronDown,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AcceptanceClassSelectorProps {
  value: AcceptanceClass | string;
  onChange: (value: AcceptanceClass | string) => void;
  standard: StandardType;
  disabled?: boolean;
  variant?: "default" | "compact";
}

// Color schemes for each stringency level
const stringencyColors = {
  highest: {
    bg: "bg-gradient-to-br from-red-500 to-rose-600",
    border: "border-red-400",
    ring: "ring-red-500/30",
    text: "text-red-50",
    badge: "bg-red-100 text-red-700 border-red-300",
    icon: ShieldAlert,
    glow: "shadow-red-500/40",
    hoverBg: "hover:from-red-600 hover:to-rose-700",
  },
  high: {
    bg: "bg-gradient-to-br from-orange-500 to-amber-600",
    border: "border-orange-400",
    ring: "ring-orange-500/30",
    text: "text-orange-50",
    badge: "bg-orange-100 text-orange-700 border-orange-300",
    icon: ShieldCheck,
    glow: "shadow-orange-500/40",
    hoverBg: "hover:from-orange-600 hover:to-amber-700",
  },
  medium: {
    bg: "bg-gradient-to-br from-yellow-500 to-amber-500",
    border: "border-yellow-400",
    ring: "ring-yellow-500/30",
    text: "text-yellow-50",
    badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
    icon: Shield,
    glow: "shadow-yellow-500/40",
    hoverBg: "hover:from-yellow-600 hover:to-amber-600",
  },
  low: {
    bg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    border: "border-blue-400",
    ring: "ring-blue-500/30",
    text: "text-blue-50",
    badge: "bg-blue-100 text-blue-700 border-blue-300",
    icon: Shield,
    glow: "shadow-blue-500/40",
    hoverBg: "hover:from-blue-600 hover:to-indigo-700",
  },
  basic: {
    bg: "bg-gradient-to-br from-emerald-500 to-green-600",
    border: "border-emerald-400",
    ring: "ring-emerald-500/30",
    text: "text-emerald-50",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: Shield,
    glow: "shadow-emerald-500/40",
    hoverBg: "hover:from-emerald-600 hover:to-green-700",
  },
};

// Stringency labels
const stringencyLabels = {
  highest: "Most Stringent",
  high: "Very Stringent",
  medium: "Standard",
  low: "Basic",
  basic: "Least Stringent",
};

export const AcceptanceClassSelector = ({
  value,
  onChange,
  standard,
  disabled = false,
  variant = "default",
}: AcceptanceClassSelectorProps) => {
  const isCompact = variant === "compact";
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);

  // Get available classes for the current standard (memoized to prevent useEffect re-runs)
  const availableClasses = useMemo(
    () => acceptanceClassesByStandard[standard] || [],
    [standard]
  );

  // Find the currently selected class option
  const selectedOption = useMemo(
    () => availableClasses.find(c => c.id === value),
    [availableClasses, value]
  );
  const selectedColors = selectedOption
    ? stringencyColors[selectedOption.stringency]
    : stringencyColors.medium;

  // Reset value when standard changes and current value is invalid
  useEffect(() => {
    if (value && availableClasses.length > 0) {
      const isValidClass = availableClasses.some(c => c.id === value);
      if (!isValidClass) {
        // Reset to first available class for this standard
        onChange(availableClasses[0].id as AcceptanceClass);
      }
    }
  }, [standard, value, availableClasses, onChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.acceptance-class-selector')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (availableClasses.length === 0) {
    return null;
  }

  const SelectedIcon = selectedColors.icon;

  return (
    <TooltipProvider>
      <div className="acceptance-class-selector space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Acceptance Class
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Acceptance Class Selection</p>
                <p className="text-xs">Changing acceptance class will automatically adjust:</p>
                <ul className="text-xs mt-1 space-y-0.5">
                  <li>• Single discontinuity limits</li>
                  <li>• Multiple discontinuity criteria</li>
                  <li>• Linear discontinuity limits</li>
                  <li>• Back reflection loss</li>
                  <li>• Noise level requirements</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </label>

          {selectedOption && (
            <Badge
              variant="outline"
              className={cn("max-w-full shrink-0 whitespace-normal font-medium text-[10px]", selectedColors.badge)}
            >
              {stringencyLabels[selectedOption.stringency]}
            </Badge>
          )}
        </div>

        {/* Main Selector Button */}
        <div className="relative">
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              "w-full rounded-xl border-2 transition-all duration-300",
              isCompact ? "p-2.5" : "p-3",
              "flex items-center justify-between gap-3",
              "shadow-lg",
              selectedColors.bg,
              selectedColors.border,
              selectedColors.glow,
              selectedColors.hoverBg,
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isOpen && "ring-2 ring-offset-2 ring-offset-background",
              isOpen && selectedColors.ring
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("bg-white/20 rounded-lg backdrop-blur-sm", isCompact ? "p-1.5" : "p-2")}>
                <SelectedIcon className={cn(isCompact ? "h-4 w-4" : "h-5 w-5", selectedColors.text)} />
              </div>
              <div className="min-w-0 text-left">
                <div className={cn(isCompact ? "text-sm" : "text-base", "font-bold truncate", selectedColors.text)}>
                  {selectedOption?.label || "Select Class"}
                </div>
                <div className={cn("text-xs opacity-80 truncate", selectedColors.text)}>
                  {selectedOption?.description.split(' - ')[0] || "No class selected"}
                </div>
              </div>
            </div>
            <ChevronDown className={cn(
              isCompact ? "h-4 w-4" : "h-5 w-5",
              "shrink-0 transition-transform duration-200",
              selectedColors.text,
              isOpen && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className={cn(
              "absolute z-50 w-full mt-2 py-2 rounded-xl",
              "bg-slate-900 border-2 border-slate-700",
              "shadow-2xl shadow-black/40",
              "animate-in fade-in-0 zoom-in-95 duration-200"
            )}>
              {availableClasses.map((classOption) => {
                const colors = stringencyColors[classOption.stringency];
                const Icon = colors.icon;
                const isSelected = classOption.id === value;
                const isHovered = hoveredClass === classOption.id;

                return (
                  <Tooltip key={classOption.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          onChange(classOption.id as AcceptanceClass);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setHoveredClass(classOption.id)}
                        onMouseLeave={() => setHoveredClass(null)}
                        className={cn(
                          "w-full px-3 py-2.5 flex items-center gap-3",
                          "transition-all duration-200",
                          isSelected && "bg-slate-800",
                          isHovered && !isSelected && "bg-slate-800/50"
                        )}
                      >
                        {/* Stringency Indicator */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          "transition-transform duration-200",
                          colors.bg,
                          isHovered && "scale-110"
                        )}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>

                        {/* Class Info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">
                              {classOption.label}
                            </span>
                            {/* Stars indicator */}
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-3 w-3 transition-colors",
                                    i < getStarsForStringency(classOption.stringency)
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-slate-600"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {classOption.description.split(' - ')[0]}
                          </p>
                        </div>

                        {/* Selected Check */}
                        {isSelected && (
                          <div className="p-1 bg-emerald-500 rounded-full shrink-0">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-semibold">{classOption.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{classOption.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Selection Display Card */}
        {!isCompact && selectedOption && (
          <div className={cn(
            "p-3 rounded-xl border-2 transition-all duration-300",
            "bg-gradient-to-br from-slate-800 to-slate-900",
            selectedColors.border,
            "shadow-lg"
          )}>
            {/* Stars Row */}
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-5 w-5 transition-all duration-300",
                    i < getStarsForStringency(selectedOption.stringency)
                      ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]"
                      : "text-slate-600"
                  )}
                />
              ))}
            </div>

            {/* Stringency Label */}
            <div className="text-center mb-2">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                selectedColors.badge
              )}>
                {stringencyLabels[selectedOption.stringency]}
              </span>
            </div>

            {/* Description */}
            <p className="text-center text-xs text-slate-400 leading-relaxed">
              {selectedOption.description}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

// Helper function to convert stringency to number of stars
function getStarsForStringency(stringency: AcceptanceClassOption['stringency']): number {
  switch (stringency) {
    case 'highest': return 5;
    case 'high': return 4;
    case 'medium': return 3;
    case 'low': return 2;
    case 'basic': return 1;
    default: return 3;
  }
}

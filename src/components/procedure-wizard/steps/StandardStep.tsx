/**
 * Standard Selection Step
 */

import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import type { ProcedureWizardData, ProcedureStandardType } from "@/types/procedure";
import { STANDARD_LABELS } from "@/types/procedure";

interface StandardStepProps {
  data: ProcedureWizardData;
  onUpdate: (updates: Partial<ProcedureWizardData>) => void;
}

const STANDARDS: ProcedureStandardType[] = [
  "AMS-STD-2154E",
  "ASTM-A388",
  "ASTM-E2375",
  "ASTM-E1001",
  "ASTM-E2580",
  "ASTM-E588",
  "AMS-2630",
  "BS-EN-10228-3",
  "BS-EN-10228-4",
  "MIL-STD-2154",
  "CUSTOM",
];

const ADDITIONAL_STANDARDS = [
  "ASTM E127 - FBH Reference Blocks",
  "ASTM E1001 - Immersion Pulse-Echo UT",
  "ASTM E2580 - Composite Panel UT",
  "ASTM E588 - Bearing Steel Cleanliness",
  "ASTM E2581 - Composite Shearography",
  "AMS 2375 - Forging First Article Approval",
  "ASTM E317 - Equipment Characterization",
  "ASTM E1065 - Transducer Verification",
  "EN 12668-1 - Instrument Characterization",
  "EN 12668-2 - Transducer Characterization",
  "NAS 410 - Personnel Certification",
  "SNT-TC-1A - Personnel Certification",
];

export function StandardStep({ data, onUpdate }: StandardStepProps) {
  const handleStandardChange = (value: string) => {
    onUpdate({ primaryStandard: value as ProcedureStandardType });
  };

  const handleAdditionalStandardToggle = (standard: string) => {
    const current = data.additionalStandards || [];
    const updated = current.includes(standard)
      ? current.filter((s) => s !== standard)
      : [...current, standard];
    onUpdate({ additionalStandards: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Primary Standard</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select the primary standard your procedure will comply with
        </p>

        <RadioGroup
          value={data.primaryStandard || ""}
          onValueChange={handleStandardChange}
          className="grid gap-3"
        >
          {STANDARDS.map((standard) => (
            <Card
              key={standard}
              className={`cursor-pointer transition-colors ${
                data.primaryStandard === standard
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleStandardChange(standard)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <RadioGroupItem value={standard} id={standard} />
                <Label htmlFor={standard} className="flex-1 cursor-pointer">
                  <span className="font-medium">{STANDARD_LABELS[standard]}</span>
                </Label>
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Additional Standards</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select any additional standards to reference in the procedure
        </p>

        <div className="grid gap-2">
          {ADDITIONAL_STANDARDS.map((standard) => (
            <div key={standard} className="flex items-center gap-2">
              <Checkbox
                id={standard}
                checked={(data.additionalStandards || []).includes(standard)}
                onCheckedChange={() => handleAdditionalStandardToggle(standard)}
              />
              <Label htmlFor={standard} className="text-sm cursor-pointer">
                {standard}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { describe, expect, it } from "vitest";
import {
  getV2500PassCount,
  getV2500ScanPlanForStandard,
  PW_V2500_SIGNAL_RULES,
} from "@/rules/pw/pwScanPlans";

describe("pwScanPlans", () => {
  it("selects the V2500 Stage 1 scan plan for NDIP-1226", () => {
    const plan = getV2500ScanPlanForStandard("NDIP-1226");

    expect(plan?.partNumber).toBe("2A5001");
    expect(plan?.scanZones.map((zone) => zone.id)).toEqual(["E", "A", "B", "C", "D"]);
    expect(plan ? getV2500PassCount(plan) : 0).toBe(10);
  });

  it("selects the V2500 Stage 2 scan plan for NDIP-1227", () => {
    const plan = getV2500ScanPlanForStandard("NDIP-1227");

    expect(plan?.partNumber).toBe("2A4802");
    expect(plan?.scanZones.map((zone) => zone.id)).toEqual(["M", "N", "O", "P", "K", "L"]);
    expect(plan ? getV2500PassCount(plan) : 0).toBe(12);
  });

  it("keeps the tutorial FSH values in one shared rule set", () => {
    expect(PW_V2500_SIGNAL_RULES.calibrationTargetFsh).toBe(80);
    expect(PW_V2500_SIGNAL_RULES.recordableIndicationFsh).toBe(20);
    expect(PW_V2500_SIGNAL_RULES.referenceReflector).toContain("#1 FBH");
  });
});

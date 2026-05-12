import { describe, expect, it } from "vitest";

import { getTubeAngleBeamDrawing } from "@/utils/tubeAngleBeamDrawings";

describe("tube angle beam drawing selection", () => {
  it("returns an exact scanned sheet when the matched block image exists", () => {
    const selection = getTubeAngleBeamDrawing(250, 80);

    expect(selection?.requested.blockId).toBe("D2-T1");
    expect(selection?.displayed.blockId).toBe("D2-T1");
    expect(selection?.exactImageAvailable).toBe(true);
    expect(selection?.imageSrc).toBe("/standards/tube-angle-beam/d2-t1.jpg");
  });

  it("matches table ranges by diameter and wall thickness", () => {
    const selection = getTubeAngleBeamDrawing(380, 130);

    expect(selection?.requested.blockId).toBe("D4-T2");
    expect(selection?.diameterInRange).toBe(true);
    expect(selection?.thicknessInRange).toBe(true);
  });

  it("falls back to the closest available scanned sheet when the exact sheet is missing", () => {
    const selection = getTubeAngleBeamDrawing(310, 130);

    expect(selection?.requested.blockId).toBe("D3-T2");
    expect(selection?.displayed.blockId).toBe("D4-T2");
    expect(selection?.exactImageAvailable).toBe(false);
  });

  it("uses the closest representative row when dimensions are outside the PDF table range", () => {
    const selection = getTubeAngleBeamDrawing(900, 200);

    expect(selection?.requested.blockId).toBe("D8-T2");
    expect(selection?.diameterInRange).toBe(false);
    expect(selection?.thicknessInRange).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { getRtPtControlledReleaseReadiness } from "@/components/rtpt/RtPtValidationDialog";

describe("RT/PT validation dialog controlled-release readiness", () => {
  it("requires Approved status even when validation and approval checks are complete", () => {
    const draft = getRtPtControlledReleaseReadiness("draft", 0, true);
    const inReview = getRtPtControlledReleaseReadiness("in-review", 0, true);

    expect(draft).toMatchObject({
      isReady: false,
      heading: "Draft — controlled release unavailable",
    });
    expect(draft.description).toContain("requires the document status to be Approved");
    expect(inReview).toMatchObject({
      isReady: false,
      heading: "In review — awaiting approval",
    });
    expect(inReview.description).toContain("until the document status is Approved");
  });

  it("marks only an Approved document with zero blocking issues and completed approval checks ready", () => {
    expect(getRtPtControlledReleaseReadiness("approved", 0, true)).toEqual({
      isReady: true,
      heading: "Ready for controlled release",
      description: "The document status is Approved, there are no blocking validation issues, and all approval-readiness checks are complete.",
    });

    expect(getRtPtControlledReleaseReadiness("approved", 1, true)).toMatchObject({
      isReady: false,
      heading: "Approved — release checks incomplete",
    });
    expect(getRtPtControlledReleaseReadiness("approved", 0, false)).toMatchObject({
      isReady: false,
      heading: "Approved — release checks incomplete",
    });
  });

  it("never presents a superseded document as controlled-release-ready", () => {
    const readiness = getRtPtControlledReleaseReadiness("superseded", 0, true);

    expect(readiness.isReady).toBe(false);
    expect(readiness.heading).toBe("Superseded — controlled release unavailable");
    expect(readiness.description).toContain("current document with Approved status");
  });
});

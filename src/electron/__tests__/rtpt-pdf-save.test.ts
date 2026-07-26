import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  decodeRtPtPdfSavePayload,
}: {
  decodeRtPtPdfSavePayload: (
    payload: unknown,
    options?: { maxBytes?: number },
  ) => { buffer: Buffer; filename: string };
} = require("../../../electron/rtpt-pdf-save.cjs");

const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", "ascii");

describe("RT/PT desktop PDF save boundary", () => {
  it("accepts a product-scoped PDF filename and a real PDF payload", () => {
    const result = decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename: "DRAFT-UNCONTROLLED-RTPT-RT-Film-PART-100-REV-A.pdf",
    });

    expect(result.filename).toBe("DRAFT-UNCONTROLLED-RTPT-RT-Film-PART-100-REV-A.pdf");
    expect(result.buffer.equals(validPdf)).toBe(true);
  });

  it("accepts an explicitly superseded uncontrolled RT/PT filename", () => {
    const result = decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename: "SUPERSEDED-UNCONTROLLED-RTPT-RT-Film-PART-100-REV-A.pdf",
    });

    expect(result.filename).toBe("SUPERSEDED-UNCONTROLLED-RTPT-RT-Film-PART-100-REV-A.pdf");
    expect(result.buffer.equals(validPdf)).toBe(true);
  });

  it("accepts the separately scoped RT/PT inspection-report filename", () => {
    const result = decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename: "RTPT-REPORT-DRAFT-UNCONTROLLED-RT-Digital-RPT-100-REV-A.pdf",
    });

    expect(result.filename).toBe("RTPT-REPORT-DRAFT-UNCONTROLLED-RT-Digital-RPT-100-REV-A.pdf");
    expect(result.buffer.equals(validPdf)).toBe(true);
  });

  it.each([
    "../RTPT-escape.pdf",
    "RTPT\\escape.pdf",
    "other-product.pdf",
    "RTPT-document.exe",
  ])("rejects an unsafe or non-product filename: %s", (filename) => {
    expect(() => decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename,
    })).toThrowError("filename is invalid");
  });

  it("rejects malformed base64, non-PDF bytes, and unexpected request fields", () => {
    expect(() => decodeRtPtPdfSavePayload({
      data: "not base64!",
      filename: "RTPT-RT-Film-PART-100.pdf",
    })).toThrowError("not valid base64");

    expect(() => decodeRtPtPdfSavePayload({
      data: Buffer.from("not a pdf", "ascii").toString("base64"),
      filename: "RTPT-RT-Film-PART-100.pdf",
    })).toThrowError("does not contain a PDF");

    expect(() => decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename: "RTPT-RT-Film-PART-100.pdf",
      destination: "C:/outside.pdf",
    })).toThrowError("unexpected fields");
  });

  it("enforces the decoded PDF size limit before disk access", () => {
    expect(() => decodeRtPtPdfSavePayload({
      data: validPdf.toString("base64"),
      filename: "RTPT-RT-Film-PART-100.pdf",
    }, { maxBytes: 8 })).toThrowError("exceeds the permitted size");
  });
});

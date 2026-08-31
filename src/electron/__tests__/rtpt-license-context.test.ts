import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createRtPtLicenseHttpBridge,
  isConfirmedRtPtLicenseDeactivation,
  normaliseRtPtLicenseStatus,
  resolveRtPtLicenseMutation,
} from "../../contexts/RtPtLicenseContext";

const INSTALLATION_ID = "123e4567-e89b-42d3-a456-426614174000";

const activeResponse = () => ({
  status: "active",
  active: true,
  product: "rt-pt-inspector",
  appId: "com.amitay.rtptinspector",
  installationId: INSTALLATION_ID,
  reason: null,
  message: "License is active.",
  license: {
    schemaVersion: 1,
    product: "rt-pt-inspector",
    appId: "com.amitay.rtptinspector",
    licenseId: "323e4567-e89b-42d3-a456-426614174001",
    customer: "RT-PT Inspection Lab",
    installationId: INSTALLATION_ID,
    issuedAt: "2026-07-01T00:00:00.000Z",
    expiresAt: null as string | null,
    edition: "professional",
    features: ["rt-film", "rt-digital", "pt"],
  },
});

describe("RT/PT renderer license trust boundary", () => {
  it("accepts a complete active license only when it is bound to the reported installation", () => {
    const status = normaliseRtPtLicenseStatus(activeResponse());

    expect(status).toMatchObject({
      status: "active",
      active: true,
      installationId: INSTALLATION_ID,
      reason: null,
      license: {
        installationId: INSTALLATION_ID,
        edition: "professional",
        features: ["rt-film", "rt-digital", "pt"],
      },
    });
  });

  it("accepts an active site license that is not bound to one installation", () => {
    const response = activeResponse();
    (response.license as Record<string, unknown>).installationId = null;

    expect(normaliseRtPtLicenseStatus(response)).toMatchObject({
      status: "active",
      active: true,
      installationId: INSTALLATION_ID,
      reason: null,
      license: {
        installationId: null,
        edition: "professional",
        features: ["rt-film", "rt-digital", "pt"],
      },
    });
  });

  it.each([
    ["missing license details", (response: ReturnType<typeof activeResponse>) => {
      (response as Record<string, unknown>).license = null;
    }],
    ["mismatched installation", (response: ReturnType<typeof activeResponse>) => {
      response.license.installationId = "423e4567-e89b-42d3-a456-426614174002";
    }],
    ["non-canonical issue time", (response: ReturnType<typeof activeResponse>) => {
      response.license.issuedAt = "2026-07-01";
    }],
    ["incomplete feature grant", (response: ReturnType<typeof activeResponse>) => {
      response.license.features = ["rt-film", "pt"];
    }],
    ["unexpected license field", (response: ReturnType<typeof activeResponse>) => {
      (response.license as Record<string, unknown>).unexpected = true;
    }],
    ["untrimmed installation ID", (response: ReturnType<typeof activeResponse>) => {
      response.installationId = ` ${INSTALLATION_ID}`;
    }],
  ])("fails closed for active status with %s", (_description, mutate) => {
    const response = activeResponse();
    mutate(response);

    expect(normaliseRtPtLicenseStatus(response)).toMatchObject({
      status: "invalid",
      active: false,
      reason: "verification-failed",
      license: null,
    });
  });

  it("fails closed locally when an allegedly active license is already expired", () => {
    const response = activeResponse();
    response.license.expiresAt = "2026-07-02T00:00:00.000Z";

    expect(normaliseRtPtLicenseStatus(response)).toMatchObject({
      status: "expired",
      active: false,
      reason: "license-expired",
      installationId: INSTALLATION_ID,
      license: null,
    });
  });
});

describe("RT/PT renderer license lifecycle wiring", () => {
  const contextSource = fs.readFileSync(
    path.join(process.cwd(), "src/contexts/RtPtLicenseContext.tsx"),
    "utf8",
  );

  it("revalidates active licenses periodically and when the app returns to the foreground", () => {
    expect(contextSource).toContain("const LICENSE_REVALIDATION_INTERVAL_MS = 60_000");
    expect(contextSource).toContain("window.setInterval(");
    expect(contextSource).toContain('window.addEventListener("focus", revalidateActiveLicense)');
    expect(contextSource).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(contextSource).toContain("const backgroundCheck = checkStatus(false)");
  });

  it("limits silent checks to active, idle workspaces and keeps foreground loading separate", () => {
    expect(contextSource).toContain("!statusRef.current.active");
    expect(contextSource).toContain("foregroundCheckOperationRef.current !== null");
    expect(contextSource).toContain("mutationOperationRef.current !== null");
    expect(contextSource).toContain("backgroundCheckRef.current !== null");
    expect(contextSource).toContain("if (mountedRef.current && showLoading)");
  });
});

describe("RT/PT renderer license mutation lifecycle", () => {
  it("keeps an active workspace mounted and reports an invalid early-renewal separately", () => {
    const currentStatus = normaliseRtPtLicenseStatus(activeResponse());
    const renewalFailure = normaliseRtPtLicenseStatus({
      status: "invalid",
      active: false,
      product: "rt-pt-inspector",
      appId: "com.amitay.rtptinspector",
      installationId: INSTALLATION_ID,
      reason: "license-signature-invalid",
      message: "The replacement activation code is not valid.",
      license: null,
    });

    const resolution = resolveRtPtLicenseMutation(
      "activation",
      currentStatus,
      renewalFailure,
    );

    expect(resolution).toMatchObject({
      succeeded: false,
      mutationStatus: renewalFailure,
      error: "The replacement activation code is not valid.",
    });
    expect(resolution.authoritativeStatus).toBe(currentStatus);
    expect(resolution.authoritativeStatus.active).toBe(true);
  });

  it("keeps an active workspace mounted when deactivation cannot update secure storage", () => {
    const currentStatus = normaliseRtPtLicenseStatus(activeResponse());
    const deactivationFailure = normaliseRtPtLicenseStatus({
      status: "storage-unavailable",
      active: false,
      product: "rt-pt-inspector",
      appId: "com.amitay.rtptinspector",
      installationId: INSTALLATION_ID,
      reason: "encryption-unavailable",
      message: "Secure license storage could not be updated.",
      license: null,
    });

    const resolution = resolveRtPtLicenseMutation(
      "deactivation",
      currentStatus,
      deactivationFailure,
    );

    expect(resolution).toMatchObject({
      succeeded: false,
      mutationStatus: deactivationFailure,
      error: "Secure license storage could not be updated.",
    });
    expect(resolution.authoritativeStatus).toBe(currentStatus);
    expect(resolution.authoritativeStatus.active).toBe(true);
  });

  it("accepts only the exact inactive removal confirmation as a successful deactivation", () => {
    const currentStatus = normaliseRtPtLicenseStatus(activeResponse());
    const confirmedDeactivation = normaliseRtPtLicenseStatus({
      status: "missing",
      active: false,
      product: "rt-pt-inspector",
      appId: "com.amitay.rtptinspector",
      installationId: INSTALLATION_ID,
      reason: "license-deactivated",
      message: "No license is activated for this installation.",
      license: null,
    });
    const ambiguousDeactivation = {
      ...confirmedDeactivation,
      message: "No current license was found.",
    };
    const unconfirmedReason = {
      ...confirmedDeactivation,
      reason: "license-not-activated" as const,
    };

    expect(isConfirmedRtPtLicenseDeactivation(
      confirmedDeactivation,
      INSTALLATION_ID,
    )).toBe(true);
    expect(isConfirmedRtPtLicenseDeactivation(
      ambiguousDeactivation,
      INSTALLATION_ID,
    )).toBe(false);
    expect(isConfirmedRtPtLicenseDeactivation(
      unconfirmedReason,
      INSTALLATION_ID,
    )).toBe(false);
    expect(resolveRtPtLicenseMutation(
      "deactivation",
      currentStatus,
      confirmedDeactivation,
    )).toMatchObject({
      authoritativeStatus: confirmedDeactivation,
      succeeded: true,
      error: null,
    });
    expect(resolveRtPtLicenseMutation(
      "deactivation",
      currentStatus,
      ambiguousDeactivation,
    )).toMatchObject({
      authoritativeStatus: currentStatus,
      succeeded: false,
    });
  });
});

describe("RT/PT browser/PWA license bridge", () => {
  it("uses the same-origin API without caching and sends only the activation token", async () => {
    const responsePayload = activeResponse();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const bridge = createRtPtLicenseHttpBridge(fetchMock as unknown as typeof fetch);

    await expect(bridge.activate("RTPT1.payload.signature")).resolves.toEqual(responsePayload);
    expect(fetchMock).toHaveBeenCalledWith("/api/rtpt-license/activate", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      body: JSON.stringify({ token: "RTPT1.payload.signature" }),
    }));
  });

  it("passes through a well-formed closed response from an HTTP rejection", async () => {
    const closedPayload = {
      status: "invalid",
      active: false,
      product: "rt-pt-inspector",
      appId: "com.amitay.rtptinspector",
      installationId: INSTALLATION_ID,
      reason: "license-format-invalid",
      message: "A valid activation code is required.",
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(closedPayload), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
    const bridge = createRtPtLicenseHttpBridge(fetchMock as unknown as typeof fetch);

    await expect(bridge.activate("bad-token")).resolves.toEqual(closedPayload);
    expect(normaliseRtPtLicenseStatus(await bridge.activate("bad-token"))).toMatchObject({
      active: false,
      status: "invalid",
      reason: "license-format-invalid",
    });
  });

  it("rejects malformed JSON and never accepts an active payload from a failed HTTP response", async () => {
    const invalidJsonFetch = vi.fn(async () => new Response("not-json", { status: 200 }));
    const invalidJsonBridge = createRtPtLicenseHttpBridge(
      invalidJsonFetch as unknown as typeof fetch,
    );
    await expect(invalidJsonBridge.getStatus()).rejects.toThrow("invalid response");

    const rejectedActiveFetch = vi.fn(async () => new Response(JSON.stringify(activeResponse()), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }));
    const rejectedActiveBridge = createRtPtLicenseHttpBridge(
      rejectedActiveFetch as unknown as typeof fetch,
    );
    await expect(rejectedActiveBridge.getStatus()).rejects.toThrow("rejected the request");
  });
});

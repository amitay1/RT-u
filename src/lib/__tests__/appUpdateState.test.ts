import { describe, expect, it } from "vitest";

import {
  INITIAL_UPDATE_STATE,
  type AppUpdateState,
  describeUpdatePhase,
  formatDownloadEta,
  formatRelativeTime,
  formatUpdateBytes,
  formatUpdateSpeed,
  normalizeReleaseNotes,
  phaseTone,
  primaryUpdateAction,
  reduceUpdate,
} from "@/lib/appUpdateState";

const NOW = 1_700_000_000_000;

const stateWith = (overrides: Partial<AppUpdateState>): AppUpdateState => ({
  ...INITIAL_UPDATE_STATE,
  ...overrides,
});

describe("reduceUpdate — check lifecycle", () => {
  it("moves to checking and clears a prior error on check-initiated", () => {
    const prev = stateWith({ phase: "error", error: "boom", canRetry: true });
    const next = reduceUpdate(prev, { type: "check-initiated" }, NOW);
    expect(next.phase).toBe("checking");
    expect(next.error).toBeNull();
    expect(next.canRetry).toBe(false);
  });

  it("reports up-to-date and stamps the check time on a not-available event", () => {
    const prev = reduceUpdate(INITIAL_UPDATE_STATE, { type: "check-initiated" }, NOW);
    const next = reduceUpdate(prev, { type: "event", payload: { status: "not-available" } }, NOW);
    expect(next.phase).toBe("up-to-date");
    expect(next.lastCheckedAt).toBe(NOW);
  });

  it("settles up-to-date from the resolved IPC promise only while checking", () => {
    const checking = stateWith({ phase: "checking" });
    const settled = reduceUpdate(checking, { type: "check-settled", upToDate: true }, NOW);
    expect(settled.phase).toBe("up-to-date");
    expect(settled.lastCheckedAt).toBe(NOW);

    // Once an event already advanced us, a late promise result is ignored.
    const ready = stateWith({ phase: "ready", version: "2.0.0" });
    const unchanged = reduceUpdate(ready, { type: "check-settled", upToDate: true }, NOW);
    expect(unchanged).toEqual(ready);
  });

  it("turns a watchdog timeout into a retryable error only while checking", () => {
    const checking = stateWith({ phase: "checking" });
    const timedOut = reduceUpdate(checking, { type: "check-timed-out" }, NOW);
    expect(timedOut.phase).toBe("error");
    expect(timedOut.canRetry).toBe(true);

    const idle = reduceUpdate(INITIAL_UPDATE_STATE, { type: "check-timed-out" }, NOW);
    expect(idle.phase).toBe("idle");
  });
});

describe("reduceUpdate — download lifecycle", () => {
  it("captures version and release notes when an update becomes available", () => {
    const next = reduceUpdate(
      INITIAL_UPDATE_STATE,
      {
        type: "event",
        payload: {
          status: "available",
          version: "2.1.0",
          releaseNotes: "<p>Fixed <b>PDF</b> export</p>",
          releaseDate: "2026-07-01",
        },
      },
      NOW,
    );
    expect(next.phase).toBe("available");
    expect(next.version).toBe("2.1.0");
    expect(next.releaseNotes).toBe("Fixed PDF export");
    expect(next.releaseDate).toBe("2026-07-01");
  });

  it("does not regress from downloading back to available", () => {
    const downloading = stateWith({ phase: "downloading", version: "2.1.0", percent: 40 });
    const next = reduceUpdate(
      downloading,
      { type: "event", payload: { status: "available", version: "2.1.0" } },
      NOW,
    );
    expect(next.phase).toBe("downloading");
    expect(next.percent).toBe(40);
  });

  it("clamps progress and tracks transfer figures while downloading", () => {
    const next = reduceUpdate(
      stateWith({ phase: "available", version: "2.1.0" }),
      {
        type: "event",
        payload: {
          status: "downloading",
          percent: 142,
          bytesPerSecond: 1_048_576,
          transferred: 5_000_000,
          total: 10_000_000,
        },
      },
      NOW,
    );
    expect(next.phase).toBe("downloading");
    expect(next.percent).toBe(100);
    expect(next.transferred).toBe(5_000_000);
    expect(next.total).toBe(10_000_000);
  });

  it("marks the build ready at 100% when the download finishes", () => {
    const next = reduceUpdate(
      stateWith({ phase: "downloading", version: "2.1.0", percent: 88 }),
      { type: "event", payload: { status: "downloaded", version: "2.1.0" } },
      NOW,
    );
    expect(next.phase).toBe("ready");
    expect(next.percent).toBe(100);
    expect(next.bytesPerSecond).toBe(0);
  });

  it("surfaces a retryable error and stops the throughput readout", () => {
    const next = reduceUpdate(
      stateWith({ phase: "downloading", bytesPerSecond: 999 }),
      { type: "event", payload: { status: "error", error: "net::ERR_DISCONNECTED" } },
      NOW,
    );
    expect(next.phase).toBe("error");
    expect(next.error).toContain("net::ERR_DISCONNECTED");
    expect(next.canRetry).toBe(true);
    expect(next.bytesPerSecond).toBe(0);
  });
});

describe("reduceUpdate — hydrate on mount", () => {
  it("hydrates a downloaded build as ready", () => {
    const next = reduceUpdate(
      INITIAL_UPDATE_STATE,
      { type: "hydrate", info: { updateDownloaded: true, updateVersion: "3.0.0" } },
      NOW,
    );
    expect(next.phase).toBe("ready");
    expect(next.version).toBe("3.0.0");
    expect(next.percent).toBe(100);
  });

  it("hydrates an available build without clobbering a live phase", () => {
    const fresh = reduceUpdate(
      INITIAL_UPDATE_STATE,
      { type: "hydrate", info: { updateAvailable: true, updateVersion: "3.0.0" } },
      NOW,
    );
    expect(fresh.phase).toBe("available");

    const checking = stateWith({ phase: "checking" });
    const preserved = reduceUpdate(
      checking,
      { type: "hydrate", info: { updateAvailable: true, updateVersion: "3.0.0" } },
      NOW,
    );
    expect(preserved.phase).toBe("checking");
    expect(preserved.version).toBe("3.0.0");
  });
});

describe("release-note normalisation", () => {
  it("strips HTML from a string", () => {
    expect(normalizeReleaseNotes("<h1>New</h1><p>Line</p>")).toBe("New Line");
  });

  it("joins an array of version/note records", () => {
    const notes = normalizeReleaseNotes([
      { version: "2.1.0", note: "First fix" },
      { version: "2.0.9", note: "Second fix" },
    ]);
    expect(notes).toBe("First fix\n\nSecond fix");
  });

  it("returns null for empty or unknown shapes", () => {
    expect(normalizeReleaseNotes("   ")).toBeNull();
    expect(normalizeReleaseNotes(undefined)).toBeNull();
    expect(normalizeReleaseNotes(42)).toBeNull();
  });
});

describe("presentation helpers", () => {
  it("maps phases to semantic tones", () => {
    expect(phaseTone("checking")).toBe("progress");
    expect(phaseTone("downloading")).toBe("progress");
    expect(phaseTone("up-to-date")).toBe("success");
    expect(phaseTone("ready")).toBe("success");
    expect(phaseTone("available")).toBe("attention");
    expect(phaseTone("error")).toBe("danger");
    expect(phaseTone("idle")).toBe("idle");
  });

  it("gives every phase a distinct, non-empty description", () => {
    const phases = [
      "idle",
      "checking",
      "up-to-date",
      "available",
      "downloading",
      "ready",
      "error",
    ] as const;
    for (const phase of phases) {
      const description = describeUpdatePhase(stateWith({ phase, version: "2.1.0" }));
      expect(description.title.length).toBeGreaterThan(0);
      expect(description.detail.length).toBeGreaterThan(0);
    }
  });

  it("chooses the right primary action per phase", () => {
    expect(primaryUpdateAction("idle").kind).toBe("check");
    expect(primaryUpdateAction("up-to-date").kind).toBe("check");
    expect(primaryUpdateAction("available").kind).toBe("download");
    expect(primaryUpdateAction("downloading")).toMatchObject({ kind: "download", busy: true });
    expect(primaryUpdateAction("ready").kind).toBe("install");
    expect(primaryUpdateAction("error").kind).toBe("retry");
    expect(primaryUpdateAction("checking").busy).toBe(true);
  });

  it("formats bytes, speed and ETA for the progress readout", () => {
    expect(formatUpdateBytes(0)).toBe("0 MB");
    expect(formatUpdateBytes(512 * 1024)).toBe("512 KB");
    expect(formatUpdateBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatUpdateSpeed(0)).toBe("");
    expect(formatUpdateSpeed(2 * 1024 * 1024)).toBe("2.0 MB/s");

    const eta = formatDownloadEta(
      stateWith({
        phase: "downloading",
        bytesPerSecond: 1_000_000,
        transferred: 4_000_000,
        total: 10_000_000,
      }),
    );
    expect(eta).toBe("6s left");
    expect(formatDownloadEta(stateWith({ phase: "available" }))).toBeNull();
  });

  it("formats the relative last-checked label", () => {
    expect(formatRelativeTime(null, NOW)).toBe("never");
    expect(formatRelativeTime(NOW - 3_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 45_000, NOW)).toBe("45s ago");
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
  });
});

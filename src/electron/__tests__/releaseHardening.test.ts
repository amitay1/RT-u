import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("RT-PT release hardening", () => {
  it("keeps the Electron identity, channel, and package boundary RT-PT-only", () => {
    const builder = JSON.parse(read("electron-builder.json"));
    const patterns = builder.files as string[];

    expect(builder.productName).toBe("RT-PT Inspector");
    expect(builder.appId).toBe("com.amitay.rtptinspector");
    expect(builder.artifactName).toBe("RTPT-Inspector-Setup-${version}.${ext}");
    expect(builder.portable.artifactName).toBe("RTPT-Inspector-Portable-${version}.${ext}");
    expect(builder.nsis.differentialPackage).toBe(true);
    expect(builder.publish).toEqual([
      expect.objectContaining({ provider: "github", owner: "amitay1", repo: "RT-u" }),
    ]);
    expect(builder.win.signAndEditExecutable).not.toBe(false);
    expect(builder.mac).toBeUndefined();
    expect(builder.linux).toBeUndefined();
    expect(patterns.filter((pattern) =>
      !pattern.startsWith("!") && /(^|\/)(?:rtpt-)?dist(\/|$)/i.test(pattern)
    )).toEqual(["rtpt-dist/**/*"]);
    expect(builder.asarUnpack).toEqual(["rtpt-dist/**/*"]);
    expect(patterns).toContain("!rtpt-dist/standards/MRO/**");
    expect(patterns).toContain("electron/rtpt-license-service.cjs");
    expect(patterns).toContain("electron/rtpt-license-public-key.pem");
    expect(patterns).toContain("!electron/license-manager.cjs");
    expect(patterns).toContain("!electron/**/*private*.pem");
    expect(patterns).toContain("!electron/**/*.key");
    expect(patterns).toContain("!electron/**/*.p12");
    expect(patterns).toContain("!electron/**/*.pfx");
    expect(patterns).toContain("!electron/**/*.rtpt-license.json");
    expect(patterns).toContain("!electron/**/*.rtpt-license");
    expect(patterns).toContain("!electron/**/activation-packages{,/**/*}");
    expect(patterns).toContain("!server{,/**/*}");
    expect(patterns).toContain("!shared{,/**/*}");
    expect(patterns).toContain("!**/node_modules/@jscad{,/**/*}");
    expect(patterns).toContain("!**/node_modules/@react-three{,/**/*}");
    expect(patterns).toContain("!**/node_modules/{three,three-csg-ts,makerjs,paper,dxf-writer,docx,mammoth,opentype.js,pdfjs-dist}{,/**/*}");
    expect(patterns.some((pattern) => !pattern.startsWith("!") && /node_modules\/\*\*/i.test(pattern))).toBe(false);
  });

  it("exposes only the governed Windows desktop packaging commands", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["electron:build"]).toContain("electron-builder --win");
    expect(packageJson.scripts["dist:win"]).toContain("electron-builder --win");
    expect(packageJson.scripts["dist:mac"]).toBeUndefined();
    expect(packageJson.scripts["dist:linux"]).toBeUndefined();
  });

  it("allowlists every dedicated renderer root entry audited by release smoke", () => {
    const releaseSmoke = read("scripts/release-smoke.cjs");

    for (const entry of [
      "assets",
      "favicon.ico",
      "icon-192.png",
      "icon-512.png",
      "index.html",
      "manifest.json",
      "service-worker-advanced.js",
    ]) {
      expect(releaseSmoke).toContain(`["${entry}",`);
    }
    expect(releaseSmoke).toContain("Unexpected rtpt-dist root entry:");
  });

  it("does not use broad Git staging, destructive cleanup, or release clobbering", () => {
    const releaseScript = read("scripts/release.ps1");

    expect(releaseScript).toContain("AllowUnsignedDevelopmentBuild");
    expect(releaseScript).toContain("Assert-AuthenticodeSigned");
    expect(releaseScript).toContain("RTPT_WINDOWS_SIGNER_SHA1");
    expect(releaseScript).toContain("SignerCertificate.Thumbprint");
    expect(releaseScript).toContain("TimeStamperCertificate");
    expect(releaseScript).toContain("Assert-RtPtLicenseVerificationKey");
    expect(releaseScript).toContain("verify-rtpt-license-key.cjs");
    expect(releaseScript).toContain("Assert-RtPtUpdateVerificationKey");
    expect(releaseScript).toContain("verify-rtpt-update-key.cjs");
    expect(releaseScript).toContain("SMOKE_ALLOW_UNUSABLE_UPDATE_KEY");
    expect(releaseScript).toContain("release-workspace");
    expect(releaseScript).not.toMatch(/git[^\r\n]*add[^\r\n]*-A/i);
    expect(releaseScript).not.toContain("--clobber");
    expect(releaseScript).not.toMatch(/\b(?:Remove-Item|git\s+(?:reset|checkout)|rm\s+-rf)\b/i);
  });

  it("keeps GitHub Actions verification-only and manually dispatched", () => {
    const workflow = read(".github/workflows/release.yml");
    const applyVersion = workflow.indexOf("npm version $env:RELEASE_VERSION");
    const buildRenderer = workflow.indexOf("npm run build");

    expect(workflow).toMatch(/\bon:\s*\r?\n\s+workflow_dispatch:/);
    expect(workflow).not.toMatch(/^\s*push:/m);
    expect(workflow).not.toMatch(/^\s*tags:/m);
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("RELEASE_VERSION: ${{ inputs.version }}");
    expect(workflow).not.toMatch(/--publish\s+(?:always|onTagOrDraft)/i);
    expect(workflow).not.toMatch(/\b(?:GH_TOKEN|GITHUB_TOKEN|secrets\.)\b/);
    expect(workflow).not.toMatch(/npm run dist:|electron-builder/i);
    expect(workflow).not.toMatch(/\b(?:gh\s+release|git\s+push|npm\s+publish)\b/i);
    expect(applyVersion).toBeGreaterThan(-1);
    expect(buildRenderer).toBeGreaterThan(applyVersion);
  });

  it("applies the requested package version before the final release build", () => {
    const releaseScript = read("scripts/release.ps1");
    const dryRunGate = releaseScript.indexOf("if ($DryRun)");
    const applyVersion = releaseScript.indexOf(
      "Run npm @('version', $targetVersion, '--no-git-tag-version')",
    );
    const buildRenderer = releaseScript.indexOf("Run npm @('run', 'build')");
    const smokeRenderer = releaseScript.indexOf("Run npm @('run', 'smoke:release')");
    const packageElectron = releaseScript.indexOf("Run npx $targets");

    expect(releaseScript).toContain("$Version.TrimStart('v')");
    expect(releaseScript).toContain("$appliedVersion -cne $targetVersion");
    expect(releaseScript).toContain("[System.IO.File]::ReadAllBytes");
    expect(releaseScript).toContain("[System.IO.File]::WriteAllBytes");
    expect(releaseScript).toContain("$versionFilesApplied -and -not $releaseCommitCreated");
    expect(dryRunGate).toBeGreaterThan(-1);
    expect(applyVersion).toBeGreaterThan(dryRunGate);
    expect(applyVersion).toBeGreaterThan(-1);
    expect(buildRenderer).toBeGreaterThan(applyVersion);
    expect(smokeRenderer).toBeGreaterThan(buildRenderer);
    expect(packageElectron).toBeGreaterThan(smokeRenderer);
  });

  it("creates only a signed and hashed RT-PT offline-update folder", () => {
    const offlineScript = read("scripts/build-offline-package.sh");

    expect(offlineScript).toContain("RTPT-Inspector-Setup-$VERSION.exe");
    expect(offlineScript).toContain("installerSha256");
    expect(offlineScript).toContain("signatureFile: 'update-info.sig'");
    expect(offlineScript).toContain("Get-AuthenticodeSignature");
    expect(offlineScript).toContain("openssl dgst -sha256 -verify \"$PUBLIC_KEY\"");
    expect(offlineScript).toContain("Refusing to overwrite existing output");
    expect(offlineScript).not.toMatch(/^\s*docker\s/m);
  });
});

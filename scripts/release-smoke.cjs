#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const {
  inspectLicensePublicKey,
  verifyLicensePublicKeyContent,
  verifyLicensePublicKeyFile,
} = require("./verify-rtpt-license-key.cjs");
const {
  inspectUpdatePublicKey,
  verifyUpdatePublicKeyContent,
  verifyUpdatePublicKeyFile,
} = require("./verify-rtpt-update-key.cjs");

const repoRoot = path.resolve(__dirname, "..");
const buildOutputDir = path.join(repoRoot, "rtpt-dist");
const screenshotDir = path.join(repoRoot, "logs", "release-smoke");
const externalBaseUrl = process.env.SMOKE_BASE_URL || "";
const configOnly = process.env.SMOKE_CONFIG_ONLY === "1";
const packagedBuildDir = (process.env.SMOKE_PACKAGED_APP_DIR || "").trim();
const allowUnusableLicense = process.env.SMOKE_ALLOW_UNUSABLE_LICENSE === "1";
const allowUnusableUpdateKey = process.env.SMOKE_ALLOW_UNUSABLE_UPDATE_KEY === "1";
const expectedLicenseKeyFingerprint = (process.env.RTPT_LICENSE_PUBLIC_KEY_SHA256 || "").trim();
const expectedUpdateKeyFingerprint = (process.env.RTPT_UPDATE_PUBLIC_KEY_SHA256 || "").trim();
const sourceLicensePublicKeyPath = path.join(repoRoot, "electron", "rtpt-license-public-key.pem");
const sourceUpdatePublicKeyPath = path.join(repoRoot, "electron", "update-public-key.pem");

const expectedReleaseIdentity = Object.freeze({
  appId: "com.amitay.rtptinspector",
  productName: "RT-PT Inspector",
  setupArtifact: "RTPT-Inspector-Setup-${version}.${ext}",
  portableArtifact: "RTPT-Inspector-Portable-${version}.${ext}",
  rootPackageName: "rt-pt-inspector",
  electronPackageName: "rt-pt-inspector-electron",
  owner: "amitay1",
  repo: "RT-u",
});

const forbiddenFirstPartyIdentityPatterns = Object.freeze([
  Object.freeze({ label: "legacy Electron package name", pattern: /scan-master-electron/i }),
  Object.freeze({ label: "legacy Electron application ID", pattern: /com\.(?:amitay\.)?scan[-_.]?master/i }),
  Object.freeze({ label: "legacy browser-storage namespace", pattern: /scanmaster_inspector_/i }),
]);
const legacyFirstPartyProductIdentityPattern = /scan[-_ ]?master/i;
const firstPartyTextExtensions = Object.freeze(new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".map",
  ".md",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]));
const firstPartyRuntimeTextExtensions = Object.freeze(new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".xml",
  ".yaml",
  ".yml",
]));

const forbiddenRuntimePackages = Object.freeze([
  "@jscad",
  "@react-three",
  "three",
  "three-csg-ts",
  "makerjs",
  "paper",
  "dxf-writer",
  "docx",
  "mammoth",
  "opentype.js",
  "pdfjs-dist",
]);
const allowedBuildOutputRoot = Object.freeze(new Map([
  ["assets", "directory"],
  ["favicon.ico", "file"],
  ["icon-192.png", "file"],
  ["icon-512.png", "file"],
  ["index.html", "file"],
  ["manifest.json", "file"],
  ["service-worker-advanced.js", "file"],
]));

function assertRelease(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePackagePath(value) {
  return `/${String(value).replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

function assertLicenseKeyVerifierWithEphemeralFixtures() {
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const inspected = inspectLicensePublicKey(publicKeyPem);
  const verified = verifyLicensePublicKeyContent(publicKeyPem, inspected.fingerprint);
  assertRelease(verified.fingerprint === inspected.fingerprint, "The RT/PT license-key verifier rejected a valid ephemeral Ed25519 fixture.");

  let mismatchRejected = false;
  try {
    verifyLicensePublicKeyContent(publicKeyPem, "0".repeat(64));
  } catch (error) {
    mismatchRejected = error?.reason === "fingerprint-mismatch";
  }
  assertRelease(mismatchRejected, "The RT/PT license-key verifier accepted a mismatched fingerprint fixture.");

  const { publicKey: rsaPublicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  let rsaRejected = false;
  try {
    inspectLicensePublicKey(rsaPublicKey.export({ format: "pem", type: "spki" }));
  } catch (error) {
    rsaRejected = error?.reason === "public-key-not-ed25519";
  }
  assertRelease(rsaRejected, "The RT/PT license-key verifier accepted a non-Ed25519 fixture.");
}

function assertUpdateKeyVerifierWithEphemeralFixtures() {
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const inspected = inspectUpdatePublicKey(publicKeyPem);
  const verified = verifyUpdatePublicKeyContent(publicKeyPem, inspected.fingerprint);
  assertRelease(verified.fingerprint === inspected.fingerprint, "The RT/PT update-key verifier rejected a valid ephemeral RSA fixture.");

  let mismatchRejected = false;
  try {
    verifyUpdatePublicKeyContent(publicKeyPem, "0".repeat(64));
  } catch (error) {
    mismatchRejected = error?.reason === "fingerprint-mismatch";
  }
  assertRelease(mismatchRejected, "The RT/PT update-key verifier accepted a mismatched fingerprint fixture.");

  const { publicKey: unsupportedPublicKey } = crypto.generateKeyPairSync("ed25519");
  let unsupportedAlgorithmRejected = false;
  try {
    inspectUpdatePublicKey(unsupportedPublicKey.export({ format: "pem", type: "spki" }));
  } catch (error) {
    unsupportedAlgorithmRejected = error?.reason === "public-key-signature-algorithm-unsupported";
  }
  assertRelease(unsupportedAlgorithmRejected, "The RT/PT update-key verifier accepted a key incompatible with SHA-256 manifest signatures.");
}

function assertBuildOutputContents(required = false) {
  if (!fs.existsSync(buildOutputDir)) {
    assertRelease(!required, "rtpt-dist is missing. Run npm run build before the release smoke test.");
    return;
  }

  const rootEntries = fs.readdirSync(buildOutputDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    const expectedType = allowedBuildOutputRoot.get(entry.name);
    assertRelease(expectedType, `Unexpected rtpt-dist root entry: ${entry.name}`);
    assertRelease(
      (expectedType === "file" && entry.isFile()) || (expectedType === "directory" && entry.isDirectory()),
      `Unexpected rtpt-dist root entry type for ${entry.name}; expected ${expectedType}.`,
    );
  }

  const indexEntry = rootEntries.find((entry) => entry.name === "index.html");
  const assetsEntry = rootEntries.find((entry) => entry.name === "assets");
  assertRelease(indexEntry?.isFile(), "rtpt-dist/index.html is missing or is not a file.");
  assertRelease(assetsEntry?.isDirectory(), "rtpt-dist/assets is missing or is not a directory.");
}

function assertReleaseConfiguration() {
  const builderPath = path.join(repoRoot, "electron-builder.json");
  const builder = JSON.parse(fs.readFileSync(builderPath, "utf8"));
  const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const electronPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "electron", "package.json"), "utf8"));
  const electronMain = fs.readFileSync(path.join(repoRoot, "electron", "main.cjs"), "utf8");
  const publishers = Array.isArray(builder.publish) ? builder.publish : [];
  const publisher = publishers[0] || {};
  const filePatterns = Array.isArray(builder.files) ? builder.files : [];
  const asarUnpackPatterns = Array.isArray(builder.asarUnpack) ? builder.asarUnpack : [];
  const positiveRendererPatterns = filePatterns.filter((pattern) =>
    typeof pattern === "string"
      && !pattern.startsWith("!")
      && /(^|\/)(?:rtpt-)?dist(\/|$)/i.test(pattern),
  );

  assertRelease(builder.appId === expectedReleaseIdentity.appId, "Unexpected Electron appId.");
  assertRelease(builder.productName === expectedReleaseIdentity.productName, "Unexpected Electron productName.");
  assertRelease(rootPackage.name === expectedReleaseIdentity.rootPackageName, "Unexpected root package name.");
  assertRelease(electronPackage.name === expectedReleaseIdentity.electronPackageName, "Unexpected nested Electron package name.");
  assertRelease(builder.artifactName === expectedReleaseIdentity.setupArtifact, "Unexpected Windows setup artifact name.");
  assertRelease(builder.portable?.artifactName === expectedReleaseIdentity.portableArtifact, "Unexpected portable artifact name.");
  assertRelease(
    publishers.length === 1
      && publisher.provider === "github"
      && publisher.owner === expectedReleaseIdentity.owner
      && publisher.repo === expectedReleaseIdentity.repo,
    "Electron publish channel must be github/amitay1/RT-u only.",
  );
  assertRelease(builder.win?.signAndEditExecutable !== false, "Windows executable signing must not be disabled.");
  assertRelease(
    !Object.prototype.hasOwnProperty.call(builder, "mac")
      && !Object.prototype.hasOwnProperty.call(builder, "linux"),
    "Unsupported macOS/Linux production targets must not be declared in the Windows-only release configuration.",
  );
  const configuredUrls = electronMain.match(/https?:\/\/[^'"`\s)]+/g) || [];
  assertRelease(
    !configuredUrls.some((url) => /scan[-_ ]?master/i.test(url)),
    "Electron main process contains a Scan-Master URL/channel.",
  );
  assertRelease(!/\.setFeedURL\s*\(/.test(electronMain), "Electron main process must not override the packaged RT-PT update channel.");
  assertRelease(
    !filePatterns.some((pattern) => typeof pattern === "string" && !pattern.startsWith("!") && /node_modules\/\*\*/i.test(pattern)),
    "A broad node_modules include is forbidden.",
  );
  assertRelease(
    positiveRendererPatterns.length === 1 && positiveRendererPatterns[0] === "rtpt-dist/**/*",
    "rtpt-dist/**/* must be the only positively included renderer output.",
  );
  assertRelease(
    asarUnpackPatterns.length === 1 && asarUnpackPatterns[0] === "rtpt-dist/**/*",
    "Only the dedicated RT/PT renderer output may be unpacked from asar.",
  );
  assertRelease(filePatterns.includes("!rtpt-dist/standards/MRO/**"), "MRO standards must be excluded from desktop packages.");
  assertRelease(
    filePatterns.includes("electron/rtpt-license-service.cjs")
      && filePatterns.includes("electron/rtpt-license-public-key.pem"),
    "The RT/PT license service and exact public-key file must be explicitly included.",
  );
  assertRelease(
    filePatterns.includes("electron/update-public-key.pem"),
    "The exact RT/PT offline-update public-key file must be explicitly included.",
  );
  assertRelease(filePatterns.includes("!electron/license-manager.cjs"), "Legacy license-manager.cjs must be excluded.");
  assertRelease(
    electronMain.includes("require('./rtpt-license-service.cjs')")
      && electronMain.includes("rtpt-license-public-key.pem"),
    "The independent RT/PT license service and pinned verification key path must be wired into Electron.",
  );
  assertRelease(
    electronMain.includes("require('./offline-updater.cjs')")
      && electronMain.includes("update-public-key.pem"),
    "The RT/PT offline updater and pinned update verification key path must be wired into Electron.",
  );
  assertRelease(filePatterns.includes("!server{,/**/*}"), "Server source must be explicitly excluded.");
  assertRelease(filePatterns.includes("!shared{,/**/*}"), "Shared source must be explicitly excluded.");

  for (const requiredSecretExclusion of [
    "!electron/**/*private*.pem",
    "!electron/**/*.key",
    "!electron/**/*.p12",
    "!electron/**/*.pfx",
    "!electron/**/*.rtpt-license.json",
    "!electron/**/*.rtpt-license",
    "!electron/**/activation-packages{,/**/*}",
  ]) {
    assertRelease(filePatterns.includes(requiredSecretExclusion), `Desktop package secret exclusion is missing: ${requiredSecretExclusion}`);
  }

  for (const requiredExclusion of [
    "!**/node_modules/@jscad{,/**/*}",
    "!**/node_modules/@react-three{,/**/*}",
    "!**/node_modules/{three,three-csg-ts,makerjs,paper,dxf-writer,docx,mammoth,opentype.js,pdfjs-dist}{,/**/*}",
  ]) {
    assertRelease(filePatterns.includes(requiredExclusion), `Desktop package exclusion is missing: ${requiredExclusion}`);
  }
}

function findFile(root, fileName, maxDepth = 5) {
  const queue = [{ directory: root, depth: 0 }];
  while (queue.length > 0) {
    const { directory, depth } = queue.shift();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && entry.name === fileName) return fullPath;
      if (entry.isDirectory() && depth < maxDepth) {
        queue.push({ directory: fullPath, depth: depth + 1 });
      }
    }
  }
  return "";
}

function listDirectoryEntries(root, prefix = "") {
  const entries = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    entries.push(normalizePackagePath(relative));
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      entries.push(...listDirectoryEntries(path.join(root, entry.name), relative));
    }
  }
  return entries;
}

function listDirectoryFiles(root, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      files.push(...listDirectoryFiles(fullPath, relative));
    } else if (entry.isFile() && !entry.isSymbolicLink()) {
      files.push({ entry: normalizePackagePath(relative), fullPath });
    }
  }
  return files;
}

function assertNoForbiddenFirstPartyIdentityInText(content, entry) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (buffer.includes(0)) return;

  const source = buffer.toString("utf8");
  const extension = path.posix.extname(entry).toLowerCase();
  if (firstPartyRuntimeTextExtensions.has(extension)) {
    assertRelease(
      !legacyFirstPartyProductIdentityPattern.test(source),
      `Packaged first-party runtime content contains a legacy product identity: ${entry}`,
    );
  }
  for (const { label, pattern } of forbiddenFirstPartyIdentityPatterns) {
    assertRelease(!pattern.test(source), `Packaged first-party content contains a ${label}: ${entry}`);
  }
}

function assertPackagedFirstPartyIdentity(asar, asarPath, asarEntries, unpackedPath) {
  const lowerAsarEntries = asarEntries.map((entry) => entry.toLowerCase());
  const manifestExpectations = new Map([
    ["/package.json", expectedReleaseIdentity.rootPackageName],
    ["/electron/package.json", expectedReleaseIdentity.electronPackageName],
  ]);

  for (const [manifestEntry, expectedName] of manifestExpectations) {
    const entryIndex = lowerAsarEntries.indexOf(manifestEntry);
    assertRelease(entryIndex >= 0, `Packaged application is missing ${manifestEntry}.`);
    const actualEntry = asarEntries[entryIndex];
    const manifestContent = Buffer.from(asar.extractFile(asarPath, actualEntry.slice(1)));
    const manifestText = manifestContent.toString("utf8");
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      throw new Error(`Packaged first-party manifest is not valid JSON: ${manifestEntry}`);
    }
    assertRelease(manifest.name === expectedName, `Unexpected packaged package name in ${manifestEntry}.`);
    assertRelease(
      !legacyFirstPartyProductIdentityPattern.test(manifestText),
      `Packaged first-party manifest contains a legacy product identity: ${manifestEntry}`,
    );
  }

  const unpackedFiles = fs.existsSync(unpackedPath) ? listDirectoryFiles(unpackedPath) : [];
  const firstPartyEntries = [
    ...asarEntries,
    ...unpackedFiles.map(({ entry }) => entry),
  ].filter((entry) => !/^\/node_modules(?:\/|$)/i.test(entry));

  const legacyPath = firstPartyEntries.find((entry) => legacyFirstPartyProductIdentityPattern.test(entry));
  assertRelease(!legacyPath, `Packaged first-party path contains a legacy product identity: ${legacyPath}`);

  for (const entry of asarEntries) {
    if (/^\/node_modules(?:\/|$)/i.test(entry)) continue;
    if (!firstPartyTextExtensions.has(path.posix.extname(entry).toLowerCase())) continue;
    if (fs.existsSync(unpackedPath) && /^\/rtpt-dist(?:\/|$)/i.test(entry)) continue;

    let content;
    try {
      content = Buffer.from(asar.extractFile(asarPath, entry.slice(1)));
    } catch (error) {
      throw new Error(`Unable to inspect packaged first-party content ${entry}: ${error.message}`);
    }
    assertNoForbiddenFirstPartyIdentityInText(content, entry);
  }

  for (const { entry, fullPath } of unpackedFiles) {
    if (!firstPartyTextExtensions.has(path.posix.extname(entry).toLowerCase())) continue;
    assertNoForbiddenFirstPartyIdentityInText(fs.readFileSync(fullPath), entry);
  }
}

function isForbiddenPackagedLicenseMaterial(entry) {
  const lowerEntry = entry.toLowerCase();
  if (lowerEntry === "/electron/rtpt-license-public-key.pem") return false;

  const basename = path.posix.basename(lowerEntry);
  const extension = path.posix.extname(basename);
  const stem = basename.slice(0, Math.max(0, basename.length - extension.length));
  const namedPrivateKey = [".pem", ".key"].includes(extension)
    && /(?:^|[-_.])private(?:[-_.]|$)/.test(stem);
  return basename.endsWith(".rtpt-license.json")
    || basename.endsWith(".rtpt-license")
    || namedPrivateKey
    || /(?:^|[-_.])(?:license|signing)[-_.]?key\.(?:p12|pfx)$/.test(basename)
    || (/^\/electron\//.test(lowerEntry) && /\.(?:key|p12|pfx)$/.test(basename))
    || /\/(?:activation-packages?|issued-licenses?)(?:\/|$)/.test(lowerEntry);
}

function assertNoFirstPartyPrivatePem(asar, asarPath, asarEntries) {
  const firstPartyPemEntries = asarEntries.filter((entry) =>
    /^\/electron\/.*\.pem$/i.test(entry),
  );
  for (const entry of firstPartyPemEntries) {
    const content = Buffer.from(asar.extractFile(asarPath, entry.slice(1))).toString("utf8");
    assertRelease(
      !/-----BEGIN [^-]*PRIVATE KEY-----/.test(content),
      `Private key material was packaged in ${entry}.`,
    );
  }
}

function assertPackagedApplication(buildDirectory) {
  const resolvedBuildDir = path.resolve(buildDirectory);
  assertRelease(fs.existsSync(resolvedBuildDir), `Packaged build directory does not exist: ${resolvedBuildDir}`);

  const asarPath = findFile(resolvedBuildDir, "app.asar");
  assertRelease(asarPath, `app.asar was not found below ${resolvedBuildDir}.`);

  let asar;
  try {
    asar = require("@electron/asar");
  } catch {
    throw new Error("@electron/asar is required to audit the packaged application.");
  }

  const asarEntries = asar.listPackage(asarPath).map(normalizePackagePath);
  const entries = [...asarEntries];
  const unpackedPath = `${asarPath}.unpacked`;
  if (fs.existsSync(unpackedPath)) {
    entries.push(...listDirectoryEntries(unpackedPath));
  }
  const lowerEntries = entries.map((entry) => entry.toLowerCase());
  const lowerAsarEntries = asarEntries.map((entry) => entry.toLowerCase());

  assertRelease(
    lowerEntries.includes("/rtpt-dist/index.html"),
    "Packaged application is missing rtpt-dist/index.html.",
  );
  assertRelease(
    lowerAsarEntries.includes("/electron/rtpt-license-service.cjs"),
    "Packaged application is missing electron/rtpt-license-service.cjs inside app.asar.",
  );

  const packagedLicensePublicKeyEntry = "/electron/rtpt-license-public-key.pem";
  const hasPackagedLicensePublicKey = lowerAsarEntries.includes(packagedLicensePublicKeyEntry);
  if (!hasPackagedLicensePublicKey && allowUnusableLicense) {
    console.warn("RT/PT LICENSING UNUSABLE IN THIS DEVELOPMENT PACKAGE: the packaged public key is missing.");
  } else {
    assertRelease(
      hasPackagedLicensePublicKey,
      "Packaged application is missing electron/rtpt-license-public-key.pem inside app.asar.",
    );
  }

  if (hasPackagedLicensePublicKey) {
    const packagedPublicKeyContent = Buffer.from(asar.extractFile(asarPath, packagedLicensePublicKeyEntry.slice(1)));
    if (allowUnusableLicense) {
      try {
        inspectLicensePublicKey(packagedPublicKeyContent);
        if (fs.existsSync(sourceLicensePublicKeyPath)) {
          const sourcePublicKeyContent = fs.readFileSync(sourceLicensePublicKeyPath);
          assertRelease(
            sourcePublicKeyContent.equals(packagedPublicKeyContent),
            "The development package license public key differs from the source public key.",
          );
        }
      } catch (error) {
        console.warn(`RT/PT LICENSING UNUSABLE IN THIS DEVELOPMENT PACKAGE: ${error.message}`);
      }
    } else {
      const sourcePublicKey = verifyLicensePublicKeyFile({
        publicKeyPath: sourceLicensePublicKeyPath,
        expectedFingerprint: expectedLicenseKeyFingerprint,
      });
      const packagedPublicKey = verifyLicensePublicKeyContent(
        packagedPublicKeyContent,
        expectedLicenseKeyFingerprint,
      );
      assertRelease(
        sourcePublicKey.publicKeyContent.equals(packagedPublicKeyContent),
        "The packaged RT/PT license public key is not byte-for-byte identical to the controlled source public key.",
      );
      assertRelease(
        sourcePublicKey.spkiDer.equals(packagedPublicKey.spkiDer),
        "The packaged RT/PT license public key does not match the controlled source key.",
      );
    }
  }

  const packagedUpdatePublicKeyEntry = "/electron/update-public-key.pem";
  const hasPackagedUpdatePublicKey = lowerAsarEntries.includes(packagedUpdatePublicKeyEntry);
  if (!hasPackagedUpdatePublicKey && allowUnusableUpdateKey) {
    console.warn("RT/PT OFFLINE UPDATES UNUSABLE IN THIS DEVELOPMENT PACKAGE: the packaged update public key is missing.");
  } else {
    assertRelease(
      hasPackagedUpdatePublicKey,
      "Packaged application is missing electron/update-public-key.pem inside app.asar.",
    );
  }

  if (hasPackagedUpdatePublicKey) {
    const packagedUpdatePublicKeyContent = Buffer.from(asar.extractFile(asarPath, packagedUpdatePublicKeyEntry.slice(1)));
    const sourceUpdatePublicKeyContent = fs.existsSync(sourceUpdatePublicKeyPath)
      ? fs.readFileSync(sourceUpdatePublicKeyPath)
      : null;

    if (sourceUpdatePublicKeyContent) {
      assertRelease(
        sourceUpdatePublicKeyContent.equals(packagedUpdatePublicKeyContent),
        "The packaged RT/PT offline-update public key is not byte-for-byte identical to the controlled source public key.",
      );
    }

    if (allowUnusableUpdateKey) {
      try {
        inspectUpdatePublicKey(packagedUpdatePublicKeyContent);
        if (sourceUpdatePublicKeyContent) inspectUpdatePublicKey(sourceUpdatePublicKeyContent);
      } catch (error) {
        console.warn(`RT/PT OFFLINE UPDATES UNUSABLE IN THIS DEVELOPMENT PACKAGE: ${error.message}`);
      }
    } else {
      const sourceUpdatePublicKey = verifyUpdatePublicKeyFile({
        publicKeyPath: sourceUpdatePublicKeyPath,
        expectedFingerprint: expectedUpdateKeyFingerprint,
      });
      const packagedUpdatePublicKey = verifyUpdatePublicKeyContent(
        packagedUpdatePublicKeyContent,
        expectedUpdateKeyFingerprint,
      );
      assertRelease(
        sourceUpdatePublicKey.publicKeyContent.equals(packagedUpdatePublicKeyContent),
        "The packaged RT/PT offline-update public key is not byte-for-byte identical to the controlled source public key.",
      );
      assertRelease(
        sourceUpdatePublicKey.spkiDer.equals(packagedUpdatePublicKey.spkiDer),
        "The packaged RT/PT offline-update public key does not match the controlled source key.",
      );
    }
  }

  assertNoFirstPartyPrivatePem(asar, asarPath, asarEntries);
  assertPackagedFirstPartyIdentity(asar, asarPath, asarEntries, unpackedPath);
  const legacyRendererArtifact = lowerEntries.find((entry) => /^\/dist(\/|$)/.test(entry));
  assertRelease(!legacyRendererArtifact, `Legacy dist artifact packaged: ${legacyRendererArtifact}`);

  const forbiddenArtifact = lowerEntries.find((entry) =>
    /^\/(server|shared)(\/|$)/.test(entry)
      || entry === "/electron/license-manager.cjs"
      || /^\/(licenses|licensing)(\/|$)/.test(entry)
      || /^\/rtpt-dist\/standards\/mro(\/|$)/.test(entry)
      || isForbiddenPackagedLicenseMaterial(entry)
      || forbiddenRuntimePackages.some((packageName) =>
        entry.includes(`/node_modules/${packageName.toLowerCase()}/`)
          || entry.endsWith(`/node_modules/${packageName.toLowerCase()}`),
      ),
  );
  assertRelease(!forbiddenArtifact, `Forbidden source, private/activation material, licensing, MRO, or CAD/UT artifact packaged: ${forbiddenArtifact}`);

  for (const requiredPackage of ["express", "electron-updater", "electron-log"]) {
    assertRelease(
      lowerEntries.some((entry) => entry.includes(`/node_modules/${requiredPackage}/`)),
      `Required Electron runtime package is missing: ${requiredPackage}`,
    );
  }

  const updateConfigPath = findFile(resolvedBuildDir, "app-update.yml");
  assertRelease(updateConfigPath, "Packaged app-update.yml was not found.");
  const updateConfig = fs.readFileSync(updateConfigPath, "utf8");
  assertRelease(!/scan[-_ ]?master/i.test(updateConfig), "Packaged updater still references a Scan-Master channel.");
  assertRelease(/^provider:\s*github\s*$/im.test(updateConfig), "Packaged updater provider is not GitHub.");
  assertRelease(/^owner:\s*amitay1\s*$/im.test(updateConfig), "Packaged updater owner is not amitay1.");
  assertRelease(/^repo:\s*RT-u\s*$/im.test(updateConfig), "Packaged updater repository is not RT-u.");
}

try {
  assertLicenseKeyVerifierWithEphemeralFixtures();
  assertUpdateKeyVerifierWithEphemeralFixtures();
  assertReleaseConfiguration();
  assertBuildOutputContents(false);
  if (packagedBuildDir) assertPackagedApplication(packagedBuildDir);
} catch (error) {
  console.error(`RELEASE SMOKE FAILED: ${error.message}`);
  process.exit(1);
}

if (configOnly) {
  console.log(`Release configuration audit passed${packagedBuildDir ? " (including packaged app contents)" : ""}.`);
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for release smoke tests.");
  console.error("Install dependencies, then run: npx playwright install chromium");
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
};

async function launchSmokeBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    const candidates = [
      process.env.SMOKE_BROWSER_EXECUTABLE,
      process.platform === "win32" && path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
      process.platform === "win32" && path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
      process.platform === "win32" && path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
      process.platform === "win32" && path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      process.platform === "win32" && path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
      const executablePath = path.resolve(candidate);
      if (!fs.existsSync(executablePath) || !fs.statSync(executablePath).isFile()) continue;
      try {
        console.log(`Bundled Chromium unavailable; using system browser: ${executablePath}`);
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        // Continue to the next explicitly resolved system browser.
      }
    }

    throw new Error(
      `No usable Chromium browser was found. Install Playwright Chromium or set SMOKE_BROWSER_EXECUTABLE. ${bundledError.message}`,
    );
  }
}

function ensureBuildOutputExists() {
  if (externalBaseUrl) return;
  assertBuildOutputContents(true);
}

function startStaticServer() {
  if (externalBaseUrl) {
    return Promise.resolve({
      baseUrl: externalBaseUrl.replace(/\/$/, ""),
      close: async () => {},
    });
  }

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(buildOutputDir, safePath);

    if (!filePath.startsWith(buildOutputDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(buildOutputDir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function fail(page, message, details = []) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshot = path.join(screenshotDir, `failure-${Date.now()}.png`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  console.error(`RELEASE SMOKE FAILED: ${message}`);
  for (const detail of details.filter(Boolean)) {
    console.error(detail);
  }
  console.error(`Screenshot: ${screenshot}`);
  process.exitCode = 1;
}

async function assertNoCrash(page, errors, phase) {
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const crashText = /Something went wrong|unexpected error occurred|handleRunCheck is not defined/i;
  const relevantErrors = errors.filter((entry) => {
    if (/favicon|ResizeObserver loop|Error loading organizations|Failed to load resource/i.test(entry)) {
      return false;
    }

    return /pageerror|ReferenceError|TypeError|is not defined|Cannot read properties|GlobalErrorBoundary|Uncaught|Minified React error/i.test(entry);
  });

  if (crashText.test(bodyText) || relevantErrors.length > 0) {
    await fail(page, `Runtime crash during ${phase}`, [
      bodyText.slice(0, 1200),
      relevantErrors.slice(0, 10).join("\n"),
    ]);
    throw new Error(`Runtime crash during ${phase}`);
  }
}

async function clickFirstVisible(page, locators, label) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index++) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.click({ timeout: 10_000 });
        return;
      }
    }
  }

  throw new Error(`Could not find visible ${label}`);
}

async function readActiveDocumentId(page) {
  await page.locator('[role="tab"][title^="Control & Approval"]').click({ timeout: 10_000 });
  const documentId = await page.getByLabel(/^Document ID/i).inputValue({ timeout: 10_000 });
  assertRelease(documentId.trim().length > 0, "The active RT/PT technique has no Document ID.");
  return documentId;
}

(async () => {
  ensureBuildOutputExists();

  const server = await startStaticServer();
  const browser = await launchSmokeBrowser();
  const errors = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });

    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`console: ${message.text()}`);
      }
    });

    // Exercise the production renderer through its desktop-local path without
    // adding an authentication bypass to application code. This object exists
    // only inside the isolated Playwright page and mirrors the safe preload API.
    // (The dialog blocks the toolbar and is modal — `allowClose=false` — so
    // Escape/click-outside don't work in production; only profile selection does.)
    await page.addInitScript(() => {
      const activeLicenseStatus = {
        status: "active",
        active: true,
        product: "rt-pt-inspector",
        appId: "com.amitay.rtptinspector",
        installationId: "7f9ddf52-b747-4d9e-a61e-6d04d9d9ae6f",
        reason: null,
        message: "License is active.",
        license: {
          schemaVersion: 1,
          product: "rt-pt-inspector",
          appId: "com.amitay.rtptinspector",
          licenseId: "b00fe114-c901-44b9-b940-f92a09aa96d0",
          customer: "Release smoke test",
          installationId: "7f9ddf52-b747-4d9e-a61e-6d04d9d9ae6f",
          issuedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: null,
          edition: "professional",
          features: ["rt-film", "rt-digital", "pt"],
        },
      };
      const rtptLicense = {
        getStatus: async () => activeLicenseStatus,
        activate: async () => activeLicenseStatus,
        deactivate: async () => ({
          ...activeLicenseStatus,
          status: "missing",
          active: false,
          reason: "license-deactivated",
          message: "No license is activated for this installation.",
          license: undefined,
        }),
      };
      const electronBridge = {
        isElectron: true,
        platform: "win32",
        rtptLicense,
        getAppVersion: async () => "smoke-test",
        checkForUpdates: async () => undefined,
        forceCheckUpdates: async () => undefined,
        downloadUpdate: async () => undefined,
        installUpdate: async () => ({ started: false }),
        getUpdateInfo: async () => ({ updateAvailable: false }),
        openExternal: async () => ({ success: true }),
        onUpdateStatus: () => undefined,
        removeUpdateListener: () => undefined,
        confirmAppClose: async () => ({ success: true }),
        onAppCloseRequested: () => undefined,
        removeAppCloseRequested: () => undefined,
        onPrepareForUpdateInstall: () => undefined,
        removePrepareForUpdateInstall: () => undefined,
        confirmUpdateInstallReady: async () => ({ acknowledged: true }),
      };
      Object.defineProperty(window, "electron", {
        configurable: true,
        value: electronBridge,
      });
      Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: electronBridge,
      });

      const now = new Date().toISOString();
      const profile = {
        id: "smoke-test-profile",
        name: "Smoke Tester",
        initials: "ST",
        certificationLevel: "Level II",
        certificationNumber: "SMOKE-001",
        certifyingOrganization: "ASNT",
        createdAt: now,
        updatedAt: now,
        isDefault: true,
      };
      const storage = {
        profiles: [profile],
        currentProfileId: profile.id,
        rememberSelection: true,
        lastUsedProfileId: profile.id,
      };
      try {
        localStorage.setItem("rtpt_inspector_profiles", JSON.stringify(storage));
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(750);
    await page.keyboard.press("Space").catch(() => {});
    await page.waitForTimeout(1500);

    await assertNoCrash(page, errors, "initial app load");

    await page.waitForFunction(() => {
      const text = document.body.innerText || "";
      return /RT Film|RT Digital|Export|Validate/i.test(text);
    }, { timeout: 20_000 });

    // ── Complete the blocking session-profile selection ──
    // The first-launch dialog intentionally cannot be dismissed without an
    // inspector selection, so confirm the seeded smoke-test profile via the
    // current CTA while retaining compatibility with the legacy label.
    const profileConfirmation = page.getByRole("button", { name: /^(?:Use Inspector|Continue)$/i });
    if (await profileConfirmation.isVisible().catch(() => false)) {
      await profileConfirmation.click();
      await page.waitForTimeout(500);
    }
    await assertNoCrash(page, errors, "confirming profile selection");

    await clickFirstVisible(page, [
      page.getByRole("button", { name: /^Export$/i }),
      page.getByRole("button", { name: /Export PDF/i }),
      page.getByText("Export PDF", { exact: false }),
    ], "Export action");
    await page.waitForTimeout(900);
    await assertNoCrash(page, errors, "exporting an uncontrolled draft PDF");

    await page.getByRole("button", { name: /^Validate$/i }).click({ timeout: 10_000 });
    await page.waitForTimeout(700);
    await assertNoCrash(page, errors, "validating the active technique");
    const readinessDialog = page.getByRole("dialog", { name: /^Technique readiness$/i });
    if (await readinessDialog.isVisible().catch(() => false)) {
      await readinessDialog.getByRole("button", { name: /^Close$/i }).first().click({ timeout: 10_000 });
      await page.waitForTimeout(300);
    }

    const filmDocumentId = await readActiveDocumentId(page);

    await page.getByRole("button", { name: /^RT Digital$/i }).click({ timeout: 10_000 });
    await page.waitForTimeout(700);
    await assertNoCrash(page, errors, "RT Digital workspace switch");

    const digitalDocumentId = await readActiveDocumentId(page);
    assertRelease(
      digitalDocumentId !== filmDocumentId,
      "Switching from RT Film to RT Digital reused the previous document identity.",
    );

    await page.locator('[role="tab"][title^="Acquisition Plan"]').click({ timeout: 10_000 });
    await page.getByRole("button", { name: /^Add Acquisition$/i }).click({ timeout: 10_000 });
    await page.getByRole("button", { name: /^Duplicate$/i }).click({ timeout: 10_000 });
    assertRelease(
      await page.getByText(/^Acquisition \d+$/i).count() === 2,
      "Digital acquisition add/duplicate did not create two planned acquisitions.",
    );
    await page.getByRole("button", { name: /^Delete acquisition 2$/i }).click({ timeout: 10_000 });
    assertRelease(
      await page.getByText(/^Acquisition \d+$/i).count() === 1,
      "Digital acquisition delete did not leave exactly one planned acquisition.",
    );

    let dirtySwitchConfirmed = false;
    page.once("dialog", async (dialog) => {
      dirtySwitchConfirmed = dialog.type() === "confirm";
      await dialog.accept();
    });

    await page.getByRole("button", { name: /^PT$/i }).click({ timeout: 10_000 });
    const inAppMethodConfirmation = page.getByRole("button", { name: /^Discard changes (?:&|and) start /i });
    if (await inAppMethodConfirmation.isVisible().catch(() => false)) {
      dirtySwitchConfirmed = true;
      await inAppMethodConfirmation.click({ timeout: 10_000 });
    }
    await page.waitForTimeout(700);
    await assertNoCrash(page, errors, "PT workspace switch");

    assertRelease(dirtySwitchConfirmed, "Dirty RT Digital changes did not require confirmation before switching method.");
    const ptDocumentId = await readActiveDocumentId(page);
    assertRelease(
      ptDocumentId !== digitalDocumentId,
      "Switching from RT Digital to PT reused the previous document identity.",
    );

    console.log("Release smoke passed: RT/PT production UI, PDF export, validation, fresh method identities, dirty-switch confirmation, and acquisition CRUD.");
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
})().catch((error) => {
  console.error(`RELEASE SMOKE FAILED: ${error.message}`);
  process.exit(1);
});

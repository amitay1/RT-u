#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright is required for release smoke tests.");
  console.error("Install dependencies, then run: npx playwright install chromium");
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const screenshotDir = path.join(repoRoot, "logs", "release-smoke");
const externalBaseUrl = process.env.SMOKE_BASE_URL || "";

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

function ensureDistExists() {
  if (externalBaseUrl) return;
  const indexHtml = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error("dist/index.html not found. Run npm run build before npm run smoke:release.");
  }
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
    let filePath = path.join(distDir, safePath);

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
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

(async () => {
  ensureDistExists();

  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
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

    // Seed an inspector profile so the Session Profile dialog auto-dismisses.
    // (The dialog blocks the toolbar and is modal — `allowClose=false` — so
    // Escape/click-outside don't work in production; only profile selection does.)
    await page.addInitScript(() => {
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
        localStorage.setItem("scanmaster_inspector_profiles", JSON.stringify(storage));
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
      return /File|Export|Setup|Scan Params|Technique/i.test(text);
    }, { timeout: 20_000 });

    // ── Dismiss any blocking modal (Session Profile dialog, etc.) ──
    // The "Choose Session Profile" dialog auto-opens on first launch and
    // covers the Toolbar. Try, in order: Continue (legacy), Escape, then
    // any explicit Close affordance. The dialog accepts Escape.
    const profileContinue = page.getByRole("button", { name: /^Continue$/i });
    if (await profileContinue.isVisible().catch(() => false)) {
      await profileContinue.click();
      await page.waitForTimeout(500);
    } else {
      // Modern dialog: "Choose Session Profile" → press Escape to dismiss.
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);

      // Fallback: explicit Close (✕) button inside any visible dialog.
      const closeBtn = page.locator('[role="dialog"] button[aria-label*="Close" i], [role="dialog"] button:has-text("Close")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    await assertNoCrash(page, errors, "closing profile selection");

    await clickFirstVisible(page, [
      page.getByRole("button", { name: /^Export$/i }),
      page.getByRole("button", { name: /Export PDF/i }),
      page.getByText("Export PDF", { exact: false }),
    ], "Export action");
    await page.waitForTimeout(500);
    await assertNoCrash(page, errors, "opening export dialog");

    await page.getByText(/Compliance Check Passed|Warning\(s\)|Critical Issue\(s\)/i).click({ timeout: 10_000 });
    await page.waitForTimeout(900);
    await assertNoCrash(page, errors, "opening compliance check");

    await page.getByRole("button", { name: /Re-check/i }).click({ timeout: 10_000 });
    await page.waitForTimeout(900);
    await assertNoCrash(page, errors, "running compliance re-check");

    await page.goto(`${server.baseUrl}/standards`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Space").catch(() => {});
    await page.waitForTimeout(500);
    await assertNoCrash(page, errors, "standards route");

    console.log("Release smoke passed: production UI loaded, export compliance flow opened, and re-check completed.");
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
})().catch((error) => {
  console.error(`RELEASE SMOKE FAILED: ${error.message}`);
  process.exit(1);
});

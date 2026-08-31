import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { resolveStandaloneLicenseDataDirectory } from "./rtptLicenseRuntime";

/**
 * File-based unified storage for the standalone browser/PWA surface.
 * Mirrors the desktop shell's /api/unified-storage API (electron/main.cjs) so
 * Chrome and Edge on the same machine share saved cards, settings, and
 * profiles instead of holding separate localStorage copies. Access is
 * license-gated by the standalone license runtime, matching the desktop shell.
 */
const VALID_UNIFIED_STORAGE_KEYS = new Set([
  "rtpt_inspector_saved_cards",
  "rtpt_inspector_settings",
  "rtpt_inspector_profiles",
  "rtpt_inspector_first_run_completed",
  "rtpt_inspector_first_run_data",
  "rtpt_inspector_user_id",
]);

export function registerUnifiedStorageRoutes(
  app: Express,
  { dataDir = resolveStandaloneLicenseDataDirectory() }: { dataDir?: string } = {},
): void {
  const unifiedStorageDir = path.join(dataDir, "unified-storage");
  const getUnifiedStorageFile = (key: string) => path.join(unifiedStorageDir, `${key}.json`);

  app.get("/api/unified-storage/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;
    if (!VALID_UNIFIED_STORAGE_KEYS.has(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    const filePath = getUnifiedStorageFile(key);
    try {
      const data = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, "utf8"))
        : null;
      return res.json({ data });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;
    if (!VALID_UNIFIED_STORAGE_KEYS.has(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    try {
      fs.mkdirSync(unifiedStorageDir, { recursive: true });
      fs.writeFileSync(
        getUnifiedStorageFile(key),
        JSON.stringify(req.body?.data ?? null, null, 2),
      );
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;
    if (!VALID_UNIFIED_STORAGE_KEYS.has(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    try {
      const filePath = getUnifiedStorageFile(key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

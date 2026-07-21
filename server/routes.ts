import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { z } from "zod";
import { DbStorage } from "./storage";
import logger from "./utils/logger";
import { insertTechniqueSheetSchema, organizations, desktopLicenses, licenseActivations } from "../shared/schema";
import type { CadJobDTO } from "../shared/drawingSpec";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import crypto from "crypto";
// import { registerOrganizationRoutes } from "./routes/organizations"; // Disabled - tables don't exist yet
import { registerEquipmentRoutes } from "./routes/equipment";

const storage = new DbStorage();

// Mock organization ID for development mode
const MOCK_ORG_ID = "11111111-1111-1111-1111-111111111111";

// Track whether the database is properly initialized
let isDatabaseReady = false;
let mockOrgExists = false;

// Ensure the mock organization exists in the database for development
async function ensureMockOrganization() {
  try {
    // Check if mock org already exists
    const existing = await db.select().from(organizations).where(eq(organizations.id, MOCK_ORG_ID));

    if (existing.length === 0) {
      // Create the mock organization with a specific ID
      // Use ON CONFLICT on both id and slug to handle any constraint violations
      await db.execute(`
        INSERT INTO organizations (id, name, slug, plan, is_active, max_users, max_sheets, settings)
        VALUES ('${MOCK_ORG_ID}', 'Default Organization', 'default', 'free', true, 999, 99999, '{}')
        ON CONFLICT (id) DO UPDATE SET name = 'Default Organization'
      `);
      logger.info('✅ Created mock organization for development');
    } else {
      logger.info('✅ Mock organization already exists');
    }
    isDatabaseReady = true;
    mockOrgExists = true;
  } catch (error: any) {
    // If it's a unique constraint on slug, try to update instead
    if (error.code === '23505') {
      try {
        await db.execute(`
          UPDATE organizations SET id = '${MOCK_ORG_ID}' WHERE slug = 'default'
        `);
        logger.info('✅ Updated existing default organization');
        isDatabaseReady = true;
        mockOrgExists = true;
      } catch (updateError) {
        logger.warn('⚠️ Could not update default organization:', updateError);
        isDatabaseReady = false;
        mockOrgExists = false;
      }
    } else {
      logger.warn('⚠️ Could not ensure mock organization (this is OK if migrations have not been run):', error.message || error);
      isDatabaseReady = false;
      mockOrgExists = false;
    }
  }
}

// Initialize mock organization on module load
ensureMockOrganization().catch(err => {
  logger.warn('Mock organization setup deferred:', err.message);
  isDatabaseReady = false;
  mockOrgExists = false;
});

// Minimal validation for CAD jobs coming from the client. We deliberately
// keep this fairly generic – the Python side performs deeper validation
// of operations.
const cadJobSchema = z.object({
  solid: z.object({
    id: z.string(),
    operations: z.array(
      z.object({
        type: z.string(),
      }),
    ).nonempty(),
  }),
  drawing: z.object({
    page_title: z.string(),
    template_path: z.string(),
    views: z.array(
      z.object({
        id: z.string(),
        direction: z.tuple([z.number(), z.number(), z.number()]),
        is_section: z.boolean().optional(),
        section_normal: z.tuple([z.number(), z.number(), z.number()]).nullable().optional(),
        scale: z.number().optional(),
      }),
    ),
    dimensions: z.array(
      z.object({
        view_id: z.string(),
        kind: z.string(),
        label: z.string(),
        edges: z.array(z.string()).optional(),
      }),
    ).optional(),
  }),
  output_pdf: z.string().optional(),
  output_svg: z.string().optional(),
});

// Enhanced schema for ScanMaster CAD Engine with calibration support
const cadSolidJobSchema = z.object({
  shapeType: z.string(),
  parameters: z.record(z.any()).default({}),
  calibrationData: z.object({
    // נתונים מטאב Calibration
    fbhSizes: z.string().optional(),
    metalTravelDistance: z.union([z.number(), z.string().transform(val => Number(val))]).optional(),
    blockDimensions: z.object({
      L: z.number().min(1, "Block length must be positive"),
      W: z.number().min(1, "Block width must be positive"),
      H: z.number().min(1, "Block height must be positive"),
    }).optional(),
    standardType: z.string().optional(),

    // נתונים מטאב Inspection Setup
    material: z.string().optional(),
    partThickness: z.union([z.number(), z.string().transform(val => Number(val))]).optional(),
    partType: z.string().optional(),
    isHollow: z.boolean().optional(),
    acceptanceClass: z.string().optional(),

    // נתונים מטאב Equipment
    probeType: z.string().optional(),
    frequency: z.union([z.number(), z.string().transform(val => Number(val))]).optional(),
    inspectionType: z.string().optional(),

    // Scanning directions visualization
    includeScanDirections: z.boolean().optional(),
  }).optional(),
  metadata: z.object({
    userId: z.string().optional(),
    projectId: z.string().optional(),
    partName: z.string().optional(),
  }).optional(),
});

// Enhanced auth middleware with org_id support (optional)
const mockAuth = (req: any, res: any, next: any) => {
  // For now, use a mock user ID (valid UUID format for development)
  // In production, this would validate JWT and extract user ID
  req.userId = req.headers["x-user-id"] || "00000000-0000-0000-0000-000000000000";
  req.orgId = req.headers["x-org-id"] || null;

  next();
};

// Helper to safely read auth properties from the (augmented) Express request
// without upsetting the TypeScript type system.
const getAuthContext = (req: Request): { userId: string; orgId?: string } => {
  const anyReq = req as any;
  const userId = String(anyReq.userId || "00000000-0000-0000-0000-000000000000");
  const rawOrgId = anyReq.orgId;
  const orgId = rawOrgId != null && rawOrgId !== "" ? String(rawOrgId) : undefined;
  return { userId, orgId };
};

export function registerRoutes(app: Express) {
  // Serve generated CAD PDFs from a dedicated folder.
  const cadOutputDir = path.join(process.cwd(), "cad-output");
  app.use("/cad-output", express.static(cadOutputDir));

  // Serve generated 3D STEP files from the ScanMaster CAD Engine.
  const cad3dOutputRoot = path.join(process.cwd(), "cad-3d-output");
  app.use("/cad-3d-output", express.static(cad3dOutputRoot));

  // Register organization routes - DISABLED until migrations are run
  // registerOrganizationRoutes(app);

  // Register equipment tracking routes
  registerEquipmentRoutes(app);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ==========================================================================
  // UNIFIED STORAGE API
  // Provides cross-browser/Electron data persistence via local files
  // All browsers (Chrome, Edge) and Electron share the same data
  // ==========================================================================

  const unifiedStorageDir = path.join(process.cwd(), "data", "unified-storage");

  // Ensure unified storage directory exists
  if (!fs.existsSync(unifiedStorageDir)) {
    fs.mkdirSync(unifiedStorageDir, { recursive: true });
    logger.info("Created unified storage directory:", unifiedStorageDir);
  }

  // Valid storage keys (whitelist for security)
  const VALID_STORAGE_KEYS = [
    "rtpt_inspector_saved_cards",
    "rtpt_inspector_settings",
    "rtpt_inspector_profiles",
    "rtpt_inspector_first_run_completed",
    "rtpt_inspector_first_run_data",
    "rtpt_inspector_user_id",
  ];

  function isValidStorageKey(key: string): boolean {
    return VALID_STORAGE_KEYS.includes(key);
  }

  function getStorageFilePath(key: string): string {
    return path.join(unifiedStorageDir, `${key}.json`);
  }

  // Health check for unified storage
  app.get("/api/unified-storage/health", (req, res) => {
    res.json({ status: "ok", storageDir: unifiedStorageDir });
  });

  // Get data for a specific key
  app.get("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;

    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    const filePath = getStorageFilePath(key);

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        res.json({ data, timestamp: fs.statSync(filePath).mtime.toISOString() });
      } else {
        res.json({ data: null, timestamp: null });
      }
    } catch (error: any) {
      logger.error(`Failed to read unified storage key ${key}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set data for a specific key
  app.post("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;
    const { data } = req.body;

    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    const filePath = getStorageFilePath(key);

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      logger.info(`Unified storage updated: ${key}`);
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
      logger.error(`Failed to write unified storage key ${key}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete data for a specific key
  app.delete("/api/unified-storage/:key", (req, res) => {
    const { key } = req.params;

    if (!isValidStorageKey(key)) {
      return res.status(400).json({ error: "Invalid storage key" });
    }

    const filePath = getStorageFilePath(key);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Unified storage deleted: ${key}`);
      }
      res.json({ success: true });
    } catch (error: any) {
      logger.error(`Failed to delete unified storage key ${key}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all stored keys
  app.get("/api/unified-storage", (req, res) => {
    try {
      const files = fs.readdirSync(unifiedStorageDir);
      const keys = files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
      res.json({ keys });
    } catch (error: any) {
      logger.error("Failed to list unified storage keys:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================================================
  // END UNIFIED STORAGE API
  // ==========================================================================

  // Temporary mock organizations endpoint (until database migrations are run)
  // Use the module-level MOCK_ORG_ID constant (ensured to exist in DB)
  
  app.get("/api/organizations", mockAuth, async (req, res) => {
    // Only return mock organization if database is ready and org exists
    // This prevents auto-save from trying to save when DB isn't set up
    if (!isDatabaseReady || !mockOrgExists) {
      logger.warn('⚠️ /api/organizations: Database not ready or mock org not created. Returning empty list to disable auto-save.');
      return res.json([]);
    }

    // Double-check that the org actually exists in DB (in case of race conditions)
    try {
      const existing = await db.select().from(organizations).where(eq(organizations.id, MOCK_ORG_ID));
      if (existing.length === 0) {
        logger.warn('⚠️ /api/organizations: Mock org not found in DB. Returning empty list.');
        mockOrgExists = false;
        return res.json([]);
      }
    } catch (error: any) {
      logger.warn('⚠️ /api/organizations: DB check failed:', error.message);
      isDatabaseReady = false;
      return res.json([]);
    }

    res.json([
      {
        id: MOCK_ORG_ID,
        name: "Default Organization",
        slug: "default",
        plan: "free",
        isActive: true,
        userRole: "owner"
      }
    ]);
  });

  app.get("/api/organizations/:id/role", mockAuth, (req, res) => {
    res.json({ role: "owner" });
  });

  // Inspector Profiles Routes
  app.get("/api/inspector-profiles", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      logger.info('Fetching inspector profiles for user:', userId, 'org:', orgId || '(none)');
      const profiles = await storage.getInspectorProfilesByUserId(userId, orgId);
      res.json(profiles);
    } catch (error: any) {
      logger.error('Failed to fetch inspector profiles:', error);
      // Return empty array for any database issues
      // This allows the client to fallback to localStorage gracefully
      logger.warn('Database error, returning empty array for profiles');
      return res.json([]);
    }
  });

  app.get("/api/inspector-profiles/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const profile = await storage.getInspectorProfileById(req.params.id, orgId);
      if (!profile) {
        return res.status(404).json({ error: "Inspector profile not found" });
      }
      // Check user access
      if (profile.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && profile.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }
      res.json(profile);
    } catch (error: any) {
      logger.error('Failed to fetch inspector profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/inspector-profiles", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);

      logger.info('Creating inspector profile:', {
        userId,
        orgId,
        body: req.body,
      });

      const profile = await storage.createInspectorProfile({
        ...req.body,
        userId,
        orgId,
      });
      res.status(201).json(profile);
    } catch (error: any) {
      logger.error('Failed to create inspector profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/inspector-profiles/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const existing = await storage.getInspectorProfileById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ error: "Inspector profile not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && existing.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }

      const profile = await storage.updateInspectorProfile(req.params.id, req.body, orgId);
      res.json(profile);
    } catch (error: any) {
      logger.error('Failed to update inspector profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/inspector-profiles/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const existing = await storage.getInspectorProfileById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ error: "Inspector profile not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && existing.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }

      await storage.deleteInspectorProfile(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Failed to delete inspector profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Technique Sheets Routes
  app.get("/api/technique-sheets", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const sheets = await storage.getTechniqueSheetsByUserId(userId, orgId);
      res.json(sheets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/technique-sheets/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const sheet = await storage.getTechniqueSheetById(req.params.id, orgId);
      if (!sheet) {
        return res.status(404).json({ error: "Technique sheet not found" });
      }
      // Check both user and org access
      if (sheet.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && sheet.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }
      res.json(sheet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/technique-sheets", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      
      // Debug logging
      logger.info('📥 Technique sheet POST request:');
      logger.info('  userId:', userId);
      logger.info('  orgId from headers:', orgId || '(null - no organization)');
      logger.info('  body keys:', Object.keys(req.body));
      logger.info('  body.orgId:', req.body.orgId || '(not in body)');
      logger.info('  sheetName:', req.body.sheetName);
      logger.info('  standard:', req.body.standard);
      logger.info('  data type:', typeof req.body.data);
      
      // Prepare data - explicitly exclude any orgId from body, use only from headers
      const { orgId: bodyOrgId, ...bodyWithoutOrgId } = req.body;
      const sheetData: any = {
        ...bodyWithoutOrgId,
        userId,
      };
      
      // Only include orgId if it's a valid UUID from headers (not empty string)
      if (orgId && orgId.trim() !== '') {
        sheetData.orgId = orgId;
      } else {
        sheetData.orgId = null; // Explicitly set to null for empty/missing orgId
      }
      
      logger.info('  Final sheetData.orgId:', sheetData.orgId || '(null)');
      
      const data = insertTechniqueSheetSchema.parse(sheetData);
      const sheet = await storage.createTechniqueSheet(data, orgId);
      res.status(201).json(sheet);
    } catch (error: any) {
      if (error.name === 'ZodError' || error instanceof z.ZodError) {
        logger.error('❌ Technique sheet validation failed:');
        const errors = error.errors || error.issues || [];
        errors.forEach((err: any) => {
          logger.error(`  - Path: ${err.path?.join('.') || 'unknown'}, Code: ${err.code}, Message: ${err.message}`);
        });
        return res.status(400).json({ error: "Invalid data", details: errors });
      }
      logger.error('❌ Technique sheet creation failed:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  app.patch("/api/technique-sheets/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const existing = await storage.getTechniqueSheetById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ error: "Technique sheet not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && existing.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }

      const sheet = await storage.updateTechniqueSheet(req.params.id, req.body, orgId);
      res.json(sheet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/technique-sheets/:id", mockAuth, async (req, res) => {
    try {
      const { userId, orgId } = getAuthContext(req);
      const existing = await storage.getTechniqueSheetById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ error: "Technique sheet not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (orgId && existing.orgId !== orgId) {
        return res.status(403).json({ error: "Forbidden - wrong organization" });
      }

      await storage.deleteTechniqueSheet(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CAD drawing generation route - bridges the JSON spec to the Python
  // job_runner. The client can either build the CadJobDTO directly or use
  // the helpers in @shared/drawingSpec.
  app.post("/api/cad/drawings", mockAuth, async (req: Request, res: Response) => {
    try {
      const parsed = cadJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid CAD job payload",
          details: parsed.error.flatten(),
        });
      }

      const job = parsed.data as unknown as CadJobDTO;

      // Always prefer a server-side template path if provided. The frontend
      // does not know the filesystem layout of the backend, so we override any
      // placeholder value sent from the client with TECHDRAW_TEMPLATE_PATH when
      // available.
      const templatePathEnv = process.env.TECHDRAW_TEMPLATE_PATH;
      if (templatePathEnv && templatePathEnv.trim().length > 0) {
        job.drawing.template_path = templatePathEnv;
      }

      // Always control output paths on the server side for security.
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userId = String((req as any).userId || "anonymous");

      const userDir = path.join(cadOutputDir, userId);
      const outputPdfPath = path.join(userDir, `${jobId}.pdf`);

      const jobForPython: CadJobDTO = {
        ...job,
        output_pdf: outputPdfPath,
        output_svg: job.output_svg ? path.join(userDir, `${jobId}.svg`) : undefined,
      };

      // Allow the Python drawing engine to live outside this Node project.
      // If CAD_ENGINE_ROOT is set, we use that as the base directory;
      // otherwise we fall back to the local ./drawing-engine folder.
      const engineRoot = process.env.CAD_ENGINE_ROOT
        ? path.resolve(process.env.CAD_ENGINE_ROOT)
        : path.join(process.cwd(), "drawing-engine");

      const scriptPath = path.join(engineRoot, "job_runner.py");

      const pythonBin = process.env.PYTHON_BIN || "python";

      const pythonResult = await new Promise<any>((resolve, reject) => {
        const child = spawn(pythonBin, [scriptPath], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("error", (err) => {
          reject(err);
        });

        child.on("close", (code) => {
          if (code !== 0) {
            return reject(new Error(`Python exited with code ${code}: ${stderr}`));
          }
          try {
            const parsedResult = JSON.parse(stdout || "{}");
            resolve(parsedResult);
          } catch (err: any) {
            reject(new Error(`Failed to parse Python output: ${err.message}`));
          }
        });

        child.stdin.write(JSON.stringify(jobForPython));
        child.stdin.end();
      });

      const publicPdfUrl = `/cad-output/${userId}/${jobId}.pdf`;

      res.json({
        pdfUrl: publicPdfUrl,
        jobId,
        pythonResult,
      });
    } catch (error: any) {
      logger.error("Failed to generate CAD drawing", {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to generate CAD drawing" });
    }
  });

  // Standards Routes
  app.get("/api/standards", async (req, res) => {
    try {
      const standards = await storage.getAllStandards();
      res.json(standards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/standards/:id", async (req, res) => {
    try {
      const standard = await storage.getStandardById(req.params.id);
      if (!standard) {
        return res.status(404).json({ error: "Standard not found" });
      }
      res.json(standard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 3D solid generation route using the external ScanMaster CAD Engine.
  // This produces STEP files and is designed to work with the
  // integration_examples/generate_drawing.py (or similar) entrypoint.
  app.post("/api/cad/engine/parts", mockAuth, async (req: Request, res: Response) => {
    try {
      // Debug logging
      logger.info("Received CAD solid generation request", {
        body: req.body,
        userId: (req as any).userId,
      });

      const parsed = cadSolidJobSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.error("CAD solid job validation failed", {
          error: parsed.error.flatten(),
          body: req.body,
          fieldErrors: parsed.error.flatten().fieldErrors,
        });
        console.error("🚨 Validation Details:", JSON.stringify(parsed.error.flatten(), null, 2));
        console.error("🚨 Received Body:", JSON.stringify(req.body, null, 2));
        
        return res.status(400).json({
          error: "Invalid CAD solid job payload",
          details: parsed.error.flatten(),
          fieldErrors: parsed.error.flatten().fieldErrors,
          receivedBody: req.body,
        });
      }

      const cadScript = process.env.SCANMASTER_CAD_SCRIPT;
      if (!cadScript || cadScript.trim().length === 0) {
        return res.status(500).json({
          error: "SCANMASTER_CAD_SCRIPT environment variable is not set. Point it to your generate_drawing.py or python_api_integration.py entrypoint.",
        });
      }

      const pythonBin = process.env.PYTHON_BIN || "python";

      const userId = String((req as any).userId || "anonymous");
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const cad3dOutputRoot = path.join(process.cwd(), "cad-3d-output");
      const cad3dUserDir = path.join(cad3dOutputRoot, userId);
      const jobDir = path.join(process.cwd(), "cad-engine-jobs");

      fs.mkdirSync(cad3dUserDir, { recursive: true });
      fs.mkdirSync(jobDir, { recursive: true });

      const outputStepPath = path.join(cad3dUserDir, `${jobId}.step`);

      const jobPayload = {
        jobId,
        engine: "ScanMaster CAD Engine v3.0",
        shapeType: parsed.data.shapeType,
        parameters: parsed.data.parameters,
        calibrationData: parsed.data.calibrationData,
        metadata: parsed.data.metadata,
        outputFormat: "step",
        outputPath: outputStepPath,
      };

      const jobFilePath = path.join(jobDir, `${jobId}.json`);
      await fs.promises.writeFile(jobFilePath, JSON.stringify(jobPayload, null, 2), "utf8");

      const pythonResult = await new Promise<any>((resolve, reject) => {
        const child = spawn(pythonBin, [cadScript, "--json", jobFilePath], {
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("error", (err) => {
          reject(err);
        });

        child.on("close", (code) => {
          // Debug logging
          logger.info("ScanMaster CAD Engine process completed", {
            exitCode: code,
            stdout: stdout,
            stderr: stderr
          });

          // Try to parse stdout as JSON - look for JSON at the end of stdout
          let parsedOut;
          try {
            // Look for JSON at the end of stdout (after any progress messages)
            // Extract the last line that contains a complete JSON object
            const lines = stdout.trim().split('\n');
            let jsonLine = null;
            
            // Search from the end for a line that starts with { and contains "success"
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.includes('"success"')) {
                jsonLine = line;
                break;
              }
            }
            
            if (jsonLine) {
              parsedOut = JSON.parse(jsonLine);
              logger.info("Parsed stdout JSON from line", { parsedOut });
            } else {
              // Try parsing the entire stdout
              parsedOut = stdout.trim() ? JSON.parse(stdout) : {};
              logger.info("Parsed entire stdout as JSON", { parsedOut });
            }
          } catch (parseError) {
            logger.warn("Failed to parse stdout as JSON", { stdout: stdout.substring(0, 500), parseError });
            parsedOut = { rawOutput: stdout };
          }

          logger.info("Debug: Checking success conditions");
          console.log("🔍 DEBUG - parsedOut.success:", parsedOut.success);
          console.log("🔍 DEBUG - typeof success:", typeof parsedOut.success);
          console.log("🔍 DEBUG - exit code:", code);
          console.log("🔍 DEBUG - parsedOut keys:", Object.keys(parsedOut || {}));
          console.log("🔍 DEBUG - parsedOut sample:", JSON.stringify(parsedOut).substring(0, 300));

          // If we have a success indicator in the JSON output, treat as success regardless of exit code
          if (parsedOut.success === true) {
            logger.info("CAD engine reported success, ignoring exit code", { exitCode: code });
            return resolve(parsedOut);
          }

          // Check if we have output that looks successful (outputPath exists)
          if (parsedOut.outputPath) {
            const fileExists = fs.existsSync(parsedOut.outputPath);
            logger.info("Checking output file existence", { 
              outputPath: parsedOut.outputPath, 
              fileExists,
              exitCode: code 
            });
            
            if (fileExists) {
              logger.info("CAD engine created output file, treating as success", { outputPath: parsedOut.outputPath, exitCode: code });
              parsedOut.success = true; // Mark as success
              return resolve(parsedOut);
            }
          }

          // If no success indicator and non-zero exit code, treat as error
          if (code !== 0) {
            logger.error("CAD engine failed", { 
              exitCode: code, 
              stderr, 
              parsedOut,
              stdoutLength: stdout.length,
              stderrLength: stderr.length
            });
            return reject(new Error(`ScanMaster CAD Engine exited with code ${code}: ${stderr || 'No error details'}`));
          }

          // If zero exit code but no explicit success, return the parsed output
          logger.info("CAD engine completed with zero exit code", { parsedOut });
          resolve(parsedOut);
        });
      });

      const publicStepUrl = `/cad-3d-output/${userId}/${jobId}.step`;

      return res.json({
        stepUrl: publicStepUrl,
        jobId,
        engineResult: pythonResult,
      });
    } catch (error: any) {
      logger.error("Error while generating CAD solid via ScanMaster engine", {
        error: error?.message || String(error),
      });

      return res.status(500).json({
        error: "Failed to generate CAD solid via ScanMaster engine",
      });
    }
  });

  // User Standards Access Routes
  app.get("/api/user-standards", mockAuth, async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const accessRecords = await storage.getUserStandardAccess(userId);
      
      // Filter out expired subscriptions
      const now = new Date();
      const activeStandards = accessRecords.filter(access => 
        !access.expiryDate || new Date(access.expiryDate) > now
      );

      const hasActiveSubscription = activeStandards.some(
        access => access.accessType === 'subscription'
      );

      res.json({
        standards: activeStandards,
        has_active_subscription: hasActiveSubscription,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate Standard Access
  app.post("/api/validate-standard-access", mockAuth, async (req, res) => {
    try {
      const { standardCode } = req.body;

      if (!standardCode || typeof standardCode !== 'string') {
        return res.status(400).json({ 
          hasAccess: false,
          error: 'Invalid or missing standard code' 
        });
      }

      // Validate standard code format
      if (standardCode.length > 50 || !/^[A-Za-z0-9-]+$/.test(standardCode)) {
        return res.status(400).json({ 
          hasAccess: false,
          error: 'Invalid standard code format' 
        });
      }

      const standard = await storage.getStandardByCode(standardCode);
      
      if (!standard) {
        return res.status(404).json({ 
          hasAccess: false,
          error: 'Standard not found' 
        });
      }

      // Free standards are always accessible
      if (standard.isFree) {
        return res.json({ 
          hasAccess: true,
          accessType: 'free',
          expiryDate: null
        });
      }

      const { userId } = getAuthContext(req);
      const hasAccess = await storage.hasStandardAccess(userId, standardCode);
      
      if (!hasAccess) {
        return res.json({ 
          hasAccess: false,
          accessType: null,
          expiryDate: null
        });
      }

      res.json({ 
        hasAccess: true,
        accessType: 'purchased',
        expiryDate: null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lemon Squeezy Webhook
  app.post("/api/webhooks/lemon-squeezy", async (req, res) => {
    try {
      const event = req.body;
      
      const customData = event.meta?.custom_data;
      const userId = customData?.user_id;
      const standardId = customData?.standard_id;
      const priceType = customData?.price_type;

      // Validate required webhook data
      if (!userId || !standardId) {
        return res.status(400).json({ error: 'Missing required data' });
      }

      // Validate UUID formats
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId) || !uuidRegex.test(standardId)) {
        return res.status(400).json({ error: 'Invalid data format' });
      }

      // Handle different event types
      switch (event.meta.event_name) {
        case 'order_created': {
          const isSubscription = priceType === 'monthly' || priceType === 'annual';
          let expiryDate = null;

          if (isSubscription) {
            const now = new Date();
            expiryDate = priceType === 'monthly'
              ? new Date(now.setMonth(now.getMonth() + 1))
              : new Date(now.setFullYear(now.getFullYear() + 1));
          }

          await storage.grantStandardAccess({
            userId,
            standardId,
            accessType: isSubscription ? 'subscription' : 'purchased',
            purchaseDate: new Date(),
            expiryDate: expiryDate || undefined,
            isActive: true,
            lemonSqueezyOrderId: event.data.id,
          });

          await storage.createPurchaseHistory({
            userId,
            standardId,
            bundleId: undefined,
            purchaseType: priceType,
            amount: String(event.data.attributes.total / 100),
            status: 'completed',
          });
          break;
        }

        case 'subscription_cancelled':
          // Deactivate access logic would go here
          break;

        case 'subscription_payment_success':
          // Renewal logic would go here
          break;
      }

      res.json({ received: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create Lemon Squeezy Checkout
  app.post("/api/create-checkout", mockAuth, async (req, res) => {
    try {
      const { standardId, priceType } = req.body;

      // Validate inputs
      if (!standardId || typeof standardId !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing standardId' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(standardId)) {
        return res.status(400).json({ error: 'Invalid UUID format for standardId' });
      }

      const validPriceTypes = ['one_time', 'monthly', 'annual'];
      if (!priceType || !validPriceTypes.includes(priceType)) {
        return res.status(400).json({ 
          error: 'Invalid price type. Must be one_time, monthly, or annual' 
        });
      }

      const standard = await storage.getStandardById(standardId);
      
      if (!standard) {
        return res.status(404).json({ error: 'Standard not found' });
      }

      // Get the appropriate variant ID based on price type
      let variantId;
      switch (priceType) {
        case 'one_time':
          variantId = standard.lemonSqueezyVariantIdOnetime;
          break;
        case 'monthly':
          variantId = standard.lemonSqueezyVariantIdMonthly;
          break;
        case 'annual':
          variantId = standard.lemonSqueezyVariantIdAnnual;
          break;
      }

      if (!variantId) {
        return res.status(400).json({ 
          error: 'Price type not available for this standard' 
        });
      }

      // TODO: Implement actual Lemon Squeezy API call
      // For now, return a mock response
      res.json({ 
        checkoutUrl: 'https://checkout.lemonsqueezy.com/mock-checkout-url',
        message: 'This is a mock checkout URL. Configure LEMON_SQUEEZY_API_KEY to enable real checkouts.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // DESKTOP LICENSE MANAGEMENT ROUTES
  // =====================================================

  const LICENSE_SECRET = process.env.LICENSE_SECRET || 'your-super-secret-key-change-this-in-production';

  // Available standards catalog
  const AVAILABLE_STANDARDS: Record<string, { code: string; name: string; price: number }> = {
    'AMS': { code: 'AMS-STD-2154E', name: 'Aerospace Material Specification', price: 500 },
    'AMS2630': { code: 'AMS-2630', name: 'AMS 2630 Product Over 0.5 Inch Thick', price: 500 },
    'ASTM': { code: 'ASTM-A388', name: 'Steel Forgings', price: 500 },
    'ASTM_E1001': { code: 'ASTM-E1001', name: 'Immersion Pulse-Echo UT', price: 500 },
    'ASTM_E2580': { code: 'ASTM-E2580', name: 'Composite Panel UT', price: 500 },
    'ASTM_E588': { code: 'ASTM-E588', name: 'Bearing Steel Cleanliness', price: 500 },
    'BS3': { code: 'BS-EN-10228-3', name: 'European Steel Standards Part 3', price: 500 },
    'BS4': { code: 'BS-EN-10228-4', name: 'European Steel Standards Part 4', price: 500 },
    'MIL': { code: 'MIL-STD-2154', name: 'Military Standard', price: 800 },
  };

  // Helper: Generate factory ID
  function generateFactoryId(factoryName: string): string {
    const normalized = factoryName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const timestamp = Date.now().toString(36).toUpperCase();
    return `FAC-${normalized.substring(0, 6)}-${timestamp}`;
  }

  // Helper: Generate HMAC signature
  function generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', LICENSE_SECRET)
      .update(data)
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
  }

  // Helper: Generate license key
  function generateLicenseKey(factoryId: string, standards: string[], expiryDate: Date | null): string {
    const standardsCodes = standards.join('').toUpperCase();
    const expiryStr = expiryDate
      ? expiryDate.toISOString().split('T')[0].replace(/-/g, '')
      : 'LIFETIME';
    const data = `${factoryId}:${standardsCodes}:${expiryStr}`;
    const signature = generateSignature(data);
    return `SM-${factoryId}-${standardsCodes}-${expiryStr}-${signature}`;
  }

  // Helper function to read local license files
  function readLocalLicenseFiles(): any[] {
    const licensesDir = path.join(process.cwd(), 'licenses');
    const localLicenses: any[] = [];
    
    try {
      if (fs.existsSync(licensesDir)) {
        const files = fs.readdirSync(licensesDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(licensesDir, file), 'utf-8');
            const license = JSON.parse(content);
            localLicenses.push({
              id: license.factoryId,
              licenseKey: license.licenseKey,
              factoryId: license.factoryId,
              factoryName: license.factoryName,
              contactEmail: null,
              contactPhone: null,
              purchasedStandards: license.purchasedStandards || [],
              maxActivations: license.maxUsers || 5,
              isLifetime: license.isLifetime || false,
              expiryDate: license.expiryDate,
              totalPrice: String(license.totalPrice || 0),
              notes: null,
              status: 'active',
              createdAt: license.generatedAt,
              activationCount: 0,
              activeCount: 0,
              activations: [],
              source: 'local-file'
            });
          } catch (e) {
            logger.warn(`Failed to parse license file: ${file}`, e);
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to read licenses directory', e);
    }
    
    return localLicenses;
  }

  // GET /api/licenses - List all licenses with stats (DB + local files)
  app.get("/api/licenses", mockAuth, async (req, res) => {
    try {
      // Get licenses from database
      const dbLicenses = await db
        .select()
        .from(desktopLicenses)
        .orderBy(desc(desktopLicenses.createdAt));

      // Get activation counts for each license
      const licensesWithStats = await Promise.all(
        dbLicenses.map(async (license) => {
          const activations = await db
            .select()
            .from(licenseActivations)
            .where(eq(licenseActivations.licenseId, license.id));
          
          const activeActivations = activations.filter(a => a.isActive);
          
          return {
            ...license,
            activationCount: activations.length,
            activeCount: activeActivations.length,
            activations: activations.map(a => ({
              id: a.id,
              machineName: a.machineName,
              machineId: a.machineId,
              appVersion: a.appVersion,
              activatedAt: a.activatedAt,
              lastSeenAt: a.lastSeenAt,
              isActive: a.isActive,
            })),
            source: 'database'
          };
        })
      );

      // Also read local license files from /licenses folder
      const localLicenses = readLocalLicenseFiles();
      
      // Merge - avoid duplicates by factoryId
      const existingFactoryIds = new Set(licensesWithStats.map(l => l.factoryId));
      const uniqueLocalLicenses = localLicenses.filter(l => !existingFactoryIds.has(l.factoryId));
      
      const allLicenses = [...licensesWithStats, ...uniqueLocalLicenses];

      res.json(allLicenses);
    } catch (error: any) {
      logger.error('Failed to fetch licenses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/licenses/stats - Dashboard statistics (DB + local files)
  app.get("/api/licenses/stats", mockAuth, async (req, res) => {
    try {
      // Get DB stats
      const [dbLicenses] = await db
        .select({ count: sql<number>`count(*)` })
        .from(desktopLicenses);

      const [activeLicenses] = await db
        .select({ count: sql<number>`count(*)` })
        .from(desktopLicenses)
        .where(eq(desktopLicenses.status, 'active'));

      const [totalActivations] = await db
        .select({ count: sql<number>`count(*)` })
        .from(licenseActivations);

      const [activeActivations] = await db
        .select({ count: sql<number>`count(*)` })
        .from(licenseActivations)
        .where(eq(licenseActivations.isActive, true));

      // Recent activations (last 7 days)
      const recentActivations = await db
        .select()
        .from(licenseActivations)
        .orderBy(desc(licenseActivations.activatedAt))
        .limit(10);

      // Also count local license files
      const localLicenses = readLocalLicenseFiles();
      const localLicenseCount = localLicenses.length;
      
      // Combine stats
      const totalLicenses = Number(dbLicenses?.count || 0) + localLicenseCount;
      const activeLocalLicenses = localLicenses.filter(l => l.status === 'active').length;

      res.json({
        totalLicenses,
        activeLicenses: Number(activeLicenses?.count || 0) + activeLocalLicenses,
        totalActivations: Number(totalActivations?.count || 0),
        activeActivations: Number(activeActivations?.count || 0),
        recentActivations,
        localLicenseCount, // Extra info
      });
    } catch (error: any) {
      logger.error('Failed to fetch license stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/licenses - Generate a new license
  app.post("/api/licenses", mockAuth, async (req, res) => {
    try {
      const { factoryName, contactEmail, contactPhone, standards, isLifetime, expiryDate, maxActivations, notes } = req.body;

      if (!factoryName || !standards || standards.length === 0) {
        return res.status(400).json({ error: 'Factory name and standards are required' });
      }

      // Validate standards
      const validStandards = standards.filter((std: string) => AVAILABLE_STANDARDS[std]);
      if (validStandards.length === 0) {
        return res.status(400).json({ error: 'No valid standards provided' });
      }

      // Generate IDs and key
      const factoryId = generateFactoryId(factoryName);
      const expiry = isLifetime ? null : (expiryDate ? new Date(expiryDate) : null);
      const licenseKey = generateLicenseKey(factoryId, validStandards, expiry);

      // Calculate price
      const totalPrice = validStandards.reduce((sum: number, key: string) => sum + (AVAILABLE_STANDARDS[key]?.price || 0), 0);

      // Get full standard codes
      const purchasedStandards = validStandards.map((key: string) => AVAILABLE_STANDARDS[key].code);

      // Save to database
      const [newLicense] = await db
        .insert(desktopLicenses)
        .values({
          licenseKey,
          factoryId,
          factoryName,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          purchasedStandards,
          maxActivations: maxActivations || 3,
          isLifetime: isLifetime ?? true,
          expiryDate: expiry,
          totalPrice: totalPrice.toString(),
          notes: notes || null,
          status: 'active',
        })
        .returning();

      logger.info('✅ License generated:', { factoryId, licenseKey, standards: purchasedStandards });

      res.status(201).json({
        ...newLicense,
        licenseKey, // Make sure to return the key
      });
    } catch (error: any) {
      logger.error('Failed to generate license:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/licenses/activate - Called by Electron app when activating
  app.post("/api/licenses/activate", async (req, res) => {
    try {
      const { licenseKey, machineId, machineName, osVersion, appVersion } = req.body;

      if (!licenseKey || !machineId) {
        return res.status(400).json({ error: 'License key and machine ID are required' });
      }

      // Find the license
      const [license] = await db
        .select()
        .from(desktopLicenses)
        .where(eq(desktopLicenses.licenseKey, licenseKey));

      if (!license) {
        return res.status(404).json({ error: 'License not found', valid: false });
      }

      if (license.status !== 'active') {
        return res.status(403).json({ error: `License is ${license.status}`, valid: false });
      }

      // Check expiry
      if (license.expiryDate && new Date() > new Date(license.expiryDate)) {
        await db
          .update(desktopLicenses)
          .set({ status: 'expired' })
          .where(eq(desktopLicenses.id, license.id));
        return res.status(403).json({ error: 'License has expired', valid: false });
      }

      // Check if this machine is already activated
      const [existingActivation] = await db
        .select()
        .from(licenseActivations)
        .where(and(
          eq(licenseActivations.licenseId, license.id),
          eq(licenseActivations.machineId, machineId)
        ));

      // Get client IP
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || 'unknown';

      if (existingActivation) {
        // Update last seen
        await db
          .update(licenseActivations)
          .set({
            lastSeenAt: new Date(),
            appVersion: appVersion || existingActivation.appVersion,
            isActive: true,
          })
          .where(eq(licenseActivations.id, existingActivation.id));

        logger.info('📱 License check-in:', { factoryId: license.factoryId, machineId, machineName });
        
        return res.json({
          valid: true,
          factoryName: license.factoryName,
          purchasedStandards: license.purchasedStandards,
          isLifetime: license.isLifetime,
          expiryDate: license.expiryDate,
          isNewActivation: false,
        });
      }

      // Check activation limit
      const [activationCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(licenseActivations)
        .where(and(
          eq(licenseActivations.licenseId, license.id),
          eq(licenseActivations.isActive, true)
        ));

      const currentCount = Number(activationCount?.count || 0);
      if (license.maxActivations && currentCount >= license.maxActivations) {
        return res.status(403).json({
          error: `Maximum activations (${license.maxActivations}) reached`,
          valid: false,
          currentActivations: currentCount,
          maxActivations: license.maxActivations,
        });
      }

      // Create new activation
      await db
        .insert(licenseActivations)
        .values({
          licenseId: license.id,
          licenseKey,
          machineId,
          machineName: machineName || 'Unknown',
          osVersion: osVersion || null,
          appVersion: appVersion || null,
          ipAddress,
          isActive: true,
        });

      logger.info('🎉 NEW LICENSE ACTIVATION:', {
        factoryId: license.factoryId,
        factoryName: license.factoryName,
        machineId,
        machineName,
        ipAddress,
        appVersion,
      });

      res.json({
        valid: true,
        factoryName: license.factoryName,
        purchasedStandards: license.purchasedStandards,
        isLifetime: license.isLifetime,
        expiryDate: license.expiryDate,
        isNewActivation: true,
      });
    } catch (error: any) {
      logger.error('Failed to activate license:', error);
      res.status(500).json({ error: error.message, valid: false });
    }
  });

  // PATCH /api/licenses/:id - Update license (status, notes, etc.)
  app.patch("/api/licenses/:id", mockAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes, maxActivations } = req.body;

      const [updated] = await db
        .update(desktopLicenses)
        .set({
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          ...(maxActivations !== undefined && { maxActivations }),
          updatedAt: new Date(),
        })
        .where(eq(desktopLicenses.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'License not found' });
      }

      res.json(updated);
    } catch (error: any) {
      logger.error('Failed to update license:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/licenses/:id/activations/:activationId - Deactivate a machine
  app.delete("/api/licenses/:id/activations/:activationId", mockAuth, async (req, res) => {
    try {
      const { activationId } = req.params;

      await db
        .update(licenseActivations)
        .set({
          isActive: false,
          deactivatedAt: new Date(),
        })
        .where(eq(licenseActivations.id, activationId));

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to deactivate machine:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/licenses/standards - Get available standards catalog
  app.get("/api/licenses/standards", (req, res) => {
    res.json(AVAILABLE_STANDARDS);
  });
}

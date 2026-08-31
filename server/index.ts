import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "dotenv";
import { registerRtPtRoutes, type RtPtOrganizationSummary } from "./rtptRoutes";
import { DbStorage } from "./storage";
import { MemoryStorage } from "./memoryStorage";
import { db, isRtPtDatabaseConfigured } from "./db";
import { organizations } from "../shared/schema";
import { eq } from "drizzle-orm";
import { setupVite } from "./vite";
import { createServer } from "http";
import path from "path";
import { 
  securityHeaders, 
  corsOptions, 
  sanitizeRequest,
} from "./middleware/security";
import { generalRateLimiter } from "./middleware/rateLimiter";
import { requestTracking, healthCheck, livenessProbe, readinessProbe, metricsEndpoint } from "./middleware/monitoring";
import { 
  errorHandler, 
  notFoundHandler, 
  handleUncaughtException, 
  handleUnhandledRejection,
  handleGracefulShutdown
} from "./middleware/errorHandler";
import logger, { stream } from "./utils/logger";
import compression from "compression";
import { createStandaloneRtPtLicenseRuntime } from "./rtptLicenseRuntime";
import { registerUnifiedStorageRoutes } from "./unifiedStorageRoutes";

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5199;
const HOST = (process.env.HOST || "127.0.0.1").trim().toLowerCase();
const isDev = process.env.NODE_ENV !== "production";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";
const LOCAL_ORGANIZATION_SLUG = "rtpt-local";

if (!LOOPBACK_HOSTS.has(HOST)) {
  throw new Error(
    `Refusing to bind the RT-PT local server to non-loopback host "${HOST}" until authenticated public-server mode is implemented.`
  );
}

const allowedRequestHosts = new Set([
  "127.0.0.1",
  "localhost",
  "[::1]",
  `127.0.0.1:${PORT}`,
  `localhost:${PORT}`,
  `[::1]:${PORT}`,
]);

app.use((req, res, next) => {
  const requestHost = String(req.headers.host || "").toLowerCase();
  if (!allowedRequestHosts.has(requestHost)) {
    return res.status(403).json({ error: "Forbidden request host" });
  }
  return next();
});

// Handle uncaught errors
handleUncaughtException();
handleUnhandledRejection();

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(compression()); // Compress responses

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Logging middleware
if (isDev) {
  // Development: simple request logging
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: unknown;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse && res.statusCode >= 400) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 120) {
          logLine = logLine.slice(0, 119) + "…";
        }

        console.log(logLine);
      }
    });

    next();
  });
} else {
  // Production: structured logging with Morgan
  app.use(morgan('combined', { stream }));
}

// Monitoring - skip for static assets in development
app.use((req, res, next) => {
  // In development, skip monitoring for Vite assets and HMR
  if (isDev && (req.path.startsWith('/@') || req.path.startsWith('/src/') || 
      req.path.includes('.css') || req.path.includes('.js') || 
      req.path.includes('.ts') || req.path.includes('.tsx') ||
      req.path.includes('.json') || req.path.includes('.png') ||
      req.path.includes('.jpg') || req.path.includes('.svg'))) {
    return next();
  }
  requestTracking(req, res, next);
});

// Security checks - skip for static assets in development
app.use((req, res, next) => {
  // In development, skip sanitization for Vite assets
  if (isDev && (req.path.startsWith('/@') || req.path.startsWith('/src/'))) {
    return next();
  }
  sanitizeRequest(req, res, next);
});
// Rate limiting for API routes
app.use('/api', generalRateLimiter);

// Health check endpoints (before other routes)
app.get('/health', healthCheck);
app.get('/health/live', livenessProbe);
app.get('/health/ready', readinessProbe);
app.get('/metrics', metricsEndpoint);

type OrganizationRow = typeof organizations.$inferSelect;

function toLocalOrganizationSummary(organization: OrganizationRow): RtPtOrganizationSummary {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    domain: organization.domain,
    plan: organization.plan || "free",
    isActive: organization.isActive ?? true,
    maxUsers: organization.maxUsers ?? 5,
    maxSheets: organization.maxSheets ?? 100,
    settings: organization.settings || {},
    userRole: "owner",
  };
}

async function resolveLocalOrganization(): Promise<RtPtOrganizationSummary> {
  const existingById = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, LOCAL_ORGANIZATION_ID))
    .limit(1);
  if (existingById[0]) return toLocalOrganizationSummary(existingById[0]);

  // Reuse an existing local workspace rather than changing a referenced
  // organization primary key when an older installation used another UUID.
  const existingBySlug = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, LOCAL_ORGANIZATION_SLUG))
    .limit(1);
  if (existingBySlug[0]) return toLocalOrganizationSummary(existingBySlug[0]);

  const inserted = await db.insert(organizations).values({
    id: LOCAL_ORGANIZATION_ID,
    name: "RT/PT Local Workspace",
    slug: LOCAL_ORGANIZATION_SLUG,
    plan: "free",
    isActive: true,
    maxUsers: 999,
    maxSheets: 99_999,
    settings: {},
  }).returning();

  return toLocalOrganizationSummary(inserted[0]);
}

let localOrganizationPromise: Promise<RtPtOrganizationSummary> | undefined;

const memoryLocalOrganization: RtPtOrganizationSummary = {
  id: LOCAL_ORGANIZATION_ID,
  name: "RT/PT Local Workspace (non-persistent)",
  slug: LOCAL_ORGANIZATION_SLUG,
  domain: null,
  plan: "free",
  isActive: true,
  maxUsers: 999,
  maxSheets: 99_999,
  settings: {},
  userRole: "owner",
};

async function listLocalOrganizations(_userId: string): Promise<RtPtOrganizationSummary[]> {
  if (!isRtPtDatabaseConfigured) {
    return [memoryLocalOrganization];
  }
  if (!localOrganizationPromise) {
    localOrganizationPromise = resolveLocalOrganization();
  }

  try {
    return [await localOrganizationPromise];
  } catch (error) {
    // Permit a later request to retry after a transient database failure.
    localOrganizationPromise = undefined;
    throw error;
  }
}

(async () => {
  const server = createServer(app);

  // The browser/PWA surface uses the same independent signed RT/PT license
  // format as Electron. License endpoints stay available so a locked local
  // installation can be activated; all document/profile APIs fail closed.
  const rtPtLicenseRuntime = createStandaloneRtPtLicenseRuntime();
  rtPtLicenseRuntime.register(app);

  // Same-machine shared storage (saved cards, settings, profiles) for the
  // browser/PWA surface — parity with the desktop shell's unified storage.
  // License-gated above alongside the other document APIs.
  registerUnifiedStorageRoutes(app);

  // Register only the standalone RT/PT API. Header identity is permitted here
  // solely because this process is hard-bound to loopback above.
  if (!isRtPtDatabaseConfigured) {
    console.warn(
      "⚠️  RTPT_DATABASE_URL is not set — running with NON-PERSISTENT in-memory storage for local development. "
        + "Server-side sheets and profiles are lost on restart (browser-side drafts and saved cards are unaffected). "
        + "Generic DATABASE_URL credentials remain intentionally ignored.",
    );
  }
  registerRtPtRoutes(app, {
    storage: isRtPtDatabaseConfigured ? new DbStorage() : new MemoryStorage(),
    listOrganizations: listLocalOrganizations,
  });

  // In production, serve the built client files
  if (process.env.NODE_ENV === "production") {
    const clientPath = path.join(process.cwd(), "rtpt-dist");
    app.use(express.static(clientPath));
    
    // Handle client-side routing - serve index.html for all non-API routes
    app.use((req, res, next) => {
      if (!req.path.startsWith("/api") && !req.path.startsWith("/health") && !req.path.startsWith("/metrics") && req.method === "GET") {
        res.sendFile(path.join(clientPath, "index.html"));
      } else {
        next();
      }
    });
  } else {
    // In development, use Vite's middleware
    await setupVite(app, server);
  }

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Graceful shutdown handling
  handleGracefulShutdown(server);

  // Start server
  server.listen(PORT, HOST, () => {
    const message = `Server running at http://${HOST}:${PORT} in ${process.env.NODE_ENV || 'development'} mode`;
    if (!isDev) {
      logger.info(message);
    }
    console.log(message);
  });
})();

import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { z, type ZodTypeAny } from "zod";
import type {
  InsertProfile,
  InsertTechniqueSheet,
  Profile,
  TechniqueSheet,
} from "@shared/schema";
import type { IStorage } from "./storage";
import logger from "./utils/logger";
import {
  decodeRtPtDocument,
  fingerprintRtPtApprovedContent,
  hasValidRtPtApprovalFingerprint,
} from "../src/lib/rtPtDocumentCodec";
import { validateRtPtDocument } from "../src/lib/rtPtValidation";
import type { RtPtDocumentV3 } from "../src/types/rtPtDocument";

const RT_PT_DOCUMENT_KIND = "rtpt-document";
const LOCAL_OWNER_ROLE = "owner";

const uuidSchema = z.string().uuid();
const documentObjectSchema = z.record(z.unknown());
const textSchema = z.string();
const numberOrEmptySchema = z.union([z.number().finite(), z.literal("")]);
const lengthUnitSchema = z.enum(["mm", "inch"]);
const inspectionStageSchema = z.enum(["In-process", "Final", ""]);
const inspectorLevelSchema = z.enum(["I", "II", "III", ""]);
const acceptRejectSchema = z.enum(["Accept", "Reject", ""]);

const generalTechniqueSchema = z.object({
  partName: textSchema,
  partNumber: textSchema,
  material: textSchema,
  thickness: numberOrEmptySchema,
  thicknessUnit: lengthUnitSchema,
  drawingReference: textSchema,
  procedureNumber: textSchema,
  inspectionStage: inspectionStageSchema,
  inspectorLevel: inspectorLevelSchema,
  date: textSchema,
}).strict();

const rtAcceptanceTechniqueSchema = z.object({
  acceptanceStandard: textSchema,
  qualityLevel: textSchema,
  singleDiscontinuity: numberOrEmptySchema,
  singleDiscontinuityUnit: lengthUnitSchema,
  multipleDiscontinuities: numberOrEmptySchema,
  multipleDiscontinuitiesUnit: lengthUnitSchema,
  linearIndications: numberOrEmptySchema,
  linearIndicationsUnit: lengthUnitSchema,
  specialRequirements: textSchema,
}).strict();

const rtIdentificationTechniqueSchema = z.object({
  filmNumber: textSchema,
  exposureNumber: numberOrEmptySchema,
  partIdentification: textSchema,
}).strict();

const rtFilmTechniqueSchema = z.object({
  general: generalTechniqueSchema,
  exposure: z.object({
    techniqueType: z.enum(["SWSI", "DWDI", "DWSI", ""]),
    radiationType: z.enum(["X-ray", "Gamma", ""]),
    sfd: numberOrEmptySchema,
    sfdUnit: lengthUnitSchema,
    sod: numberOrEmptySchema,
    sodUnit: lengthUnitSchema,
    ofd: numberOrEmptySchema,
    ofdUnit: lengthUnitSchema,
    geometricMagnificationAuto: z.boolean(),
    geometricMagnification: numberOrEmptySchema,
    focalSpotSize: numberOrEmptySchema,
    beamAngle: numberOrEmptySchema,
    numberOfExposures: numberOrEmptySchema,
    exposurePattern: z.enum(["Static", "Multiple", "Rotational", "Panoramic", ""]),
    coverage: numberOrEmptySchema,
  }).strict(),
  equipment: z.object({
    radiationSourceType: z.enum(["X-ray", "Isotope", ""]),
    manufacturer: textSchema,
    model: textSchema,
    serialNumber: textSchema,
    calibrationStatus: z.enum(["Valid", "Expired", ""]),
    viewingEquipment: textSchema,
  }).strict(),
  filmSystem: z.object({
    filmType: textSchema,
    filmClass: z.enum(["I", "II", "III", ""]),
    screenType: z.enum(["Lead", "None", ""]),
    screenThickness: numberOrEmptySchema,
    cassetteType: z.enum(["Flexible", "Rigid", ""]),
    processingMethod: z.enum(["Manual", "Automatic", ""]),
  }).strict(),
  iqc: z.object({
    iqiType: z.enum(["Wire", "Hole", ""]),
    iqiStandard: z.enum(["ASTM E747", "ASTM E1025", ""]),
    iqiMaterial: z.enum(["Steel", "Aluminum", "Same as part", ""]),
    iqiSize: numberOrEmptySchema,
    iqiPlacement: z.enum(["Source side", "Film side", ""]),
    requiredSensitivity: z.enum(["1-1T", "2-1T", "2-2T", "2-4T", ""]),
    imageQualityLevel: z.enum(["00", "0", "1", "2", "3", ""]),
  }).strict(),
  acceptance: rtAcceptanceTechniqueSchema,
  identification: rtIdentificationTechniqueSchema,
}).strict();

const rtDigitalTechniqueSchema = z.object({
  general: generalTechniqueSchema,
  exposure: z.object({
    radiationType: z.enum(["X-ray", "Gamma", ""]),
    tubeVoltage: numberOrEmptySchema,
    tubeCurrent: numberOrEmptySchema,
    exposureTime: numberOrEmptySchema,
    frameRate: numberOrEmptySchema,
    framesAveraged: numberOrEmptySchema,
    sdd: numberOrEmptySchema,
    sod: numberOrEmptySchema,
    odd: numberOrEmptySchema,
    magnificationAuto: z.boolean(),
    magnification: numberOrEmptySchema,
    focalSpotSize: numberOrEmptySchema,
    filters: textSchema,
    coverage: numberOrEmptySchema,
  }).strict(),
  system: z.object({
    ddaType: z.enum(["Flat Panel", "CCD", "CMOS", ""]),
    manufacturer: textSchema,
    model: textSchema,
    pixelSize: numberOrEmptySchema,
    detectorMode: z.enum(["Full", "Binned", ""]),
    gainSetting: numberOrEmptySchema,
    calibrationStatus: z.enum(["Valid", "Expired", ""]),
  }).strict(),
  detector: z.object({
    spatialResolutionSRb: numberOrEmptySchema,
    pixelDensity: numberOrEmptySchema,
    imageUnsharpness: numberOrEmptySchema,
    badPixelCorrection: z.enum(["Yes", "No", ""]),
    detectorCorrections: z.enum(["Gain", "Offset", "Gain + Offset", ""]),
  }).strict(),
  imageProcessing: z.object({
    windowLevel: numberOrEmptySchema,
    windowWidth: numberOrEmptySchema,
    zoom: numberOrEmptySchema,
    noiseReduction: z.enum(["None", "Low", "Medium", "High", ""]),
    contrastEnhancement: z.enum(["On", "Off", ""]),
    imageFormat: z.enum(["DICONDE", "TIFF", ""]),
  }).strict(),
  iqc: z.object({
    iqiType: z.enum(["Wire", "Hole", ""]),
    iqiStandard: z.enum(["ASTM E747", "ASTM E1025", ""]),
    requiredSensitivity: z.enum(["1-1T", "2-2T", ""]),
  }).strict(),
  acceptance: rtAcceptanceTechniqueSchema,
  identification: rtIdentificationTechniqueSchema,
}).strict();

const ptTechniqueSchema = z.object({
  general: generalTechniqueSchema,
  materials: z.object({
    penetrantType: z.enum(["Type I", "Type II", ""]),
    method: z.enum(["A", "B", "C", "D", ""]),
    sensitivityLevel: z.enum(["1", "2", "3", "4", ""]),
    developerType: z.enum(["Dry", "Water", "Non-aqueous", ""]),
    cleanerType: z.enum(["Solvent", "Water", ""]),
  }).strict(),
  surfacePrep: z.object({
    cleaningMethod: z.enum(["Solvent", "Alkaline", ""]),
    surfaceCondition: z.enum(["As-welded", "Machined", ""]),
    dryingMethod: z.enum(["Air", "Oven", ""]),
  }).strict(),
  application: z.object({
    applicationMethod: z.enum(["Spray", "Dip", "Brush", ""]),
    dwellTime: numberOrEmptySchema,
    removalMethod: z.enum(["Water wash", "Solvent", ""]),
    rinsePressure: numberOrEmptySchema,
    rinseTemperature: numberOrEmptySchema,
  }).strict(),
  development: z.object({
    developerApplication: z.enum(["Spray", "Dust", ""]),
    developmentTime: numberOrEmptySchema,
  }).strict(),
  conditions: z.object({
    lightType: z.enum(["UV-A", "White", ""]),
    uvIntensity: numberOrEmptySchema,
    whiteLight: numberOrEmptySchema,
  }).strict(),
  acceptance: z.object({
    acceptanceStandard: textSchema,
    linearIndications: numberOrEmptySchema,
    roundedIndications: numberOrEmptySchema,
  }).strict(),
  postCleaning: z.object({
    postCleaningMethod: z.enum(["Water", "Solvent", ""]),
  }).strict(),
}).strict();

const migrationBaseFields = {
  sourceSchemaVersion: z.literal(1),
  warnings: z.array(textSchema),
};

const filmMigrationSchema = z.object({
  ...migrationBaseFields,
  legacyPerformedData: z.object({
    iqc: z.object({
      achievedSensitivity: textSchema,
      opticalDensityMin: numberOrEmptySchema,
      opticalDensityMax: numberOrEmptySchema,
    }).strict().optional(),
    identification: z.object({
      inspectionDate: textSchema,
      inspector: textSchema,
      result: acceptRejectSchema,
      remarks: textSchema,
    }).strict().optional(),
  }).strict().optional(),
}).strict();

const digitalMigrationSchema = z.object({
  ...migrationBaseFields,
  legacyPerformedData: z.object({
    iqc: z.object({ cnr: numberOrEmptySchema }).strict().optional(),
    identification: z.object({
      inspectionDate: textSchema,
      inspector: textSchema,
      result: acceptRejectSchema,
      remarks: textSchema,
    }).strict().optional(),
  }).strict().optional(),
}).strict();

const ptMigrationSchema = z.object({
  ...migrationBaseFields,
  legacyPerformedData: z.object({
    development: z.object({
      indicationType: z.enum(["Linear", "Rounded", ""]),
      indicationSize: numberOrEmptySchema,
    }).strict().optional(),
    postCleaning: z.object({
      result: acceptRejectSchema,
      inspector: textSchema,
      date: textSchema,
    }).strict().optional(),
  }).strict().optional(),
}).strict();

const rtPtDocumentV2BaseSchema = z.object({
  documentKind: z.literal(RT_PT_DOCUMENT_KIND),
  schemaVersion: z.literal(2),
  documentType: z.literal("technique"),
  documentId: z.string().trim().min(1),
  status: z.enum(["draft", "in-review", "approved", "superseded"]),
  documentControl: z.object({
    number: textSchema,
    title: textSchema,
    revision: textSchema,
    revisionDate: textSchema,
    effectiveDate: textSchema,
    changeSummary: textSchema,
  }).strict(),
  organization: z.object({ name: textSchema, site: textSchema }).strict(),
  job: z.object({
    customer: textSchema,
    contract: textSchema,
    purchaseOrder: textSchema,
    workOrder: textSchema,
  }).strict(),
  unitSystem: z.enum(["SI", "US-customary"]),
  controlledReferences: z.array(z.object({
    type: textSchema,
    title: textSchema,
    number: textSchema,
    revision: textSchema,
    clauseOrNote: textSchema,
  }).strict()),
  approvals: z.array(z.object({
    role: z.enum(["prepared", "reviewed", "cognizant-engineering", "ndt-level-3"]),
    name: textSchema,
    personnelId: textSchema,
    certificationBasis: textSchema,
    certificationRevision: textSchema,
    date: textSchema,
  }).strict()),
}).strict();

const rtPtDocumentV2Schema = z.discriminatedUnion("method", [
  rtPtDocumentV2BaseSchema.extend({
    method: z.literal("RT-Film"),
    technique: rtFilmTechniqueSchema,
    migration: filmMigrationSchema.optional(),
  }).strict(),
  rtPtDocumentV2BaseSchema.extend({
    method: z.literal("RT-Digital"),
    technique: rtDigitalTechniqueSchema,
    migration: digitalMigrationSchema.optional(),
  }).strict(),
  rtPtDocumentV2BaseSchema.extend({
    method: z.literal("PT"),
    technique: ptTechniqueSchema,
    migration: ptMigrationSchema.optional(),
  }).strict(),
]);

const rtPtDocumentV1Schema = z.object({
  documentKind: z.literal(RT_PT_DOCUMENT_KIND),
  schemaVersion: z.literal(1),
  method: z.enum(["RT-Film", "RT-Digital", "PT"]),
  activeTabs: z.object({
    rtFilm: z.string().trim().min(1).max(100).optional(),
    rtDigital: z.string().trim().min(1).max(100).optional(),
    pt: z.string().trim().min(1).max(100).optional(),
  }).strict().optional(),
  sheets: z.object({
    rtFilm: documentObjectSchema,
    rtDigital: documentObjectSchema,
    penetrant: documentObjectSchema,
  }).strict(),
}).strict();

/*
 * This registry is the sole version gate for database persistence. A future
 * document version must have a complete structural schema registered here;
 * merely increasing schemaVersion must never make it pass the API boundary.
 */
const supportedRtPtDocumentSchemas: ReadonlyMap<number, ZodTypeAny> = new Map<number, ZodTypeAny>([
  [1, rtPtDocumentV1Schema],
  [2, rtPtDocumentV2Schema],
]);

type SupportedDocumentValidation =
  | { success: true; version: number; data: unknown }
  | {
      success: false;
      kind: "invalid" | "legacy-ut" | "unsupported-version";
      message: string;
      details?: z.ZodIssue[];
    };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

function hasOnlyCanonicalFields(input: unknown, parsed: unknown): boolean {
  if (Array.isArray(input) || Array.isArray(parsed)) {
    return Array.isArray(input)
      && Array.isArray(parsed)
      && input.length === parsed.length
      && input.every((item, index) => hasOnlyCanonicalFields(item, parsed[index]));
  }
  if (isRecord(input) || isRecord(parsed)) {
    if (!isRecord(input) || !isRecord(parsed)) return false;
    return Object.keys(input).every((key) => (
      Object.prototype.hasOwnProperty.call(parsed, key)
      && hasOnlyCanonicalFields(input[key], parsed[key])
    ));
  }
  return Object.is(input, parsed);
}

export function validateSupportedRtPtDocument(value: unknown): SupportedDocumentValidation {
  if (!isRecord(value)) {
    return {
      success: false,
      kind: "invalid",
      message: "The technique-sheet data must be an RT/PT document object.",
    };
  }

  if ("partA" in value || "inspectionSetup" in value) {
    return {
      success: false,
      kind: "legacy-ut",
      message: "This document uses an unsupported legacy inspection data model.",
    };
  }

  if (value.documentKind !== RT_PT_DOCUMENT_KIND) {
    return {
      success: false,
      kind: "invalid",
      message: "Only RT/PT Inspector documents are supported by this application.",
    };
  }

  if (typeof value.schemaVersion !== "number" || !Number.isInteger(value.schemaVersion)) {
    return {
      success: false,
      kind: "invalid",
      message: "The RT/PT document schema version is missing or invalid.",
    };
  }

  if (value.schemaVersion === 3) {
    const decoded = decodeRtPtDocument(value);
    if (decoded.status !== "success" || decoded.document.schemaVersion !== 3) {
      return {
        success: false,
        kind: "invalid",
        message: "RT/PT document version 3 is structurally invalid.",
      };
    }
    if (!hasOnlyCanonicalFields(value, decoded.document)) {
      return {
        success: false,
        kind: "invalid",
        message: "RT/PT document version 3 contains unknown or non-canonical fields.",
      };
    }
    return { success: true, version: 3, data: decoded.document };
  }

  const schema = supportedRtPtDocumentSchemas.get(value.schemaVersion);
  if (!schema) {
    return {
      success: false,
      kind: "unsupported-version",
      message: `RT/PT document version ${value.schemaVersion} is not supported by this server.`,
    };
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      kind: "invalid",
      message: `RT/PT document version ${value.schemaVersion} is structurally invalid.`,
      details: parsed.error.issues,
    };
  }

  return { success: true, version: value.schemaVersion, data: parsed.data };
}

export function validateWritableRtPtDocument(value: unknown): SupportedDocumentValidation {
  const validation = validateSupportedRtPtDocument(value);
  if (!validation.success) return validation;
  if (validation.version !== 3) {
    return {
      success: false,
      kind: "unsupported-version",
      message: "RT/PT document writes require native schema version 3. Load and review the migrated draft before saving.",
    };
  }
  const document = validation.data as RtPtDocumentV3;
  if (document.status === "approved") {
    if (!hasValidRtPtApprovalFingerprint(document)) {
      return {
        success: false,
        kind: "invalid",
        message: "Approved RT/PT documents require a valid approval fingerprint for their current controlled content.",
      };
    }
    const summary = validateRtPtDocument(document);
    if (!summary.isComplete || !summary.isApprovalReady) {
      return {
        success: false,
        kind: "invalid",
        message: "Approved RT/PT documents must independently pass current completeness and approval-readiness validation.",
      };
    }
  }
  return validation;
}

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

const profileFieldsSchema = z.object({
  name: z.string().trim().min(2).max(200),
  initials: z.string().trim().min(1).max(10),
  certificationLevel: z.enum(["Level I", "Level II", "Level III"]),
  certificationNumber: z.string().trim().min(1).max(200),
  certifyingOrganization: z.string().trim().min(1).max(200),
  employeeId: optionalText(200),
  department: optionalText(200),
  email: z.union([
    z.string().trim().email().max(320),
    z.literal(""),
  ]).nullable().optional(),
  phone: optionalText(100),
  signature: optionalText(8_000_000),
  isDefault: z.boolean().optional(),
}).strict();

const createProfileBodySchema = profileFieldsSchema.extend({
  id: uuidSchema.optional(),
  // Current clients send local timestamps. They are accepted for compatibility
  // but discarded so that the database remains authoritative.
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}).strict();

const updateProfileBodySchema = profileFieldsSchema.partial().extend({
  updatedAt: z.string().datetime().optional(),
}).strict().superRefine((value, context) => {
  const mutableKeys = Object.keys(value).filter((key) => key !== "updatedAt");
  if (mutableKeys.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one profile field must be supplied.",
    });
  }
});

const techniqueSheetFieldsSchema = z.object({
  sheetName: z.string().trim().min(1).max(255),
  standard: optionalText(255),
  data: z.unknown(),
  status: z.string().trim().min(1).max(64).optional(),
  createdBy: optionalText(255),
  modifiedBy: optionalText(255),
}).strict();

const createTechniqueSheetBodySchema = techniqueSheetFieldsSchema;
const updateTechniqueSheetBodySchema = techniqueSheetFieldsSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one technique-sheet field must be supplied." },
);

const clientLogSchema = z.object({
  level: z.enum(["info", "warn", "error", "debug"]),
  message: z.string().trim().min(1).max(4_000),
  timestamp: z.string().datetime(),
  context: z.record(z.unknown()).optional(),
  stack: z.string().max(16_000).optional(),
}).strict();

type RtPtStorage = Pick<IStorage,
  | "getInspectorProfilesByUserId"
  | "getInspectorProfileById"
  | "createInspectorProfile"
  | "updateInspectorProfile"
  | "deleteInspectorProfile"
  | "getTechniqueSheetsByUserId"
  | "getTechniqueSheetById"
  | "createTechniqueSheet"
  | "updateTechniqueSheet"
  | "deleteTechniqueSheet"
>;

export interface RtPtOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  plan: string;
  isActive: boolean;
  maxUsers?: number;
  maxSheets?: number;
  settings?: unknown;
  userRole: typeof LOCAL_OWNER_ROLE;
}

export interface RtPtRouteDependencies {
  storage: RtPtStorage;
  listOrganizations: (userId: string) => Promise<RtPtOrganizationSummary[]>;
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncRoute = (handler: AsyncRoute): RequestHandler => (
  (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
);

const localHeaderIdentity: RequestHandler = (req, res, next) => {
  const rawUserId = req.headers["x-user-id"];
  const userId = Array.isArray(rawUserId) ? undefined : rawUserId;
  const parsedUserId = uuidSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return res.status(401).json({ error: "A valid x-user-id header is required." });
  }

  const rawOrgId = req.headers["x-org-id"];
  const orgId = Array.isArray(rawOrgId) ? undefined : rawOrgId;
  if (rawOrgId !== undefined) {
    const parsedOrgId = uuidSchema.safeParse(orgId);
    if (!parsedOrgId.success) {
      return res.status(400).json({ error: "x-org-id must be a valid UUID." });
    }
    req.orgId = parsedOrgId.data;
  } else {
    req.orgId = null;
  }

  req.userId = parsedUserId.data;
  return next();
};

const requireOrganizationIdentity: RequestHandler = (req, res, next) => {
  if (!req.orgId) {
    return res.status(400).json({ error: "A valid x-org-id header is required." });
  }
  return next();
};

function parseResourceId(req: Request, res: Response): string | undefined {
  const parsed = uuidSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: "Resource id must be a valid UUID." });
    return undefined;
  }
  return parsed.data;
}

function sendZodError(res: Response, error: z.ZodError): Response {
  return res.status(400).json({ error: "Invalid request data", details: error.issues });
}

function sendDocumentError(
  res: Response,
  validation: Exclude<SupportedDocumentValidation, { success: true }>,
  statusCode: 400 | 409,
): Response {
  return res.status(statusCode).json({
    error: validation.message,
    code: validation.kind,
    ...(validation.details ? { details: validation.details } : {}),
  });
}

function authorizeOwnedProfile(
  profile: Profile,
  userId: string,
  orgId: string | null | undefined,
  res: Response,
): boolean {
  if (profile.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  if (orgId && profile.orgId !== orgId) {
    res.status(403).json({ error: "Forbidden - wrong organization" });
    return false;
  }
  return true;
}

function authorizeOwnedTechniqueSheet(
  sheet: TechniqueSheet,
  userId: string,
  orgId: string,
  res: Response,
): boolean {
  if (sheet.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  if (sheet.orgId !== orgId) {
    res.status(403).json({ error: "Forbidden - wrong organization" });
    return false;
  }
  return true;
}

/**
 * Registers the standalone RT/PT Inspector API allowlist.
 *
 * SECURITY: x-user-id and x-org-id are local identity selectors, not remote
 * authentication. This router is safe only behind server/index.ts, which
 * refuses non-loopback binds and rejects non-loopback Host headers. A public
 * deployment must replace this middleware with verified authentication.
 */
export function registerRtPtRoutes(app: Express, dependencies: RtPtRouteDependencies): void {
  const { storage, listOrganizations } = dependencies;

  app.get("/api/organizations", localHeaderIdentity, asyncRoute(async (req, res) => {
    try {
      res.json(await listOrganizations(req.userId!));
    } catch (error) {
      logger.warn("Local organization lookup failed; database saves are disabled", { error });
      res.json([]);
    }
  }));

  app.get("/api/organizations/:id/role", localHeaderIdentity, asyncRoute(async (req, res) => {
    const organizationId = parseResourceId(req, res);
    if (!organizationId) return;

    const organizations = await listOrganizations(req.userId!);
    if (!organizations.some((organization) => organization.id === organizationId)) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // Standalone local mode has one owner per local user identity.
    res.json({ role: LOCAL_OWNER_ROLE });
  }));

  app.get("/api/inspector-profiles", localHeaderIdentity, asyncRoute(async (req, res) => {
    const profiles = await storage.getInspectorProfilesByUserId(
      req.userId!,
      req.orgId || undefined,
    );
    res.json(profiles);
  }));

  app.get("/api/inspector-profiles/:id", localHeaderIdentity, asyncRoute(async (req, res) => {
    const profileId = parseResourceId(req, res);
    if (!profileId) return;

    const profile = await storage.getInspectorProfileById(profileId, req.orgId || undefined);
    if (!profile) {
      res.status(404).json({ error: "Inspector profile not found" });
      return;
    }
    if (!authorizeOwnedProfile(profile, req.userId!, req.orgId, res)) return;

    res.json(profile);
  }));

  app.post("/api/inspector-profiles", localHeaderIdentity, asyncRoute(async (req, res) => {
    const parsed = createProfileBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendZodError(res, parsed.error);
      return;
    }

    const {
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...profileFields
    } = parsed.data;
    const insert: InsertProfile = {
      ...profileFields,
      userId: req.userId!,
      orgId: req.orgId || null,
    };
    const profile = await storage.createInspectorProfile(insert);
    res.status(201).json(profile);
  }));

  app.patch("/api/inspector-profiles/:id", localHeaderIdentity, asyncRoute(async (req, res) => {
    const profileId = parseResourceId(req, res);
    if (!profileId) return;

    const parsed = updateProfileBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendZodError(res, parsed.error);
      return;
    }

    const existing = await storage.getInspectorProfileById(profileId, req.orgId || undefined);
    if (!existing) {
      res.status(404).json({ error: "Inspector profile not found" });
      return;
    }
    if (!authorizeOwnedProfile(existing, req.userId!, req.orgId, res)) return;

    const { updatedAt: _updatedAt, ...updates } = parsed.data;
    const profile = await storage.updateInspectorProfile(
      profileId,
      updates,
      req.orgId || undefined,
    );
    res.json(profile);
  }));

  app.delete("/api/inspector-profiles/:id", localHeaderIdentity, asyncRoute(async (req, res) => {
    const profileId = parseResourceId(req, res);
    if (!profileId) return;

    const existing = await storage.getInspectorProfileById(profileId, req.orgId || undefined);
    if (!existing) {
      res.status(404).json({ error: "Inspector profile not found" });
      return;
    }
    if (!authorizeOwnedProfile(existing, req.userId!, req.orgId, res)) return;

    await storage.deleteInspectorProfile(profileId, req.orgId || undefined);
    res.status(204).send();
  }));

  app.get(
    "/api/technique-sheets",
    localHeaderIdentity,
    requireOrganizationIdentity,
    asyncRoute(async (req, res) => {
      const sheets = await storage.getTechniqueSheetsByUserId(req.userId!, req.orgId!);
      const supportedSheets = sheets.flatMap((sheet) => {
        const validation = validateSupportedRtPtDocument(sheet.data);
        return validation.success
          ? [{
              ...sheet,
              data: validation.version === 3 ? validation.data : sheet.data,
              ...(validation.version === 3
                ? { status: (validation.data as { status: string }).status }
                : {}),
            }]
          : [];
      });

      if (supportedSheets.length !== sheets.length) {
        logger.warn("Filtered incompatible technique sheets at the RT/PT API boundary", {
          userId: req.userId,
          orgId: req.orgId,
          filteredCount: sheets.length - supportedSheets.length,
        });
      }
      res.json(supportedSheets);
    }),
  );

  app.get(
    "/api/technique-sheets/:id",
    localHeaderIdentity,
    requireOrganizationIdentity,
    asyncRoute(async (req, res) => {
      const sheetId = parseResourceId(req, res);
      if (!sheetId) return;

      const sheet = await storage.getTechniqueSheetById(sheetId, req.orgId!);
      if (!sheet) {
        res.status(404).json({ error: "Technique sheet not found" });
        return;
      }
      if (!authorizeOwnedTechniqueSheet(sheet, req.userId!, req.orgId!, res)) return;

      const validation = validateSupportedRtPtDocument(sheet.data);
      if (!validation.success) {
        sendDocumentError(res, validation, 409);
        return;
      }
      res.json({
        ...sheet,
        data: validation.version === 3 ? validation.data : sheet.data,
        ...(validation.version === 3
          ? { status: (validation.data as { status: string }).status }
          : {}),
      });
    }),
  );

  app.post(
    "/api/technique-sheets",
    localHeaderIdentity,
    requireOrganizationIdentity,
    asyncRoute(async (req, res) => {
      const parsed = createTechniqueSheetBodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendZodError(res, parsed.error);
        return;
      }

      const documentValidation = validateWritableRtPtDocument(parsed.data.data);
      if (!documentValidation.success) {
        sendDocumentError(res, documentValidation, 400);
        return;
      }

      const insert: InsertTechniqueSheet = {
        ...parsed.data,
        data: documentValidation.data,
        userId: req.userId!,
        orgId: req.orgId!,
        status: (documentValidation.data as { status: string }).status,
      };
      const sheet = await storage.createTechniqueSheet(insert, req.orgId!);
      res.status(201).json(sheet);
    }),
  );

  app.patch(
    "/api/technique-sheets/:id",
    localHeaderIdentity,
    requireOrganizationIdentity,
    asyncRoute(async (req, res) => {
      const sheetId = parseResourceId(req, res);
      if (!sheetId) return;

      const parsed = updateTechniqueSheetBodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendZodError(res, parsed.error);
        return;
      }

      const existing = await storage.getTechniqueSheetById(sheetId, req.orgId!);
      if (!existing) {
        res.status(404).json({ error: "Technique sheet not found" });
        return;
      }
      if (!authorizeOwnedTechniqueSheet(existing, req.userId!, req.orgId!, res)) return;

      const documentValidation = validateWritableRtPtDocument(
        "data" in parsed.data ? parsed.data.data : existing.data,
      );
      if (!documentValidation.success) {
        sendDocumentError(res, documentValidation, 400);
        return;
      }

      const previousDocument = decodeRtPtDocument(existing.data);
      const nextDocument = decodeRtPtDocument(documentValidation.data);
      if (
        isRecord(existing.data)
        && existing.data.schemaVersion === 3
        && previousDocument.status === "success"
        && nextDocument.status === "success"
        && previousDocument.document.status === "approved"
        && nextDocument.document.status === "approved"
        && fingerprintRtPtApprovedContent(previousDocument.document)
          !== fingerprintRtPtApprovedContent(nextDocument.document)
      ) {
        res.status(409).json({
          error: "Approved RT/PT content changed. Save it as Draft with approvals cleared before re-approval.",
          code: "approved-content-changed",
        });
        return;
      }

      const updates: Partial<InsertTechniqueSheet> = {
        ...parsed.data,
        ...(Object.prototype.hasOwnProperty.call(parsed.data, "data")
          ? { data: documentValidation.data }
          : {}),
        status: (documentValidation.data as { status: string }).status,
      };
      const sheet = await storage.updateTechniqueSheet(sheetId, updates, req.orgId!);
      res.json(sheet);
    }),
  );

  app.delete(
    "/api/technique-sheets/:id",
    localHeaderIdentity,
    requireOrganizationIdentity,
    asyncRoute(async (req, res) => {
      const sheetId = parseResourceId(req, res);
      if (!sheetId) return;

      const existing = await storage.getTechniqueSheetById(sheetId, req.orgId!);
      if (!existing) {
        res.status(404).json({ error: "Technique sheet not found" });
        return;
      }
      if (!authorizeOwnedTechniqueSheet(existing, req.userId!, req.orgId!, res)) return;

      await storage.deleteTechniqueSheet(sheetId, req.orgId!);
      res.status(204).send();
    }),
  );

  app.post("/api/logs", (req, res) => {
    const parsed = clientLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendZodError(res, parsed.error);
    }

    const entry = parsed.data;
    logger[entry.level]({
      message: entry.message,
      source: "rtpt-client",
      clientTimestamp: entry.timestamp,
      context: entry.context,
      clientStack: entry.stack,
    });
    return res.status(202).json({ success: true });
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { TechniqueSheet } from "@shared/schema";
import {
  registerRtPtRoutes,
  validateSupportedRtPtDocument,
  validateWritableRtPtDocument,
  type RtPtRouteDependencies,
} from "./rtptRoutes";
import {
  createRtPtDocument,
  fingerprintRtPtApprovedContent,
} from "../src/lib/rtPtDocumentCodec";
import {
  createCompleteCrDocument,
  createCompleteDigitalDocument,
  createCompleteFilmDocument,
  createCompletePtDocument,
} from "../src/lib/__tests__/rtPtV3Fixtures";
import { emptyPtSheet } from "../src/types/penetrant";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ORG_ID = "11111111-1111-4111-8111-111111111111";

const validV1Document = {
  documentKind: "rtpt-document",
  schemaVersion: 1,
  method: "RT-Film",
  activeTabs: { rtFilm: "general", rtDigital: "general", pt: "general" },
  sheets: { rtFilm: {}, rtDigital: {}, penetrant: {} },
};

const validV2Document = {
  documentKind: "rtpt-document",
  schemaVersion: 2,
  documentType: "technique",
  documentId: "PT-TECH-001",
  status: "draft",
  documentControl: {
    number: "PT-001",
    title: "Penetrant technique",
    revision: "A",
    revisionDate: "",
    effectiveDate: "",
    changeSummary: "",
  },
  organization: { name: "", site: "" },
  job: { customer: "", contract: "", purchaseOrder: "", workOrder: "" },
  unitSystem: "SI",
  controlledReferences: [],
  approvals: [],
  method: "PT",
  technique: {
    general: {
      partName: "",
      partNumber: "",
      material: "",
      thickness: "",
      thicknessUnit: "mm",
      drawingReference: "",
      procedureNumber: "",
      inspectionStage: "",
      inspectorLevel: "",
      date: "",
    },
    materials: {
      penetrantType: "",
      method: "",
      sensitivityLevel: "",
      developerType: "",
      cleanerType: "",
    },
    surfacePrep: { cleaningMethod: "", surfaceCondition: "", dryingMethod: "" },
    application: {
      applicationMethod: "",
      dwellTime: "",
      removalMethod: "",
      rinsePressure: "",
      rinseTemperature: "",
    },
    development: { developerApplication: "", developmentTime: "" },
    conditions: { lightType: "", uvIntensity: "", whiteLight: "" },
    acceptance: { acceptanceStandard: "", linearIndications: "", roundedIndications: "" },
    postCleaning: { postCleaningMethod: "" },
  },
};

const validV3Document = createRtPtDocument({ method: "PT", technique: emptyPtSheet });

function createOlderV3FilmDocument(): Record<string, unknown> {
  const document = JSON.parse(JSON.stringify(createCompleteFilmDocument())) as Record<string, unknown>;
  const technique = document.technique as Record<string, unknown>;
  const exposureDefaults = technique.exposureDefaults as Record<string, unknown>;
  const exposureViews = technique.exposureViews as Array<Record<string, unknown>>;

  delete technique.ps811000Applicable;
  delete exposureDefaults.ps811000EnergyCurve;
  delete exposureDefaults.ps811000ThicknessBasis;
  delete exposureDefaults.machineTechniqueReference;
  delete exposureViews[0].ps811000EnergyCurve;
  delete exposureViews[0].ps811000ThicknessBasis;
  delete exposureViews[0].machineTechniqueReference;

  return document;
}

interface CapturedRoute {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  handlers: RequestHandler[];
}

function createFakeApp(): { app: Express; routes: CapturedRoute[] } {
  const routes: CapturedRoute[] = [];
  const capture = (method: CapturedRoute["method"]) => (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    routes.push({ method, path, handlers });
  };

  return {
    app: {
      get: capture("GET"),
      post: capture("POST"),
      patch: capture("PATCH"),
      delete: capture("DELETE"),
    } as unknown as Express,
    routes,
  };
}

function createStorage(overrides: Partial<RtPtRouteDependencies["storage"]> = {}) {
  const unused = async (): Promise<never> => {
    throw new Error("Unexpected storage call");
  };

  return {
    getInspectorProfilesByUserId: async () => [],
    getInspectorProfileById: async () => null,
    createInspectorProfile: unused,
    updateInspectorProfile: unused,
    deleteInspectorProfile: async () => undefined,
    getTechniqueSheetsByUserId: async () => [],
    getTechniqueSheetById: async () => null,
    createTechniqueSheet: unused,
    updateTechniqueSheet: unused,
    deleteTechniqueSheet: async () => undefined,
    ...overrides,
  } as RtPtRouteDependencies["storage"];
}

async function runHandlers(
  handlers: RequestHandler[],
  request: Request,
  response: Response,
): Promise<void> {
  for (const handler of handlers) {
    let nextCalled = false;
    let nextError: unknown;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = true;
      nextError = error;
    };

    await handler(request, response, next);
    if (nextError) throw nextError;
    if (!nextCalled) return;
  }
}

function createResponse(): Response & { body?: unknown; statusCode: number } {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body?: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as unknown as Response & { body?: unknown; statusCode: number };
}

function techniqueSheetRecord(
  data: unknown,
  userId = USER_ID,
  id = "22222222-2222-4222-8222-222222222222",
): TechniqueSheet {
  return {
    id,
    userId,
    orgId: ORG_ID,
    sheetName: "RT/PT technique",
    standard: null,
    data,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: null,
    modifiedBy: null,
    status: "draft",
  };
}

test("the standalone router exposes only the RT/PT API allowlist", () => {
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage(),
    listOrganizations: async () => [],
  });

  assert.deepEqual(
    routes.map(({ method, path }) => `${method} ${path}`).sort(),
    [
      "DELETE /api/inspector-profiles/:id",
      "DELETE /api/technique-sheets/:id",
      "GET /api/inspector-profiles",
      "GET /api/inspector-profiles/:id",
      "GET /api/organizations",
      "GET /api/organizations/:id/role",
      "GET /api/technique-sheets",
      "GET /api/technique-sheets/:id",
      "PATCH /api/inspector-profiles/:id",
      "PATCH /api/technique-sheets/:id",
      "POST /api/inspector-profiles",
      "POST /api/logs",
      "POST /api/technique-sheets",
    ],
  );
});

test("the read boundary recognizes V1/V2/V3 while the write boundary accepts only native V3", () => {
  assert.equal(validateSupportedRtPtDocument(validV1Document).success, true);
  assert.equal(validateSupportedRtPtDocument(validV2Document).success, true);
  assert.equal(validateSupportedRtPtDocument(validV3Document).success, true);
  assert.equal(validateSupportedRtPtDocument(createOlderV3FilmDocument()).success, true);
  assert.equal(validateWritableRtPtDocument(validV1Document).success, false);
  assert.equal(validateWritableRtPtDocument(validV2Document).success, false);
  assert.equal(validateWritableRtPtDocument(validV3Document).success, true);
  assert.deepEqual(validateSupportedRtPtDocument({ partA: {} }), {
    success: false,
    kind: "legacy-ut",
    message: "This document uses an unsupported legacy inspection data model.",
  });

  const future = validateSupportedRtPtDocument({
    ...validV2Document,
    schemaVersion: 99,
  });
  assert.equal(future.success, false);
  if (!future.success) assert.equal(future.kind, "unsupported-version");

  const unknownV3 = validateSupportedRtPtDocument({ ...validV3Document, unknown: true });
  assert.equal(unknownV3.success, false);
  if (!unknownV3.success) assert.match(unknownV3.message, /unknown|non-canonical/);

  const incomplete = validateSupportedRtPtDocument({
    ...validV1Document,
    sheets: { rtFilm: {}, rtDigital: {} },
  });
  assert.equal(incomplete.success, false);
});

test("the write boundary rejects a freshly fingerprinted Approved document that is not domain-complete", () => {
  const incompleteApproved = createCompletePtDocument("D", "Type I", "approved");
  incompleteApproved.approvals = [];
  incompleteApproved.approvalFingerprint = fingerprintRtPtApprovedContent(incompleteApproved);

  const validation = validateWritableRtPtDocument(incompleteApproved);
  assert.equal(validation.success, false);
  if (!validation.success) {
    assert.match(validation.message, /completeness and approval-readiness/i);
  }
});

test("the write boundary rejects re-fingerprinted Approved Digital IQI values that contradict their immutable rule", () => {
  const tamperedApproved = createCompleteDigitalDocument("approved");
  const planning = tamperedApproved.technique.planning!;
  planning.iqiRules.zoneOutputs[0].designation = "WIRE-99";
  planning.iqiRules.zoneOutputs[0].requiredWire = "W99";
  tamperedApproved.technique.acquisitions[0].plan!.iqiAssignment.designation = "WIRE-99";
  tamperedApproved.technique.acquisitions[0].plan!.iqiAssignment.requiredWire = "W99";
  tamperedApproved.approvalFingerprint = fingerprintRtPtApprovedContent(tamperedApproved);

  const validation = validateWritableRtPtDocument(tamperedApproved);
  assert.equal(validation.success, false);
  if (!validation.success) {
    assert.match(validation.message, /completeness and approval-readiness/i);
  }
});

test("technique-sheet GET canonicalizes an older V3 response without mutating stored data", async () => {
  const sheetId = "88888888-8888-4888-8888-888888888888";
  const storedData = createOlderV3FilmDocument();
  storedData.status = "in-review";
  const storedTechnique = storedData.technique as Record<string, unknown>;
  const storedSheet = techniqueSheetRecord(storedData, USER_ID, sheetId);
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      getTechniqueSheetById: async () => storedSheet,
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => (
    method === "GET" && path === "/api/technique-sheets/:id"
  ));
  assert.ok(route);

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: undefined,
    params: { id: sheetId },
  } as unknown as Request;
  const response = createResponse();
  await runHandlers(route.handlers, request, response);

  assert.equal(response.statusCode, 200);
  const returnedSheet = response.body as TechniqueSheet;
  const returnedData = returnedSheet.data as Record<string, unknown>;
  const returnedTechnique = returnedData.technique as Record<string, unknown>;
  assert.equal(returnedSheet.status, "in-review");
  assert.equal(returnedTechnique.ps811000Applicable, false);
  assert.equal(
    ((returnedTechnique.exposureDefaults as Record<string, unknown>).ps811000EnergyCurve),
    "",
  );
  assert.equal(storedSheet.status, "draft");
  assert.equal(Object.prototype.hasOwnProperty.call(storedTechnique, "ps811000Applicable"), false);
});

test("technique-sheet POST rejects unknown V3 fields even when known defaults are absent", async () => {
  let createCalls = 0;
  const unknownV3 = createOlderV3FilmDocument();
  const technique = unknownV3.technique as Record<string, unknown>;
  const exposureDefaults = technique.exposureDefaults as Record<string, unknown>;
  exposureDefaults.uncontrolledPlanningField = "must not be silently stripped";

  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      createTechniqueSheet: async () => {
        createCalls += 1;
        throw new Error("Unknown data reached storage");
      },
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => (
    method === "POST" && path === "/api/technique-sheets"
  ));
  assert.ok(route);

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Unknown V3 field", data: unknownV3 },
    params: {},
  } as unknown as Request;
  const response = createResponse();
  await runHandlers(route.handlers, request, response);

  assert.equal(response.statusCode, 400);
  assert.equal(createCalls, 0);
  assert.match(String((response.body as { error?: string }).error), /unknown or non-canonical/i);
});

test("technique-sheet POST rejects V1/V2 writes and persists canonical V3", async () => {
  const persisted: unknown[] = [];
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      createTechniqueSheet: async (insert) => {
        persisted.push(insert.data);
        return techniqueSheetRecord(insert.data);
      },
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => method === "POST" && path === "/api/technique-sheets");
  assert.ok(route);

  for (const legacy of [validV1Document, validV2Document]) {
    const request = {
      headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
      body: { sheetName: "Legacy write", data: legacy },
      params: {},
    } as unknown as Request;
    const response = createResponse();
    await runHandlers(route.handlers, request, response);
    assert.equal(response.statusCode, 400);
    assert.equal((response.body as { code: string }).code, "unsupported-version");
  }

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Native V3 write", data: validV3Document },
    params: {},
  } as unknown as Request;
  const response = createResponse();
  await runHandlers(route.handlers, request, response);
  assert.equal(response.statusCode, 201);
  assert.equal(persisted.length, 1);
  assert.equal((persisted[0] as { schemaVersion: number }).schemaVersion, 3);
});

test("the write boundary accepts complete RT-CR documents and POST persists them", async () => {
  const approvedCr = createCompleteCrDocument("approved");
  const writable = validateWritableRtPtDocument(approvedCr);
  assert.equal(writable.success, true);

  const supported = validateSupportedRtPtDocument(JSON.parse(JSON.stringify(approvedCr)));
  assert.equal(supported.success, true);

  const persisted: unknown[] = [];
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      createTechniqueSheet: async (insert) => {
        persisted.push(insert.data);
        return techniqueSheetRecord(insert.data);
      },
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => method === "POST" && path === "/api/technique-sheets");
  assert.ok(route);
  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Native V3 CR write", data: createCompleteCrDocument() },
    params: {},
  } as unknown as Request;
  const response = createResponse();
  await runHandlers(route.handlers, request, response);
  assert.equal(response.statusCode, 201);
  assert.equal(persisted.length, 1);
  assert.equal((persisted[0] as { method: string }).method, "RT-CR");
});

test("technique-sheet create and update derive envelope status from canonical V3 data", async () => {
  const sheetId = "99999999-9999-4999-8999-999999999999";
  const existingData = createRtPtDocument({
    method: "PT",
    technique: emptyPtSheet,
    status: "draft",
  });
  const createData = createRtPtDocument({
    method: "PT",
    technique: emptyPtSheet,
    status: "in-review",
  });
  const updateData = createRtPtDocument({
    method: "PT",
    technique: emptyPtSheet,
    status: "superseded",
  });
  let createdEnvelopeStatus: unknown;
  let updatedEnvelopeStatus: unknown;

  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      createTechniqueSheet: async (insert) => {
        createdEnvelopeStatus = insert.status;
        return techniqueSheetRecord(insert.data);
      },
      getTechniqueSheetById: async () => techniqueSheetRecord(existingData, USER_ID, sheetId),
      updateTechniqueSheet: async (_id, updates) => {
        updatedEnvelopeStatus = updates.status;
        return techniqueSheetRecord(updates.data ?? existingData, USER_ID, sheetId);
      },
    }),
    listOrganizations: async () => [],
  });

  const createRoute = routes.find(({ method, path }) => (
    method === "POST" && path === "/api/technique-sheets"
  ));
  const updateRoute = routes.find(({ method, path }) => (
    method === "PATCH" && path === "/api/technique-sheets/:id"
  ));
  assert.ok(createRoute);
  assert.ok(updateRoute);

  const createResponseValue = createResponse();
  await runHandlers(createRoute.handlers, {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Create status", status: "approved", data: createData },
    params: {},
  } as unknown as Request, createResponseValue);
  assert.equal(createResponseValue.statusCode, 201);
  assert.equal(createdEnvelopeStatus, "in-review");

  const updateResponseValue = createResponse();
  await runHandlers(updateRoute.handlers, {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { status: "draft", data: updateData },
    params: { id: sheetId },
  } as unknown as Request, updateResponseValue);
  assert.equal(updateResponseValue.statusCode, 200);
  assert.equal(updatedEnvelopeStatus, "superseded");
});

test("technique-sheet PATCH requires the resulting document to be native V3", async () => {
  const sheetId = "66666666-6666-4666-8666-666666666666";
  let existingData: unknown = validV2Document;
  let updateCalls = 0;
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      getTechniqueSheetById: async () => techniqueSheetRecord(existingData, USER_ID, sheetId),
      updateTechniqueSheet: async (_id, updates) => {
        updateCalls += 1;
        return techniqueSheetRecord(updates.data ?? existingData, USER_ID, sheetId);
      },
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => method === "PATCH" && path === "/api/technique-sheets/:id");
  assert.ok(route);

  const legacyRequest = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Rename legacy" },
    params: { id: sheetId },
  } as unknown as Request;
  const legacyResponse = createResponse();
  await runHandlers(route.handlers, legacyRequest, legacyResponse);
  assert.equal(legacyResponse.statusCode, 400);
  assert.equal(updateCalls, 0);

  existingData = validV3Document;
  const v3Request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: { sheetName: "Rename V3", data: validV3Document },
    params: { id: sheetId },
  } as unknown as Request;
  const v3Response = createResponse();
  await runHandlers(route.handlers, v3Request, v3Response);
  assert.equal(v3Response.statusCode, 200);
  assert.equal(updateCalls, 1);
});

test("technique-sheet PATCH rejects a non-canonical stale approval but accepts no-op and explicit draft revisions", async () => {
  const sheetId = "77777777-7777-4777-8777-777777777777";
  let existingData: unknown = createCompletePtDocument("D", "Type I", "approved");
  let updateCalls = 0;
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      getTechniqueSheetById: async () => techniqueSheetRecord(existingData, USER_ID, sheetId),
      updateTechniqueSheet: async (_id, updates) => {
        updateCalls += 1;
        existingData = updates.data ?? existingData;
        return techniqueSheetRecord(existingData, USER_ID, sheetId);
      },
    }),
    listOrganizations: async () => [],
  });
  const route = routes.find(({ method, path }) => method === "PATCH" && path === "/api/technique-sheets/:id");
  assert.ok(route);

  const patch = async (body: Record<string, unknown>) => {
    const request = {
      headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
      body,
      params: { id: sheetId },
    } as unknown as Request;
    const response = createResponse();
    await runHandlers(route.handlers, request, response);
    return response;
  };

  const metadataOnly = await patch({ sheetName: "Renamed approved technique" });
  assert.equal(metadataOnly.statusCode, 200);

  const exactApproved = structuredClone(existingData);
  const exact = await patch({ data: exactApproved });
  assert.equal(exact.statusCode, 200);

  const changedApproved = structuredClone(existingData) as ReturnType<typeof createCompletePtDocument>;
  changedApproved.technique.techniqueNotes = "Changed planned instruction that remains complete";
  const staleApproval = await patch({ data: changedApproved });
  assert.equal(staleApproval.statusCode, 400);
  assert.match(
    String((staleApproval.body as { error?: string }).error),
    /unknown or non-canonical fields/i,
  );

  const explicitDraft = structuredClone(changedApproved);
  explicitDraft.status = "draft";
  explicitDraft.approvals = [];
  const draftRevision = await patch({ data: explicitDraft });
  assert.equal(draftRevision.statusCode, 200);
  assert.equal(updateCalls, 3);
});

test("an invalid technique-sheet POST is rejected before storage", async () => {
  let createCalls = 0;
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      createTechniqueSheet: async () => {
        createCalls += 1;
        throw new Error("Invalid data reached storage");
      },
    }),
    listOrganizations: async () => [],
  });

  const route = routes.find(({ method, path }) => (
    method === "POST" && path === "/api/technique-sheets"
  ));
  assert.ok(route);

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: {
      sheetName: "Legacy sheet",
      standard: "legacy",
      status: "draft",
      data: { partA: {} },
    },
    params: {},
  } as unknown as Request;
  const response = createResponse();

  await runHandlers(route.handlers, request, response);
  assert.equal(response.statusCode, 400);
  assert.equal(createCalls, 0);
  assert.match(String((response.body as { error?: string }).error), /unsupported legacy inspection data model/);
});

test("the technique-sheet list filters legacy records", async () => {
  const olderV3 = createOlderV3FilmDocument();
  olderV3.status = "in-review";
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      getTechniqueSheetsByUserId: async () => [
        techniqueSheetRecord(validV2Document),
        techniqueSheetRecord(
          olderV3,
          USER_ID,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ),
        techniqueSheetRecord(
          { inspectionSetup: {} },
          USER_ID,
          "33333333-3333-4333-8333-333333333333",
        ),
      ],
    }),
    listOrganizations: async () => [],
  });

  const route = routes.find(({ method, path }) => (
    method === "GET" && path === "/api/technique-sheets"
  ));
  assert.ok(route);

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: undefined,
    params: {},
  } as unknown as Request;
  const response = createResponse();

  await runHandlers(route.handlers, request, response);
  assert.equal(response.statusCode, 200);
  const returnedSheets = response.body as TechniqueSheet[];
  assert.equal(returnedSheets.length, 2);
  assert.equal(returnedSheets[0].data, validV2Document);
  assert.equal(returnedSheets[1].status, "in-review");
  assert.equal(
    ((returnedSheets[1].data as Record<string, unknown>).technique as Record<string, unknown>)
      .ps811000Applicable,
    false,
  );
});

test("item reads enforce user ownership before returning a stored document", async () => {
  const sheetId = "44444444-4444-4444-8444-444444444444";
  const { app, routes } = createFakeApp();
  registerRtPtRoutes(app, {
    storage: createStorage({
      getTechniqueSheetById: async () => techniqueSheetRecord(
        validV2Document,
        "55555555-5555-4555-8555-555555555555",
        sheetId,
      ),
    }),
    listOrganizations: async () => [],
  });

  const route = routes.find(({ method, path }) => (
    method === "GET" && path === "/api/technique-sheets/:id"
  ));
  assert.ok(route);

  const request = {
    headers: { "x-user-id": USER_ID, "x-org-id": ORG_ID },
    body: undefined,
    params: { id: sheetId },
  } as unknown as Request;
  const response = createResponse();

  await runHandlers(route.handlers, request, response);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: "Forbidden" });
});

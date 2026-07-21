import { decodeRtPtDocument } from "@/lib/rtPtDocumentCodec";
import type { RtPtDocumentV3 } from "@/types/rtPtDocument";

const API_BASE = "/api/technique-sheets";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

interface RequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  userId: string;
  orgId?: string;
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  // Some environments mislabel JSON; attempt parse if it looks like JSON.
  const looksLikeJson = /^\s*[[{]/.test(rawText);
  const shouldTryJson = contentType.includes("application/json") || looksLikeJson;

  if (shouldTryJson) {
    try {
      // Empty JSON bodies are valid in some APIs; treat as undefined.
      if (!rawText.trim()) return undefined as T;
      return JSON.parse(rawText) as T;
    } catch {
      // Fall through to a descriptive error.
    }
  }

  const preview = rawText.trim().slice(0, 300);
  throw new Error(
    `Expected JSON response but got ${contentType || "unknown content-type"}. Body starts with: ${preview}`
  );
}

async function request<T>({ path, method = "GET", body, userId, orgId }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    "x-user-id": userId,
  };

  if (orgId) {
    headers["x-org-id"] = orgId;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await readJsonOrThrow<unknown>(response);
      if (!isRecord(errorBody)) throw new Error("Invalid error response");
      if (typeof errorBody.error === "string") {
        errorMessage = errorBody.error;
      }
      // Log details if available
      if (errorBody.details) {
        console.error('Validation errors:', errorBody.details);
        // Include first error detail in message if available
        if (Array.isArray(errorBody.details) && errorBody.details.length > 0) {
          const firstError = errorBody.details[0];
          if (isRecord(firstError)) {
            const path = Array.isArray(firstError.path) ? firstError.path.join('.') : 'data';
            const message = typeof firstError.message === 'string' ? firstError.message : 'validation failed';
            errorMessage += `: ${path} - ${message}`;
          }
        }
      }
    } catch (error) {
      // Ignore parse errors - fallback to default message
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return readJsonOrThrow<T>(response);
}

/** @deprecated Import RtPtDocumentV3 directly in new code. */
export type PersistedTechniqueSheetData = RtPtDocumentV3;

export interface TechniqueSheetRecord {
  id: string;
  userId: string;
  orgId: string | null;
  sheetName: string;
  standard: string | null;
  data: RtPtDocumentV3;
  status: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  userRole?: string;
}

export interface SaveTechniqueSheetInput {
  sheetId?: string;
  sheetName: string;
  standard: string;
  data: RtPtDocumentV3;
  status?: string;
  userId: string;
  orgId: string;
}

export interface LoadTechniqueSheetParams {
  sheetId: string;
  userId: string;
  orgId: string;
}

const ensureOrgId = (orgId?: string): string => {
  if (!orgId) {
    throw new Error("Organization ID is required for this operation");
  }
  return orgId;
};

function decodeDocumentOrThrow(value: unknown, boundary: string): RtPtDocumentV3 {
  const decoded = decodeRtPtDocument(value);
  if (decoded.status !== "success") {
    throw new Error(`${boundary}: ${decoded.message}`);
  }
  return decoded.document;
}

function decodeRecordOrThrow(value: unknown, boundary: string): TechniqueSheetRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${boundary}: the server response is not a technique-sheet record.`);
  }

  const record = value as Record<string, unknown>;
  return {
    ...record,
    data: decodeDocumentOrThrow(record.data, `${boundary} data`),
  } as unknown as TechniqueSheetRecord;
}

function decodeRecordListOrThrow(value: unknown): TechniqueSheetRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Load saved cards response: the server response is not an array.");
  }

  return value.map((record, index) => (
    decodeRecordOrThrow(record, `Saved card ${index + 1}`)
  ));
}

export const techniqueSheetService = {
  async fetchOrganizations(userId: string): Promise<OrganizationSummary[]> {
    return request<OrganizationSummary[]>({
      path: "/api/organizations",
      userId,
    });
  },

  async loadTechniqueSheets(userId: string, orgId: string): Promise<TechniqueSheetRecord[]> {
    const response = await request<unknown>({
      path: API_BASE,
      userId,
      orgId: ensureOrgId(orgId),
    });
    return decodeRecordListOrThrow(response);
  },

  async loadTechniqueSheet({ sheetId, userId, orgId }: LoadTechniqueSheetParams): Promise<TechniqueSheetRecord> {
    const response = await request<unknown>({
      path: `${API_BASE}/${sheetId}`,
      userId,
      orgId: ensureOrgId(orgId),
    });
    return decodeRecordOrThrow(response, `Saved card "${sheetId}"`);
  },

  async deleteTechniqueSheet(sheetId: string, userId: string, orgId: string): Promise<void> {
    await request<void>({
      path: `${API_BASE}/${sheetId}`,
      method: "DELETE",
      userId,
      orgId: ensureOrgId(orgId),
    });
  },

  async saveTechniqueSheet({ sheetId, sheetName, standard, data, status = "draft", userId, orgId }: SaveTechniqueSheetInput): Promise<TechniqueSheetRecord> {
    const validatedData = decodeDocumentOrThrow(data, "Save request data");
    const payload = {
      sheetName,
      standard,
      data: validatedData,
      status,
    };

    if (sheetId) {
      const response = await request<unknown>({
        path: `${API_BASE}/${sheetId}`,
        method: "PATCH",
        body: payload,
        userId,
        orgId: ensureOrgId(orgId),
      });
      return decodeRecordOrThrow(response, `Updated saved card "${sheetId}"`);
    }

    const response = await request<unknown>({
      path: API_BASE,
      method: "POST",
      body: payload,
      userId,
      orgId: ensureOrgId(orgId),
    });
    return decodeRecordOrThrow(response, "Created saved card");
  },
};

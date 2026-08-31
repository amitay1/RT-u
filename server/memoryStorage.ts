import { randomUUID } from "node:crypto";
import type {
  InsertProfile,
  InsertPurchaseHistory,
  InsertTechniqueSheet,
  InsertUserStandardAccess,
  Profile,
  PurchaseHistory,
  Standard,
  TechniqueSheet,
  UserStandardAccess,
} from "@shared/schema";
import type { IStorage } from "./storage";

/**
 * NON-PERSISTENT in-memory storage for local development without a
 * configured RTPT_DATABASE_URL. Mirrors DbStorage's org enforcement so the
 * API behaves identically; everything is lost when the process exits, which
 * is loudly announced at startup. Browser-side local persistence (drafts and
 * saved cards) is unaffected — it never touches this store.
 */
export class MemoryStorage implements IStorage {
  private readonly profiles = new Map<string, Profile>();
  private readonly techniqueSheets = new Map<string, TechniqueSheet>();
  private readonly purchases: PurchaseHistory[] = [];

  // Inspector Profiles
  async getInspectorProfilesByUserId(userId: string, orgId?: string): Promise<Profile[]> {
    return [...this.profiles.values()].filter((profile) => (
      profile.userId === userId && (!orgId || profile.orgId === orgId)
    ));
  }

  async getInspectorProfileById(id: string, orgId?: string): Promise<Profile | null> {
    const profile = this.profiles.get(id);
    if (!profile) return null;
    if (orgId && profile.orgId !== orgId) return null;
    return profile;
  }

  async createInspectorProfile(profile: InsertProfile): Promise<Profile> {
    const now = new Date();
    const record: Profile = {
      id: profile.id ?? randomUUID(),
      userId: profile.userId,
      name: profile.name,
      initials: profile.initials,
      certificationLevel: profile.certificationLevel,
      certificationNumber: profile.certificationNumber,
      certifyingOrganization: profile.certifyingOrganization,
      employeeId: profile.employeeId ?? null,
      department: profile.department ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      signature: profile.signature ?? null,
      isDefault: profile.isDefault ?? false,
      orgId: profile.orgId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(record.id, record);
    return record;
  }

  async updateInspectorProfile(id: string, profile: Partial<InsertProfile>, orgId?: string): Promise<Profile> {
    const existing = await this.getInspectorProfileById(id, orgId);
    if (!existing) throw new Error("Inspector profile not found or access denied");
    const { userId: _userId, orgId: _orgId, id: _id, ...safeUpdates } = profile;
    const updated: Profile = { ...existing, ...safeUpdates, updatedAt: new Date() } as Profile;
    this.profiles.set(id, updated);
    return updated;
  }

  async deleteInspectorProfile(id: string, orgId?: string): Promise<void> {
    const existing = await this.getInspectorProfileById(id, orgId);
    if (existing) this.profiles.delete(id);
  }

  // Technique Sheets — org enforcement mirrors DbStorage exactly.
  async getTechniqueSheetsByUserId(userId: string, orgId?: string): Promise<TechniqueSheet[]> {
    if (!orgId) throw new Error("Organization ID is required for all operations");
    return [...this.techniqueSheets.values()].filter((sheet) => (
      sheet.userId === userId && sheet.orgId === orgId
    ));
  }

  async getTechniqueSheetById(id: string, orgId?: string): Promise<TechniqueSheet | null> {
    if (!orgId) throw new Error("Organization ID is required for all operations");
    const sheet = this.techniqueSheets.get(id);
    return sheet && sheet.orgId === orgId ? sheet : null;
  }

  async createTechniqueSheet(sheet: InsertTechniqueSheet, orgId?: string): Promise<TechniqueSheet> {
    if (!orgId) throw new Error("Organization ID is required for all operations");
    const now = new Date();
    const record: TechniqueSheet = {
      id: sheet.id ?? randomUUID(),
      userId: sheet.userId,
      orgId,
      sheetName: sheet.sheetName,
      standard: sheet.standard ?? null,
      data: sheet.data,
      createdAt: now,
      updatedAt: now,
      createdBy: sheet.createdBy ?? null,
      modifiedBy: sheet.modifiedBy ?? null,
      status: sheet.status ?? "draft",
    };
    this.techniqueSheets.set(record.id, record);
    return record;
  }

  async updateTechniqueSheet(id: string, sheet: Partial<InsertTechniqueSheet>, orgId?: string): Promise<TechniqueSheet> {
    if (!orgId) throw new Error("Organization ID is required for all operations");
    const existing = this.techniqueSheets.get(id);
    if (!existing || existing.orgId !== orgId) {
      throw new Error("Technique sheet not found or access denied");
    }
    const { orgId: _orgId, userId: _userId, id: _id, ...safeUpdates } = sheet;
    const updated: TechniqueSheet = { ...existing, ...safeUpdates, updatedAt: new Date() } as TechniqueSheet;
    this.techniqueSheets.set(id, updated);
    return updated;
  }

  async deleteTechniqueSheet(id: string, orgId?: string): Promise<void> {
    if (!orgId) throw new Error("Organization ID is required for all operations");
    const existing = this.techniqueSheets.get(id);
    if (existing && existing.orgId === orgId) this.techniqueSheets.delete(id);
  }

  // Standards — the dev store ships none; nothing is invented.
  async getAllStandards(): Promise<Standard[]> {
    return [];
  }

  async getStandardById(_id: string): Promise<Standard | null> {
    return null;
  }

  async getStandardByCode(_code: string): Promise<Standard | null> {
    return null;
  }

  async getUserStandardAccess(_userId: string): Promise<(UserStandardAccess & { standard: Standard })[]> {
    return [];
  }

  async hasStandardAccess(_userId: string, _standardCode: string): Promise<boolean> {
    return false;
  }

  async grantStandardAccess(_access: InsertUserStandardAccess): Promise<UserStandardAccess> {
    throw new Error("Standard access management requires the configured RT-PT database.");
  }

  async updateStandardAccess(_id: string, _access: Partial<InsertUserStandardAccess>): Promise<UserStandardAccess> {
    throw new Error("Standard access management requires the configured RT-PT database.");
  }

  async createPurchaseHistory(purchase: InsertPurchaseHistory): Promise<PurchaseHistory> {
    const record: PurchaseHistory = {
      id: purchase.id ?? randomUUID(),
      userId: purchase.userId,
      orgId: purchase.orgId ?? null,
      standardId: purchase.standardId ?? null,
      bundleId: purchase.bundleId ?? null,
      purchaseType: purchase.purchaseType ?? null,
      amount: purchase.amount ?? null,
      status: purchase.status ?? null,
      stripePaymentIntentId: purchase.stripePaymentIntentId ?? null,
      stripeSubscriptionId: purchase.stripeSubscriptionId ?? null,
      createdAt: purchase.createdAt ?? new Date(),
    };
    this.purchases.push(record);
    return record;
  }

  async getUserPurchaseHistory(userId: string): Promise<PurchaseHistory[]> {
    return this.purchases.filter((purchase) => purchase.userId === userId);
  }
}

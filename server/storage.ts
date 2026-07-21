import type {
  InsertTechniqueSheet,
  TechniqueSheet,
  Standard,
  UserStandardAccess,
  InsertUserStandardAccess,
  PurchaseHistory,
  InsertPurchaseHistory,
  Profile,
  InsertProfile
} from "@shared/schema";

export interface IStorage {
  // Inspector Profiles - with org_id enforcement
  getInspectorProfilesByUserId(userId: string, orgId?: string): Promise<Profile[]>;
  getInspectorProfileById(id: string, orgId?: string): Promise<Profile | null>;
  createInspectorProfile(profile: InsertProfile): Promise<Profile>;
  updateInspectorProfile(id: string, profile: Partial<InsertProfile>, orgId?: string): Promise<Profile>;
  deleteInspectorProfile(id: string, orgId?: string): Promise<void>;

  // Technique Sheets - with org_id enforcement
  getTechniqueSheetsByUserId(userId: string, orgId?: string): Promise<TechniqueSheet[]>;
  getTechniqueSheetById(id: string, orgId?: string): Promise<TechniqueSheet | null>;
  createTechniqueSheet(sheet: InsertTechniqueSheet, orgId?: string): Promise<TechniqueSheet>;
  updateTechniqueSheet(id: string, sheet: Partial<InsertTechniqueSheet>, orgId?: string): Promise<TechniqueSheet>;
  deleteTechniqueSheet(id: string, orgId?: string): Promise<void>;

  // Standards
  getAllStandards(): Promise<Standard[]>;
  getStandardById(id: string): Promise<Standard | null>;
  getStandardByCode(code: string): Promise<Standard | null>;

  // User Standard Access
  getUserStandardAccess(userId: string): Promise<(UserStandardAccess & { standard: Standard })[]>;
  hasStandardAccess(userId: string, standardCode: string): Promise<boolean>;
  grantStandardAccess(access: InsertUserStandardAccess): Promise<UserStandardAccess>;
  updateStandardAccess(id: string, access: Partial<InsertUserStandardAccess>): Promise<UserStandardAccess>;

  // Purchase History
  createPurchaseHistory(purchase: InsertPurchaseHistory): Promise<PurchaseHistory>;
  getUserPurchaseHistory(userId: string): Promise<PurchaseHistory[]>;
}

import { db } from "./db";
import { techniqueSheets, standards, userStandardAccess, purchaseHistory, profiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class DbStorage implements IStorage {
  // Inspector Profiles Methods
  async getInspectorProfilesByUserId(userId: string, orgId?: string): Promise<Profile[]> {
    const conditions = [eq(profiles.userId, userId)];
    if (orgId) {
      conditions.push(eq(profiles.orgId, orgId));
    }

    return await db.select().from(profiles)
      .where(and(...conditions));
  }

  async getInspectorProfileById(id: string, orgId?: string): Promise<Profile | null> {
    const conditions = [eq(profiles.id, id)];
    if (orgId) {
      conditions.push(eq(profiles.orgId, orgId));
    }

    const results = await db.select().from(profiles)
      .where(and(...conditions));
    return results[0] || null;
  }

  async createInspectorProfile(profile: InsertProfile): Promise<Profile> {
    const results = await db.insert(profiles).values(profile).returning();
    return results[0];
  }

  async updateInspectorProfile(id: string, profile: Partial<InsertProfile>, orgId?: string): Promise<Profile> {
    // Filter out protected fields
    const { userId: _, orgId: __, ...safeUpdates } = profile;

    const conditions = [eq(profiles.id, id)];
    if (orgId) {
      conditions.push(eq(profiles.orgId, orgId));
    }

    const results = await db
      .update(profiles)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    if (!results[0]) {
      throw new Error("Inspector profile not found or access denied");
    }

    return results[0];
  }

  async deleteInspectorProfile(id: string, orgId?: string): Promise<void> {
    const conditions = [eq(profiles.id, id)];
    if (orgId) {
      conditions.push(eq(profiles.orgId, orgId));
    }

    await db.delete(profiles).where(and(...conditions));
  }

  // Technique Sheets Methods
  async getTechniqueSheetsByUserId(userId: string, orgId?: string): Promise<TechniqueSheet[]> {
    // ALWAYS enforce org_id for multi-tenant security
    if (!orgId) {
      throw new Error("Organization ID is required for all operations");
    }
    
    return await db.select().from(techniqueSheets)
      .where(and(
        eq(techniqueSheets.userId, userId),
        eq(techniqueSheets.orgId, orgId)
      ));
  }

  async getTechniqueSheetById(id: string, orgId?: string): Promise<TechniqueSheet | null> {
    // ALWAYS enforce org_id for multi-tenant security
    if (!orgId) {
      throw new Error("Organization ID is required for all operations");
    }
    
    const results = await db.select().from(techniqueSheets)
      .where(and(
        eq(techniqueSheets.id, id),
        eq(techniqueSheets.orgId, orgId)
      ));
    return results[0] || null;
  }

  async createTechniqueSheet(sheet: InsertTechniqueSheet, orgId?: string): Promise<TechniqueSheet> {
    // ALWAYS enforce org_id for multi-tenant security
    if (!orgId) {
      throw new Error("Organization ID is required for all operations");
    }
    
    // Force org_id and prevent client override
    const dataToInsert = {
      ...sheet,
      orgId, // Always use server-provided orgId
    };
    
    try {
      console.log('🔵 Inserting technique sheet with data:', JSON.stringify({
        userId: dataToInsert.userId,
        orgId: dataToInsert.orgId,
        sheetName: dataToInsert.sheetName,
        standard: dataToInsert.standard,
        status: dataToInsert.status,
        dataKeys: Object.keys(dataToInsert.data || {})
      }, null, 2));
      
      const results = await db.insert(techniqueSheets).values(dataToInsert).returning();
      console.log('✅ Insert successful, id:', results[0]?.id);
      return results[0];
    } catch (error: unknown) {
      const errorDetails = typeof error === 'object' && error !== null
        ? error as Record<string, unknown>
        : {};
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Insert failed:', message);
      console.error('   Error code:', errorDetails.code);
      console.error('   Error detail:', errorDetails.detail);
      throw error;
    }
  }

  async updateTechniqueSheet(id: string, sheet: Partial<InsertTechniqueSheet>, orgId?: string): Promise<TechniqueSheet> {
    // ALWAYS enforce org_id for multi-tenant security
    if (!orgId) {
      throw new Error("Organization ID is required for all operations");
    }
    
    // Filter out protected fields that clients shouldn't override
    const { orgId: _, userId: __, ...safeUpdates } = sheet;
    
    const whereClause = and(
      eq(techniqueSheets.id, id),
      eq(techniqueSheets.orgId, orgId)
    );
    
    const results = await db
      .update(techniqueSheets)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(whereClause)
      .returning();
    
    if (!results[0]) {
      throw new Error("Technique sheet not found or access denied");
    }
    
    return results[0];
  }

  async deleteTechniqueSheet(id: string, orgId?: string): Promise<void> {
    // ALWAYS enforce org_id for multi-tenant security
    if (!orgId) {
      throw new Error("Organization ID is required for all operations");
    }
    
    const whereClause = and(
      eq(techniqueSheets.id, id),
      eq(techniqueSheets.orgId, orgId)
    );
    
    await db.delete(techniqueSheets).where(whereClause);
  }

  async getAllStandards(): Promise<Standard[]> {
    return await db.select().from(standards).where(eq(standards.isActive, true));
  }

  async getStandardById(id: string): Promise<Standard | null> {
    const results = await db.select().from(standards).where(eq(standards.id, id));
    return results[0] || null;
  }

  async getStandardByCode(code: string): Promise<Standard | null> {
    const results = await db.select().from(standards).where(eq(standards.code, code));
    return results[0] || null;
  }

  async getUserStandardAccess(userId: string): Promise<(UserStandardAccess & { standard: Standard })[]> {
    const results = await db
      .select({
        id: userStandardAccess.id,
        userId: userStandardAccess.userId,
        standardId: userStandardAccess.standardId,
        accessType: userStandardAccess.accessType,
        purchaseDate: userStandardAccess.purchaseDate,
        expiryDate: userStandardAccess.expiryDate,
        isActive: userStandardAccess.isActive,
        stripePaymentId: userStandardAccess.stripePaymentId,
        stripeSubscriptionId: userStandardAccess.stripeSubscriptionId,
        lemonSqueezyOrderId: userStandardAccess.lemonSqueezyOrderId,
        createdAt: userStandardAccess.createdAt,
        standard: standards,
      })
      .from(userStandardAccess)
      .leftJoin(standards, eq(userStandardAccess.standardId, standards.id))
      .where(and(
        eq(userStandardAccess.userId, userId),
        eq(userStandardAccess.isActive, true)
      ));
    
    return results.filter(r => r.standard !== null) as (UserStandardAccess & { standard: Standard })[];
  }

  async hasStandardAccess(userId: string, standardCode: string): Promise<boolean> {
    const standard = await this.getStandardByCode(standardCode);
    if (!standard) return false;
    if (standard.isFree) return true;

    const access = await db
      .select()
      .from(userStandardAccess)
      .where(and(
        eq(userStandardAccess.userId, userId),
        eq(userStandardAccess.standardId, standard.id),
        eq(userStandardAccess.isActive, true)
      ));

    if (access.length === 0) return false;

    const userAccess = access[0];
    if (!userAccess.expiryDate) return true;

    return new Date(userAccess.expiryDate) > new Date();
  }

  async grantStandardAccess(access: InsertUserStandardAccess): Promise<UserStandardAccess> {
    const results = await db.insert(userStandardAccess).values(access).returning();
    return results[0];
  }

  async updateStandardAccess(id: string, access: Partial<InsertUserStandardAccess>): Promise<UserStandardAccess> {
    const results = await db
      .update(userStandardAccess)
      .set(access)
      .where(eq(userStandardAccess.id, id))
      .returning();
    return results[0];
  }

  async createPurchaseHistory(purchase: InsertPurchaseHistory): Promise<PurchaseHistory> {
    const results = await db.insert(purchaseHistory).values(purchase).returning();
    return results[0];
  }

  async getUserPurchaseHistory(userId: string): Promise<PurchaseHistory[]> {
    return await db.select().from(purchaseHistory).where(eq(purchaseHistory.userId, userId));
  }
}

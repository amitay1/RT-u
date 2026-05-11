// Debug script to test Drizzle ORM insert
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';

const { Pool } = pg;

// Define table (same as schema.ts)
const techniqueSheets = pgTable("technique_sheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  orgId: uuid("org_id"),
  sheetName: text("sheet_name").notNull(),
  standard: text("standard"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by"),
  modifiedBy: text("modified_by"),
  status: text("status").default("draft"),
});

const pool = new Pool({ 
  connectionString: 'postgresql://scanmaster:scanmaster_dev_password@localhost:5433/scanmaster'
});

const db = drizzle(pool);

async function test() {
  try {
    console.log('Testing Drizzle ORM insert...');
    
    const testData = { test: 'hello', nested: { value: 123 } };
    
    const results = await db.insert(techniqueSheets).values({
      userId: '00000000-0000-0000-0000-000000000000',
      orgId: '11111111-1111-1111-1111-111111111111',
      sheetName: 'Drizzle Debug Test',
      standard: 'AMS-STD-2154E',
      data: testData,
      status: 'draft'
    }).returning();
    
    console.log('✅ Drizzle Insert OK, id:', results[0].id);
    
    // Clean up
    const { eq } = await import('drizzle-orm');
    await db.delete(techniqueSheets).where(eq(techniqueSheets.sheetName, 'Drizzle Debug Test'));
    console.log('✅ Cleanup OK');
    
  } catch (err) {
    console.error('❌ Drizzle Error:', err.message);
    console.error('   Full error:', err);
  } finally {
    await pool.end();
  }
}

test();

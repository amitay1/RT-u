import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { config } from "dotenv";

// Load environment variables
config();

const databaseUrl = process.env.RTPT_DATABASE_URL;

/**
 * True when the dedicated RT-PT database is configured. Generic DATABASE_URL
 * credentials are intentionally ignored — the server never falls back to a
 * shared or legacy database. When unconfigured, the server runs in local
 * development mode with non-persistent in-memory storage (see server/index.ts)
 * and any direct database use below fails with the original guard message.
 */
export const isRtPtDatabaseConfigured = Boolean(databaseUrl);

type RtPtDrizzle = ReturnType<typeof drizzle<typeof schema>>;

let poolInstance: Pool | null = null;
let dbInstance: RtPtDrizzle | null = null;

function requireDatabase(): { pool: Pool; db: RtPtDrizzle } {
  if (!databaseUrl) {
    throw new Error(
      "RTPT_DATABASE_URL must be set to the dedicated RT-PT Inspector database. Generic DATABASE_URL credentials are intentionally ignored.",
    );
  }
  if (!poolInstance || !dbInstance) {
    // Check if using local database (no SSL needed) or cloud (SSL required)
    const isLocalDb = databaseUrl.includes('localhost') ||
                      databaseUrl.includes('127.0.0.1') ||
                      databaseUrl.includes('@postgres:') ||
                      process.env.DOCKER_ENV === 'true';

    const sslMode = process.env.RTPT_DATABASE_SSL_MODE || (isLocalDb ? 'disable' : 'verify-full');
    if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
      throw new Error('RTPT_DATABASE_SSL_MODE must be disable, require, or verify-full.');
    }

    const ssl = sslMode === 'disable'
      ? false
      : { rejectUnauthorized: sslMode === 'verify-full' };

    console.log('🔵 Database configuration:', { isLocalDb, sslMode });

    poolInstance = new Pool({ connectionString: databaseUrl, ssl });
    dbInstance = drizzle(poolInstance, { schema });

    // Test connection on first use
    poolInstance.query('SELECT NOW()')
      .then(() => console.log('✅ Database connection successful'))
      .catch((err) => console.error('❌ Database connection failed:', err.message));
  }
  return { pool: poolInstance, db: dbInstance };
}

/**
 * Lazy proxies: importing this module never throws; touching the database
 * without RTPT_DATABASE_URL configured throws the guard error at the call
 * site instead of crashing the whole dev server at import time.
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, property) {
    const value = requireDatabase().pool[property as keyof Pool];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(requireDatabase().pool) : value;
  },
});

export const db: RtPtDrizzle = new Proxy({} as RtPtDrizzle, {
  get(_target, property) {
    const instance = requireDatabase().db;
    const value = instance[property as keyof RtPtDrizzle];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});

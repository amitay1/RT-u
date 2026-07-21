import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { config } from "dotenv";

// Load environment variables
config();

const databaseUrl = process.env.RTPT_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "RTPT_DATABASE_URL must be set to the dedicated RT-PT Inspector database. Generic DATABASE_URL credentials are intentionally ignored.",
  );
}

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

console.log('🔵 Database configuration:', {
  isLocalDb,
  sslMode,
});

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl,
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connection successful'))
  .catch((err) => console.error('❌ Database connection failed:', err.message));

export const db = drizzle(pool, { schema });

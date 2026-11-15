import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set to the Supabase PostgreSQL pooled connection string.",
  );
}

/**
 * Reuse one pool per warm serverless instance. Supabase Transaction Pooler
 * should be used for Vercel runtime connections; keep the per-instance pool
 * small so horizontally scaled functions do not exhaust the database pool.
 */
export const pool = new Pool({
  connectionString: databaseUrl,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export const db = drizzle(pool, { schema });

export * from "./schema";

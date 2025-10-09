// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Make sure you have DATABASE_URL in your .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

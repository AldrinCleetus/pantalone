import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as authSchema from "./auth-schema.js";
import * as appSchema from "./schema.js";

export const schema = { ...appSchema, ...authSchema };

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Keep pool lean for a 1 GB RAM VPS
  max: 10,
});

export const db = drizzle(pool, { schema });

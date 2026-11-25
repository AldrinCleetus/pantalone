import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  STORE_NAME: z.string().trim().min(1).default("Knight Makes"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://pantalone:pantalone@localhost:5434/pantalone"),
  BETTER_AUTH_SECRET: z.string().min(1).default("dev-only-secret-change-in-production-32-chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default(""),
  R2_PUBLIC_BASE_URL: z.string().optional().default(""),
  EMAIL_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("orders@example.com"),
});

export const env = envSchema.parse(process.env);

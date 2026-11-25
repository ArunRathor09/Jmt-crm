import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_DIRECT_URL: z.string().url().optional(),
    SESSION_SECRET: z.string().min(32),
    SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
    SEED_SUPER_ADMIN_USERNAME: z.string().min(3).optional(),
    SEED_SUPER_ADMIN_PASSWORD: z.string().min(14).optional(),
    ENCRYPTION_KEY: z.string().min(32),
    RESEND_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    GOOGLE_SHEETS_WEBHOOK_SECRET: z.string().min(32).optional(),
  },
  experimental__runtimeEnv: process.env,
});

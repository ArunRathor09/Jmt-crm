import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "@node-rs/argon2";
import { leadSources, packages, users } from "./schema";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const username = process.env.SEED_SUPER_ADMIN_USERNAME;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !username || !password) {
    throw new Error(
      "Set SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_USERNAME, and SEED_SUPER_ADMIN_PASSWORD",
    );
  }

  const db = drizzle(neon(databaseUrl));
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await db.insert(users).values({
    email,
    username,
    passwordHash,
    role: "SUPER_ADMIN",
    fullName: "JMT Super Admin",
    mustChangePassword: false,
    twoFactorEnabled: false,
  }).onConflictDoNothing();

  await db.insert(leadSources).values([
    { name: "Website" },
    { name: "Facebook" },
    { name: "Instagram" },
    { name: "Google Ads" },
    { name: "Referral" },
    { name: "Walk-in" },
    { name: "Cold Call" },
    { name: "Other" },
  ]).onConflictDoNothing();

  await db.insert(packages).values([
    {
      name: "Starter",
      code: "STARTER",
      description: "Starter package",
      price: 0,
      status: "ACTIVE",
    },
  ]).onConflictDoNothing();

  console.log("Database seed completed");
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database seed failed");
  process.exit(1);
});

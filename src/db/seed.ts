import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "@node-rs/argon2";
import { eq, inArray } from "drizzle-orm";
import { accountsSecurity, leadSources, packages, users } from "./schema";

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
  if (password.length < 14) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 14 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  const db = drizzle(neon(databaseUrl));
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await db
    .insert(users)
    .values({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      role: "SUPER_ADMIN",
      fullName: "JMT Super Admin",
      mustChangePassword: false,
      twoFactorEnabled: false,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, updatedAt: new Date() },
      setWhere: eq(users.role, "SUPER_ADMIN"),
    });

  const [superAdmin] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (!superAdmin || superAdmin.role !== "SUPER_ADMIN") {
    throw new Error("SEED_SUPER_ADMIN_EMAIL must belong to a super-admin account");
  }
  await db
    .update(users)
    .set({ mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, superAdmin.id));
  await db
    .insert(accountsSecurity)
    .values({ userId: superAdmin.id })
    .onConflictDoNothing();

  const defaultLeadSources = [
    { name: "Website" },
    { name: "Facebook" },
    { name: "Instagram" },
    { name: "Google Ads" },
    { name: "Referral" },
    { name: "Walk-in" },
    { name: "Cold Call" },
    { name: "Other" },
  ];
  const existingLeadSources = await db
    .select({ name: leadSources.name })
    .from(leadSources)
    .where(inArray(leadSources.name, defaultLeadSources.map((source) => source.name)));
  const existingLeadSourceNames = new Set(existingLeadSources.map((source) => source.name));
  const missingLeadSources = defaultLeadSources.filter(
    (source) => !existingLeadSourceNames.has(source.name),
  );
  if (missingLeadSources.length > 0) {
    await db.insert(leadSources).values(missingLeadSources);
  }

  const [starterPackage] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.code, "STARTER"))
    .limit(1);
  if (!starterPackage) {
    await db.insert(packages).values({
      name: "Starter",
      code: "STARTER",
      description: "Starter package",
      price: 0,
      status: "ACTIVE",
    });
  }

  console.log("Database seed completed");
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database seed failed");
  process.exit(1);
});

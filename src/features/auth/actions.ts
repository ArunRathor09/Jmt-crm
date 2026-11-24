"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verify, hash } from "@node-rs/argon2";
import { eq, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/src/db";
import { accountsSecurity, auditLogs, users } from "@/src/db/schema";
import { createSession, revokeSession } from "@/src/lib/auth/session";
import { changePasswordSchema, loginSchema } from "./schemas";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(
  input: z.input<typeof loginSchema>,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid credentials" };
  }

  const identifier = parsed.data.identifier.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        sql`lower(${users.email}) = ${identifier}`,
        sql`lower(${users.username}) = ${identifier}`,
      ),
    )
    .limit(1);

  if (!user || !user.active || user.deletedAt) {
    return { ok: false, error: "Invalid credentials" };
  }

  const [security] = await db
    .select()
    .from(accountsSecurity)
    .where(eq(accountsSecurity.userId, user.id))
    .limit(1);

  if (security?.lockedUntil && security.lockedUntil > new Date()) {
    return { ok: false, error: "Invalid credentials" };
  }

  let valid = false;
  try {
    valid = await verify(user.passwordHash, parsed.data.password);
  } catch {
    valid = false;
  }

  if (!valid) {
    if (security) {
      const failedAttempts = (security.failedAttempts ?? 0) + 1;
      await db
        .update(accountsSecurity)
        .set({
          failedAttempts,
          lockedUntil: failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(accountsSecurity.userId, user.id));
    }
    return { ok: false, error: "Invalid credentials" };
  }

  if (security) {
    await db
      .update(accountsSecurity)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(accountsSecurity.userId, user.id));
  }

  const requestHeaders = await headers();
  await createSession(user.id, {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: requestHeaders.get("user-agent") ?? undefined,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db.insert(auditLogs).values({
    actorId: user.id,
    action: "LOGIN",
    entityType: "USER",
    entityId: user.id,
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: requestHeaders.get("user-agent"),
  });

  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await revokeSession();
  redirect("/login");
}

export async function changePasswordAction(
  input: z.input<typeof changePasswordSchema>,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const { getSession } = await import("@/src/lib/auth/session");
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/login");

  let currentValid = false;
  try {
    currentValid = await verify(user.passwordHash, parsed.data.currentPassword);
  } catch {
    currentValid = false;
  }
  if (!currentValid) return { ok: false, error: "Current password is incorrect" };

  const passwordHash = await hash(parsed.data.newPassword, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      version: sql`${users.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { ok: true };
}

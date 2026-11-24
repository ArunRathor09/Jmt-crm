import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { sessions, users } from "@/src/db/schema";

export const SESSION_COOKIE = "jmt_session";
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  requestMeta: { ipAddress?: string; userAgent?: string },
) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS),
    idleExpiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });

  return token;
}

export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .update(sessions)
    .set({
      idleExpiresAt: sql`now() + (${IDLE_TIMEOUT_MS} * interval '1 millisecond')`,
      updatedAt: sql`now()`,
    })
    .from(users)
    .where(
      and(
        eq(sessions.userId, users.id),
        eq(sessions.tokenHash, hashSessionToken(token)),
        isNull(sessions.revokedAt),
        isNull(sessions.deletedAt),
        gt(sessions.expiresAt, sql`now()`),
        gt(sessions.idleExpiresAt, sql`now()`),
        eq(users.active, true),
        isNull(users.deletedAt),
      ),
    )
    .returning({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      twoFactorEnabled: users.twoFactorEnabled,
      idleExpiresAt: sessions.idleExpiresAt,
      expiresAt: sessions.expiresAt,
    });

  if (!row) return null;

  return row;
});

export async function revokeSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

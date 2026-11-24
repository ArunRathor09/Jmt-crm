"use server";

import { eq } from "drizzle-orm";
import { verify } from "otplib";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { accountsSecurity, users } from "@/src/db/schema";
import { encryptSecret } from "@/src/lib/crypto";
import { getSession } from "@/src/lib/auth/session";

export async function enableTotpAction(
  secret: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await verify({ secret, token });
  if (!result.valid) {
    return { ok: false, error: "Invalid authentication code" };
  }

  await db
    .insert(accountsSecurity)
    .values({
      userId: session.userId,
      totpSecretEncrypted: encryptSecret(secret),
      failedAttempts: 0,
    })
    .onConflictDoUpdate({
      target: accountsSecurity.userId,
      set: {
        totpSecretEncrypted: encryptSecret(secret),
        updatedAt: new Date(),
      },
    });

  await db
    .update(users)
    .set({ twoFactorEnabled: true, updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  return { ok: true };
}

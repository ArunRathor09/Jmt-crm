"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { packages } from "@/src/db/schema";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";

const createPackageSchema = z.object({
  name: z.string().trim().min(1, "Enter a package name.").max(150),
  category: z.enum(["DOMESTIC", "INTERNATIONAL"]),
  price: z.coerce.number().int().min(0).max(2_147_483_647),
  description: z.string().trim().max(5000).optional(),
  durationDays: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(1).max(3650).optional(),
  ),
});

export type PackageActionState = {
  error: string | null;
  success: boolean;
};

export async function createPackageAction(
  _previousState: PackageActionState,
  formData: FormData,
): Promise<PackageActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "packages.manage")) {
    return { error: "You do not have permission to manage packages.", success: false };
  }

  const parsed = createPackageSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    price: formData.get("price"),
    description: formData.get("description"),
    durationDays: formData.get("durationDays"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the package details and try again.",
      success: false,
    };
  }

  const codePrefix =
    parsed.data.name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "PACKAGE";
  const code = `${codePrefix}-${randomBytes(3).toString("hex").toUpperCase()}`;

  await db.insert(packages).values({
    name: parsed.data.name,
    code,
    category: parsed.data.category,
    price: parsed.data.price,
    description: parsed.data.description || null,
    durationDays: parsed.data.durationDays ?? null,
  });

  revalidatePath("/packages");
  revalidatePath("/leads");
  return { error: null, success: true };
}

const updatePackageStatusSchema = z.object({
  packageId: z.uuid(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

export async function updatePackageStatusAction(packageId: string, status: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "packages.manage")) {
    return { error: "You do not have permission to manage packages." };
  }

  const parsed = updatePackageStatusSchema.safeParse({ packageId, status });
  if (!parsed.success) {
    return { error: "Choose a valid package and status." };
  }

  const [updatedPackage] = await db
    .update(packages)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(packages.id, parsed.data.packageId), isNull(packages.deletedAt)))
    .returning({ id: packages.id });
  if (!updatedPackage) return { error: "This package was not found or was already deleted." };

  revalidatePath("/packages");
  revalidatePath("/leads");
  return { error: null };
}

export async function deletePackageAction(packageId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "packages.manage")) {
    return { error: "You do not have permission to manage packages." };
  }

  const parsedId = z.uuid().safeParse(packageId);
  if (!parsedId.success) return { error: "Choose a valid package to delete." };

  const [deletedPackage] = await db
    .update(packages)
    .set({ status: "ARCHIVED", deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(packages.id, parsedId.data), isNull(packages.deletedAt)))
    .returning({ id: packages.id });
  if (!deletedPackage) return { error: "This package was not found or was already deleted." };

  revalidatePath("/packages");
  revalidatePath("/leads");
  return { error: null };
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";
import { db } from "@/src/db";
import { leadSources, leads } from "@/src/db/schema";
import { createLeadSchema } from "./schemas";

export type LeadActionState = {
  error: string | null;
  success: boolean;
};

export async function createLeadAction(
  _previousState: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.create")) {
    return { error: "You do not have permission to create leads.", success: false };
  }

  const parsed = createLeadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    company: formData.get("company"),
    sourceId: formData.get("sourceId"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the lead details and try again.",
      success: false,
    };
  }

  if (parsed.data.sourceId) {
    const [source] = await db
      .select({ id: leadSources.id })
      .from(leadSources)
      .where(
        and(
          eq(leadSources.id, parsed.data.sourceId),
          eq(leadSources.active, true),
          isNull(leadSources.deletedAt),
        ),
      )
      .limit(1);
    if (!source) return { error: "Choose an active lead source.", success: false };
  }

  const [createdLead] = await db
    .insert(leads)
    .values({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      company: parsed.data.company,
      sourceId: parsed.data.sourceId,
      createdBy: session.userId,
    })
    .onConflictDoNothing()
    .returning({ id: leads.id });

  if (!createdLead) {
    return { error: "A lead with this phone number already exists.", success: false };
  }

  revalidatePath("/leads");
  return { error: null, success: true };
}

import { createHash } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import {
  leadCategoryEnum,
  leadExternalReferences,
  leads,
  leadStatusEnum,
} from "@/src/db/schema";
import { createLeadSchema, parseLeadCategory } from "./schemas";
import { normalizeCsvHeader } from "./csv";

const provider = "google-sheets-dubai";
type LeadStatus = (typeof leadStatusEnum.enumValues)[number];

const sheetStatusMap: Record<string, LeadStatus> = {
  NEW: "NEW",
  OPEN: "NEW",
  CONTACTED: "CONTACTED",
  IN_PROGRESS: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  CLOSED_WON: "WON",
  LOST: "LOST",
  CLOSED_LOST: "LOST",
  JUNK: "JUNK",
  SPAM: "JUNK",
};

const sheetLeadSchema = createLeadSchema
  .omit({ phone: true })
  .extend({ phone: z.string().min(7).max(20).optional() });

const leadProjection = {
  id: leads.id,
  name: leads.name,
  phone: leads.phone,
  market: leads.market,
  alternatePhone: leads.alternatePhone,
  email: leads.email,
  city: leads.city,
  description: leads.description,
  budget: leads.budget,
  status: leads.status,
  category: leads.category,
  sourceData: leads.sourceData,
  payloadHash: sql<string | null>`null`,
};

type ExistingLead = {
  id: string;
  name: string;
  phone: string | null;
  market: string;
  alternatePhone: string | null;
  email: string | null;
  city: string | null;
  description: string | null;
  budget: number | null;
  status: LeadStatus;
  category: (typeof leadCategoryEnum.enumValues)[number] | null;
  sourceData: Record<string, string> | null;
  payloadHash: string | null;
};

export type DubaiSheetRow = {
  rowNumber: number;
  values: Record<string, string>;
};

function cellAt(values: Record<string, string>, ...headers: string[]) {
  const cells = new Map(
    Object.entries(values).map(([header, value]) => [normalizeCsvHeader(header), value.trim()]),
  );
  for (const header of headers) {
    const value = cells.get(normalizeCsvHeader(header));
    if (value) return value;
  }
  return "";
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const explicitInternational = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  } else if (
    !explicitInternational &&
    !(digits.startsWith("91") && digits.length === 12) &&
    !(digits.startsWith("971") && digits.length === 12)
  ) {
    throw new Error("Phone must be a 10-digit local number or include an international country code.");
  }

  if (digits.length < 7 || digits.length > 15 || digits.startsWith("0")) {
    throw new Error("Phone number is not a valid E.164 number.");
  }
  return `+${digits}`;
}

function parseBudget(value: string) {
  const normalized = value
    .trim()
    .replace(/^(?:₹|INR)\s*/i, "")
    .replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Math.round(Number(normalized));
  return Number.isSafeInteger(amount) && amount <= 2_147_483_647 ? amount : undefined;
}

function getExternalKeys(values: Record<string, string>, phone: string | undefined, name: string) {
  const keys: string[] = [];
  const metaLeadId = cellAt(
    values,
    "lead_id",
    "leadid",
    "meta_lead_id",
    "meta_leadid",
    "facebook_lead_id",
    "facebookleadid",
    "id",
  );
  if (metaLeadId) {
    const digest = createHash("sha256").update(metaLeadId).digest("hex");
    keys.push(`meta-lead:${digest}`);
  }

  const createdAt = cellAt(values, "created_time");
  const formId = cellAt(values, "form_id");
  if (createdAt && formId) {
    const identityValues = [
      `${createdAt}\n${formId}`,
      `${createdAt}\n${name.trim().toLowerCase()}\n${formId}`,
    ];
    for (const identity of identityValues) {
      const digest = createHash("sha256").update(identity).digest("hex");
      keys.push(`fallback:${digest}`);
    }
  }

  if (phone) keys.push(`phone:${phone}`);
  if (keys.length === 0) {
    throw new Error("A Meta lead ID, phone number, or created_time and form_id are required.");
  }
  return [...new Set(keys)];
}

function sheetStatus(value: string): LeadStatus {
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return sheetStatusMap[key] ?? "NEW";
}

function parseRow(values: Record<string, string>) {
  const rawName =
    cellAt(
      values,
      "full_name",
      "fullname",
      "name",
      "lead_name",
      "customer_name",
      "contact_name",
    ) ||
    [cellAt(values, "first_name"), cellAt(values, "last_name")]
      .filter(Boolean)
      .join(" ");
  const rawPhone = cellAt(
    values,
    "phone_number",
    "phone",
    "phone_no",
    "primary_phone",
    "mobile_number",
    "mobile",
    "mobile_no",
    "primary_mobile",
    "contact_mobile",
    "contact_number",
    "telephone",
  );
  const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
  const rawAlternatePhone = cellAt(
    values,
    "whatsapp_number",
    "alternate_phone",
    "whatsapp",
    "whatsapp_phone",
  );
  const alternatePhone = rawAlternatePhone ? normalizePhone(rawAlternatePhone) : undefined;
  const normalizedPayload = Object.fromEntries(
    Object.entries(values)
      .slice(0, 60)
      .map(([key, value]) => [key.trim().slice(0, 100), value.slice(0, 2000)]),
  );
  const rawPayload = JSON.stringify(normalizedPayload);
  const hashPayload = JSON.stringify(
    Object.fromEntries(Object.entries(normalizedPayload).sort(([a], [b]) => a.localeCompare(b))),
  );
  const statusText = cellAt(values, "lead_status");
  const parsedCategory = parseLeadCategory(cellAt(values, "category", "lead_category"));
  if (parsedCategory.error) throw new Error(parsedCategory.error);
  const sourceData = {
    ...normalizedPayload,
    integration_source: "Meta Ads - Dubai",
    raw_payload: rawPayload,
  };
  const parsed = sheetLeadSchema.safeParse({
    name: rawName,
    phone,
    alternatePhone,
    email: cellAt(values, "email", "email_address"),
    city: cellAt(values, "city"),
    description: cellAt(values, "what_is_the_purpose_of_your_dubai_trip"),
    market: "INTERNATIONAL",
    status: sheetStatus(statusText),
    category: parsedCategory.category,
    priority: "MEDIUM",
    budget: parseBudget(
      cellAt(values, "what_is_your_approximate_budget_per_person", "budget"),
    ),
    sourceData,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The sheet row contains invalid lead data.");
  }

  return {
    lead: parsed.data,
    externalKeys: getExternalKeys(values, phone, rawName),
    payloadHash: createHash("sha256").update(hashPayload).digest("hex"),
  };
}

async function findByExternalKeys(keys: string[]) {
  if (keys.length === 0) return undefined;
  for (const externalKey of keys) {
    const [lead] = await db
      .select({
        ...leadProjection,
        payloadHash: leadExternalReferences.payloadHash,
      })
      .from(leadExternalReferences)
      .innerJoin(leads, eq(leadExternalReferences.leadId, leads.id))
      .where(
        and(
          eq(leadExternalReferences.provider, provider),
          eq(leadExternalReferences.externalKey, externalKey),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1);
    if (lead) return lead;
  }
  return undefined;
}

async function findByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const candidates = [digits];
  if (digits.startsWith("91") && digits.length === 12) {
    candidates.push(digits.slice(2));
  }
  const numericPhone = sql<string>`regexp_replace(${leads.phone}, '[^0-9]', '', 'g')`;
  const matches = await db
    .select(leadProjection)
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        or(...candidates.map((candidate) => sql`${numericPhone} = ${candidate}`)),
      ),
    )
    .limit(2);
  if (matches.length > 1) {
    throw new Error("Multiple active CRM leads match this normalized phone. Resolve the duplicate leads first.");
  }
  return matches[0];
}

async function attachExternalKeys(leadId: string, keys: string[], payloadHash: string) {
  for (const externalKey of keys) {
    const [createdReference] = await db
      .insert(leadExternalReferences)
      .values({ provider, externalKey, leadId, payloadHash })
      .onConflictDoNothing()
      .returning({ id: leadExternalReferences.id });
    if (createdReference) continue;

    const [existingReference] = await db
      .select({
        id: leadExternalReferences.id,
        leadId: leadExternalReferences.leadId,
        deletedAt: leads.deletedAt,
      })
      .from(leadExternalReferences)
      .leftJoin(leads, eq(leadExternalReferences.leadId, leads.id))
      .where(
        and(
          eq(leadExternalReferences.provider, provider),
          eq(leadExternalReferences.externalKey, externalKey),
        ),
      )
      .limit(1);
    if (!existingReference) {
      throw new Error("Could not register the Google Sheets lead identity.");
    }
    if (existingReference.leadId === leadId) {
      await db
        .update(leadExternalReferences)
        .set({ payloadHash, updatedAt: new Date() })
        .where(eq(leadExternalReferences.id, existingReference.id));
      continue;
    }
    if (existingReference.deletedAt === null) return existingReference.leadId;

    await db
      .update(leadExternalReferences)
      .set({ leadId, payloadHash, updatedAt: new Date() })
      .where(eq(leadExternalReferences.id, existingReference.id));
  }
  return leadId;
}

async function updateLead(
  existing: ExistingLead,
  lead: ReturnType<typeof parseRow>["lead"],
) {
  const [updated] = await db
    .update(leads)
    .set({
      name: lead.name,
      phone: lead.phone ?? null,
      alternatePhone: lead.alternatePhone ?? null,
      email: lead.email ?? null,
      city: lead.city ?? null,
      description: lead.description ?? null,
      budget: lead.budget ?? null,
      sourceData: lead.sourceData,
      market: "INTERNATIONAL",
      status: lead.status,
      category: lead.category ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, existing.id), isNull(leads.deletedAt)))
    .returning({ id: leads.id });
  if (!updated) throw new Error("The matching CRM lead is no longer active.");
}

function sourceDataMatches(
  existing: Record<string, string> | null,
  incoming: Record<string, string>,
) {
  const existingEntries = Object.entries(existing ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const incomingEntries = Object.entries(incoming).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify(existingEntries) === JSON.stringify(incomingEntries);
}

function leadMatchesSheet(
  existing: ExistingLead,
  lead: ReturnType<typeof parseRow>["lead"],
) {
  return (
    existing.name === lead.name &&
    existing.phone === (lead.phone ?? null) &&
    existing.alternatePhone === (lead.alternatePhone ?? null) &&
    existing.email === (lead.email ?? null) &&
    existing.city === (lead.city ?? null) &&
    existing.description === (lead.description ?? null) &&
    existing.budget === (lead.budget ?? null) &&
    existing.status === lead.status &&
    existing.category === (lead.category ?? null) &&
    existing.market === "INTERNATIONAL" &&
    sourceDataMatches(existing.sourceData, lead.sourceData)
  );
}

async function getLeadById(id: string) {
  const [lead] = await db
    .select(leadProjection)
    .from(leads)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .limit(1);
  return lead;
}

export async function syncDubaiSheetRow(values: Record<string, string>) {
  const { lead, externalKeys, payloadHash } = parseRow(values);
  let existing = await findByExternalKeys(externalKeys);
  if (!existing && lead.phone) existing = await findByPhone(lead.phone);

  if (existing) {
    if (existing.payloadHash === payloadHash && leadMatchesSheet(existing, lead)) {
      return "unchanged" as const;
    }
    await updateLead(existing, lead);
    const canonicalLeadId = await attachExternalKeys(existing.id, externalKeys, payloadHash);
    if (canonicalLeadId !== existing.id) {
      const canonicalLead = await getLeadById(canonicalLeadId);
      if (!canonicalLead) throw new Error("The linked CRM lead is no longer active.");
      await updateLead(canonicalLead, lead);
    }
    return "updated" as const;
  }

  const [created] = await db
    .insert(leads)
    .values({
      name: lead.name,
      phone: lead.phone ?? null,
      alternatePhone: lead.alternatePhone,
      email: lead.email,
      city: lead.city,
      description: lead.description,
      market: "INTERNATIONAL",
      budget: lead.budget,
      sourceData: lead.sourceData,
      status: lead.status,
      category: lead.category ?? null,
      priority: lead.priority,
    })
    .onConflictDoNothing()
    .returning({ id: leads.id });

  if (!created) {
    const phoneMatch = lead.phone ? await findByPhone(lead.phone) : undefined;
    const identityMatch = phoneMatch ?? (await findByExternalKeys(externalKeys));
    if (!identityMatch) throw new Error("Could not find the lead after a concurrent sheet sync.");
    await updateLead(identityMatch, lead);
    await attachExternalKeys(identityMatch.id, externalKeys, payloadHash);
    return "updated" as const;
  }

  const canonicalLeadId = await attachExternalKeys(created.id, externalKeys, payloadHash);
  if (canonicalLeadId !== created.id) {
    await db.delete(leads).where(eq(leads.id, created.id));
    const canonicalLead = await getLeadById(canonicalLeadId);
    if (!canonicalLead) throw new Error("The linked CRM lead is no longer active.");
    await updateLead(canonicalLead, lead);
    return "updated" as const;
  }
  return "created" as const;
}


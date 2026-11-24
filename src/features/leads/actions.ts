"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { followups, leadSources, leads, packages } from "@/src/db/schema";
import { can } from "@/src/lib/auth/rbac";
import { getSession } from "@/src/lib/auth/session";
import { normalizeCsvHeader, parseCsv } from "./csv";
import {
  createLeadSchema,
  leadMarketSchema,
  leadStatusSchema,
} from "./schemas";
import { readCsvSourceData, readManualSourceData } from "./source-fields";

export type LeadActionState = {
  error: string | null;
  success: boolean;
};

export type LeadImportState = {
  error: string | null;
  imported: number;
  skipped: number;
  errors: string[];
};

type LeadDraft = ReturnType<typeof createLeadSchema.parse>;

const initialImportState: LeadImportState = {
  error: null,
  imported: 0,
  skipped: 0,
  errors: [],
};

function parseFollowUpDate(value?: string) {
  if (!value) return null;
  if (!value.includes("T")) return undefined;

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const dateValue = hasTimezone
    ? value
    : `${value}${value.length === 16 ? ":00" : ""}+05:30`;
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function cellAtAny(row: string[], headerIndexes: Map<string, number>, names: string[]) {
  for (const name of names) {
    const value = cellAt(row, headerIndexes, name);
    if (value) return value;
  }
  return "";
}

function parseLeadStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    OPEN: "NEW",
    NEW_LEAD: "NEW",
    IN_PROGRESS: "CONTACTED",
    IN_PROGRESS_CONTACT: "CONTACTED",
    CONVERTED: "WON",
    CLOSED_WON: "WON",
    CLOSED_LOST: "LOST",
    SPAM: "JUNK",
  };
  const candidate = aliases[normalized] ?? normalized;
  const parsed = leadStatusSchema.safeParse(candidate);
  return parsed.success ? parsed.data : "NEW";
}

function parseBudget(value: string) {
  const normalized = value.trim().replace(/^(?:₹|INR)\s*/i, "").replace(/,/g, "");
  return /^\d+$/.test(normalized) ? normalized : "";
}

async function validateLeadReferences(draft: LeadDraft) {
  let sourceId: string | null = draft.sourceId ?? null;
  let packageId: string | null = draft.packageId ?? null;
  let packagePrice: number | null = null;

  if (sourceId) {
    const [source] = await db
      .select({ id: leadSources.id })
      .from(leadSources)
      .where(
        and(
          eq(leadSources.id, sourceId),
          eq(leadSources.active, true),
          isNull(leadSources.deletedAt),
        ),
      )
      .limit(1);
    if (!source) return { error: "Choose an active lead source." as const };
  }

  if (packageId) {
    const [selectedPackage] = await db
      .select({ id: packages.id, price: packages.price })
      .from(packages)
      .where(
        and(
          eq(packages.id, packageId),
          eq(packages.category, draft.market),
          eq(packages.status, "ACTIVE"),
          isNull(packages.deletedAt),
        ),
      )
      .limit(1);
    if (!selectedPackage) {
      return { error: "Choose an active package from this category." as const };
    }
    packageId = selectedPackage.id;
    packagePrice = selectedPackage.price;
  }

  sourceId = sourceId ?? null;
  return { sourceId, packageId, packagePrice };
}

async function insertLead(draft: LeadDraft, userId: string) {
  const references = await validateLeadReferences(draft);
  if ("error" in references) return { error: references.error };

  const [createdLead] = await db
    .insert(leads)
    .values({
      name: draft.name,
      phone: draft.phone,
      alternatePhone: draft.alternatePhone,
      market: draft.market,
      email: draft.email,
      company: draft.company,
      city: draft.city,
      description: draft.description,
      sourceData: Object.keys(draft.sourceData).length ? draft.sourceData : null,
      sourceId: references.sourceId,
      packageId: references.packageId,
      budget: draft.budget ?? references.packagePrice,
      status: draft.status,
      priority: draft.priority,
      createdBy: userId,
    })
    .onConflictDoNothing()
    .returning({ id: leads.id });

  if (!createdLead) return { error: "A lead with this phone number already exists." };

  const nextFollowUpAt = parseFollowUpDate(draft.nextFollowUpAt);
  if (draft.nextFollowUpAt && !nextFollowUpAt) {
    return { error: "Enter the next follow-up as a valid date and time." };
  }
  if (nextFollowUpAt) {
    await db.insert(followups).values({
      leadId: createdLead.id,
      assignedTo: userId,
      type: "CALL",
      dueAt: nextFollowUpAt,
      priority: draft.priority,
      createdBy: userId,
    });
  }

  return { error: null };
}

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
    alternatePhone: formData.get("alternatePhone"),
    market: formData.get("market"),
    email: formData.get("email"),
    company: formData.get("company"),
    city: formData.get("city"),
    description: formData.get("description"),
    sourceData: readManualSourceData(formData),
    status: formData.get("status"),
    sourceId: formData.get("sourceId"),
    packageId: formData.get("packageId"),
    budget: formData.get("budget"),
    priority: formData.get("priority"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the lead details and try again.",
      success: false,
    };
  }

  const nextFollowUpAt = parseFollowUpDate(parsed.data.nextFollowUpAt);
  if (parsed.data.nextFollowUpAt && !nextFollowUpAt) {
    return { error: "Enter the next follow-up as a valid date and time.", success: false };
  }

  const result = await insertLead(parsed.data, session.userId);
  if (result.error) return { error: result.error, success: false };

  revalidatePath("/leads");
  return { error: null, success: true };
}

function cellAt(row: string[], headerIndexes: Map<string, number>, name: string) {
  const index = headerIndexes.get(name);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

function previewCell(row: string[], headerIndexes: Map<string, number>, name: string) {
  const value = cellAt(row, headerIndexes, name);
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}

export async function importLeadsAction(
  _previousState: LeadImportState,
  formData: FormData,
): Promise<LeadImportState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.role, "leads.create")) {
    return { ...initialImportState, error: "You do not have permission to import leads." };
  }

  const file = formData.get("file");
  const defaultPackageId = formData.get("defaultPackageId");
  const parsedMarket = leadMarketSchema.safeParse(formData.get("market"));
  if (!parsedMarket.success) {
    return { ...initialImportState, error: "Choose Domestic or International leads." };
  }
  const market = parsedMarket.data;
  if (!(file instanceof File) || file.size === 0) {
    return { ...initialImportState, error: "Choose a CSV file to import." };
  }
  if (file.size > 512 * 1024) {
    return { ...initialImportState, error: "CSV files must be 512 KB or smaller." };
  }

  let rows: string[][];
  let csvText: string;
  try {
    csvText = (await file.text()).replace(/^\uFEFF/, "");
    const header = csvText.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = header.includes("\t") && !header.includes(",") ? "\t" : ",";
    rows = parseCsv(csvText, delimiter);
  } catch (error) {
    return {
      ...initialImportState,
      error: error instanceof Error ? error.message : "Could not read the CSV file.",
    };
  }

  const nonEmptyRecords = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .filter(({ row }) => row.some((cell) => cell.trim() !== ""));
  if (nonEmptyRecords.length < 2) {
    return { ...initialImportState, error: "The CSV needs a header row and at least one lead." };
  }
  if (nonEmptyRecords.length > 501) {
    return { ...initialImportState, error: "Import up to 500 leads at a time." };
  }

  const headers = nonEmptyRecords[0].row.map(normalizeCsvHeader);
  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const nameColumn = ["name", "fullname"].find((name) => headerIndexes.has(name));
  const phoneColumn = ["phone", "phonenumber", "mobilenumber", "whatsappnumber"].find(
    (name) => headerIndexes.has(name),
  );
  if (!nameColumn || !phoneColumn) {
    return {
      ...initialImportState,
      error: "The file must include Name/Full Name and Phone/Phone Number columns.",
    };
  }

  const [sources, availablePackages] = await Promise.all([
    db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources)
      .where(and(eq(leadSources.active, true), isNull(leadSources.deletedAt))),
    db
      .select({ id: packages.id, name: packages.name, price: packages.price })
      .from(packages)
      .where(
        and(
          eq(packages.status, "ACTIVE"),
          eq(packages.category, market),
          isNull(packages.deletedAt),
        ),
      ),
  ]);
  const sourceByName = new Map(sources.map((source) => [source.name.toLowerCase(), source]));
  const packageByName = new Map(
    availablePackages.map((availablePackage) => [
      availablePackage.name.toLowerCase(),
      availablePackage,
    ]),
  );
  const defaultPackage =
    typeof defaultPackageId === "string"
      ? availablePackages.find((availablePackage) => availablePackage.id === defaultPackageId)
      : undefined;
  if (defaultPackageId && !defaultPackage) {
    return {
      ...initialImportState,
      error: "Choose an active package from the selected category.",
    };
  }
  const packagePriceById = new Map(
    availablePackages.map((availablePackage) => [
      availablePackage.id,
      availablePackage.price,
    ]),
  );

  const validRows: { rowNumber: number; draft: LeadDraft }[] = [];
  const seenPhones = new Set<string>();
  const errors: string[] = [];
  let errorCount = 0;
  const addError = (message: string) => {
    errorCount += 1;
    if (errors.length < 10) errors.push(message);
  };

  for (const { row, rowNumber } of nonEmptyRecords.slice(1)) {
    const packageName = cellAt(row, headerIndexes, "package").toLowerCase();
    const sourceName = cellAt(row, headerIndexes, "source").toLowerCase();
    const selectedPackage = packageName
      ? packageByName.get(packageName)
      : defaultPackage;
    const source = sourceName ? sourceByName.get(sourceName) : undefined;

    if (packageName && !selectedPackage) {
      addError(`Row ${rowNumber}: Package "${previewCell(row, headerIndexes, "package")}" was not found or is inactive.`);
      continue;
    }
    if (sourceName && !source) {
      addError(`Row ${rowNumber}: Source "${previewCell(row, headerIndexes, "source")}" was not found or is inactive.`);
      continue;
    }

    const priority = cellAt(row, headerIndexes, "priority").toUpperCase() || "MEDIUM";
    const sourceData = readCsvSourceData(nonEmptyRecords[0].row, row);
    const budget = parseBudget(
      cellAtAny(row, headerIndexes, [
        "price",
        "budget",
        "whatisyourapproximatebudgetperperson",
      ]),
    );
    const parsed = createLeadSchema.safeParse({
      name: cellAtAny(row, headerIndexes, ["name", "fullname"]),
      phone: cellAtAny(row, headerIndexes, [
        "phone",
        "phonenumber",
        "mobilenumber",
        "whatsappnumber",
      ]),
      alternatePhone: cellAtAny(row, headerIndexes, [
        "alternatephone",
        "whatsappnumber",
      ]),
      market,
      email: cellAtAny(row, headerIndexes, ["email", "emailaddress"]),
      company: cellAt(row, headerIndexes, "company"),
      city: cellAt(row, headerIndexes, "city"),
      description: cellAt(row, headerIndexes, "description"),
      sourceData,
      status: parseLeadStatus(cellAt(row, headerIndexes, "leadstatus")),
      sourceId: source?.id,
      packageId: selectedPackage?.id,
      budget,
      priority: ["LOW", "MEDIUM", "HIGH", "HOT"].includes(priority)
        ? priority
        : "MEDIUM",
      nextFollowUpAt: cellAt(row, headerIndexes, "nextfollowup"),
    });
    if (!parsed.success) {
      addError(`Row ${rowNumber}: ${parsed.error.issues[0]?.message ?? "Invalid lead details."}`);
      continue;
    }

    const hasFollowUpTimezone =
      !parsed.data.nextFollowUpAt ||
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(parsed.data.nextFollowUpAt);
    const followUpDate = parseFollowUpDate(parsed.data.nextFollowUpAt);
    if (parsed.data.nextFollowUpAt && (!hasFollowUpTimezone || !followUpDate)) {
      addError(`Row ${rowNumber}: Next Follow-up must be an ISO date/time with timezone.`);
      continue;
    }
    if (seenPhones.has(parsed.data.phone)) {
      addError(`Row ${rowNumber}: Phone number is repeated in this CSV.`);
      continue;
    }

    seenPhones.add(parsed.data.phone);
    validRows.push({ rowNumber, draft: parsed.data });
  }

  if (validRows.length === 0) {
    return {
      error: null,
      imported: 0,
      skipped: nonEmptyRecords.length - 1,
      errors,
    };
  }

  const createdRows = await db
    .insert(leads)
    .values(
      validRows.map(({ draft }) => ({
        name: draft.name,
        phone: draft.phone,
        alternatePhone: draft.alternatePhone,
        market: draft.market,
        email: draft.email,
        company: draft.company,
        city: draft.city,
        description: draft.description,
        sourceData: Object.keys(draft.sourceData).length ? draft.sourceData : null,
        sourceId: draft.sourceId,
        packageId: draft.packageId,
        budget: draft.budget ?? packagePriceById.get(draft.packageId ?? "") ?? null,
        status: draft.status,
        priority: draft.priority,
        createdBy: session.userId,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: leads.id, phone: leads.phone });

  const validByPhone = new Map(validRows.map((entry) => [entry.draft.phone, entry]));
  const createdPhones = new Set(createdRows.map((created) => created.phone));
  for (const entry of validRows) {
    if (!createdPhones.has(entry.draft.phone)) {
      addError(`Row ${entry.rowNumber}: A lead with this phone number already exists.`);
    }
  }

  const followUpValues = createdRows.flatMap((created) => {
    const entry = validByPhone.get(created.phone);
    const dueAt = parseFollowUpDate(entry?.draft.nextFollowUpAt);
    if (!entry || !dueAt) return [];
    return [{
      leadId: created.id,
      assignedTo: session.userId,
      type: "CALL",
      dueAt,
      priority: entry.draft.priority,
      createdBy: session.userId,
    }];
  });
  if (followUpValues.length > 0) {
    await db.insert(followups).values(followUpValues);
  }

  revalidatePath("/leads");
  return {
    error: null,
    imported: createdRows.length,
    skipped: nonEmptyRecords.length - 1 - createdRows.length,
    errors:
      errorCount > errors.length
        ? [...errors, `${errorCount - errors.length} more row errors.`]
        : errors,
  };
}

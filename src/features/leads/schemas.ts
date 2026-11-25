import { z } from "zod";

export const leadMarkets = ["DOMESTIC", "INTERNATIONAL"] as const;
export const leadMarketSchema = z.enum(leadMarkets);
export const leadServiceTypes = ["TRAVEL", "VISA"] as const;
export const leadServiceTypeSchema = z.enum(leadServiceTypes);
export const leadCategories = ["TICKET", "VISA", "HOLIDAY"] as const;
export const leadCategorySchema = z.enum(leadCategories);
export const leadStatusValues = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "JUNK",
] as const;
export const leadStatusSchema = z.enum(leadStatusValues);

export function parseLeadCategory(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!normalized) return { category: undefined, error: null };

  const aliases: Record<string, string> = {
    TICKETS: "TICKET",
    HOLIDAY_PACKAGE: "HOLIDAY",
    HOLIDAYS: "HOLIDAY",
  };
  const parsed = leadCategorySchema.safeParse(aliases[normalized] ?? normalized);
  return parsed.success
    ? { category: parsed.data, error: null }
    : { category: undefined, error: "Choose Ticket, Visa, or Holiday as the lead category." };
}

const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Enter the lead name").max(150),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  market: leadMarketSchema.default("DOMESTIC"),
  serviceType: z.preprocess(blankToUndefined, leadServiceTypeSchema.optional()),
  category: z.preprocess(blankToUndefined, leadCategorySchema.optional()),
  alternatePhone: z.preprocess(
    blankToUndefined,
    z.string().trim().min(7).max(20).optional(),
  ),
  email: z.preprocess(
    blankToUndefined,
    z.string().trim().email("Enter a valid email address").max(255).optional(),
  ),
  company: optionalText(150),
  city: optionalText(100),
  description: optionalText(5000),
  status: leadStatusSchema.default("NEW"),
  sourceId: z.preprocess(blankToUndefined, z.uuid().optional()),
  packageId: z.preprocess(blankToUndefined, z.uuid().optional()),
  budget: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  ),
  priority: z.preprocess(
    blankToUndefined,
    z.enum(["LOW", "MEDIUM", "HIGH", "HOT"]).default("MEDIUM"),
  ),
  sourceData: z.record(z.string(), z.string()).default({}),
  nextFollowUpAt: optionalText(40),
});

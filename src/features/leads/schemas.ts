import { z } from "zod";

export const leadMarkets = ["DOMESTIC", "INTERNATIONAL"] as const;
export const leadMarketSchema = z.enum(leadMarkets);

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Enter the lead name").max(150),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  market: leadMarketSchema.default("DOMESTIC"),
  email: z.preprocess(
    blankToUndefined,
    z.string().trim().email("Enter a valid email address").max(255).optional(),
  ),
  company: optionalText(150),
  description: optionalText(5000),
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
  nextFollowUpAt: optionalText(40),
});

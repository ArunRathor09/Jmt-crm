import { z } from "zod";

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Enter the lead name").max(150),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  email: z.preprocess(
    blankToUndefined,
    z.string().trim().email("Enter a valid email address").max(255).optional(),
  ),
  company: optionalText(150),
  sourceId: z.preprocess(blankToUndefined, z.uuid().optional()),
});

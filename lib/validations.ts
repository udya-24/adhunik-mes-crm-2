import { z } from "zod";
import { leadStatuses, roles, sourceTypes } from "./constants.ts";
import { normalizeDateValue } from "./date-utils.ts";

const nullableText = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional().nullable());
const nullableStringOrNumberText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.union([z.string(), z.number()]).transform((value) => String(value)).optional().nullable()
);
const nullableDateText = z.preprocess(
  (value) => (value === "" ? undefined : normalizeDateValue(value)),
  z.string().optional().nullable()
);
const nullableUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional().nullable());
const nullableEmail = z.preprocess((value) => (value === "" ? undefined : value), z.string().email().optional().nullable());
const nullableNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value), "Expected a valid number")
    .optional()
    .nullable()
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const assignmentSchema = z.object({
  tenderId: z.string().uuid(),
  assignedTo: z.string().uuid(),
  remarks: z.string().max(500).optional()
});

export const tenderSchema = z.object({
  tender_id: z.string().trim().min(1, "Tender ID is required"),
  organisation_chain: nullableText,
  ge: nullableText,
  cwe: nullableText,
  tender_ref_no: nullableStringOrNumberText,
  tender_title: z.string().trim().min(1, "Tender Title is required"),
  contract_date: nullableDateText,
  bid_number: nullableStringOrNumberText,
  bidder_name: nullableText,
  currency: z.preprocess((value) => (value === "" || value === null || value === undefined ? "INR" : value), z.string()),
  awarded_value: nullableNumber,
  contact_number_1: nullableStringOrNumberText,
  contact_number_2: nullableStringOrNumberText,
  contact_number_3: nullableStringOrNumberText,
  address: nullableText,
  make: nullableText,
  email: nullableEmail,
  boq_attachment_url: nullableUrl,
  aoc_attachment_url: nullableUrl,
  tender_document_url: nullableUrl,
  our_value: nullableNumber,
  source_type: z.enum(sourceTypes).default("MANUAL_ENTRY"),
  lead_status: z.enum(leadStatuses).default("NEW")
});

export const profileSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(roles),
  manager_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true)
});

export const followUpSchema = z.object({
  tenderId: z.string().uuid(),
  followUpDate: z.string(),
  remarks: z.string().min(1),
  status: z.enum(leadStatuses)
});

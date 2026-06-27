import type { Quotation } from "@/lib/types";

export const quotationSignatureCompany = "ADHUNIK SWITCHGEARS PVT. LTD.";

export function quotationCreatorName(quotation: Quotation) {
  return quotation.creator?.full_name || quotation.creator?.email || "Unknown User";
}

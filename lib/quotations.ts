import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireQuotationAccess } from "@/lib/quotation-access";
import type { Quotation } from "@/lib/types";

const quotationSelect =
  "*, creator:profiles!quotations_created_by_fkey(full_name,email), items:quotation_items(*), terms:quotation_terms(*)";

export async function getQuotations(): Promise<Quotation[]> {
  noStore();
  await requireQuotationAccess();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(quotationSelect)
    .order("quotation_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeQuotations((data ?? []) as unknown as Quotation[]);
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  noStore();
  await requireQuotationAccess();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(quotationSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeQuotations([data as unknown as Quotation])[0] : null;
}

function normalizeQuotations(rows: Quotation[]) {
  return rows.map((quotation) => ({
    ...quotation,
    gst_percentage: Number(quotation.gst_percentage ?? 0),
    gst_amount: Number(quotation.gst_amount ?? 0),
    grand_total: Number(quotation.grand_total ?? 0),
    creator: Array.isArray(quotation.creator) ? quotation.creator[0] ?? null : quotation.creator ?? null,
    items: [...(quotation.items ?? [])]
      .sort((a, b) => a.line_no - b.line_no)
      .map((item) => ({
        ...item,
        line_no: Number(item.line_no ?? 0),
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        total_price: Number(item.total_price ?? 0)
      })),
    terms: [...(quotation.terms ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map((term) => ({ ...term, display_order: Number(term.display_order ?? 0) }))
  }));
}

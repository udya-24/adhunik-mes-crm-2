import { unstable_noStore as noStore } from "next/cache";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProformaInvoice } from "@/lib/types";

const proformaInvoiceSelect =
  "*, creator:profiles!proforma_invoices_created_by_fkey(full_name,email), items:proforma_invoice_items(*), terms:proforma_invoice_terms(*)";

export async function getProformaInvoices(): Promise<ProformaInvoice[]> {
  noStore();
  await requireProformaInvoiceAccess();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("proforma_invoices")
    .select(proformaInvoiceSelect)
    .order("pi_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeProformaInvoices((data ?? []) as unknown as ProformaInvoice[]);
}

export async function getProformaInvoice(id: string): Promise<ProformaInvoice | null> {
  noStore();
  await requireProformaInvoiceAccess();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("proforma_invoices")
    .select(proformaInvoiceSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeProformaInvoices([data as unknown as ProformaInvoice])[0] : null;
}

function normalizeProformaInvoices(rows: ProformaInvoice[]) {
  return rows.map((invoice) => ({
    ...invoice,
    gst_percentage: Number(invoice.gst_percentage ?? 0),
    gst_amount: Number(invoice.gst_amount ?? 0),
    grand_total: Number(invoice.grand_total ?? 0),
    creator: Array.isArray(invoice.creator) ? invoice.creator[0] ?? null : invoice.creator ?? null,
    items: [...(invoice.items ?? [])]
      .sort((a, b) => a.line_no - b.line_no)
      .map((item) => ({
        ...item,
        line_no: Number(item.line_no ?? 0),
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        total_price: Number(item.total_price ?? 0)
      })),
    terms: [...(invoice.terms ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map((term) => ({ ...term, display_order: Number(term.display_order ?? 0) }))
  }));
}

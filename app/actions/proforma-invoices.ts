"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";
import type { ProformaInvoiceInput, ProformaInvoiceStatus } from "@/lib/types";

const allowedStatuses: ProformaInvoiceStatus[] = ["DRAFT", "SENT", "APPROVED", "CANCELLED"];

type SupabaseError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function logPiError(table: "proforma_invoices" | "proforma_invoice_items" | "proforma_invoice_terms", operation: string, error: SupabaseError, context?: Record<string, unknown>) {
  console.error(`[ProformaInvoices] ${table} ${operation} failed`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    ...context
  });
}

function cleanText(value: unknown, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error("Please complete all required PI fields.");
  return text || null;
}

function normalizeProformaInvoice(input: ProformaInvoiceInput) {
  const items = input.items.map((item, index) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unit_price) || 0);
    return {
      line_no: index + 1,
      ims_master_id: item.ims_master_id || null,
      item_category: cleanText(item.item_category),
      item_description: String(item.item_description ?? "").trim(),
      make: cleanText(item.make),
      model_type: cleanText(item.model_type),
      quantity,
      unit_price: unitPrice,
      total_price: Number((quantity * unitPrice).toFixed(2))
    };
  });
  if (!items.length || items.some((item) => !item.item_description)) {
    throw new Error("Add at least one item and complete every item description.");
  }

  const terms = input.terms
    .map((term, index) => ({
      term_key: String(term.term_key ?? "").trim(),
      term_value: String(term.term_value ?? "").trim(),
      display_order: index
    }))
    .filter((term) => term.term_key || term.term_value);

  const status = allowedStatuses.includes(input.status) ? input.status : "DRAFT";
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const gstPercentage = Number(input.gst_percentage);
  if (!Number.isFinite(gstPercentage) || gstPercentage < 0) throw new Error("GST percentage cannot be negative.");
  const normalizedGstPercentage = Number(gstPercentage.toFixed(2));
  const gstAmount = Number((subtotal * normalizedGstPercentage / 100).toFixed(2));
  const grandTotal = Number((subtotal + gstAmount).toFixed(2));

  return {
    invoice: {
      pi_no: cleanText(input.pi_no, true) as string,
      pi_date: cleanText(input.pi_date, true) as string,
      our_ref_no: cleanText(input.our_ref_no),
      dp_code: cleanText(input.dp_code),
      mobile_no: cleanText(input.mobile_no),
      indentor_name: cleanText(input.indentor_name, true) as string,
      indentor_address: cleanText(input.indentor_address),
      email: cleanText(input.email),
      gstin: cleanText(input.gstin),
      po_no: cleanText(input.po_no),
      po_date: cleanText(input.po_date),
      project: cleanText(input.project),
      status,
      gst_percentage: normalizedGstPercentage,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      signature_designation: cleanText(input.signature_designation),
      signature_email: cleanText(input.signature_email),
      signature_mobile: cleanText(input.signature_mobile)
    },
    items,
    terms
  };
}

export async function createProformaInvoiceAction(input: ProformaInvoiceInput) {
  const profile = await requireProformaInvoiceAccess();
  const payload = normalizeProformaInvoice(input);
  const supabase = createAdminClient();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("proforma_invoices")
    .select("id")
    .eq("pi_no", payload.invoice.pi_no)
    .maybeSingle();
  if (duplicateError) {
    logPiError("proforma_invoices", "duplicate check", duplicateError, { pi_no: payload.invoice.pi_no });
    throw new Error(duplicateError.message);
  }
  if (duplicate) throw new Error(`PI number "${payload.invoice.pi_no}" already exists.`);

  const { data: invoice, error } = await supabase
    .from("proforma_invoices")
    .insert({ ...payload.invoice, created_by: profile.id, updated_by: profile.id })
    .select("id")
    .single();
  if (error) {
    logPiError("proforma_invoices", "insert", error, { pi_no: payload.invoice.pi_no });
    throw new Error(error.message);
  }

  try {
    const itemResult = await supabase.from("proforma_invoice_items").insert(payload.items.map((item) => ({ ...item, proforma_invoice_id: invoice.id })));
    if (itemResult.error) {
      logPiError("proforma_invoice_items", "insert", itemResult.error, { proforma_invoice_id: invoice.id, row_count: payload.items.length });
      throw itemResult.error;
    }
    if (payload.terms.length) {
      const termResult = await supabase.from("proforma_invoice_terms").insert(payload.terms.map((term) => ({ ...term, proforma_invoice_id: invoice.id })));
      if (termResult.error) {
        logPiError("proforma_invoice_terms", "insert", termResult.error, { proforma_invoice_id: invoice.id, row_count: payload.terms.length });
        throw termResult.error;
      }
    }
  } catch (saveError) {
    const rollback = await supabase.from("proforma_invoices").delete().eq("id", invoice.id);
    if (rollback.error) logPiError("proforma_invoices", "create rollback delete", rollback.error, { proforma_invoice_id: invoice.id });
    throw new Error(saveError instanceof Error ? saveError.message : "Unable to save PI rows.");
  }

  revalidatePath("/proforma-invoices");
  return { id: invoice.id };
}

export async function updateProformaInvoiceAction(id: string, input: ProformaInvoiceInput) {
  const profile = await requireProformaInvoiceAccess();
  const payload = normalizeProformaInvoice(input);
  const supabase = createAdminClient();

  const [
    { data: existing, error: existingError },
    { data: existingItems, error: existingItemsError },
    { data: existingTerms, error: existingTermsError }
  ] = await Promise.all([
    supabase.from("proforma_invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("proforma_invoice_items").select("*").eq("proforma_invoice_id", id).order("line_no"),
    supabase.from("proforma_invoice_terms").select("*").eq("proforma_invoice_id", id).order("display_order")
  ]);
  if (existingError) {
    logPiError("proforma_invoices", "select for update", existingError, { proforma_invoice_id: id });
    throw new Error(existingError.message);
  }
  if (existingItemsError) {
    logPiError("proforma_invoice_items", "select for update", existingItemsError, { proforma_invoice_id: id });
    throw new Error(existingItemsError.message);
  }
  if (existingTermsError) {
    logPiError("proforma_invoice_terms", "select for update", existingTermsError, { proforma_invoice_id: id });
    throw new Error(existingTermsError.message);
  }
  if (!existing) throw new Error("Proforma invoice not found.");
  if (profile.role === "USER" && existing.created_by !== profile.id) throw new Error("You can only edit PIs you created.");

  const { data: duplicate, error: duplicateError } = await supabase
    .from("proforma_invoices")
    .select("id")
    .eq("pi_no", payload.invoice.pi_no)
    .neq("id", id)
    .maybeSingle();
  if (duplicateError) {
    logPiError("proforma_invoices", "duplicate check for update", duplicateError, { proforma_invoice_id: id, pi_no: payload.invoice.pi_no });
    throw new Error(duplicateError.message);
  }
  if (duplicate) throw new Error(`PI number "${payload.invoice.pi_no}" already exists.`);

  const { data: stagedItems, error: itemError } = await supabase
    .from("proforma_invoice_items")
    .insert(payload.items.map((item) => ({ ...item, proforma_invoice_id: id })))
    .select("id");
  if (itemError) {
    logPiError("proforma_invoice_items", "stage replacement insert", itemError, { proforma_invoice_id: id, row_count: payload.items.length });
    throw new Error(itemError.message);
  }

  let stagedTerms: { id: string }[] = [];
  if (payload.terms.length) {
    const { data, error: termError } = await supabase
      .from("proforma_invoice_terms")
      .insert(payload.terms.map((term) => ({ ...term, proforma_invoice_id: id })))
      .select("id");
    if (termError) {
      logPiError("proforma_invoice_terms", "stage replacement insert", termError, { proforma_invoice_id: id, row_count: payload.terms.length });
      await deleteStagedRows(supabase, stagedItems ?? [], [], id);
      throw new Error(termError.message);
    }
    stagedTerms = data ?? [];
  }

  const { error: updateError } = await supabase.from("proforma_invoices").update({ ...payload.invoice, updated_by: profile.id }).eq("id", id);
  if (updateError) {
    logPiError("proforma_invoices", "update", updateError, { proforma_invoice_id: id });
    await deleteStagedRows(supabase, stagedItems ?? [], stagedTerms, id);
    throw new Error(updateError.message);
  }

  const oldItemIds = (existingItems ?? []).map((item) => item.id);
  const oldTermIds = (existingTerms ?? []).map((term) => term.id);
  if (oldItemIds.length) {
    const { error: itemDeleteError } = await supabase.from("proforma_invoice_items").delete().in("id", oldItemIds);
    if (itemDeleteError) {
      logPiError("proforma_invoice_items", "delete replaced rows", itemDeleteError, { proforma_invoice_id: id });
      throw new Error(itemDeleteError.message);
    }
  }
  if (oldTermIds.length) {
    const { error: termDeleteError } = await supabase.from("proforma_invoice_terms").delete().in("id", oldTermIds);
    if (termDeleteError) {
      logPiError("proforma_invoice_terms", "delete replaced rows", termDeleteError, { proforma_invoice_id: id });
      throw new Error(termDeleteError.message);
    }
  }

  revalidatePath("/proforma-invoices");
  revalidatePath(`/proforma-invoices/${id}`);
  revalidatePath(`/proforma-invoices/${id}/edit`);
  return { id };
}

export async function duplicateProformaInvoiceAction(id: string) {
  const profile = await requireProformaInvoiceAccess();
  const supabase = createAdminClient();
  const { data: source, error } = await supabase
    .from("proforma_invoices")
    .select("*, items:proforma_invoice_items(*), terms:proforma_invoice_terms(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!source) throw new Error("Proforma invoice not found.");

  const sourceRow = source as Record<string, unknown> & { items?: Record<string, unknown>[]; terms?: Record<string, unknown>[] };
  const baseNo = `${String(sourceRow.pi_no ?? "PI")}-COPY`;
  const piNo = await nextCopyNumber(supabase, baseNo);
  const { items = [], terms = [], id: _id, created_at: _createdAt, updated_at: _updatedAt, creator: _creator, ...parent } = sourceRow;

  const { data: invoice, error: insertError } = await supabase
    .from("proforma_invoices")
    .insert({ ...parent, pi_no: piNo, status: "DRAFT", created_by: profile.id, updated_by: profile.id })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const itemRows = items.map(({ id: _itemId, proforma_invoice_id: _oldId, created_at: _itemCreatedAt, ...item }) => ({ ...item, proforma_invoice_id: invoice.id }));
  if (itemRows.length) {
    const itemResult = await supabase.from("proforma_invoice_items").insert(itemRows);
    if (itemResult.error) throw new Error(itemResult.error.message);
  }
  const termRows = terms.map(({ id: _termId, proforma_invoice_id: _oldId, created_at: _termCreatedAt, ...term }) => ({ ...term, proforma_invoice_id: invoice.id }));
  if (termRows.length) {
    const termResult = await supabase.from("proforma_invoice_terms").insert(termRows);
    if (termResult.error) throw new Error(termResult.error.message);
  }
  revalidatePath("/proforma-invoices");
  return { id: invoice.id };
}

export async function deleteProformaInvoiceAction(id: string) {
  const profile = await requireProformaInvoiceAccess();
  if (profile.role === "USER") throw new Error("Only administrators and managers can delete PIs.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("proforma_invoices").delete().eq("id", id);
  if (error) {
    logPiError("proforma_invoices", "delete", error, { proforma_invoice_id: id });
    throw new Error(error.message);
  }
  revalidatePath("/proforma-invoices");
}

async function nextCopyNumber(supabase: ReturnType<typeof createAdminClient>, baseNo: string) {
  let candidate = baseNo;
  for (let index = 2; index < 100; index += 1) {
    const { data, error } = await supabase.from("proforma_invoices").select("id").eq("pi_no", candidate).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${baseNo}-${index}`;
  }
  return `${baseNo}-${Date.now()}`;
}

async function deleteStagedRows(
  supabase: ReturnType<typeof createAdminClient>,
  items: { id: string }[],
  terms: { id: string }[],
  invoiceId: string
) {
  if (items.length) {
    const { error } = await supabase.from("proforma_invoice_items").delete().in("id", items.map((item) => item.id));
    if (error) logPiError("proforma_invoice_items", "rollback staged rows", error, { proforma_invoice_id: invoiceId });
  }
  if (terms.length) {
    const { error } = await supabase.from("proforma_invoice_terms").delete().in("id", terms.map((term) => term.id));
    if (error) logPiError("proforma_invoice_terms", "rollback staged rows", error, { proforma_invoice_id: invoiceId });
  }
}

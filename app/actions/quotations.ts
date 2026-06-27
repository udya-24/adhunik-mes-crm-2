"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireQuotationAccess } from "@/lib/quotation-access";
import type { QuotationInput, QuotationStatus } from "@/lib/types";

const allowedStatuses: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];

type SupabaseError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function logSupabaseError(table: "quotations" | "quotation_items" | "quotation_terms", operation: string, error: SupabaseError, context?: Record<string, unknown>) {
  console.error(`[Quotations] ${table} ${operation} failed`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    ...context
  });
}

function cleanText(value: unknown, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error("Please complete all required quotation fields.");
  return text || null;
}

function normalizeQuotation(input: QuotationInput) {
  const items = input.items.map((item, index) => ({
    line_no: index + 1,
    ims_master_id: item.ims_master_id || null,
    item_category: cleanText(item.item_category),
    item_description: String(item.item_description ?? "").trim(),
    make: cleanText(item.make),
    model: cleanText(item.model),
    quantity: Math.max(0, Number(item.quantity) || 0),
    unit: String(item.unit ?? "").trim() || "Nos",
    unit_price: Math.max(0, Number(item.unit_price) || 0),
    total_price: Number((Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0)).toFixed(2))
  }));
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
  if (!Number.isFinite(gstPercentage) || gstPercentage < 0) {
    throw new Error("GST percentage cannot be negative.");
  }
  const normalizedGstPercentage = Number(gstPercentage.toFixed(2));
  const gstAmount = Number((subtotal * normalizedGstPercentage / 100).toFixed(2));
  const grandTotal = Number((subtotal + gstAmount).toFixed(2));

  return {
    quotation: {
      quotation_no: cleanText(input.quotation_no, true) as string,
      quotation_date: cleanText(input.quotation_date, true) as string,
      contract_name: cleanText(input.contract_name),
      customer_name: cleanText(input.customer_name, true) as string,
      address: cleanText(input.address),
      gst_number: cleanText(input.gst_number),
      contact_person: cleanText(input.contact_person),
      mobile_number: cleanText(input.mobile_number),
      email: cleanText(input.email),
      header_image_url: input.header_image_url || null,
      signature_designation: cleanText(input.signature_designation),
      status,
      gst_percentage: normalizedGstPercentage,
      gst_amount: gstAmount,
      grand_total: grandTotal
    },
    items,
    terms
  };
}

export async function createQuotationAction(input: QuotationInput) {
  const profile = await requireQuotationAccess();
  const payload = normalizeQuotation(input);
  const supabase = createAdminClient();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("quotations")
    .select("id")
    .eq("quotation_no", payload.quotation.quotation_no)
    .maybeSingle();
  if (duplicateError) {
    logSupabaseError("quotations", "duplicate check", duplicateError, { quotation_no: payload.quotation.quotation_no });
    throw new Error(duplicateError.message);
  }
  if (duplicate) throw new Error(`Quotation number "${payload.quotation.quotation_no}" already exists.`);

  const { data: quotation, error } = await supabase
    .from("quotations")
    .insert({ ...payload.quotation, created_by: profile.id, updated_by: profile.id })
    .select("id")
    .single();
  if (error) {
    logSupabaseError("quotations", "insert", error, { quotation_no: payload.quotation.quotation_no });
    throw new Error(error.message);
  }

  try {
    const itemResult = await supabase
      .from("quotation_items")
      .insert(payload.items.map((item) => ({ ...item, quotation_id: quotation.id })));
    if (itemResult.error) {
      logSupabaseError("quotation_items", "insert", itemResult.error, { quotation_id: quotation.id, row_count: payload.items.length });
      throw itemResult.error;
    }

    if (payload.terms.length) {
      const termResult = await supabase
        .from("quotation_terms")
        .insert(payload.terms.map((term) => ({ ...term, quotation_id: quotation.id })));
      if (termResult.error) {
        logSupabaseError("quotation_terms", "insert", termResult.error, { quotation_id: quotation.id, row_count: payload.terms.length });
        throw termResult.error;
      }
    }
  } catch (saveError) {
    const rollback = await supabase.from("quotations").delete().eq("id", quotation.id);
    if (rollback.error) logSupabaseError("quotations", "create rollback delete", rollback.error, { quotation_id: quotation.id });
    throw new Error(saveError instanceof Error ? saveError.message : "Unable to save quotation rows.");
  }

  revalidatePath("/quotations");
  return { id: quotation.id };
}

export async function updateQuotationAction(id: string, input: QuotationInput) {
  const profile = await requireQuotationAccess();
  const payload = normalizeQuotation(input);
  const supabase = createAdminClient();
  const [
    { data: existing, error: existingError },
    { data: existingItems, error: existingItemsError },
    { data: existingTerms, error: existingTermsError }
  ] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("line_no"),
    supabase.from("quotation_terms").select("*").eq("quotation_id", id).order("display_order")
  ]);
  if (existingError) {
    logSupabaseError("quotations", "select for update", existingError, { quotation_id: id });
    throw new Error(existingError.message);
  }
  if (existingItemsError) {
    logSupabaseError("quotation_items", "select for update", existingItemsError, { quotation_id: id });
    throw new Error(existingItemsError.message);
  }
  if (existingTermsError) {
    logSupabaseError("quotation_terms", "select for update", existingTermsError, { quotation_id: id });
    throw new Error(existingTermsError.message);
  }
  if (!existing) throw new Error("Quotation not found.");
  if (profile.role === "USER" && existing.created_by !== profile.id) {
    throw new Error("You can only edit quotations you created.");
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("quotations")
    .select("id")
    .eq("quotation_no", payload.quotation.quotation_no)
    .neq("id", id)
    .maybeSingle();
  if (duplicateError) {
    logSupabaseError("quotations", "duplicate check for update", duplicateError, { quotation_id: id, quotation_no: payload.quotation.quotation_no });
    throw new Error(duplicateError.message);
  }
  if (duplicate) throw new Error(`Quotation number "${payload.quotation.quotation_no}" already exists.`);

  const { data: stagedItems, error: itemError } = await supabase
    .from("quotation_items")
    .insert(payload.items.map((item) => ({ ...item, quotation_id: id })))
    .select("id");
  if (itemError) {
    logSupabaseError("quotation_items", "stage replacement insert", itemError, { quotation_id: id, row_count: payload.items.length });
    throw new Error(itemError.message);
  }

  let stagedTerms: { id: string }[] = [];
  if (payload.terms.length) {
    const { data, error: termError } = await supabase
      .from("quotation_terms")
      .insert(payload.terms.map((term) => ({ ...term, quotation_id: id })))
      .select("id");
    if (termError) {
      logSupabaseError("quotation_terms", "stage replacement insert", termError, { quotation_id: id, row_count: payload.terms.length });
      await deleteStagedRows(supabase, stagedItems ?? [], [], id);
      throw new Error(termError.message);
    }
    stagedTerms = data ?? [];
  }

  const parentUpdates = { ...payload.quotation, updated_by: profile.id };
  const { error: updateError } = await supabase.from("quotations").update(parentUpdates).eq("id", id);
  if (updateError) {
    logSupabaseError("quotations", "update", updateError, { quotation_id: id });
    await deleteStagedRows(supabase, stagedItems ?? [], stagedTerms, id);
    throw new Error(updateError.message);
  }

  const oldItemIds = (existingItems ?? []).map((item) => item.id);
  const oldTermIds = (existingTerms ?? []).map((term) => term.id);

  if (oldItemIds.length) {
    const { error: itemDeleteError } = await supabase.from("quotation_items").delete().in("id", oldItemIds);
    if (itemDeleteError) {
      logSupabaseError("quotation_items", "delete replaced rows", itemDeleteError, { quotation_id: id, row_count: oldItemIds.length });
      await rollbackQuotationUpdate(supabase, id, existing, stagedItems ?? [], stagedTerms);
      throw new Error(itemDeleteError.message);
    }
  }

  if (oldTermIds.length) {
    const { error: termDeleteError } = await supabase.from("quotation_terms").delete().in("id", oldTermIds);
    if (termDeleteError) {
      logSupabaseError("quotation_terms", "delete replaced rows", termDeleteError, { quotation_id: id, row_count: oldTermIds.length });
      await rollbackQuotationUpdate(supabase, id, existing, stagedItems ?? [], stagedTerms);
      await restoreItems(supabase, existingItems ?? [], id);
      throw new Error(termDeleteError.message);
    }
  }

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  revalidatePath(`/quotations/${id}/edit`);
  return { id };
}

export async function deleteQuotationAction(id: string) {
  const profile = await requireQuotationAccess();
  if (profile.role !== "ADMIN") throw new Error("Only administrators can delete quotations.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("quotations").delete().eq("id", id);
  if (error) {
    logSupabaseError("quotations", "delete", error, { quotation_id: id });
    throw new Error(error.message);
  }
  revalidatePath("/quotations");
}

async function deleteStagedRows(
  supabase: ReturnType<typeof createAdminClient>,
  items: { id: string }[],
  terms: { id: string }[],
  quotationId: string
) {
  if (items.length) {
    const { error } = await supabase.from("quotation_items").delete().in("id", items.map((item) => item.id));
    if (error) logSupabaseError("quotation_items", "rollback staged rows", error, { quotation_id: quotationId });
  }
  if (terms.length) {
    const { error } = await supabase.from("quotation_terms").delete().in("id", terms.map((term) => term.id));
    if (error) logSupabaseError("quotation_terms", "rollback staged rows", error, { quotation_id: quotationId });
  }
}

async function rollbackQuotationUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  quotationId: string,
  existing: Record<string, unknown>,
  stagedItems: { id: string }[],
  stagedTerms: { id: string }[]
) {
  await deleteStagedRows(supabase, stagedItems, stagedTerms, quotationId);
  const restorePayload = {
    quotation_no: existing.quotation_no,
    quotation_date: existing.quotation_date,
    tender_id: existing.tender_id,
    contract_name: existing.contract_name,
    customer_name: existing.customer_name,
    address: existing.address,
    gst_number: existing.gst_number,
    contact_person: existing.contact_person,
    mobile_number: existing.mobile_number,
    email: existing.email,
    project_name: existing.project_name,
    tender_reference: existing.tender_reference,
    header_image_url: existing.header_image_url,
    signature_designation: existing.signature_designation,
    gst_percentage: existing.gst_percentage,
    gst_amount: existing.gst_amount,
    grand_total: existing.grand_total,
    status: existing.status,
    updated_by: existing.updated_by
  };
  const { error } = await supabase.from("quotations").update(restorePayload).eq("id", quotationId);
  if (error) logSupabaseError("quotations", "rollback restore", error, { quotation_id: quotationId });
}

async function restoreItems(
  supabase: ReturnType<typeof createAdminClient>,
  items: Record<string, unknown>[],
  quotationId: string
) {
  if (!items.length) return;
  const rows = items.map((item) => ({
    quotation_id: quotationId,
    line_no: item.line_no,
    ims_master_id: item.ims_master_id,
    item_category: item.item_category,
    item_description: item.item_description,
    make: item.make,
    model: item.model,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price
  }));
  const { error } = await supabase.from("quotation_items").insert(rows);
  if (error) logSupabaseError("quotation_items", "rollback restore old rows", error, { quotation_id: quotationId, row_count: rows.length });
}

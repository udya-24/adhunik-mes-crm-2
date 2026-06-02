"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { utcNowISOString } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/server";
import type { ManualTenderInsert } from "@/lib/types";
import { assignmentSchema, followUpSchema, tenderSchema } from "@/lib/validations";

function emptyToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

export async function createTenderAction(input: FormData | ManualTenderInsert) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const payload = tenderSchema.parse({
    ...raw,
    tender_id: typeof raw.tender_id === "string" ? raw.tender_id.trim() : raw.tender_id,
    tender_title: typeof raw.tender_title === "string" ? raw.tender_title.trim() : raw.tender_title,
    source_type: "MANUAL_ENTRY"
  });
  const supabase = await createClient();
  const insertPayload = {
    ...payload,
    organisation_chain: emptyToNull(payload.organisation_chain),
    ge: emptyToNull(payload.ge),
    cwe: emptyToNull(payload.cwe),
    tender_ref_no: emptyToNull(payload.tender_ref_no),
    contract_date: emptyToNull(payload.contract_date),
    bid_number: emptyToNull(payload.bid_number),
    bidder_name: emptyToNull(payload.bidder_name),
    currency: emptyToNull(payload.currency) ?? "INR",
    contact_number_1: emptyToNull(payload.contact_number_1),
    contact_number_2: emptyToNull(payload.contact_number_2),
    contact_number_3: emptyToNull(payload.contact_number_3),
    address: emptyToNull(payload.address),
    make: emptyToNull(payload.make),
    email: emptyToNull(payload.email),
    boq_attachment_url: emptyToNull(payload.boq_attachment_url),
    aoc_attachment_url: emptyToNull(payload.aoc_attachment_url),
    tender_document_url: emptyToNull(payload.tender_document_url),
    uploaded_by: profile.id,
    source_type: "MANUAL_ENTRY" as const
  };
  const { error } = await supabase.from("tenders").insert(insertPayload);
  if (error) {
    console.error("Supabase tender insert error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      tender_id: payload.tender_id
    });
    throw new Error(error.message);
  }
  revalidatePath("/tenders");
  revalidatePath("/imports");
}

export async function bulkImportTendersAction(rows: unknown[], fileName: string) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = rows.map((row) => tenderSchema.parse({ ...(row as object), source_type: "EXCEL_UPLOAD" }));
  const supabase = await createClient();
  const tenderIds = parsed.map((row) => row.tender_id);
  const { data: existing } = await supabase.from("tenders").select("tender_id").in("tender_id", tenderIds);
  const duplicateIds = new Set((existing ?? []).map((row) => row.tender_id));
  const inserts = parsed.filter((row) => !duplicateIds.has(row.tender_id)).map((row) => ({ ...row, uploaded_by: profile.id }));

  const { error } = inserts.length ? await supabase.from("tenders").insert(inserts) : { error: null };
  if (error) return { error: error.message };

  await supabase.from("upload_history").insert({
    uploaded_by: profile.id,
    file_name: fileName,
    total_rows: parsed.length,
    imported_rows: inserts.length,
    duplicate_rows: duplicateIds.size,
    source_type: "EXCEL_UPLOAD"
  });

  revalidatePath("/imports");
  revalidatePath("/tenders");
  return { ok: true, imported: inserts.length, duplicates: duplicateIds.size };
}

export async function assignLeadAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  const payload = assignmentSchema.parse({
    tenderId: formData.get("tenderId"),
    assignedTo: formData.get("assignedTo"),
    remarks: formData.get("remarks") || undefined
  });
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenders")
    .update({
      assigned_to: payload.assignedTo,
      assigned_by: profile.id,
      lead_status: "ASSIGNED"
    })
    .eq("id", payload.tenderId)
    .eq("is_deleted", false);
  if (error) throw new Error(error.message);

  await supabase.from("lead_assignments").insert({
    tender_id: payload.tenderId,
    assigned_to: payload.assignedTo,
    assigned_by: profile.id,
    remarks: payload.remarks
  });

  await supabase.from("lead_activities").insert({
    tender_id: payload.tenderId,
    user_id: profile.id,
    activity_type: "ASSIGNED",
    activity_notes: payload.remarks ?? "Lead assigned"
  });

  revalidatePath("/tenders");
  revalidatePath("/assignments");
}

export async function updateLeadStatusAction(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const tenderId = String(formData.get("tenderId"));
  const status = String(formData.get("status"));
  const notes = String(formData.get("notes") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("tenders").update({ lead_status: status }).eq("id", tenderId).eq("is_deleted", false);
  if (error) throw new Error(error.message);
  await supabase.from("lead_activities").insert({
    tender_id: tenderId,
    user_id: profile.id,
    activity_type: "UPDATED",
    activity_notes: notes || `Status changed to ${status}`
  });
  revalidatePath("/tenders");
}

export async function deleteTenderAction(tenderId: string) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase.from("tenders").select("*").eq("id", tenderId).eq("is_deleted", false).maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Tender not found or already deleted.");

  const deletedAt = utcNowISOString();
  const updates = {
    is_deleted: true,
    deleted_at: deletedAt,
    deleted_by: profile.id
  };

  const { data: updated, error } = await supabase.from("tenders").update(updates).eq("id", tenderId).select("*").single();
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_logs").insert({
    table_name: "tenders",
    record_id: tenderId,
    user_id: profile.id,
    action: "DELETE_TENDER",
    old_data: existing,
    new_data: updated
  });
  if (auditError) throw new Error(auditError.message);

  revalidateTenderPaths();
}

export async function restoreTenderAction(tenderId: string) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase.from("tenders").select("*").eq("id", tenderId).eq("is_deleted", true).maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Deleted tender not found.");

  const updates = {
    is_deleted: false,
    deleted_at: null,
    deleted_by: null
  };

  const { data: updated, error } = await supabase.from("tenders").update(updates).eq("id", tenderId).select("*").single();
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_logs").insert({
    table_name: "tenders",
    record_id: tenderId,
    user_id: profile.id,
    action: "RESTORE_TENDER",
    old_data: existing,
    new_data: updated
  });
  if (auditError) throw new Error(auditError.message);

  revalidateTenderPaths();
}

function revalidateTenderPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/tenders");
  revalidatePath("/analytics");
  revalidatePath("/assignments");
  revalidatePath("/deleted-tenders");
  revalidatePath("/contractor-intelligence");
  revalidatePath("/product-intelligence");
}

export async function addFollowUpAction(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const payload = followUpSchema.parse({
    tenderId: formData.get("tenderId"),
    followUpDate: formData.get("followUpDate"),
    remarks: formData.get("remarks"),
    status: formData.get("status")
  });
  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    tender_id: payload.tenderId,
    user_id: profile.id,
    follow_up_date: payload.followUpDate,
    remarks: payload.remarks,
    status: payload.status
  });
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}

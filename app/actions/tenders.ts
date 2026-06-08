"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { normalizeDateFields, utcNowISOString } from "@/lib/date-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, ManualTenderInsert, Profile, Tender, TenderUpdateInput } from "@/lib/types";
import { assignmentSchema, followUpSchema, tenderSchema, tenderUpdateSchema } from "@/lib/validations";

function emptyToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

function normalizeAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  return String(value);
}

function canEditTender(profile: { id: string; role: string }, tender: { uploaded_by: string | null; assigned_to: string | null }) {
  return profile.role === "ADMIN" || profile.role === "MANAGER" || tender.uploaded_by === profile.id || tender.assigned_to === profile.id;
}

async function assertCanAssignToProfile(
  supabase: ReturnType<typeof createAdminClient>,
  profile: Pick<Profile, "id" | "role">,
  assignedTo: string
) {
  let query = supabase.from("profiles").select("id,role,manager_id,is_active").eq("id", assignedTo).eq("is_active", true);

  if (profile.role === "ADMIN") {
    query = query.in("role", ["MANAGER", "USER"]);
  } else if (profile.role === "MANAGER") {
    query = query.eq("role", "USER").eq("manager_id", profile.id);
  } else {
    throw new Error("You do not have permission to assign tenders.");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Selected assignee is not available for your role.");
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
    boq_attachment_name: emptyToNull(payload.boq_attachment_name),
    boq_attachment_url: emptyToNull(payload.boq_attachment_url),
    aoc_attachment_name: emptyToNull(payload.aoc_attachment_name),
    aoc_attachment_url: emptyToNull(payload.aoc_attachment_url),
    tender_document_attachment_name: emptyToNull(payload.tender_document_attachment_name),
    tender_document_url: emptyToNull(payload.tender_document_url),
    uploaded_by: profile.id,
    source_type: "MANUAL_ENTRY" as const
  };
  const { data: duplicate, error: duplicateError } = await supabase
    .from("tenders")
    .select("id")
    .eq("tender_id", payload.tender_id)
    .maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) throw new Error(`Tender ID "${payload.tender_id}" already exists. Please use a unique Tender ID before saving.`);

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
  const parsed = rows.map((row) => {
    console.log("Excel row", row);
    return tenderSchema.parse({ ...normalizeDateFields(row as Record<string, unknown>), source_type: "EXCEL_UPLOAD" });
  });
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

const editableTenderFields = [
  "tender_id",
  "organisation_chain",
  "ge",
  "cwe",
  "tender_ref_no",
  "tender_title",
  "contract_date",
  "bid_number",
  "bidder_name",
  "currency",
  "awarded_value",
  "contact_number_1",
  "contact_number_2",
  "contact_number_3",
  "address",
  "email",
  "make",
  "our_value",
  "boq_attachment_name",
  "boq_attachment_url",
  "aoc_attachment_name",
  "aoc_attachment_url",
  "tender_document_attachment_name",
  "tender_document_url",
  "assigned_to"
] as const;

export async function updateTenderAction(input: TenderUpdateInput) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");

  const rawPayload = tenderUpdateSchema.parse({
    ...input,
    tender_id: typeof input.tender_id === "string" ? input.tender_id.trim() : input.tender_id,
    tender_title: typeof input.tender_title === "string" ? input.tender_title.trim() : input.tender_title
  });

  const supabase = createAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from("tenders")
    .select("*")
    .eq("id", rawPayload.id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Tender not found or already deleted.");
  if (!canEditTender(profile, existing)) throw new Error("You do not have permission to edit this tender.");

  const { data: duplicate, error: duplicateError } = await supabase
    .from("tenders")
    .select("id,tender_id")
    .eq("tender_id", rawPayload.tender_id)
    .neq("id", rawPayload.id)
    .maybeSingle();

  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) throw new Error(`Tender ID "${rawPayload.tender_id}" already exists. Please use a unique Tender ID before saving.`);

  const canReassign = profile.role === "ADMIN" || profile.role === "MANAGER";
  const updatedAt = utcNowISOString();
  const nextAssignedTo = emptyToNull(rawPayload.assigned_to) as string | null;
  const updates = {
    tender_id: rawPayload.tender_id,
    organisation_chain: emptyToNull(rawPayload.organisation_chain),
    ge: emptyToNull(rawPayload.ge),
    cwe: emptyToNull(rawPayload.cwe),
    tender_ref_no: emptyToNull(rawPayload.tender_ref_no),
    tender_title: rawPayload.tender_title,
    contract_date: emptyToNull(rawPayload.contract_date),
    bid_number: emptyToNull(rawPayload.bid_number),
    bidder_name: emptyToNull(rawPayload.bidder_name),
    currency: emptyToNull(rawPayload.currency) ?? "INR",
    awarded_value: emptyToNull(rawPayload.awarded_value),
    contact_number_1: emptyToNull(rawPayload.contact_number_1),
    contact_number_2: emptyToNull(rawPayload.contact_number_2),
    contact_number_3: emptyToNull(rawPayload.contact_number_3),
    address: emptyToNull(rawPayload.address),
    email: emptyToNull(rawPayload.email),
    make: emptyToNull(rawPayload.make),
    our_value: emptyToNull(rawPayload.our_value),
    boq_attachment_name: emptyToNull(rawPayload.boq_attachment_name),
    boq_attachment_url: emptyToNull(rawPayload.boq_attachment_url),
    aoc_attachment_name: emptyToNull(rawPayload.aoc_attachment_name),
    aoc_attachment_url: emptyToNull(rawPayload.aoc_attachment_url),
    tender_document_attachment_name: emptyToNull(rawPayload.tender_document_attachment_name),
    tender_document_url: emptyToNull(rawPayload.tender_document_url),
    updated_at: updatedAt,
    ...(canReassign ? { assigned_to: nextAssignedTo, assigned_by: nextAssignedTo ? profile.id : existing.assigned_by } : {})
  };

  const auditRows = editableTenderFields
    .filter((field) => Object.prototype.hasOwnProperty.call(updates, field))
    .map((field) => {
      const oldValue = normalizeAuditValue(existing[field]);
      const newValue = normalizeAuditValue(updates[field as keyof typeof updates]);
      return {
        table_name: "tenders",
        record_id: rawPayload.id,
        user_id: profile.id,
        action:
          isAttachmentField(field) && newValue === null
            ? "DELETE_ATTACHMENT"
            : isAttachmentField(field)
              ? "REPLACE_ATTACHMENT"
              : "UPDATE_TENDER",
        old_data: { field_name: field, value: oldValue },
        new_data: { field_name: field, value: newValue }
      };
    })
    .filter((row) => row.old_data.value !== row.new_data.value);

  if (!auditRows.length) return { ok: true, changed: 0 };

  const assignedToChanged = canReassign && existing.assigned_to !== nextAssignedTo;
  if (assignedToChanged && nextAssignedTo) {
    await assertCanAssignToProfile(supabase, profile, nextAssignedTo);
  }

  const { data: updatedTender, error: updateError } = await supabase.from("tenders").update(updates).eq("id", rawPayload.id).select("*").single();
  if (updateError) throw new Error(updateError.message);

  if (assignedToChanged && nextAssignedTo) {
    await supabase.from("lead_assignments").insert({
      tender_id: rawPayload.id,
      assigned_to: nextAssignedTo,
      assigned_by: profile.id,
      remarks: "Reassigned from tender edit"
    });
    await supabase.from("lead_activities").insert({
      tender_id: rawPayload.id,
      user_id: profile.id,
      activity_type: "REASSIGNED",
      activity_notes: "Tender reassigned from edit form"
    });
  }

  const { error: auditError } = await supabase.from("audit_logs").insert(auditRows);
  if (auditError) throw new Error(auditError.message);

  revalidateTenderPaths();
  return { ok: true, changed: auditRows.length, tender: updatedTender as Tender };
}

export async function getTenderHistoryAction(tenderId: string): Promise<AuditLog[]> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");

  const supabase = createAdminClient();
  const { data: tender, error: tenderError } = await supabase
    .from("tenders")
    .select("id,uploaded_by,assigned_to")
    .eq("id", tenderId)
    .maybeSingle();

  if (tenderError) throw new Error(tenderError.message);
  if (!tender) throw new Error("Tender not found.");
  if (!canEditTender(profile, tender)) throw new Error("You do not have permission to view this tender history.");

  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id,user_id,action,table_name,record_id,old_data,new_data,created_at")
    .eq("record_id", tenderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const auditLogs = (logs ?? []) as AuditLog[];
  const userIds = Array.from(new Set(auditLogs.map((log) => log.user_id).filter((userId): userId is string => Boolean(userId))));
  const userNameById = new Map<string, string>();

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds);

    if (profilesError) throw new Error(profilesError.message);
    (profiles ?? []).forEach((item) => {
      userNameById.set(item.id, item.full_name || "Unknown");
    });
  }

  return auditLogs.map((log) => ({
    ...log,
    user_name: log.user_id ? userNameById.get(log.user_id) ?? "Unknown" : "Unknown"
  }));
}

function isAttachmentField(field: string) {
  return field.includes("attachment") || field === "tender_document_url";
}

export async function assignLeadAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  const payload = assignmentSchema.parse({
    tenderId: formData.get("tenderId"),
    assignedTo: formData.get("assignedTo"),
    remarks: formData.get("remarks") || undefined
  });
  const adminSupabase = createAdminClient();
  await assertCanAssignToProfile(adminSupabase, profile, payload.assignedTo);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenders")
    .update({
      assigned_to: payload.assignedTo,
      assigned_by: profile.id,
      lead_status: "ASSIGNED",
      updated_at: utcNowISOString()
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
  const { error } = await supabase.from("tenders").update({ lead_status: status, updated_at: utcNowISOString() }).eq("id", tenderId).eq("is_deleted", false);
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
    deleted_by: profile.id,
    updated_at: deletedAt
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
    deleted_by: null,
    updated_at: utcNowISOString()
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

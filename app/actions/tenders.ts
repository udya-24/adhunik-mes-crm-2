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

function leadStatusEnumFromName(statusName: string) {
  if (statusName === "Order Received") return "WON";
  if (statusName === "Lost To Competitor" || statusName === "No Requirement" || statusName === "Closed") return "LOST";
  if (statusName === "Quotation Sent") return "QUOTATION_SENT";
  if (statusName === "Price Negotiation") return "NEGOTIATION";
  if (statusName === "Follow Up Required" || statusName === "On Hold") return "FOLLOW_UP";
  if (["First Contact", "Contacted", "Requirement Received", "BOQ Requested", "BOQ Received", "Technical Discussion", "Sample Submitted", "PI Sent", "PI Waiting Approval", "Order Expected", "Not Reachable"].includes(statusName)) return "CONTACTED";
  return "NEW";
}

async function canUpdateLeadPipeline(
  supabase: ReturnType<typeof createAdminClient>,
  profile: { id: string; role: string },
  tender: { uploaded_by: string | null; assigned_to: string | null }
) {
  if (profile.role === "ADMIN") return true;
  if (profile.role === "USER") return tender.assigned_to === profile.id;
  if (profile.role !== "MANAGER") return false;
  if (tender.uploaded_by === profile.id || tender.assigned_to === profile.id) return true;
  const userIds = [tender.assigned_to, tender.uploaded_by].filter((id): id is string => Boolean(id));
  if (!userIds.length) return false;
  const { data, error } = await supabase.from("profiles").select("id").in("id", userIds).eq("manager_id", profile.id).limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function assertCanAssignToProfile(
  supabase: ReturnType<typeof createAdminClient>,
  profile: Pick<Profile, "id" | "role">,
  assignedTo: string
) {
  let query = supabase.from("profiles").select("id,role,manager_id,is_active").eq("id", assignedTo).eq("is_active", true);

  if (profile.role === "MANAGER") {
    query = query.or(`and(role.eq.USER,manager_id.eq.${profile.id}),id.eq.${profile.id}`);
  } else if (profile.role !== "ADMIN") {
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
    lead_status: "NEW" as const,
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
  const inserts = parsed.filter((row) => !duplicateIds.has(row.tender_id)).map((row) => ({ ...row, uploaded_by: profile.id, lead_status: "NEW" as const }));

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
      const isAttachment = isAttachmentField(field);
      return {
        table_name: "tenders",
        record_id: rawPayload.id,
        user_id: profile.id,
        action:
          field === "assigned_to"
            ? "ASSIGNMENT_CHANGED"
            : isAttachment && newValue === null
            ? "DELETE_ATTACHMENT"
            : isAttachment && oldValue === null && newValue !== null
              ? "UPLOAD_ATTACHMENT"
              : isAttachment
                ? "REPLACE_ATTACHMENT"
                : "TENDER_EDITED",
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
  const { data: tender, error: tenderError } = await supabase
    .from("tenders")
    .select("id,assigned_to")
    .eq("id", payload.tenderId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (tenderError) throw new Error(tenderError.message);
  if (!tender) throw new Error("Tender not found.");
  if (tender.assigned_to === payload.assignedTo) return;

  const { error } = await supabase
    .from("tenders")
    .update({
      assigned_to: payload.assignedTo,
      assigned_by: profile.id,
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

export async function assignLeadToMeAction(tenderId: string) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  if (!tenderId) return { error: "Tender is required." };

  const supabase = createAdminClient();
  const { data: tender, error: tenderError } = await supabase
    .from("tenders")
    .select("id,assigned_to")
    .eq("id", tenderId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (tenderError) return { error: tenderError.message };
  if (!tender) return { error: "Tender not found." };
  if (tender.assigned_to === profile.id) return { ok: true, alreadyAssigned: true, message: "Currently assigned to you" };

  await assertCanAssignToProfile(supabase, profile, profile.id);
  const now = utcNowISOString();
  const { error: updateError } = await supabase
    .from("tenders")
    .update({ assigned_to: profile.id, assigned_by: profile.id, updated_at: now })
    .eq("id", tenderId)
    .eq("is_deleted", false);
  if (updateError) return { error: updateError.message };

  const { error: assignmentError } = await supabase.from("lead_assignments").insert({
    tender_id: tenderId,
    assigned_to: profile.id,
    assigned_by: profile.id,
    remarks: "Assigned to self"
  });
  if (assignmentError) return { error: assignmentError.message };

  const { error: activityError } = await supabase.from("lead_activities").insert({
    tender_id: tenderId,
    user_id: profile.id,
    activity_type: "ASSIGNED",
    activity_notes: "Tender assigned to self"
  });
  if (activityError) return { error: activityError.message };

  revalidatePath("/tenders");
  revalidatePath("/assignments");
  return { ok: true, message: "Tender assigned to you successfully." };
}

export async function bulkTenderAction(input: { tenderIds: string[]; action: "assign" | "unassign" | "delete"; assignedTo?: string | null }) {
  const profile = await requireRole(input.action === "delete" ? ["ADMIN"] : ["ADMIN", "MANAGER"]);
  const tenderIds = Array.from(new Set(input.tenderIds.filter(Boolean)));
  if (!tenderIds.length) throw new Error("Select at least one tender.");

  const supabase = createAdminClient();
  const { data: tenders, error: fetchError } = await supabase
    .from("tenders")
    .select("*")
    .in("id", tenderIds)
    .eq("is_deleted", false);

  if (fetchError) throw new Error(fetchError.message);
  if (!tenders?.length) throw new Error("No active tenders found for bulk operation.");

  const now = utcNowISOString();
  let affectedTenders = tenders;
  if (input.action === "assign") {
    if (!input.assignedTo) throw new Error("Choose a user before assigning selected tenders.");
    await assertCanAssignToProfile(supabase, profile, input.assignedTo);
    affectedTenders = tenders.filter((tender) => tender.assigned_to !== input.assignedTo);
    if (!affectedTenders.length) return { ok: true, count: 0 };

    const { error } = await supabase
      .from("tenders")
      .update({ assigned_to: input.assignedTo, assigned_by: profile.id, updated_at: now })
      .in("id", affectedTenders.map((tender) => tender.id));
    if (error) throw new Error(error.message);

    await supabase.from("lead_assignments").insert(
      affectedTenders.map((tender) => ({
        tender_id: tender.id,
        assigned_to: input.assignedTo,
        assigned_by: profile.id,
        remarks: "Bulk assigned"
      }))
    );
  }

  if (input.action === "unassign") {
    const { error } = await supabase
      .from("tenders")
      .update({ assigned_to: null, assigned_by: profile.id, updated_at: now })
      .in("id", tenders.map((tender) => tender.id));
    if (error) throw new Error(error.message);
  }

  if (input.action === "delete") {
    const { error } = await supabase
      .from("tenders")
      .update({ is_deleted: true, deleted_at: now, deleted_by: profile.id, updated_at: now })
      .in("id", tenders.map((tender) => tender.id));
    if (error) throw new Error(error.message);
  }

  await supabase.from("lead_activities").insert(
    affectedTenders.map((tender) => ({
      tender_id: tender.id,
      user_id: profile.id,
      activity_type: `BULK_${input.action.toUpperCase()}`,
      activity_notes: `Bulk ${input.action} operation`
    }))
  );

  await supabase.from("audit_logs").insert(
    affectedTenders.map((tender) => ({
      table_name: "tenders",
      record_id: tender.id,
      user_id: profile.id,
      action: `BULK_${input.action.toUpperCase()}`,
      old_data: tender,
      new_data: {
        action: input.action,
        assigned_to: input.action === "assign" ? input.assignedTo : input.action === "unassign" ? null : tender.assigned_to,
        deleted_at: input.action === "delete" ? now : tender.deleted_at
      }
    }))
  );

  revalidateTenderPaths();
  return { ok: true, count: affectedTenders.length };
}

export async function updateLeadStageAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const tenderId = String(formData.get("tenderId") || "");
  const statusId = String(formData.get("statusId") || "");
  if (!tenderId || !statusId) return { error: "Tender and lead stage are required." };

  const supabase = createAdminClient();
  const [{ data: tender, error: tenderError }, { data: nextStatus, error: statusError }] = await Promise.all([
    supabase.from("tenders").select("id,uploaded_by,assigned_to,lead_status").eq("id", tenderId).eq("is_deleted", false).maybeSingle(),
    supabase.from("lead_status_master").select("*").eq("id", statusId).eq("is_active", true).maybeSingle()
  ]);
  if (tenderError) return { error: tenderError.message };
  if (statusError) return { error: statusError.message };
  if (!tender) return { error: "Tender not found" };
  if (!nextStatus) return { error: "Lead stage not found" };
  if (!(await canUpdateLeadPipeline(supabase, profile, tender))) throw new Error("You do not have permission to update this lead stage.");

  const followUpDate = String(formData.get("followUpDate") || "");
  const reminderNotes = String(formData.get("reminderNotes") || "").trim();
  const statusRemark = String(formData.get("statusRemark") || "").trim();
  if (!statusRemark) return { error: "Status remark is required." };
  const nextLeadStatus = leadStatusEnumFromName(nextStatus.status_name);

  const updates = {
    lead_status: nextLeadStatus,
    updated_at: utcNowISOString()
  };

  const { error: updateError } = await supabase.from("tenders").update(updates).eq("id", tenderId);
  if (updateError) return { error: updateError.message };

  const oldStatusLabel = tender.lead_status || "NEW";

  const { error: statusHistoryError } = await supabase.from("lead_status_history").insert({
    tender_id: tenderId,
    status_id: statusId,
    updated_by: profile.id,
    remarks: statusRemark
  });
  if (statusHistoryError) return { error: statusHistoryError.message };

  const { error: remarkError } = await supabase.from("lead_remarks").insert({
    tender_id: tenderId,
    user_id: profile.id,
    remark: statusRemark
  });
  if (remarkError) return { error: remarkError.message };

  if (followUpDate) {
    const { error: followUpError } = await supabase.from("follow_ups").insert({
      tender_id: tenderId,
      user_id: profile.id,
      follow_up_date: followUpDate,
      remarks: reminderNotes || "Lead follow-up",
      status: nextLeadStatus
    });
    if (followUpError) return { error: followUpError.message };
  }

  const { error: activityError } = await supabase.from("lead_activities").insert({
    tender_id: tenderId,
    user_id: profile.id,
    activity_type: "LEAD_STAGE_CHANGED",
    activity_notes: `${oldStatusLabel} -> ${nextStatus.status_name}${reminderNotes ? ` | ${reminderNotes}` : ""}`
  });
  if (activityError) return { error: activityError.message };

  const { error: auditError } = await supabase.from("audit_logs").insert({
    table_name: "tenders",
    record_id: tenderId,
    user_id: profile.id,
    action: "LEAD_STAGE_CHANGED",
    old_data: { field_name: "lead_status", value: tender.lead_status, label: oldStatusLabel },
    new_data: { field_name: "lead_status", value: nextLeadStatus, label: nextStatus.status_name }
  });
  if (auditError) return { error: auditError.message };

  revalidateTenderPaths();
  return { ok: true };
}

export async function addLeadRemarkAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const tenderId = String(formData.get("tenderId") || "");
  const remark = String(formData.get("remark") || "").trim();
  if (!tenderId || !remark) throw new Error("Remark is required.");

  const supabase = createAdminClient();
  const { data: tender, error: tenderError } = await supabase.from("tenders").select("uploaded_by,assigned_to").eq("id", tenderId).eq("is_deleted", false).maybeSingle();
  if (tenderError) throw new Error(tenderError.message);
  if (!tender) throw new Error("Tender not found.");
  if (!(await canUpdateLeadPipeline(supabase, profile, tender))) throw new Error("You do not have permission to add remarks for this lead.");

  const { error } = await supabase.from("lead_remarks").insert({ tender_id: tenderId, user_id: profile.id, remark });
  if (error) throw new Error(error.message);
  await supabase.from("lead_activities").insert({
    tender_id: tenderId,
    user_id: profile.id,
    activity_type: "REMARK_ADDED",
    activity_notes: remark
  });
  await supabase.from("audit_logs").insert({
    table_name: "lead_remarks",
    record_id: tenderId,
    user_id: profile.id,
    action: "REMARK_ADDED",
    old_data: null,
    new_data: { remark }
  });

  revalidateTenderPaths();
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

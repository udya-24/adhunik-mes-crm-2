"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DistributionAlgorithm = "LEAST_LOADED" | "ROUND_ROBIN" | "RANDOM";
export type DistributionQuantityMode = "ALL_UNASSIGNED" | "SPECIFIC_NUMBER" | "KEEP_UNASSIGNED";
export type DistributionOrder = "OLDEST_FIRST" | "NEWEST_FIRST" | "HIGHEST_VALUE" | "LOWEST_VALUE" | "RANDOM";
export type DistributionRequest = {
  algorithm: DistributionAlgorithm;
  assignmentOrder: DistributionOrder;
  quantityMode: DistributionQuantityMode;
  quantityValue: number;
  selectedUsers: string[];
};

export type BidderTransferScope = "FUTURE_ONLY" | "FUTURE_AND_OPEN" | "FUTURE_AND_ALL";

function cleanBidderName(value: string) {
  const name = value.trim();
  if (!name) throw new Error("Bidder name is required.");
  return name;
}

async function activeAssignee(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin.from("profiles").select("id,role,is_active").eq("id", userId).eq("is_active", true).in("role", ["USER", "MANAGER"]).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Select an active User or Manager.");
}

function revalidateDistribution() {
  revalidatePath("/lead-distribution");
  revalidatePath("/tenders");
  revalidatePath("/dashboard");
  revalidatePath("/assignments");
}

export async function getBidderOwnershipAction(search = "") {
  await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  let query = admin.from("bidder_assignments")
    .select("*,assignee:profiles!bidder_assignments_assigned_user_fkey(id,full_name,email,role),assigner:profiles!bidder_assignments_assigned_by_fkey(id,full_name,email)")
    .order("is_active", { ascending: false }).order("bidder_name").limit(500);
  const term = search.trim();
  if (term) query = query.or(`bidder_name.ilike.%${term.replace(/[%_,]/g, "")}%,assignee.full_name.ilike.%${term.replace(/[%_,]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBidderAssignmentAction(input: { bidderName: string; assignedUser: string; remarks?: string }) {
  const profile = await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  const bidderName = cleanBidderName(input.bidderName);
  await activeAssignee(admin, input.assignedUser);
  const { data: duplicate } = await admin.from("bidder_assignments").select("id").eq("is_active", true).ilike("bidder_name", bidderName).maybeSingle();
  if (duplicate) throw new Error("An active assignment already exists for this bidder.");
  const { data, error } = await admin.from("bidder_assignments").insert({ bidder_name: bidderName, assigned_user: input.assignedUser, assigned_by: profile.id, remarks: input.remarks?.trim() || null }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "An active assignment already exists for this bidder." : error.message);
  await admin.from("audit_logs").insert({ table_name: "bidder_assignments", record_id: data.id, user_id: profile.id, action: "BIDDER_ASSIGNMENT_CREATED", new_data: { bidder_name: bidderName, assigned_user: input.assignedUser } });
  revalidateDistribution();
  return { ok: true };
}

export async function updateBidderAssignmentAction(input: { id: string; bidderName: string; remarks?: string; isActive: boolean }) {
  const profile = await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  const { data: old, error: oldError } = await admin.from("bidder_assignments").select("*").eq("id", input.id).single();
  if (oldError) throw new Error(oldError.message);
  const updates = { bidder_name: cleanBidderName(input.bidderName), remarks: input.remarks?.trim() || null, is_active: input.isActive };
  const { error } = await admin.from("bidder_assignments").update(updates).eq("id", input.id);
  if (error) throw new Error(error.code === "23505" ? "An active assignment already exists for this bidder." : error.message);
  await admin.from("audit_logs").insert({ table_name: "bidder_assignments", record_id: input.id, user_id: profile.id, action: "BIDDER_ASSIGNMENT_UPDATED", old_data: old, new_data: updates });
  revalidateDistribution();
  return { ok: true };
}

export async function deleteBidderAssignmentAction(id: string) {
  const profile = await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  const { data: old, error } = await admin.from("bidder_assignments").update({ is_active: false }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({ table_name: "bidder_assignments", record_id: id, user_id: profile.id, action: "BIDDER_ASSIGNMENT_UPDATED", old_data: old, new_data: { is_active: false } });
  revalidateDistribution();
  return { ok: true };
}

export async function transferBidderOwnershipAction(input: { id: string; assignedUser: string; scope: BidderTransferScope; remarks?: string }) {
  const profile = await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  await activeAssignee(admin, input.assignedUser);
  const { data: rule, error } = await admin.from("bidder_assignments").select("*").eq("id", input.id).single();
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("bidder_assignments").update({ assigned_user: input.assignedUser, assigned_by: profile.id, assigned_at: now, remarks: input.remarks?.trim() || rule.remarks }).eq("id", input.id);
  if (updateError) throw new Error(updateError.message);
  if (input.scope !== "FUTURE_ONLY") {
    let tenderQuery = admin.from("tenders").select("id,assigned_to").ilike("bidder_name", rule.bidder_name).eq("is_deleted", false);
    if (input.scope === "FUTURE_AND_OPEN") tenderQuery = tenderQuery.not("lead_status", "in", "(WON,LOST)");
    const { data: tenders, error: tenderError } = await tenderQuery;
    if (tenderError) throw new Error(tenderError.message);
    const changed = (tenders ?? []).filter((t) => t.assigned_to !== input.assignedUser);
    if (changed.length) {
      const ids = changed.map((t) => t.id);
      const { error: assignmentError } = await admin.from("tenders").update({ assigned_to: input.assignedUser, assigned_by: profile.id, updated_at: now }).in("id", ids);
      if (assignmentError) throw new Error(assignmentError.message);
      await admin.from("lead_assignments").insert(ids.map((tender_id) => ({ tender_id, assigned_to: input.assignedUser, assigned_by: profile.id, assigned_date: now, remarks: `Bidder ownership transfer (${input.scope})` })));
    }
  }
  await admin.from("audit_logs").insert({ table_name: "bidder_assignments", record_id: input.id, user_id: profile.id, action: "BIDDER_OWNERSHIP_TRANSFERRED", old_data: { assigned_user: rule.assigned_user }, new_data: { assigned_user: input.assignedUser, scope: input.scope } });
  revalidateDistribution();
  return { ok: true };
}

function normalizedQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

export async function getDistributionOverviewAction() {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: pool, error: poolError }, { data: unassignedRows }, { data: rules }, { data: lastBatch }, { count: pending }, { count: bidderAssigned }, { count: distributed }] = await Promise.all([
    supabase.rpc("lead_distribution_pool"),
    admin.from("tenders").select("id,bidder_name").is("assigned_to", null).is("deleted_at", null),
    admin.from("bidder_assignments").select("bidder_name").eq("is_active", true),
    admin.from("assignment_batches").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("assignment_batches").select("id", { count: "exact", head: true }).in("status", ["PENDING", "RUNNING"]),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "AUTOMATIC_BIDDER_ASSIGNMENT_EXECUTED"),
    admin.from("assignment_batch_items").select("id", { count: "exact", head: true })
  ]);
  if (poolError) throw new Error(poolError.message);
  const bidderNames = new Set((rules ?? []).map((r) => r.bidder_name.trim().toLocaleLowerCase()));
  const unassigned = (unassignedRows ?? []).filter((t) => !t.bidder_name || !bidderNames.has(t.bidder_name.trim().toLocaleLowerCase())).length;
  return { pool: pool ?? [], unassigned, lastBatch, pending: pending ?? 0, analytics: { bidderAssigned: bidderAssigned ?? 0, distributed: distributed ?? 0, manuallyAssigned: Math.max(0, (pool ?? []).reduce((sum: number, p: { current_assigned: number }) => sum + Number(p.current_assigned || 0), 0) - (bidderAssigned ?? 0) - (distributed ?? 0)), unassigned } };
}

export async function previewDistributionAction(input: DistributionRequest) {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_lead_distribution", {
    p_algorithm: input.algorithm,
    p_assignment_order: input.assignmentOrder,
    p_quantity_mode: input.quantityMode,
    p_quantity_value: normalizedQuantity(input.quantityValue),
    p_selected_users: input.selectedUsers
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function createDistributionBatchAction(input: DistributionRequest) {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_assignment_batch", {
    p_algorithm: input.algorithm,
    p_assignment_order: input.assignmentOrder,
    p_quantity_mode: input.quantityMode,
    p_quantity_value: normalizedQuantity(input.quantityValue),
    p_selected_users: input.selectedUsers
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function processDistributionChunkAction(batchId: string) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_assignment_batch", { p_batch_id: batchId, p_chunk_size: 1000 });
  if (error) {
    await createAdminClient().from("assignment_batches").update({ status: "FAILED", completed_at: new Date().toISOString() }).eq("id", batchId).eq("started_by", profile.id);
    throw new Error(error.message);
  }
  if (data?.status === "COMPLETED") {
    revalidatePath("/dashboard");
    revalidatePath("/assignments");
    revalidatePath("/tenders");
    revalidatePath("/lead-distribution");
  }
  return data;
}

export async function getDistributionReportAction(batchId: string, page = 1, pageSize = 100) {
  await requireRole(["ADMIN"]);
  const admin = createAdminClient();
  const safeSize = Math.min(Math.max(pageSize, 1), 5000);
  const from = Math.max(page - 1, 0) * safeSize;
  const { data, count, error } = await admin
    .from("assignment_batch_items")
    .select("id,tender_id,old_user,new_user,assigned_at,tender:tenders(tender_id,tender_title),old_profile:profiles!assignment_batch_items_old_user_fkey(full_name,email),new_profile:profiles!assignment_batch_items_new_user_fkey(full_name,email)", { count: "exact" })
    .eq("batch_id", batchId).order("id").range(from, from + safeSize - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getDistributionAnalyticsAction() {
  await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_distribution_analytics");
  if (error) return { today: 0, yesterday: 0, last7Days: 0, lastBatch: null };
  return data;
}

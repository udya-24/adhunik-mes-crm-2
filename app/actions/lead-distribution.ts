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

function normalizedQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

export async function getDistributionOverviewAction() {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: pool, error: poolError }, { count: unassigned }, { data: lastBatch }, { count: pending }] = await Promise.all([
    supabase.rpc("lead_distribution_pool"),
    admin.from("tenders").select("id", { count: "exact", head: true }).is("assigned_to", null).is("deleted_at", null),
    admin.from("assignment_batches").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("assignment_batches").select("id", { count: "exact", head: true }).in("status", ["PENDING", "RUNNING"])
  ]);
  if (poolError) throw new Error(poolError.message);
  return { pool: pool ?? [], unassigned: unassigned ?? 0, lastBatch, pending: pending ?? 0 };
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

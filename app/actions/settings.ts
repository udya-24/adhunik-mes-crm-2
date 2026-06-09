"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function upsertLeadStatusAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const payload = {
    status_name: String(formData.get("status_name") || "").trim(),
    sort_order: Number(formData.get("sort_order") || 0),
    status_color: String(formData.get("status_color") || "#173b71"),
    is_active: formData.get("is_active") === "on"
  };
  if (!payload.status_name) throw new Error("Status name is required.");
  if (!Number.isFinite(payload.sort_order) || payload.sort_order < 1) throw new Error("Status order must be a positive number.");

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from("lead_status_master").update(payload).eq("id", id)
    : await supabase.from("lead_status_master").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/tenders");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

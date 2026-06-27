"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileSchema } from "@/lib/validations";

export async function createUserAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const payload = profileSchema.parse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
    manager_id: formData.get("manager_id") || null,
    is_active: formData.get("is_active") === "on"
  });
  const password = String(formData.get("password") || "");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: payload.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: payload.full_name, role: payload.role }
  });
  if (error) throw new Error(error.message);

  await supabase.from("profiles").upsert({
    id: data.user.id,
    ...payload
  });
  revalidatePath("/users");
}

export async function toggleUserAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id"));
  const isActive = formData.get("is_active") === "true";
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/users");
}

export async function toggleQuotationAccessAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id"));
  const hasAccess = formData.get("has_access") === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ can_access_quotations: !hasAccess })
    .eq("id", id)
    .eq("role", "USER");
  if (error) throw new Error(error.message);
  revalidatePath("/users");
  revalidatePath("/quotations");
}

export async function togglePiAccessAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id"));
  const hasAccess = formData.get("has_access") === "true";
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ can_access_pi: !hasAccess })
    .eq("id", id)
    .eq("role", "USER");
  if (error) throw new Error(error.message);
  revalidatePath("/users");
  revalidatePath("/proforma-invoices");
}

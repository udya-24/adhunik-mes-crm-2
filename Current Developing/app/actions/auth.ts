"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations";

export async function loginAction(formData: FormData) {
  const payload = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(payload);
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data as Profile | null;
}

export async function requireRole(allowed: Role[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowed.includes(profile.role) || !profile.is_active) {
    redirect("/dashboard");
  }
  return profile;
}

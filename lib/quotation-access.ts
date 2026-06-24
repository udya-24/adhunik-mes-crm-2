import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessQuotations } from "@/lib/permissions";

export async function requireQuotationAccess() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !canAccessQuotations(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

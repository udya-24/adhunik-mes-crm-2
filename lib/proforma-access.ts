import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessPI } from "@/lib/permissions";

export async function requireProformaInvoiceAccess() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !canAccessPI(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

import { unstable_noStore as noStore } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Communication, CommunicationAccount, CommunicationAttachment, CommunicationDraft, CommunicationTemplate, Profile } from "@/lib/types";

export type CommunicationCenterData = {
  accounts: CommunicationAccount[]; templates: CommunicationTemplate[]; drafts: CommunicationDraft[];
  communications: Communication[]; users: Pick<Profile, "id" | "full_name" | "email">[];
  attachments: CommunicationAttachment[];
};

export async function getCommunicationCenterData(): Promise<CommunicationCenterData> {
  noStore();
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = createAdminClient();
  const communicationQuery = supabase.from("communications")
    .select("*, creator:profiles!communications_created_by_fkey(full_name,email)")
    .order("created_at", { ascending: false });
  if (profile.role === "USER") communicationQuery.eq("created_by", profile.id);
  const [accounts, templates, drafts, communications, users, attachments] = await Promise.all([
    supabase.from("communication_accounts").select("*").order("is_default", { ascending: false }),
    supabase.from("communication_templates").select("*, creator:profiles!communication_templates_created_by_fkey(full_name,email)").order("created_at", { ascending: false }),
    supabase.from("communication_drafts").select("*").eq("created_by", profile.id).order("updated_at", { ascending: false }),
    communicationQuery,
    profile.role === "USER" ? Promise.resolve({ data: [], error: null }) : supabase.from("profiles").select("id,full_name,email").eq("is_active", true).order("full_name"),
    supabase.from("communication_attachments").select("*, creator:profiles!communication_attachments_created_by_fkey(full_name,email)").order("created_at", { ascending: false }).limit(100)
  ]);
  const error = accounts.error || templates.error || drafts.error || communications.error || users.error || attachments.error;
  if (error) throw new Error(`Communication Center is not initialized. Apply supabase/communication_center.sql. ${error.message}`);
  return {
    accounts: (accounts.data ?? []) as CommunicationAccount[], templates: (templates.data ?? []) as CommunicationTemplate[],
    drafts: (drafts.data ?? []) as CommunicationDraft[], communications: (communications.data ?? []) as unknown as Communication[],
    users: (users.data ?? []) as Pick<Profile, "id" | "full_name" | "email">[], attachments: (attachments.data ?? []) as unknown as CommunicationAttachment[]
  };
}

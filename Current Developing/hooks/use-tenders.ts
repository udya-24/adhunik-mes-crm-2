"use client";

import { useQuery } from "@tanstack/react-query";
import { tenderQueryKeys } from "@/lib/queries/tenders";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Tender } from "@/lib/types";

function logQueryError(queryName: string, error: { message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(queryName, error.message, error.details, error.hint);
}

const tenderSelect =
  "*, uploaded_by_profile:profiles!tenders_uploaded_by_fkey(full_name,email,role), assigned_profile:profiles!tenders_assigned_to_fkey(full_name,email,role), assigned_by_profile:profiles!tenders_assigned_by_fkey(full_name,email,role)";

export function useTenders() {
  return useQuery({
    queryKey: tenderQueryKeys.all,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const { data: profile, error: profileError } = user
        ? await supabase.from("profiles").select("id,role,full_name,email").eq("id", user.id).maybeSingle()
        : { data: null, error: null };

      if (profileError) {
        console.error("[useTenders] profile lookup error", profileError);
      }

      const currentProfile = profile as Pick<Profile, "id" | "role" | "full_name" | "email"> | null;
      const query = supabase.from("tenders").select(tenderSelect).eq("is_deleted", false).order("created_at", { ascending: false });
      const { data, error } = await (
        currentProfile?.role === "USER"
          ? query.or(`uploaded_by.eq.${currentProfile.id},assigned_to.eq.${currentProfile.id}`)
          : query
      );

      if (error) {
        logQueryError("useTenders tenders", error);
        return [];
      }
      return enrichTendersWithAssignments(supabase, normalizeTenderProfiles((data ?? []) as Tender[]));
    }
  });
}

type SupabaseBrowserClient = ReturnType<typeof createClient>;

async function enrichTendersWithAssignments(supabase: SupabaseBrowserClient, tenders: Tender[]) {
  if (!tenders.length) return tenders;

  const { data, error } = await supabase
    .from("lead_assignments")
    .select("tender_id,assigned_to,assigned_by,assigned_date,assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email,role),assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email,role)")
    .in("tender_id", tenders.map((tender) => tender.id))
    .order("assigned_date", { ascending: false });

  if (error) {
    logQueryError("useTenders lead_assignments enrichment", error);
    return tenders.map(clearTenderAssignment);
  }

  const latestByTenderId = new Map<string, NonNullable<typeof data>[number]>();
  (data ?? []).forEach((assignment) => {
    if (!latestByTenderId.has(assignment.tender_id)) latestByTenderId.set(assignment.tender_id, assignment);
  });

  return tenders.map((tender) => {
    const assignment = latestByTenderId.get(tender.id);
    if (!assignment) return clearTenderAssignment(tender);

    return {
      ...tender,
      assigned_to: assignment.assigned_to,
      assigned_by: assignment.assigned_by,
      assigned_date: assignment.assigned_date,
      assigned_profile: firstProfile(assignment.assignee),
      assigned_by_profile: firstProfile(assignment.assigner)
    } as unknown as Tender;
  });
}

function firstProfile<T>(profile: T | T[] | null | undefined) {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null;
}

function normalizeTenderProfiles(tenders: Tender[]) {
  return tenders.map((tender) => ({
    ...tender,
    uploaded_by_profile: firstProfile(tender.uploaded_by_profile),
    assigned_profile: firstProfile(tender.assigned_profile),
    assigned_by_profile: firstProfile(tender.assigned_by_profile)
  }));
}

function clearTenderAssignment(tender: Tender): Tender {
  return {
    ...tender,
    assigned_profile: firstProfile(tender.assigned_profile),
    assigned_by_profile: firstProfile(tender.assigned_by_profile)
  };
}

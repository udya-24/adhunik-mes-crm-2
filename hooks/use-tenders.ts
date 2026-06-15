"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { tenderQueryKeys, type TenderQueryParams } from "@/lib/queries/tenders";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Tender } from "@/lib/types";

function logQueryError(queryName: string, error: { message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(queryName, error.message, error.details, error.hint);
}

const tenderSelect =
  "*, uploaded_by_profile:profiles!tenders_uploaded_by_fkey(full_name,email,role), assigned_profile:profiles!tenders_assigned_to_fkey(full_name,email,role), assigned_by_profile:profiles!tenders_assigned_by_fkey(full_name,email,role)";

const defaultTenderQueryParams: TenderQueryParams = {
  search: "",
  status: "",
  source: "",
  assignment: "",
  page: 1,
  pageSize: 50
};

export function useTenders(params: Partial<TenderQueryParams> = {}) {
  const queryParams = { ...defaultTenderQueryParams, ...params };
  return useQuery({
    queryKey: tenderQueryKeys.list(queryParams),
    placeholderData: keepPreviousData,
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
      let query = supabase
        .from("tenders")
        .select(tenderSelect, { count: "exact" })
        .eq("is_deleted", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (currentProfile?.role === "USER") query = query.or(`uploaded_by.eq.${currentProfile.id},assigned_to.eq.${currentProfile.id}`);
      if (queryParams.status) query = query.eq("lead_status", queryParams.status);
      if (queryParams.source) query = query.eq("source_type", queryParams.source);
      if (queryParams.assignment === "assigned") query = query.not("assigned_to", "is", null);
      if (queryParams.assignment === "unassigned") query = query.is("assigned_to", null);
      if (queryParams.search.trim()) query = query.or(buildSearchOr(queryParams.search));

      const from = (Math.max(queryParams.page, 1) - 1) * queryParams.pageSize;
      const to = from + queryParams.pageSize - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        logQueryError("useTenders tenders", error);
        return { rows: [], total: 0 };
      }
      const rows = await enrichLeadContext(supabase, await enrichTendersWithAssignments(supabase, normalizeTenderProfiles((data ?? []) as Tender[])));
      return { rows, total: count ?? rows.length };
    }
  });
}

async function enrichLeadContext(supabase: SupabaseBrowserClient, tenders: Tender[]) {
  if (!tenders.length) return tenders;
  const tenderIds = tenders.map((tender) => tender.id);
  const [{ data: remarks }, { data: activities }] = await Promise.all([
    supabase
      .from("lead_remarks")
      .select("tender_id,remark,created_at,tender:tenders!lead_remarks_tender_id_fkey(id),user:profiles!lead_remarks_user_id_fkey(full_name,email)")
      .in("tender_id", tenderIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_activities")
      .select("tender_id,created_at,user:profiles!lead_activities_user_id_fkey(full_name,email)")
      .in("tender_id", tenderIds)
      .order("created_at", { ascending: false })
  ]);
  const latestRemarkByTender = new Map<string, NonNullable<typeof remarks>[number]>();
  const latestActivityByTender = new Map<string, NonNullable<typeof activities>[number]>();
  (remarks ?? []).forEach((remark) => {
    if (!latestRemarkByTender.has(remark.tender_id)) latestRemarkByTender.set(remark.tender_id, remark);
  });
  (activities ?? []).forEach((activity) => {
    if (!latestActivityByTender.has(activity.tender_id)) latestActivityByTender.set(activity.tender_id, activity);
  });
  return tenders.map((tender) => {
    const remark = latestRemarkByTender.get(tender.id);
    const activity = latestActivityByTender.get(tender.id);
    const activityUser = firstProfile(activity?.user);
    return {
      ...tender,
      latest_remark: remark?.remark ?? null,
      last_updated_by_name: activityUser?.full_name || activityUser?.email || null,
      last_activity_date: activity?.created_at ?? null
    };
  });
}

function buildSearchOr(search: string) {
  const term = search.trim().replaceAll("%", "\\%").replaceAll(",", " ");
  const pattern = `%${term}%`;
  return [
    `tender_id.ilike.${pattern}`,
    `tender_ref_no.ilike.${pattern}`,
    `tender_title.ilike.${pattern}`,
    `ge.ilike.${pattern}`,
    `cwe.ilike.${pattern}`,
    `bidder_name.ilike.${pattern}`,
    `contact_number_1.ilike.${pattern}`,
    `contact_number_2.ilike.${pattern}`,
    `contact_number_3.ilike.${pattern}`,
    `email.ilike.${pattern}`,
    `make.ilike.${pattern}`
  ].join(",");
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
    assigned_by_profile: firstProfile(tender.assigned_by_profile),
    lead_stage: firstProfile(tender.lead_stage)
  }));
}

function clearTenderAssignment(tender: Tender): Tender {
  return {
    ...tender,
    assigned_profile: firstProfile(tender.assigned_profile),
    assigned_by_profile: firstProfile(tender.assigned_by_profile)
  };
}

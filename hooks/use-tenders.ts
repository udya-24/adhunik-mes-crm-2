"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { resolveTenderPagination, tenderQueryKeys, type TenderQueryParams } from "@/lib/queries/tenders";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Tender } from "@/lib/types";

function logQueryError(queryName: string, error: { message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(queryName, error.message, error.details, error.hint);
}

const tenderSelect =
  "*, uploaded_by_profile:profiles!tenders_uploaded_by_fkey(full_name,email,role), assigned_profile:profiles!tenders_assigned_to_fkey(full_name,email,role), assigned_by_profile:profiles!tenders_assigned_by_fkey(full_name,email,role)";

const defaultTenderQueryParams: TenderQueryParams = {
  viewerId: "",
  viewerRole: "",
  search: "",
  status: "",
  source: "",
  assignment: "",
  assignedTo: "",
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
      const buildQuery = (head = false) => {
        let query = supabase
          .from("tenders")
          .select(head ? "id" : tenderSelect, { count: "exact", head })
          .eq("is_deleted", false)
          .is("deleted_at", null);

        if (currentProfile?.role === "USER") query = query.or(`uploaded_by.eq.${currentProfile.id},assigned_to.eq.${currentProfile.id}`);
        if (queryParams.status) query = query.eq("lead_status", queryParams.status);
        if (queryParams.source) query = query.eq("source_type", queryParams.source);
        if (queryParams.assignment === "assigned") query = query.not("assigned_to", "is", null);
        if (queryParams.assignment === "unassigned") query = query.is("assigned_to", null);
        if (queryParams.assignedTo.startsWith("user:")) query = query.eq("assigned_to", queryParams.assignedTo.replace("user:", ""));
        if (queryParams.assignedTo.startsWith("role:")) {
          const ids = queryParams.assignedTo.split(":")[2]?.split(",").filter(Boolean) ?? [];
          query = ids.length ? query.in("assigned_to", ids) : query.is("assigned_to", null).not("assigned_to", "is", null);
        }
        if (queryParams.search.trim()) query = query.or(buildSearchOr(queryParams.search));
        return query;
      };

      const { count, error: countError } = await buildQuery(true);
      if (countError) {
        logQueryError("useTenders count", countError);
        return { rows: [], total: 0, page: 1, maxPage: 1 };
      }

      const total = count ?? 0;
      const pagination = resolveTenderPagination(total, queryParams.page, queryParams.pageSize);
      if (total === 0) return { rows: [], total, page: 1, maxPage: 1 };

      const { data, error } = await buildQuery()
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);

      if (error) {
        logQueryError("useTenders tenders", error);
        return { rows: [], total, page: pagination.page, maxPage: pagination.maxPage };
      }
      const rows = await enrichLeadContext(supabase, normalizeTenderProfiles((data ?? []) as unknown as Tender[]));
      return { rows, total, page: pagination.page, maxPage: pagination.maxPage };
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

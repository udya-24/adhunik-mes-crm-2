import { unstable_noStore as noStore } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { formatDate, getISTDayBoundsISO } from "@/lib/date-utils";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMetrics, Profile, Tender } from "@/lib/types";

const defaultDashboardMetrics: DashboardMetrics = {
  totalTenders: 0,
  totalTenderValue: 0,
  assignedLeads: 0,
  unassignedLeads: 0,
  wonLeads: 0,
  lostLeads: 0
};

const emptyFollowUpBuckets = {
  today: [],
  overdue: [],
  upcoming: []
};

function logQueryError(queryName: string, error: { message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(queryName, error.message, error.details, error.hint);
}

const tenderSelect =
  "*, uploaded_by_profile:profiles!tenders_uploaded_by_fkey(full_name,email,role), assigned_profile:profiles!tenders_assigned_to_fkey(full_name,email,role), assigned_by_profile:profiles!tenders_assigned_by_fkey(full_name,email,role)";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function getProfileDisplayName(profileId: string | null | undefined) {
  noStore();
  if (!profileId) return "Unknown User";

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("full_name,email").eq("id", profileId).maybeSingle();
  if (error) {
    logQueryError("getProfileDisplayName profile", error);
    return "Unknown User";
  }

  return formatProfileDisplayName(data);
}

export async function getTenderRows({ limit = 50 }: { limit?: number } = {}) {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  let query = supabase.from("tenders").select(tenderSelect).eq("is_deleted", false).order("created_at", { ascending: false });
  if (profile?.role === "USER") query = query.or(`uploaded_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
  const { data, error } = await (limit ? query.limit(limit) : query);

  if (error) {
    logQueryError("getTenderRows tenders", error);
    return [];
  }
  return enrichTendersWithAssignments(supabase, normalizeTenderProfiles((data ?? []) as Tender[]));
}

export async function getDeletedTenderRows() {
  noStore();
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("*, deleted_by_profile:profiles!tenders_deleted_by_fkey(full_name,email), uploaded_by_profile:profiles!tenders_uploaded_by_fkey(full_name,email,role), assigned_profile:profiles!tenders_assigned_to_fkey(full_name,email,role), assigned_by_profile:profiles!tenders_assigned_by_fkey(full_name,email,role)")
    .eq("is_deleted", true)
    .order("deleted_at", { ascending: false });

  if (error) {
    logQueryError("getDeletedTenderRows tenders", error);
    return [];
  }

  return data ?? [];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  noStore();
  try {
    const tenders = await getTenderRows({ limit: 5000 });
    return {
      totalTenders: tenders.length,
      totalTenderValue: tenders.reduce((sum, tender) => sum + Number(tender.awarded_value ?? 0), 0),
      assignedLeads: tenders.filter((tender) => tender.assigned_to).length,
      unassignedLeads: tenders.filter((tender) => !tender.assigned_to).length,
      wonLeads: tenders.filter((tender) => tender.lead_status === "WON").length,
      lostLeads: tenders.filter((tender) => tender.lead_status === "LOST").length
    };
  } catch (error) {
    console.error("getDashboardMetrics", error);
    return defaultDashboardMetrics;
  }
}

export async function getAssignableUsers() {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) return [];

  let query = supabase.from("profiles").select("*").eq("is_active", true).order("full_name");
  if (profile.role === "ADMIN") {
    query = query.in("role", ["MANAGER", "USER"]);
  } else if (profile.role === "MANAGER") {
    query = query.eq("role", "USER").eq("manager_id", profile.id);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) {
    logQueryError("getAssignableUsers profiles", error);
    return [];
  }

  return (data ?? []) as Profile[];
}

export async function getProfiles() {
  noStore();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Profile[];
}

export async function getUploadHistory() {
  noStore();
  const supabase = await createClient();
  const { data } = await supabase.from("upload_history").select("*, uploader:profiles(full_name,email)").order("created_at", { ascending: false }).limit(25);
  return data ?? [];
}

export async function getAssignmentHistory() {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  let query = supabase
    .from("lead_assignments")
    .select("*, tender:tenders!inner(tender_id,bidder_name,ge,cwe,is_deleted), assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email,role), assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email,role)")
    .eq("tender.is_deleted", false)
    .order("assigned_date", { ascending: false })
    .limit(100);

  if (profile?.role === "USER") query = query.eq("assigned_to", profile.id);

  const { data, error } = await query;
  if (error) {
    console.error("[getAssignmentHistory] assignment history error", error);
    return [];
  }
  return data ?? [];
}

export async function getFollowUpBuckets() {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const { start: todayStart, end: todayEnd } = getISTDayBoundsISO();
  let query = supabase
    .from("follow_ups")
    .select("*, tender:tenders!inner(tender_id,bidder_name,ge,cwe,contract_date,is_deleted)")
    .eq("tender.is_deleted", false)
    .order("follow_up_date", { ascending: true })
    .limit(200);

  if (profile?.role === "USER") query = query.eq("user_id", profile.id);

  const { data, error } = await query;
  if (error) {
    logQueryError("getFollowUpBuckets follow_ups", error);
    return emptyFollowUpBuckets;
  }

  const rows = data ?? [];
  return {
    today: rows.filter((row) => row.follow_up_date >= todayStart && row.follow_up_date <= todayEnd),
    overdue: rows.filter((row) => row.follow_up_date < todayStart && row.status !== "WON" && row.status !== "LOST"),
    upcoming: rows.filter((row) => row.follow_up_date > todayEnd)
  };
}

export async function getAnalyticsBreakdowns() {
  const tenders = await getTenderRows({ limit: 5000 });
  const groupByValue = (getName: (tender: Tender) => string | null | undefined) => {
    const map = new Map<string, { name: string; count: number; value: number; won: number; lost: number }>();
    tenders.forEach((tender) => {
      const name = String(getName(tender) || "Unknown");
      const row = map.get(name) ?? { name, count: 0, value: 0, won: 0, lost: 0 };
      row.count += 1;
      row.value += Number(tender.awarded_value ?? 0);
      if (tender.lead_status === "WON") row.won += Number(tender.awarded_value ?? 0);
      if (tender.lead_status === "LOST") row.lost += Number(tender.awarded_value ?? 0);
      map.set(name, row);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  };

  return {
    ge: groupByValue((tender) => tender.ge),
    cwe: groupByValue((tender) => tender.cwe),
    contractDate: groupByValue((tender) => formatDate(tender.contract_date)),
    bidder: groupByValue((tender) => tender.bidder_name),
    user: groupByValue((tender) => (tender.assigned_to ? assignedTenderUserName(tender) : "Unassigned"))
  };
}

function assignedTenderUserName(tender: Tender) {
  return formatProfileDisplayName(tender.assigned_profile);
}

async function enrichTendersWithAssignments(supabase: Awaited<ReturnType<typeof createClient>>, tenders: Tender[]) {
  if (!tenders.length) return tenders;

  const tenderIds = tenders.map((tender) => tender.id);
  const { data, error } = await supabase
    .from("lead_assignments")
    .select("tender_id,assigned_to,assigned_by,assigned_date,assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email,role),assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email,role)")
    .in("tender_id", tenderIds)
    .order("assigned_date", { ascending: false });

  if (error) {
    logQueryError("enrichTendersWithAssignments lead_assignments", error);
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

export async function getContractorIntelligence() {
  const tenders = await getTenderRows({ limit: 5000 });
  const map = new Map<string, { contractor: string; tenderCount: number; awardedValue: number; ge: Record<string, number>; cwe: Record<string, number>; won: number }>();
  tenders.forEach((tender) => {
    const contractor = tender.bidder_name || "Unknown";
    const row = map.get(contractor) ?? { contractor, tenderCount: 0, awardedValue: 0, ge: {}, cwe: {}, won: 0 };
    row.tenderCount += 1;
    row.awardedValue += Number(tender.awarded_value ?? 0);
    row.ge[tender.ge || "Unknown"] = (row.ge[tender.ge || "Unknown"] ?? 0) + 1;
    row.cwe[tender.cwe || "Unknown"] = (row.cwe[tender.cwe || "Unknown"] ?? 0) + 1;
    if (tender.lead_status === "WON") row.won += 1;
    map.set(contractor, row);
  });

  return Array.from(map.values())
    .map((row) => ({
      contractor: row.contractor,
      tenderCount: row.tenderCount,
      awardedValue: row.awardedValue,
      preferredGe: Object.entries(row.ge).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown",
      preferredCwe: Object.entries(row.cwe).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown",
      successHistory: row.won
    }))
    .sort((a, b) => b.awardedValue - a.awardedValue);
}

export async function getProductIntelligence() {
  const brands = ["HPL", "Havells", "ABB", "L&T", "Schneider", "Legrand", "Siemens"];
  const tenders = await getTenderRows({ limit: 5000 });
  return brands
    .map((brand) => {
      const matching = tenders.filter((tender) => tender.make?.toLowerCase().includes(brand.toLowerCase()));
      return {
        brand,
        frequency: matching.length,
        value: matching.reduce((sum, tender) => sum + Number(tender.awarded_value ?? 0), 0)
      };
    })
    .sort((a, b) => b.frequency - a.frequency);
}

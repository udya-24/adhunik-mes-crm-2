import { unstable_noStore as noStore } from "next/cache";
import { endOfDay, formatISO, startOfDay } from "date-fns";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMetrics, Profile, Tender } from "@/lib/types";

export async function getTenderRows({ limit = 50 }: { limit?: number } = {}) {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const query = supabase
    .from("tenders")
    .select("*")
    .order("created_at", { ascending: false });

  const { data, error } = await (limit ? query.limit(limit) : query);

  console.log("[getTenderRows] returned rows count", data?.length ?? 0);
  console.log("[getTenderRows] Supabase error object", error);
  console.log("[getTenderRows] role", profile?.role ?? "UNKNOWN");

  if (error) throw new Error(error.message);
  return (data ?? []) as Tender[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const tenders = await getTenderRows({ limit: 5000 });
  return {
    totalTenders: tenders.length,
    totalTenderValue: tenders.reduce((sum, tender) => sum + Number(tender.awarded_value ?? 0), 0),
    assignedLeads: tenders.filter((tender) => tender.assigned_to).length,
    unassignedLeads: tenders.filter((tender) => !tender.assigned_to).length,
    wonLeads: tenders.filter((tender) => tender.lead_status === "WON").length,
    lostLeads: tenders.filter((tender) => tender.lead_status === "LOST").length
  };
}

export async function getAssignableUsers() {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  let query = supabase.from("profiles").select("*").eq("is_active", true).in("role", ["MANAGER", "USER"]).order("full_name");
  if (profile?.role === "MANAGER") query = query.eq("manager_id", profile.id);
  const { data } = await query;
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
  const { data } = await supabase
    .from("lead_assignments")
    .select("*, tender:tenders(tender_id,bidder_name,ge,cwe), assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email), assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email)")
    .order("assigned_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getFollowUpBuckets() {
  noStore();
  const supabase = await createClient();
  const todayStart = formatISO(startOfDay(new Date()));
  const todayEnd = formatISO(endOfDay(new Date()));
  const { data } = await supabase
    .from("follow_ups")
    .select("*, tender:tenders(tender_id,bidder_name,ge,cwe), user:profiles(full_name,email)")
    .order("follow_up_date", { ascending: true })
    .limit(200);

  const rows = data ?? [];
  return {
    today: rows.filter((row) => row.follow_up_date >= todayStart && row.follow_up_date <= todayEnd),
    overdue: rows.filter((row) => row.follow_up_date < todayStart && row.status !== "WON" && row.status !== "LOST"),
    upcoming: rows.filter((row) => row.follow_up_date > todayEnd)
  };
}

export async function getAnalyticsBreakdowns() {
  const tenders = await getTenderRows({ limit: 5000 });
  const group = (key: keyof Tender) => {
    const map = new Map<string, { name: string; count: number; value: number; won: number; lost: number }>();
    tenders.forEach((tender) => {
      const name = String(tender[key] || "Unknown");
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
    ge: group("ge"),
    cwe: group("cwe"),
    bidder: group("bidder_name"),
    user: group("assigned_to")
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

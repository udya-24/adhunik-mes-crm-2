import { unstable_noStore as noStore } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { formatDate, getISTDayBoundsISO } from "@/lib/date-utils";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { createClient } from "@/lib/supabase/server";
import type { AgeingBucket, AnalyticsBreakdowns, DashboardMetrics, LeadStatusMaster, OperationalSummaryRow, PipelineSummaryRow, Profile, StatusSummaryRow, Tender, UserPerformanceRow } from "@/lib/types";

const defaultDashboardMetrics: DashboardMetrics = {
  totalTenders: 0,
  totalTenderValue: 0,
  totalOurValue: 0,
  assignedLeads: 0,
  unassignedLeads: 0,
  assignedOurValue: 0,
  unassignedOurValue: 0,
  myOurValue: 0,
  showMyOurValue: false,
  wonLeads: 0,
  lostLeads: 0,
  quotationSentValue: 0,
  negotiationValue: 0,
  piPendingValue: 0,
  orderReceivedValue: 0,
  lostLeadValue: 0
};

export const defaultLeadStatuses: LeadStatusMaster[] = [
  "New Lead",
  "First Contact",
  "Contacted",
  "Requirement Received",
  "BOQ Requested",
  "BOQ Received",
  "Quotation Sent",
  "Technical Discussion",
  "Price Negotiation",
  "Sample Submitted",
  "PI Sent",
  "PI Waiting Approval",
  "Order Expected",
  "Order Received",
  "Lost To Competitor",
  "No Requirement",
  "Not Reachable",
  "Follow Up Required",
  "On Hold",
  "Closed"
].map((status_name, index) => ({
  id: `fallback-${index + 1}`,
  status_name,
  sort_order: index + 1,
  status_color: index === 13 ? "#15803d" : index === 14 ? "#dc2626" : index === 6 ? "#f97316" : "#173b71",
  is_active: true,
  created_at: ""
}));

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

  let query = supabase.from("tenders").select(tenderSelect).eq("is_deleted", false).is("deleted_at", null).order("created_at", { ascending: false });
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
    const [profile, tenders, operationalSummary, pipelineSummary] = await Promise.all([
      getCurrentProfile(),
      getAnalyticsTenderRows(),
      getOperationalSummaryRows(),
      getPipelineSummaryRows()
    ]);
    return {
      totalTenders: operationalCount(operationalSummary, "ASSIGNED") + operationalCount(operationalSummary, "OPEN_POOL"),
      totalTenderValue: tenders.reduce((sum, tender) => sum + Number(tender.awarded_value ?? 0), 0),
      totalOurValue: sumOurValue(tenders),
      assignedLeads: operationalCount(operationalSummary, "ASSIGNED"),
      unassignedLeads: operationalCount(operationalSummary, "OPEN_POOL"),
      assignedOurValue: sumOurValue(tenders.filter((tender) => tender.assigned_to)),
      unassignedOurValue: sumOurValue(tenders.filter((tender) => !tender.assigned_to)),
      myOurValue: profile?.role === "USER" ? sumOurValue(tenders.filter((tender) => tender.assigned_to === profile.id || tender.uploaded_by === profile.id)) : 0,
      showMyOurValue: profile?.role === "USER",
      wonLeads: pipelineCount(pipelineSummary, "WON"),
      lostLeads: pipelineCount(pipelineSummary, "LOST"),
      quotationSentValue: sumOurValue(tenders.filter((tender) => tender.lead_status === "QUOTATION_SENT")),
      negotiationValue: sumOurValue(tenders.filter((tender) => tender.lead_status === "NEGOTIATION")),
      piPendingValue: sumOurValue(tenders.filter((tender) => leadStageName(tender) === "PI Waiting Approval")),
      orderReceivedValue: sumOurValue(tenders.filter((tender) => tender.lead_status === "WON")),
      lostLeadValue: sumOurValue(tenders.filter((tender) => tender.lead_status === "LOST"))
    };
  } catch (error) {
    console.error("getDashboardMetrics", error);
    return defaultDashboardMetrics;
  }
}

export async function getOperationalSummaryRows(): Promise<OperationalSummaryRow[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase.from("vw_operational_summary").select("*");
  if (error) {
    logQueryError("getOperationalSummaryRows vw_operational_summary", error);
    return getOperationalSummaryRowsFromTenders();
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    status: row.status === "ASSIGNED" ? "ASSIGNED" : "OPEN_POOL",
    count: Number(row.count ?? 0)
  }));
}

async function getOperationalSummaryRowsFromTenders(): Promise<OperationalSummaryRow[]> {
  const tenders = await getAnalyticsTenderRows();
  return [
    { status: "ASSIGNED", count: tenders.filter((tender) => tender.assigned_to).length },
    { status: "OPEN_POOL", count: tenders.filter((tender) => !tender.assigned_to).length }
  ];
}

export async function getPipelineSummaryRows(): Promise<PipelineSummaryRow[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase.from("vw_pipeline_summary").select("*");
  if (error) {
    logQueryError("getPipelineSummaryRows vw_pipeline_summary", error);
    return getPipelineSummaryRowsFromTenders();
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    stage: normalizeLeadStatus(row.stage),
    count: Number(row.count ?? 0)
  }));
}

async function getPipelineSummaryRowsFromTenders(): Promise<PipelineSummaryRow[]> {
  const tenders = await getAnalyticsTenderRows();
  const counts = new Map<Tender["lead_status"], number>();
  tenders.forEach((tender) => {
    const stage = tender.lead_status ?? "NEW";
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([stage, count]) => ({ stage, count }));
}

export async function getStatusSummaryRows(): Promise<StatusSummaryRow[]> {
  const [tenders, statuses] = await Promise.all([getAnalyticsTenderRows(), getLeadStatuses()]);
  const statusByName = new Map(statuses.map((status) => [status.status_name, status]));
  const rowsByName = new Map<string, StatusSummaryRow>();

  tenders.forEach((tender) => {
    const statusName = leadStageName(tender);
    const status = statusByName.get(statusName);
    const row = rowsByName.get(statusName) ?? {
      status_id: status?.id ?? null,
      status_name: statusName,
      status_color: status?.status_color ?? null,
      sort_order: status?.sort_order ?? null,
      tender_count: 0,
      our_value: 0,
      awarded_value: 0
    };

    row.tender_count += 1;
    row.our_value += Number(tender.our_value ?? 0);
    row.awarded_value += Number(tender.awarded_value ?? 0);
    rowsByName.set(statusName, row);
  });

  return Array.from(rowsByName.values()).sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
}

export async function getLeadStatuses({ activeOnly = false }: { activeOnly?: boolean } = {}) {
  noStore();
  const supabase = await createClient();
  const buildQuery = () => {
    let query = supabase.from("lead_status_master").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    return query;
  };
  const { data, error } = await orderBySortOrderWithFallback(buildQuery);
  if (error) {
    logQueryError("getLeadStatuses lead_status_master", error);
    return activeOnly ? defaultLeadStatuses.filter((status) => status.is_active) : defaultLeadStatuses;
  }
  const statuses = ((data ?? []) as LeadStatusMaster[]).map((status) => ({
    ...status,
    sort_order: Number(status.sort_order ?? status.status_order ?? 0)
  }));
  return statuses.length ? statuses : defaultLeadStatuses;
}

async function orderBySortOrderWithFallback(
  buildQuery: () => { order: (column: string, options: { ascending: boolean }) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message?: string; details?: string | null; hint?: string | null } | null }> }
) {
  const result = await buildQuery().order("sort_order", { ascending: true });
  if (!result.error || !isMissingColumnError(result.error, "sort_order")) return result;
  return buildQuery().order("status_order", { ascending: true });
}

function isMissingColumnError(error: { message?: string; details?: string | null; hint?: string | null }, column: string) {
  return [error.message, error.details, error.hint].filter(Boolean).some((value) => String(value).includes(column));
}

export async function getAssignableUsers() {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) return [];

  let query = supabase.from("profiles").select("*").eq("is_active", true).order("role").order("full_name");
  if (profile.role === "MANAGER") {
    query = query.or(`and(role.eq.USER,manager_id.eq.${profile.id}),id.eq.${profile.id}`);
  } else if (profile.role !== "ADMIN") {
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
    .select("*, tender:tenders!inner(tender_id,bidder_name,ge,cwe,is_deleted,deleted_at), assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email,role), assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email,role)")
    .eq("tender.is_deleted", false)
    .is("tender.deleted_at", null)
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
    .select("*, tender:tenders!inner(tender_id,bidder_name,ge,cwe,contract_date,is_deleted,deleted_at)")
    .eq("tender.is_deleted", false)
    .is("tender.deleted_at", null)
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
  const [tenders, statusSummary, pipelineSummary] = await Promise.all([getAnalyticsTenderRows(), getStatusSummaryRows(), getPipelineSummaryRows()]);
  const groupByValue = (getName: (tender: Tender) => string | null | undefined, { skipEmpty = false }: { skipEmpty?: boolean } = {}) => {
    const map = new Map<string, { name: string; count: number; value: number; ourValue: number; won: number; lost: number }>();
    tenders.forEach((tender) => {
      const rawName = getName(tender);
      if (skipEmpty && !rawName) return;
      const name = String(rawName || "Unknown");
      const row = map.get(name) ?? { name, count: 0, value: 0, ourValue: 0, won: 0, lost: 0 };
      row.count += 1;
      row.value += Number(tender.awarded_value ?? 0);
      row.ourValue += Number(tender.our_value ?? 0);
      if (leadStageName(tender) === "Order Received") row.won += Number(tender.awarded_value ?? 0);
      if (leadStageName(tender) === "Lost To Competitor") row.lost += Number(tender.awarded_value ?? 0);
      map.set(name, row);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  };

  return {
    ge: groupByValue((tender) => tender.ge),
    cwe: groupByValue((tender) => tender.cwe),
    contractDate: groupByValue((tender) => formatDate(tender.contract_date)),
    bidder: groupByValue((tender) => tender.bidder_name),
    user: groupByValue((tender) => (tender.assigned_to ? assignedTenderUserName(tender) : "Unassigned")),
    ourValueByUser: groupByValue((tender) => (tender.assigned_to ? assignedTenderUserName(tender) : "Unassigned")),
    ourValueByGE: groupByValue((tender) => tender.ge),
    ourValueByContractor: groupByValue((tender) => tender.bidder_name),
    monthlyOurValueTrend: getMonthlyOurValueTrend(tenders),
    ageing: getAgeingBuckets(tenders),
    leadStageDistribution: statusSummaryToBreakdown(statusSummary),
    lostLeadsByReason: groupByValue((tender) => (leadStageName(tender) === "Lost To Competitor" ? "Unknown" : null), { skipEmpty: true }),
    competitorAnalysis: groupByValue((tender) => (leadStageName(tender) === "Lost To Competitor" ? "Unknown" : null), { skipEmpty: true }),
    userWiseConversion: groupByValue((tender) => (leadStageName(tender) === "Order Received" ? assignedTenderUserName(tender) : null), { skipEmpty: true }),
    managerWiseConversion: groupByValue((tender) => (leadStageName(tender) === "Order Received" ? tender.assigned_profile?.role ?? "Unknown" : null), { skipEmpty: true }),
    salesFunnel: getSalesFunnel(pipelineSummary, tenders)
  } satisfies AnalyticsBreakdowns;
}

export async function getUserPerformanceRows(): Promise<UserPerformanceRow[]> {
  noStore();
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "USER") return [];

  let usersQuery = supabase.from("profiles").select("*").eq("is_active", true).in("role", ["MANAGER", "USER"]).order("full_name");
  if (profile.role === "MANAGER") usersQuery = usersQuery.eq("manager_id", profile.id).eq("role", "USER");

  const [{ data: users, error: usersError }, tenders, { data: followUps, error: followUpsError }] = await Promise.all([
    usersQuery,
    getAnalyticsTenderRows(),
    supabase.from("follow_ups").select("user_id")
  ]);

  if (usersError) {
    logQueryError("getUserPerformanceRows profiles", usersError);
    return [];
  }
  if (followUpsError) logQueryError("getUserPerformanceRows follow_ups", followUpsError);

  const userRows = (users ?? []) as Profile[];
  const followUpsByUser = new Map<string, number>();
  (followUps ?? []).forEach((followUp) => {
    followUpsByUser.set(followUp.user_id, (followUpsByUser.get(followUp.user_id) ?? 0) + 1);
  });

  return userRows.map((user) => {
    const assigned = tenders.filter((tender) => tender.assigned_to === user.id);
    return {
      userId: user.id,
      userName: formatProfileDisplayName(user),
      role: user.role,
      assignedTenders: assigned.length,
      uploadedTenders: tenders.filter((tender) => tender.uploaded_by === user.id).length,
      followUps: followUpsByUser.get(user.id) ?? 0,
      assignedOurValue: sumOurValue(assigned),
      convertedTenders: assigned.filter((tender) => leadStageName(tender) === "Order Received").length
    };
  });
}

async function getAnalyticsTenderRows() {
  const [profile, tenders] = await Promise.all([getCurrentProfile(), getTenderRows({ limit: 5000 })]);
  if (!profile) return [];
  if (profile.role === "USER") return tenders;
  if (profile.role !== "MANAGER") return tenders;

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("manager_id", profile.id).eq("is_active", true);
  if (error) {
    logQueryError("getAnalyticsTenderRows team profiles", error);
    return tenders;
  }

  const teamIds = new Set([profile.id, ...(data ?? []).map((user) => user.id)]);
  return tenders.filter((tender) => (tender.assigned_to && teamIds.has(tender.assigned_to)) || (tender.uploaded_by && teamIds.has(tender.uploaded_by)));
}

function sumOurValue(tenders: Tender[]) {
  return tenders.reduce((sum, tender) => sum + Number(tender.our_value ?? 0), 0);
}

function operationalCount(rows: OperationalSummaryRow[], status: OperationalSummaryRow["status"]) {
  return rows.find((row) => row.status === status)?.count ?? 0;
}

function pipelineCount(rows: PipelineSummaryRow[], stage: Tender["lead_status"]) {
  return rows.find((row) => row.stage === stage)?.count ?? 0;
}

function leadStageName(tender: Tender) {
  return tender.lead_stage?.status_name || leadStatusNameFromEnum(tender.lead_status);
}

function leadStatusNameFromEnum(status: Tender["lead_status"] | null | undefined) {
  const labels: Record<NonNullable<Tender["lead_status"]>, string> = {
    NEW: "New Lead",
    ASSIGNED: "New Lead",
    CONTACTED: "Contacted",
    FOLLOW_UP: "Follow Up Required",
    QUOTATION_SENT: "Quotation Sent",
    NEGOTIATION: "Price Negotiation",
    WON: "Order Received",
    LOST: "Lost To Competitor"
  };
  return status ? labels[status] : "No Status";
}

function normalizeLeadStatus(value: unknown): Tender["lead_status"] {
  const status = String(value ?? "NEW") as Tender["lead_status"];
  return ["NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"].includes(status) ? status : "NEW";
}

function getSalesFunnel(pipelineSummary: PipelineSummaryRow[], tenders: Tender[]) {
  const stages: Tender["lead_status"][] = ["NEW", "CONTACTED", "QUOTATION_SENT", "NEGOTIATION", "FOLLOW_UP", "WON"];
  return stages.map((stage) => {
    const matchingTenders = tenders.filter((tender) => tender.lead_status === stage);
    return {
      name: leadStatusNameFromEnum(stage),
      count: pipelineCount(pipelineSummary, stage),
      value: matchingTenders.reduce((sum, tender) => sum + Number(tender.awarded_value ?? 0), 0),
      ourValue: sumOurValue(matchingTenders),
      won: stage === "WON" ? sumOurValue(matchingTenders) : 0,
      lost: 0
    };
  });
}

function statusSummaryToBreakdown(rows: StatusSummaryRow[]) {
  return rows.map((row) => ({
    name: row.status_name,
    count: row.tender_count,
    value: row.awarded_value,
    ourValue: row.our_value,
    won: row.status_name === "Order Received" ? row.our_value : 0,
    lost: row.status_name === "Lost To Competitor" ? row.our_value : 0
  }));
}

function getAgeingBuckets(tenders: Tender[]): AgeingBucket[] {
  const buckets = [
    { name: "0-7 Days", min: 0, max: 7, count: 0, ourValue: 0, awardedValue: 0 },
    { name: "8-30 Days", min: 8, max: 30, count: 0, ourValue: 0, awardedValue: 0 },
    { name: "31-90 Days", min: 31, max: 90, count: 0, ourValue: 0, awardedValue: 0 },
    { name: "90+ Days", min: 91, max: Number.POSITIVE_INFINITY, count: 0, ourValue: 0, awardedValue: 0 }
  ];
  const today = new Date();
  tenders.forEach((tender) => {
    const createdAt = tender.created_at ? new Date(tender.created_at) : today;
    const ageDays = Math.max(0, Math.floor((today.getTime() - createdAt.getTime()) / 86400000));
    const bucket = buckets.find((item) => ageDays >= item.min && ageDays <= item.max) ?? buckets[buckets.length - 1];
    bucket.count += 1;
    bucket.ourValue += Number(tender.our_value ?? 0);
    bucket.awardedValue += Number(tender.awarded_value ?? 0);
  });
  return buckets.map(({ min, max, ...bucket }) => bucket);
}

function getMonthlyOurValueTrend(tenders: Tender[]) {
  const map = new Map<string, { name: string; count: number; value: number; ourValue: number }>();
  tenders.forEach((tender) => {
    const date = tender.contract_date || tender.created_at;
    const month = date ? new Date(date) : new Date();
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const row = map.get(key) ?? { name: key, count: 0, value: 0, ourValue: 0 };
    row.count += 1;
    row.value += Number(tender.awarded_value ?? 0);
    row.ourValue += Number(tender.our_value ?? 0);
    map.set(key, row);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)).slice(-12);
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
    if (leadStageName(tender) === "Order Received") row.won += 1;
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

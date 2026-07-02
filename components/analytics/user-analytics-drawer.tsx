"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, Eye, Loader2, Send, X } from "lucide-react";
import { DateTime } from "@/components/common/date-time";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date-utils";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Role, Tender } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type AnalyticsUser = Pick<Profile, "id" | "full_name" | "email" | "role"> & Partial<Pick<Profile, "manager_id" | "is_active" | "created_at">>;

type AnalyticsMetric = {
  label: string;
  value: string | number;
};

type DistributionRow = {
  name: string;
  count: number;
  percentage: number;
};

type RecentActivityRow = {
  label: string;
  detail: string;
  date: string | null;
};

type UserAnalytics = {
  profile: Profile;
  manager: Pick<Profile, "full_name" | "email" | "role"> | null;
  myKpis: AnalyticsMetric[];
  headlineKpis: AnalyticsMetric[];
  tenderStats: AnalyticsMetric[];
  salesStats: AnalyticsMetric[];
  quotationStats: AnalyticsMetric[];
  piStats: AnalyticsMetric[];
  followUpStats: AnalyticsMetric[];
  pipeline: DistributionRow[];
  categories: {
    handled: DistributionRow[];
    ge: DistributionRow[];
    cwe: DistributionRow[];
    contractors: DistributionRow[];
    organisations: DistributionRow[];
  };
  recentActivity: RecentActivityRow[];
  kpis: AnalyticsMetric[];
};

const emptyUserAnalytics: UserAnalytics | null = null;

export function UserAnalyticsDrawer({
  user,
  canOpen,
  currentUserId,
  currentUserRole,
  onViewAssignedTenders,
  onAssignMoreTenders,
  onClose
}: {
  user: AnalyticsUser | null;
  canOpen: boolean;
  currentUserId: string | null;
  currentUserRole: Role | null;
  onViewAssignedTenders?: (userId: string) => void;
  onAssignMoreTenders?: (userId: string) => void;
  onClose: () => void;
}) {
  const { data: analytics = emptyUserAnalytics, isLoading, error } = useUserAnalytics(user, currentUserId, currentUserRole, canOpen);
  const canView = Boolean(user && (currentUserRole === "ADMIN" || currentUserRole === "MANAGER" || user.id === currentUserId));

  async function exportReport() {
    if (!analytics) return;
    const rows = [
      ["User", formatProfileDisplayName(analytics.profile)],
      ["Role", analytics.profile.role],
      ["Email", analytics.profile.email],
      ...analytics.tenderStats.map((item) => [item.label, item.value]),
      ...analytics.salesStats.map((item) => [item.label, item.value]),
      ...analytics.quotationStats.map((item) => [item.label, item.value]),
      ...analytics.piStats.map((item) => [item.label, item.value]),
      ...analytics.followUpStats.map((item) => [item.label, item.value]),
      ...analytics.kpis.map((item) => [item.label, item.value])
    ];
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${formatProfileDisplayName(analytics.profile)} Performance Report`, 14, 18);
    doc.setFontSize(10);
    rows.forEach(([label, value], index) => {
      const y = 30 + (index % 36) * 7;
      if (index > 0 && index % 36 === 0) doc.addPage();
      doc.text(`${label}: ${value}`, 14, y);
    });
    doc.save(`${safeFileToken(formatProfileDisplayName(analytics.profile))}-performance.pdf`);
  }

  return (
    <div className={`fixed inset-0 z-50 ${canOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!canOpen}>
      <div className={`absolute inset-0 bg-slate-950/30 transition-opacity ${canOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 h-full w-full overflow-y-auto bg-white shadow-lift transition-transform duration-300 md:left-auto md:w-[80vw] md:max-w-[650px] md:border-l md:border-border ${
          canOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {user && (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-border bg-white/95 px-4 pb-4 pt-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">User Analytics</p>
                  <h2 className="mt-1 truncate text-xl font-bold text-navy-900 sm:text-2xl">{formatProfileDisplayName(user)}</h2>
                  <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                </div>
                <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={onClose} aria-label="Close analytics drawer">
                  <X size={18} />
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {onViewAssignedTenders && (
                  <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => onViewAssignedTenders(user.id)}>
                    <Eye size={15} />
                    View Assigned Tenders
                  </Button>
                )}
                {onAssignMoreTenders && (
                  <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => onAssignMoreTenders(user.id)}>
                    <Send size={15} />
                    Assign More Tenders
                  </Button>
                )}
                <Button variant="secondary" className="h-9 px-3 text-xs" disabled={!analytics} onClick={exportReport}>
                  <Download size={15} />
                  Export Performance Report
                </Button>
              </div>
            </div>

            {!canView && <EmptyDrawerState>You can only view your own analytics.</EmptyDrawerState>}
            {canView && isLoading && <LoadingSkeleton rows={6} />}
            {canView && error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error instanceof Error ? error.message : "Analytics could not be loaded."}</div>}
            {canView && analytics && <UserAnalyticsSections analytics={analytics} />}
          </div>
        )}
      </aside>
    </div>
  );
}

export function UserAnalyticsPanel({
  user,
  currentUserId,
  currentUserRole,
  title = "My Performance"
}: {
  user: AnalyticsUser;
  currentUserId: string | null;
  currentUserRole: Role | null;
  title?: string;
}) {
  const { data: analytics = emptyUserAnalytics, isLoading, error } = useUserAnalytics(user, currentUserId, currentUserRole, true);
  const canView = currentUserRole === "ADMIN" || currentUserRole === "MANAGER" || user.id === currentUserId;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Analytics</p>
        <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">{title}</h2>
      </div>
      {!canView && <EmptyDrawerState>You can only view your own analytics.</EmptyDrawerState>}
      {canView && isLoading && <LoadingSkeleton rows={6} />}
      {canView && error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error instanceof Error ? error.message : "Analytics could not be loaded."}</div>}
      {canView && analytics && <MyPerformanceSections analytics={analytics} />}
    </div>
  );
}

function UserAnalyticsSections({ analytics }: { analytics: UserAnalytics }) {
  return (
    <>
      <Section title="Profile">
        <InfoGrid
          rows={[
            ["Name", formatProfileDisplayName(analytics.profile)],
            ["Role", analytics.profile.role],
            ["Email", analytics.profile.email],
            ["Manager", analytics.manager ? formatProfileDisplayName(analytics.manager) : analytics.profile.role === "USER" ? "Not assigned" : "-"],
            ["Account Status", analytics.profile.is_active ? "Active" : "Inactive"],
            ["Joined Date", formatDate(analytics.profile.created_at)]
          ]}
        />
      </Section>

      <Section title="Performance Overview">
        <MetricGrid metrics={analytics.headlineKpis} columns="sm:grid-cols-3" />
      </Section>

      <Section title="Tender Analytics">
        <MetricGrid metrics={analytics.tenderStats} />
      </Section>

      <Section title="Business Analytics">
        <MetricGrid metrics={analytics.salesStats} />
      </Section>

      <Section title="Lead Pipeline">
        <DistributionList rows={analytics.pipeline} />
      </Section>

      <Section title="Quotation Analytics">
        <MetricGrid metrics={analytics.quotationStats} />
      </Section>

      <Section title="PI Analytics">
        <MetricGrid metrics={analytics.piStats} />
      </Section>

      <Section title="Follow-up Analytics">
        <MetricGrid metrics={analytics.followUpStats} />
      </Section>

      <Section title="Recent Activity">
        <RecentActivityList rows={analytics.recentActivity} />
      </Section>

      <Section title="Rankings">
        <div className="grid gap-4 sm:grid-cols-2">
          <MiniRanking title="Top Categories" rows={analytics.categories.handled} />
          <MiniRanking title="Top GE" rows={analytics.categories.ge} />
          <MiniRanking title="Top CWE" rows={analytics.categories.cwe} />
          <MiniRanking title="Top Organisations" rows={analytics.categories.organisations} />
          <MiniRanking title="Top Contractors" rows={analytics.categories.contractors} />
        </div>
      </Section>
    </>
  );
}

function MyPerformanceSections({ analytics }: { analytics: UserAnalytics }) {
  return (
    <>
      <Section title="My KPI Cards">
        <MetricGrid metrics={analytics.myKpis} columns="sm:grid-cols-2 xl:grid-cols-4" />
      </Section>

      <Section title="Pipeline">
        <DistributionList rows={analytics.pipeline} />
      </Section>

      <Section title="My Top Categories">
        <MiniRanking title="Top Categories" rows={analytics.categories.handled} />
      </Section>

      <Section title="My Top GE">
        <MiniRanking title="Top GE" rows={analytics.categories.ge} />
      </Section>

      <Section title="My Top Organisations">
        <MiniRanking title="Top Organisations" rows={analytics.categories.organisations} />
      </Section>

      <Section title="My Top Contractors">
        <MiniRanking title="Top Contractors" rows={analytics.categories.contractors} />
      </Section>

      <Section title="Recent Activities">
        <RecentActivityList rows={analytics.recentActivity} />
      </Section>
    </>
  );
}

function useUserAnalytics(user: AnalyticsUser | null, currentUserId: string | null, currentUserRole: Role | null, enabled: boolean) {
  return useQuery({
    queryKey: ["user-performance-analytics", user?.id, currentUserId, currentUserRole],
    enabled: enabled && Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Choose a user to view analytics.");
      if (currentUserRole === "USER" && user.id !== currentUserId) throw new Error("You can only view your own analytics.");

      const supabase = createClient();
      const [profileResult, tendersResult, followUpsResult, activitiesResult, quotationResult, piResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("tenders")
          .select("id,tender_id,organisation_chain,ge,cwe,bidder_name,make,awarded_value,our_value,lead_status,contract_date,created_at,updated_at,assigned_to,uploaded_by")
          .eq("is_deleted", false)
          .is("deleted_at", null)
          .or(`assigned_to.eq.${user.id},uploaded_by.eq.${user.id}`)
          .limit(5000),
        supabase.from("follow_ups").select("id,tender_id,user_id,follow_up_date,remarks,status,created_at").eq("user_id", user.id).limit(5000),
        supabase.from("lead_activities").select("id,tender_id,user_id,activity_type,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5000),
        supabase.from("quotations").select("quotation_no,status,created_at,quotation_date").eq("created_by", user.id).order("created_at", { ascending: false }).limit(5000),
        supabase.from("proforma_invoices").select("pi_no,status,created_at,pi_date").eq("created_by", user.id).order("created_at", { ascending: false }).limit(5000)
      ]);

      if (profileResult.error) throw new Error(profileResult.error.message);
      if (tendersResult.error) throw new Error(tendersResult.error.message);
      if (followUpsResult.error) throw new Error(followUpsResult.error.message);
      if (activitiesResult.error) throw new Error(activitiesResult.error.message);
      if (quotationResult.error) console.error("[UserAnalytics] quotation lookup error", quotationResult.error.message, quotationResult.error);
      if (piResult.error) console.error("[UserAnalytics] PI lookup error", piResult.error.message, piResult.error);

      const profile = (profileResult.data ?? user) as Profile;
      const managerResult = currentUserRole !== "USER" && profile.manager_id
        ? await supabase.from("profiles").select("full_name,email,role").eq("id", profile.manager_id).maybeSingle()
        : { data: null, error: null };
      if (managerResult.error) console.error("[UserAnalytics] manager lookup error", managerResult.error.message, managerResult.error);

      return buildUserAnalytics({
        profile,
        manager: (managerResult.data ?? null) as Pick<Profile, "full_name" | "email" | "role"> | null,
        tenders: (tendersResult.data ?? []) as Pick<Tender, "id" | "tender_id" | "organisation_chain" | "ge" | "cwe" | "bidder_name" | "make" | "awarded_value" | "our_value" | "lead_status" | "contract_date" | "created_at" | "updated_at" | "assigned_to" | "uploaded_by">[],
        followUps: followUpsResult.data ?? [],
        activities: activitiesResult.data ?? [],
        quotations: quotationResult.data ?? [],
        proformaInvoices: piResult.data ?? []
      });
    }
  });
}

function buildUserAnalytics({
  profile,
  manager,
  tenders,
  followUps,
  activities,
  quotations,
  proformaInvoices
}: {
  profile: Profile;
  manager: Pick<Profile, "full_name" | "email" | "role"> | null;
  tenders: Pick<Tender, "id" | "tender_id" | "organisation_chain" | "ge" | "cwe" | "bidder_name" | "make" | "awarded_value" | "our_value" | "lead_status" | "contract_date" | "created_at" | "updated_at" | "assigned_to" | "uploaded_by">[];
  followUps: { tender_id: string; follow_up_date: string; status: string; created_at: string }[];
  activities: { tender_id: string; activity_type: string; created_at: string }[];
  quotations: { quotation_no?: string | null; status?: string | null; created_at?: string | null; quotation_date?: string | null }[];
  proformaInvoices: { pi_no?: string | null; status?: string | null; created_at?: string | null; pi_date?: string | null }[];
}): UserAnalytics {
  const today = new Date();
  const assignedTenders = tenders.filter((tender) => tender.assigned_to === profile.id);
  const uploadedTenders = tenders.filter((tender) => tender.uploaded_by === profile.id);
  const won = assignedTenders.filter((tender) => tender.lead_status === "WON");
  const lost = assignedTenders.filter((tender) => tender.lead_status === "LOST");
  const active = assignedTenders.filter((tender) => !["WON", "LOST"].includes(tender.lead_status));
  const pending = assignedTenders.filter((tender) => ["NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "QUOTATION_SENT", "NEGOTIATION"].includes(tender.lead_status));
  const newLeads = assignedTenders.filter((tender) => tender.lead_status === "NEW" || tender.lead_status === "ASSIGNED");
  const completedFollowUps = followUps.filter((followUp) => ["COMPLETED", "WON", "LOST"].includes(String(followUp.status).toUpperCase()));
  const pendingFollowUps = followUps.filter((followUp) => !["COMPLETED", "WON", "LOST"].includes(String(followUp.status).toUpperCase()));
  const overdue = followUps.filter((followUp) => new Date(followUp.follow_up_date) < startOfLocalDay(today) && !["WON", "LOST", "COMPLETED"].includes(String(followUp.status).toUpperCase()));
  const awardedValues = assignedTenders.map((tender) => Number(tender.awarded_value ?? 0)).filter((value) => value > 0);
  const ourValues = assignedTenders.map((tender) => Number(tender.our_value ?? 0)).filter((value) => value > 0);
  const totalAwarded = awardedValues.reduce((sum, value) => sum + value, 0);
  const totalOur = ourValues.reduce((sum, value) => sum + value, 0);
  const pipeline = buildStageDistribution(assignedTenders);
  const latestQuotation = latestByDate(quotations, "created_at");
  const latestPi = latestByDate(proformaInvoices, "created_at");
  const recentActivity = buildRecentActivity({ tenders, followUps, activities, quotations, proformaInvoices });

  return {
    profile,
    manager,
    myKpis: [
      { label: "Assigned Tenders", value: assignedTenders.length },
      { label: "Uploaded Tenders", value: uploadedTenders.length },
      { label: "Active Tenders", value: active.length },
      { label: "Won", value: won.length },
      { label: "Lost", value: lost.length },
      { label: "Pending", value: pending.length },
      { label: "Follow-ups Pending", value: pendingFollowUps.length },
      { label: "Follow-ups Completed", value: completedFollowUps.length },
      { label: "Total Quotations", value: quotations.length },
      { label: "Total PI", value: proformaInvoices.length },
      { label: "Total Awarded Value", value: formatCurrency(totalAwarded) },
      { label: "Total Our Value", value: formatCurrency(totalOur) }
    ],
    headlineKpis: [
      { label: "Conversion Rate", value: formatPercent(assignedTenders.length ? (won.length / assignedTenders.length) * 100 : 0) },
      { label: "Won Tenders", value: won.length },
      { label: "Pending Tenders", value: pending.length },
      { label: "Total Our Value", value: formatCurrency(totalOur) },
      { label: "Total Quotations", value: quotations.length },
      { label: "Total PI", value: proformaInvoices.length }
    ],
    tenderStats: [
      { label: "Total Assigned Tenders", value: assignedTenders.length },
      { label: "Uploaded Tenders", value: uploadedTenders.length },
      { label: "Active Tenders", value: active.length },
      { label: "Won", value: won.length },
      { label: "Lost", value: lost.length },
      { label: "Pending", value: pending.length },
      { label: "New Leads", value: newLeads.length }
    ],
    salesStats: [
      { label: "Total Awarded Value", value: formatCurrency(totalAwarded) },
      { label: "Total Our Value", value: formatCurrency(totalOur) },
      { label: "Average Tender Value", value: formatCurrency(average(awardedValues)) },
      { label: "Highest Tender Value", value: formatCurrency(Math.max(0, ...awardedValues)) },
      { label: "Lowest Tender Value", value: formatCurrency(awardedValues.length ? Math.min(...awardedValues) : 0) }
    ],
    quotationStats: [
      { label: "Total Quotations", value: quotations.length },
      { label: "Draft", value: quotations.filter((quotation) => quotation.status === "DRAFT").length },
      { label: "Final", value: quotations.filter((quotation) => quotation.status && quotation.status !== "DRAFT").length },
      { label: "Latest Quotation", value: latestQuotation?.created_at ? formatDate(latestQuotation.created_at) : "No quotations" }
    ],
    piStats: [
      { label: "Total PI", value: proformaInvoices.length },
      { label: "Draft", value: proformaInvoices.filter((invoice) => invoice.status === "DRAFT").length },
      { label: "Final", value: proformaInvoices.filter((invoice) => invoice.status && invoice.status !== "DRAFT").length },
      { label: "Latest PI", value: latestPi?.created_at ? formatDate(latestPi.created_at) : "No PI" }
    ],
    followUpStats: [
      { label: "Pending", value: pendingFollowUps.length },
      { label: "Completed", value: completedFollowUps.length },
      { label: "Overdue", value: overdue.length }
    ],
    pipeline,
    categories: {
      handled: topDistribution(assignedTenders.map((tender) => tender.make)),
      ge: topDistribution(assignedTenders.map((tender) => tender.ge)),
      cwe: topDistribution(assignedTenders.map((tender) => tender.cwe)),
      contractors: topDistribution(assignedTenders.map((tender) => tender.bidder_name)),
      organisations: topDistribution(assignedTenders.map((tender) => tender.organisation_chain))
    },
    recentActivity,
    kpis: [
      { label: "Conversion Rate", value: formatPercent(assignedTenders.length ? (won.length / assignedTenders.length) * 100 : 0) },
      { label: "Pending %", value: formatPercent(assignedTenders.length ? (pending.length / assignedTenders.length) * 100 : 0) },
      { label: "Won %", value: formatPercent(assignedTenders.length ? (won.length / assignedTenders.length) * 100 : 0) },
      { label: "Lost %", value: formatPercent(assignedTenders.length ? (lost.length / assignedTenders.length) * 100 : 0) },
      { label: "Average Tender Value", value: formatCurrency(average(awardedValues)) },
      { label: "Average Our Value", value: formatCurrency(average(ourValues)) }
    ]
  };
}

function MetricGrid({ metrics, columns = "sm:grid-cols-2" }: { metrics: AnalyticsMetric[]; columns?: string }) {
  return (
    <div className={`grid gap-3 ${columns}`}>
      {metrics.map((metric) => (
        <MetricTile key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </div>
  );
}

function RecentActivityList({ rows }: { rows: RecentActivityRow[] }) {
  if (!rows.length) return <EmptyDrawerState>No recent activity available</EmptyDrawerState>;
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <TimelineItem
          key={`${row.label}-${row.date}-${index}`}
          icon={<CheckCircle2 size={15} />}
          title={row.label}
          detail={
            <>
              {row.detail} - <DateTime value={row.date} />
            </>
          }
        />
      ))}
    </div>
  );
}

function DistributionList({ rows }: { rows: DistributionRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-800">{row.name}</span>
            <span className="text-xs font-bold text-slate-500">{row.count} - {formatPercent(row.percentage)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-navy-900" style={{ width: `${Math.min(100, row.percentage)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniRanking({ title, rows }: { title: string; rows: DistributionRow[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {rows.length ? <DistributionList rows={rows} /> : <EmptyDrawerState>No data</EmptyDrawerState>}
    </div>
  );
}

function buildStageDistribution(tenders: Pick<Tender, "lead_status">[]) {
  const stages: Tender["lead_status"][] = ["NEW", "CONTACTED", "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"];
  const labels: Record<Tender["lead_status"], string> = {
    NEW: "New Lead",
    ASSIGNED: "New Lead",
    CONTACTED: "First Contact",
    QUOTATION_SENT: "Quotation Sent",
    NEGOTIATION: "Negotiation",
    FOLLOW_UP: "Follow-up",
    WON: "Won",
    LOST: "Lost"
  };
  return stages.map((stage) => {
    const count = tenders.filter((tender) => (stage === "NEW" ? tender.lead_status === "NEW" || tender.lead_status === "ASSIGNED" : tender.lead_status === stage)).length;
    return {
      name: labels[stage],
      count,
      percentage: tenders.length ? (count / tenders.length) * 100 : 0
    };
  });
}

function topDistribution(values: Array<string | null | undefined>, limit = 5): DistributionRow[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = String(value || "Unknown");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const total = values.length || 1;
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function latestByDate<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows
    .slice()
    .sort((a, b) => new Date(String(b[key] ?? "")).getTime() - new Date(String(a[key] ?? "")).getTime())[0] ?? null;
}

function buildRecentActivity({
  tenders,
  followUps,
  activities,
  quotations,
  proformaInvoices
}: {
  tenders: Pick<Tender, "tender_id" | "lead_status" | "created_at" | "updated_at">[];
  followUps: { created_at: string; status: string }[];
  activities: { activity_type: string; created_at: string }[];
  quotations: { quotation_no?: string | null; created_at?: string | null }[];
  proformaInvoices: { pi_no?: string | null; created_at?: string | null }[];
}): RecentActivityRow[] {
  return [
    ...activities.map((activity) => ({
      label: activity.activity_type || "Lead Updated",
      detail: "Lead Updated",
      date: activity.created_at
    })),
    ...quotations.map((quotation) => ({
      label: "Quotation Created",
      detail: quotation.quotation_no || "Quotation",
      date: quotation.created_at ?? null
    })),
    ...proformaInvoices.map((invoice) => ({
      label: "PI Created",
      detail: invoice.pi_no || "PI",
      date: invoice.created_at ?? null
    })),
    ...followUps.map((followUp) => ({
      label: "Follow-up Added",
      detail: followUp.status || "Follow-up",
      date: followUp.created_at
    })),
    ...tenders.map((tender) => ({
      label: tender.updated_at && tender.updated_at !== tender.created_at ? "Lead Updated" : "Tender Assigned",
      detail: `${tender.tender_id} - ${leadStatusNameFromEnum(tender.lead_status)}`,
      date: tender.updated_at || tender.created_at
    }))
  ]
    .filter((row) => row.date)
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime())
    .slice(0, 10);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function safeFileToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
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

function MetricTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-navy-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">{title}</h3>
      {children}
    </section>
  );
}

function LoadingSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex animate-pulse gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyDrawerState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-slate-50 p-3 text-sm text-slate-500">{children}</p>;
}

function InfoGrid({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-sm text-slate-800">{value || "-"}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-700">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserAnalyticsPanel } from "@/components/analytics/user-analytics-drawer";
import { UserPerformanceTable } from "@/components/analytics/user-performance-table";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { AnalyticsBreakdowns, DashboardMetrics, Profile, UserPerformanceRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function AnalyticsCharts({
  metrics,
  breakdowns,
  userPerformance,
  currentProfile
}: {
  metrics: DashboardMetrics;
  breakdowns: AnalyticsBreakdowns;
  userPerformance: UserPerformanceRow[];
  currentProfile: Profile | null;
}) {
  const currentUserId = currentProfile?.id ?? null;
  const currentUserRole = currentProfile?.role ?? null;
  const isUser = currentUserRole === "USER";
  const pageCopy = currentUserRole === "MANAGER"
    ? {
        eyebrow: "Team Analytics",
        title: "Team Performance",
        description: "Manager-level tender, value, pipeline, and team performance analytics."
      }
    : {
        eyebrow: "Organization Analytics",
        title: "Tender Intelligence",
        description: "Company KPIs, user performance, pipeline, GE, CWE, contractor, and organisation analytics."
      };

  const chartGroups = [
    ["Our Value by User", breakdowns.ourValueByUser, "ourValue"],
    ["Our Value by GE", breakdowns.ourValueByGE, "ourValue"],
    ["Our Value by Contractor", breakdowns.ourValueByContractor, "ourValue"],
    ["Monthly Our Value Trend", breakdowns.monthlyOurValueTrend, "ourValue"],
    ["Tender Ageing", breakdowns.ageing, "ourValue"],
    ["Lead Stage Distribution", breakdowns.leadStageDistribution, "count"],
    ["Lost Leads by Reason", breakdowns.lostLeadsByReason, "ourValue"],
    ["Competitor Analysis", breakdowns.competitorAnalysis, "ourValue"],
    ["User-wise Conversion", breakdowns.userWiseConversion, "count"],
    ["Manager-wise Conversion", breakdowns.managerWiseConversion, "count"],
    ["Sales Funnel", breakdowns.salesFunnel, "ourValue"],
    ["GE Analysis", breakdowns.ge, "count"],
    ["Contractor Analysis", breakdowns.bidder, "value"],
    ["User Analysis", breakdowns.user, "count"]
  ] as const;

  if (isUser && currentProfile) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="My Performance" title="My Analytics" description="Your assigned tenders, uploaded tenders, values, pipeline, documents, follow-ups, and recent activity." />
        <UserAnalyticsPanel user={currentProfile} currentUserId={currentUserId} currentUserRole={currentUserRole} title="My Performance" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={pageCopy.eyebrow} title={pageCopy.title} description={pageCopy.description} />
      <AnalyticsOverview metrics={metrics} />
      <UserPerformanceTable rows={userPerformance} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      <div className="grid gap-4 xl:grid-cols-2">
        {chartGroups.map(([label, rows, primaryKey]) => (
          <Card key={label}>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">{label}</p>
              <h2 className="mt-1 font-bold text-navy-900">{label}</h2>
            </div>
            <div className="overflow-x-auto table-scroll">
              <div className="h-80 min-w-[520px] md:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, name) => (String(name).toLowerCase().includes("value") ? formatCurrency(Number(value)) : value)} />
                    <Bar dataKey={primaryKey} fill="#173b71" radius={[4, 4, 0, 0]} />
                    {primaryKey !== "ourValue" && <Bar dataKey="ourValue" fill="#f97316" radius={[4, 4, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

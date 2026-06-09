"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserPerformanceTable } from "@/components/analytics/user-performance-table";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { AnalyticsBreakdowns, DashboardMetrics, UserPerformanceRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function AnalyticsCharts({
  metrics,
  breakdowns,
  userPerformance
}: {
  metrics: DashboardMetrics;
  breakdowns: AnalyticsBreakdowns;
  userPerformance: UserPerformanceRow[];
}) {
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

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Analytics" title="Tender Intelligence" description="GE, CWE, contractor, and user-wise tender analysis with value and conversion context." />
      <AnalyticsOverview metrics={metrics} />
      <UserPerformanceTable rows={userPerformance} />
      <div className="grid gap-4 xl:grid-cols-2">
        {chartGroups.map(([label, rows, primaryKey]) => (
          <Card key={label}>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">{label}</p>
              <h2 className="mt-1 font-bold text-navy-900">{label}</h2>
            </div>
            <div className="h-80">
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
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { DashboardMetrics } from "@/lib/types";

export function AnalyticsCharts({ metrics, breakdowns }: { metrics: DashboardMetrics; breakdowns: Record<string, any[]> }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Analytics" title="Tender Intelligence" description="GE, CWE, contractor, and user-wise tender analysis with value and conversion context." />
      <AnalyticsOverview metrics={metrics} />
      <div className="grid gap-4 xl:grid-cols-2">
        {Object.entries(breakdowns).map(([label, rows]) => (
          <Card key={label}>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">{label}</p>
              <h2 className="mt-1 font-bold text-navy-900">{label} Analysis</h2>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#173b71" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

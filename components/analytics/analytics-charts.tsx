"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { Card } from "@/components/ui/card";
import type { DashboardMetrics } from "@/lib/types";

export function AnalyticsCharts({ metrics, breakdowns }: { metrics: DashboardMetrics; breakdowns: Record<string, any[]> }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Analytics</h1>
        <p className="text-sm text-slate-600">GE, CWE, bidder, and user-wise tender analysis.</p>
      </div>
      <AnalyticsOverview metrics={metrics} />
      <div className="grid gap-4 xl:grid-cols-2">
        {Object.entries(breakdowns).map(([label, rows]) => (
          <Card key={label}>
            <h2 className="mb-4 font-bold uppercase text-navy-900">{label} Analysis</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#173b71" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="value" fill="#d69a19" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

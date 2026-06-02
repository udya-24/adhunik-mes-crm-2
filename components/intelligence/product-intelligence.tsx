"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";

export function ProductIntelligence({ rows }: { rows: any[] }) {
  const top = rows[0];
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Products" title="Product Intelligence" description="Brand frequency and value trends from the Make field." />
      <Card className="bg-navy-900 text-white">
        <p className="text-sm text-navy-100">Most Used Brand</p>
        <p className="mt-2 text-3xl font-bold">{top?.brand ?? "No data"}</p>
        <p className="mt-2 text-sm text-amber-200">{top ? `${top.frequency} mentions across tender records` : "No tender product data yet"}</p>
      </Card>
      <Card>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <XAxis dataKey="brand" />
              <YAxis />
              <Tooltip formatter={(value, name) => (name === "value" ? formatCurrency(Number(value)) : value)} />
              <Bar dataKey="frequency" fill="#173b71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

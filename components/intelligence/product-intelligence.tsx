"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function ProductIntelligence({ rows }: { rows: any[] }) {
  const top = rows[0];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Product Intelligence</h1>
        <p className="text-sm text-slate-600">Brand frequency and value trends from the Make field.</p>
      </div>
      <Card>
        <p className="text-sm text-slate-600">Most Used Brand</p>
        <p className="mt-2 text-3xl font-bold text-navy-900">{top?.brand ?? "No data"}</p>
      </Card>
      <Card>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <XAxis dataKey="brand" />
              <YAxis />
              <Tooltip formatter={(value, name) => (name === "value" ? formatCurrency(Number(value)) : value)} />
              <Bar dataKey="frequency" fill="#173b71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="value" fill="#d69a19" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

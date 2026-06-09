import { Card } from "@/components/ui/card";
import type { AnalyticsBreakdownRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function SalesFunnelWidgets({ rows }: { rows: AnalyticsBreakdownRow[] }) {
  return (
    <Card>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Sales Pipeline</p>
        <h2 className="mt-1 font-bold text-navy-900">Lead Funnel</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {rows.map((row) => (
          <div key={row.name} className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="text-sm font-bold text-navy-900">{row.name}</p>
            <p className="mt-2 text-2xl font-bold text-navy-900">{row.count}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{formatCurrency(row.ourValue)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

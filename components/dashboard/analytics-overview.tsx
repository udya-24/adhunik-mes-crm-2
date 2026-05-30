import { Card } from "@/components/ui/card";
import { DashboardMetrics } from "@/lib/types";
import { compactNumber, formatCurrency } from "@/lib/utils";

export function AnalyticsOverview({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    ["Total Tenders", metrics.totalTenders],
    ["Total Tender Value", formatCurrency(metrics.totalTenderValue)],
    ["Assigned Leads", metrics.assignedLeads],
    ["Unassigned Leads", metrics.unassignedLeads],
    ["Won Leads", metrics.wonLeads],
    ["Lost Leads", metrics.lostLeads]
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map(([label, value]) => (
        <Card key={label as string}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-navy-900">{typeof value === "number" ? compactNumber(value) : value}</p>
        </Card>
      ))}
    </div>
  );
}

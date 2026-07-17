import { Card } from "@/components/ui/card";

export function AutoAssignmentAnalytics({ analytics }: { analytics: { today: number; yesterday: number; last7Days: number; lastBatch: { completed_tenders?: number; completed_at?: string; algorithm?: string } | null } }) {
  const values = [
    ["Today's Auto Assigned", analytics.today], ["Yesterday", analytics.yesterday], ["Last 7 Days", analytics.last7Days],
    ["Last Batch", analytics.lastBatch?.completed_tenders ?? "None"]
  ] as const;
  return <section><div className="mb-3"><h2 className="text-lg font-bold text-navy-900">Auto Assignment</h2><p className="text-sm text-slate-500">Distribution engine activity</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, value]) => <Card key={label} className="border-t-4 border-t-blue-600 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-navy-900">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>{label === "Last Batch" && analytics.lastBatch?.algorithm && <p className="mt-1 text-xs text-orange-600">{analytics.lastBatch.algorithm.replaceAll("_", " ")}</p>}</Card>)}</div></section>;
}

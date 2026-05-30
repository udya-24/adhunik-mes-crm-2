import { Card } from "@/components/ui/card";

export function FollowUpWidgets({ buckets }: { buckets: { today: unknown[]; overdue: unknown[]; upcoming: unknown[] } }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Today's Follow-Ups", buckets.today.length, "text-amber-600"],
        ["Overdue Follow-Ups", buckets.overdue.length, "text-red-600"],
        ["Upcoming Follow-Ups", buckets.upcoming.length, "text-navy-700"]
      ].map(([label, count, color]) => (
        <Card key={label as string}>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${color}`}>{count as number}</p>
        </Card>
      ))}
    </div>
  );
}

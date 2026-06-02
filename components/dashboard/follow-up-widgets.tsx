import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Clock3, Radar } from "lucide-react";

export function FollowUpWidgets({ buckets }: { buckets: { today: unknown[]; overdue: unknown[]; upcoming: unknown[] } }) {
  const hasData = buckets.today.length || buckets.overdue.length || buckets.upcoming.length;
  const widgets = [
    { label: "Today's Follow-Ups", count: buckets.today.length, icon: CalendarClock, badge: "Due today", tone: "amber" as const },
    { label: "Overdue Follow-Ups", count: buckets.overdue.length, icon: Clock3, badge: "Needs attention", tone: "red" as const },
    { label: "Upcoming Follow-Ups", count: buckets.upcoming.length, icon: Radar, badge: "Planned", tone: "blue" as const }
  ];

  return (
    <div className="space-y-3">
      {!hasData && <p className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-500">No data available</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {widgets.map(({ label, count, icon: Icon, badge, tone }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-navy-700">
                <Icon size={19} />
              </div>
              <Badge tone={tone}>{badge}</Badge>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-bold text-navy-900">{count}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

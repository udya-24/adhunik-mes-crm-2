import { Badge } from "@/components/ui/badge";
import { DateTime } from "@/components/common/date-time";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarClock } from "lucide-react";

export function FollowUpBoard({ buckets }: { buckets: Record<string, any[]> }) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Follow-Ups" title="Pipeline Follow-Ups" description="Prioritize overdue, due today, and upcoming tender conversations." />
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(buckets).map(([label, rows]) => (
          <Card key={label}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold capitalize text-navy-900">{label}</h2>
              <Badge tone={label === "overdue" ? "red" : label === "today" ? "amber" : "blue"}>{rows.length}</Badge>
            </div>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-navy-900">{row.tender?.tender_id} - {row.tender?.bidder_name || "Unknown"}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-slate-500"><CalendarClock size={14} /> <DateTime value={row.follow_up_date} /></p>
                  <p className="mt-2 text-slate-700">{row.remarks}</p>
                </div>
              ))}
              {!rows.length && <p className="text-sm text-slate-500">No follow-ups.</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

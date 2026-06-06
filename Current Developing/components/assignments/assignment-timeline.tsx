import { Badge } from "@/components/ui/badge";
import { DateTime } from "@/components/common/date-time";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { ArrowRight, UserRoundCheck } from "lucide-react";

export function AssignmentTimeline({ history }: { history: any[] }) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Assignments" title="Assignment History" description="Complete allocation and reassignment trail across the MES tender pipeline." />
      <Card>
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-slate-50 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-700"><UserRoundCheck size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-900">{item.tender?.tender_id} <ArrowRight className="inline" size={14} /> {formatProfileDisplayName(item.assignee)}</p>
                <p className="text-sm text-slate-600">By {formatProfileDisplayName(item.assigner)} on <DateTime value={item.assigned_date} /></p>
                {item.remarks && <p className="mt-2 text-sm text-slate-700">{item.remarks}</p>}
              </div>
              <Badge tone="blue">Assigned</Badge>
            </div>
          ))}
          {!history.length && <p className="text-sm text-slate-500">No assignment activity yet.</p>}
        </div>
      </Card>
    </div>
  );
}

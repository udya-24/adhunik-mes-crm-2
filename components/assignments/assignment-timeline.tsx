import { Card } from "@/components/ui/card";

export function AssignmentTimeline({ history }: { history: any[] }) {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-navy-900">Assignment History</h1>
      <p className="mb-5 text-sm text-slate-600">Complete allocation and reassignment trail.</p>
      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-4">
            <p className="font-semibold text-navy-900">{item.tender?.tender_id} assigned to {item.assignee?.full_name || item.assignee?.email}</p>
            <p className="text-sm text-slate-600">By {item.assigner?.full_name || item.assigner?.email} on {new Date(item.assigned_date).toLocaleString()}</p>
            {item.remarks && <p className="mt-2 text-sm text-slate-700">{item.remarks}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

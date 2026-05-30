import { Card } from "@/components/ui/card";

export function FollowUpBoard({ buckets }: { buckets: Record<string, any[]> }) {
  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-navy-900">Follow-Ups</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(buckets).map(([label, rows]) => (
          <Card key={label}>
            <h2 className="mb-4 font-bold capitalize text-navy-900">{label}</h2>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-semibold">{row.tender?.tender_id} · {row.tender?.bidder_name || "Unknown"}</p>
                  <p className="text-slate-500">{new Date(row.follow_up_date).toLocaleString()}</p>
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

import { Card } from "@/components/ui/card";
import type { UserPerformanceRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function UserPerformanceTable({ rows }: { rows: UserPerformanceRow[] }) {
  if (!rows.length) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Team Analytics</p>
        <h2 className="mt-1 font-bold text-navy-900">User Performance</h2>
      </div>
      <div className="mt-4 overflow-x-auto table-scroll">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">User Name</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Assigned Tenders</th>
              <th className="px-3 py-3">Uploaded Tenders</th>
              <th className="px-3 py-3">Follow-Ups</th>
              <th className="px-3 py-3">Assigned Our Value</th>
              <th className="px-3 py-3">Converted Tenders</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-t border-border hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold text-navy-900">{row.userName}</td>
                <td className="px-3 py-3">{row.role}</td>
                <td className="px-3 py-3">{row.assignedTenders}</td>
                <td className="px-3 py-3">{row.uploadedTenders}</td>
                <td className="px-3 py-3">{row.followUps}</td>
                <td className="px-3 py-3 font-semibold text-navy-900">{formatCurrency(row.assignedOurValue)}</td>
                <td className="px-3 py-3">{row.convertedTenders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

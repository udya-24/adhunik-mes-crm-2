import { Card } from "@/components/ui/card";
import type { Tender } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function TenderSnapshot({ tenders }: { tenders: Tender[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-navy-900">Recent Tenders</h2>
        <a className="rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50" href="/tenders">
          View all
        </a>
      </div>
      <div className="overflow-x-auto table-scroll">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Tender ID</th>
              <th className="px-3 py-3">GE</th>
              <th className="px-3 py-3">CWE</th>
              <th className="px-3 py-3">Bidder</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tenders.map((tender) => (
              <tr key={tender.id} className="border-t border-border">
                <td className="px-3 py-3 font-semibold text-navy-900">{tender.tender_id}</td>
                <td className="px-3 py-3">{tender.ge || "-"}</td>
                <td className="px-3 py-3">{tender.cwe || "-"}</td>
                <td className="px-3 py-3">{tender.bidder_name || "-"}</td>
                <td className="px-3 py-3">{formatCurrency(tender.awarded_value)}</td>
                <td className="px-3 py-3">{tender.lead_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { ContractDate } from "@/components/common/contract-date";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tender } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function TenderSnapshot({ tenders }: { tenders: Tender[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="mb-4 flex items-center justify-between">
        <div className="px-5 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Recent Activity</p>
          <h2 className="mt-1 font-bold text-navy-900">Recent Tenders</h2>
        </div>
        <a className="mr-5 mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50" href="/tenders">
          View all <ArrowRight size={15} />
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
              <th className="px-3 py-3">Contract</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {!tenders.length && (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={7}>
                  No data available
                </td>
              </tr>
            )}
            {tenders.map((tender) => (
              <tr key={tender.id} className="border-t border-border hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold text-navy-900">{tender.tender_id}</td>
                <td className="px-3 py-3">{tender.ge || "-"}</td>
                <td className="px-3 py-3">{tender.cwe || "-"}</td>
                <td className="px-3 py-3">{tender.bidder_name || "-"}</td>
                <td className="px-3 py-3"><ContractDate tender={tender} /></td>
                <td className="px-3 py-3">{formatCurrency(tender.awarded_value)}</td>
                <td className="px-3 py-3"><Badge tone={statusTone(tender.lead_status)}>{tender.lead_status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function statusTone(status: Tender["lead_status"]) {
  if (status === "WON") return "green";
  if (status === "LOST") return "red";
  if (status === "FOLLOW_UP" || status === "NEGOTIATION") return "orange";
  if (status === "ASSIGNED" || status === "CONTACTED") return "blue";
  return "slate";
}

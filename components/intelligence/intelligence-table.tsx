import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";

export function IntelligenceTable({ rows }: { rows: any[] }) {
  return (
    <div className="space-y-5">
    <PageHeader eyebrow="Contractors" title="Contractor Intelligence" description="Rankings by tender count, awarded value, preferred GE/CWE, and success history." />
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Rank", "Contractor", "Tender Count", "Awarded Value", "Preferred GE", "Preferred CWE", "Wins"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.contractor} className="border-t border-border hover:bg-slate-50">
                <td className="px-3 py-3 font-bold text-amber-600">#{index + 1}</td>
                <td className="px-3 py-3 font-semibold text-navy-900">{row.contractor}</td>
                <td className="px-3 py-3">{row.tenderCount}</td>
                <td className="px-3 py-3">{formatCurrency(row.awardedValue)}</td>
                <td className="px-3 py-3">{row.preferredGe}</td>
                <td className="px-3 py-3">{row.preferredCwe}</td>
                <td className="px-3 py-3">{row.successHistory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    </div>
  );
}

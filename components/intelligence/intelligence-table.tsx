import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function IntelligenceTable({ rows }: { rows: any[] }) {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-navy-900">Contractor Intelligence</h1>
      <p className="mb-5 text-sm text-slate-600">Rankings by tender count, awarded value, preferred GE/CWE, and success history.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Rank", "Contractor", "Tender Count", "Awarded Value", "Preferred GE", "Preferred CWE", "Wins"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.contractor} className="border-t border-border">
                <td className="px-3 py-3">{index + 1}</td>
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
  );
}

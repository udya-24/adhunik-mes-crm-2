import { Card } from "@/components/ui/card";
import { DashboardMetrics } from "@/lib/types";
import { compactNumber, formatCurrency } from "@/lib/utils";
import { ClipboardList, IndianRupee, Target, TrendingDown, Trophy, UserCheck, WalletCards } from "lucide-react";

export function AnalyticsOverview({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    { label: "Total Tenders", value: metrics.totalTenders, icon: ClipboardList, tone: "bg-navy-50 text-navy-700" },
    { label: "Tender Value", value: formatCurrency(metrics.totalTenderValue), icon: IndianRupee, tone: "bg-amber-50 text-amber-600" },
    { label: "Total Our Value", value: formatCurrency(metrics.totalOurValue), icon: WalletCards, tone: "bg-blue-50 text-blue-700" },
    { label: "Assigned Our Value", value: formatCurrency(metrics.assignedOurValue), icon: WalletCards, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Unassigned Our Value", value: formatCurrency(metrics.unassignedOurValue), icon: WalletCards, tone: "bg-orange-50 text-orange-600" },
    { label: "Quotation Sent Value", value: formatCurrency(metrics.quotationSentValue), icon: WalletCards, tone: "bg-amber-50 text-amber-600" },
    { label: "Negotiation Value", value: formatCurrency(metrics.negotiationValue), icon: WalletCards, tone: "bg-orange-50 text-orange-600" },
    { label: "PI Pending Value", value: formatCurrency(metrics.piPendingValue), icon: WalletCards, tone: "bg-blue-50 text-blue-700" },
    { label: "Order Received Value", value: formatCurrency(metrics.orderReceivedValue), icon: Trophy, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Lost Lead Value", value: formatCurrency(metrics.lostLeadValue), icon: TrendingDown, tone: "bg-red-50 text-red-700" },
    ...(metrics.showMyOurValue ? [{ label: "My Our Value", value: formatCurrency(metrics.myOurValue), icon: WalletCards, tone: "bg-navy-50 text-navy-700" }] : []),
    { label: "Assigned", value: metrics.assignedLeads, icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Open Pool", value: metrics.unassignedLeads, icon: Target, tone: "bg-orange-50 text-orange-600" },
    { label: "Won", value: metrics.wonLeads, icon: Trophy, tone: "bg-navy-50 text-navy-700" },
    { label: "Lost", value: metrics.lostLeads, icon: TrendingDown, tone: "bg-red-50 text-red-700" }
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="relative overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
              <Icon size={18} />
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-navy-900">{typeof value === "number" ? compactNumber(value) : value}</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-navy-500 via-amber-500 to-orange-500" />
          </div>
        </Card>
      ))}
    </div>
  );
}

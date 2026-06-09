import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { AgeingWidgets } from "@/components/dashboard/ageing-widgets";
import { FollowUpWidgets } from "@/components/dashboard/follow-up-widgets";
import { SalesFunnelWidgets } from "@/components/dashboard/sales-funnel-widgets";
import { TenderSnapshot } from "@/components/dashboard/tender-snapshot";
import { PageHeader } from "@/components/ui/page-header";
import { getAnalyticsBreakdowns, getDashboardMetrics, getFollowUpBuckets, getTenderRows } from "@/lib/data";

export default async function DashboardPage() {
  const [metrics, followUps, tenders, breakdowns] = await Promise.all([
    getDashboardMetrics(),
    getFollowUpBuckets(),
    getTenderRows({ limit: 8 }),
    getAnalyticsBreakdowns()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command Center"
        title="MES Tender Dashboard"
        description="Tender pipeline, allocation health, contractor activity, and follow-up focus for today."
      />
      <AnalyticsOverview metrics={metrics} />
      <SalesFunnelWidgets rows={breakdowns.salesFunnel} />
      <AgeingWidgets buckets={breakdowns.ageing} />
      <FollowUpWidgets buckets={followUps} />
      <TenderSnapshot tenders={tenders} />
    </div>
  );
}

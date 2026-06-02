import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { FollowUpWidgets } from "@/components/dashboard/follow-up-widgets";
import { TenderSnapshot } from "@/components/dashboard/tender-snapshot";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboardMetrics, getFollowUpBuckets, getTenderRows } from "@/lib/data";

export default async function DashboardPage() {
  const [metrics, followUps, tenders] = await Promise.all([
    getDashboardMetrics(),
    getFollowUpBuckets(),
    getTenderRows({ limit: 8 })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command Center"
        title="MES Tender Dashboard"
        description="Tender pipeline, allocation health, contractor activity, and follow-up focus for today."
      />
      <AnalyticsOverview metrics={metrics} />
      <FollowUpWidgets buckets={followUps} />
      <TenderSnapshot tenders={tenders} />
    </div>
  );
}

import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { FollowUpWidgets } from "@/components/dashboard/follow-up-widgets";
import { TenderSnapshot } from "@/components/dashboard/tender-snapshot";
import { getDashboardMetrics, getFollowUpBuckets, getTenderRows } from "@/lib/data";

export default async function DashboardPage() {
  const [metrics, followUps, tenders] = await Promise.all([
    getDashboardMetrics(),
    getFollowUpBuckets(),
    getTenderRows({ limit: 8 })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Tender pipeline, allocation health, and follow-up focus for today.</p>
      </div>
      <AnalyticsOverview metrics={metrics} />
      <FollowUpWidgets buckets={followUps} />
      <TenderSnapshot tenders={tenders} />
    </div>
  );
}

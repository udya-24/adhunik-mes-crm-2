import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { getCurrentProfile } from "@/lib/auth";
import { getAnalyticsBreakdowns, getDashboardMetrics, getUserPerformanceRows } from "@/lib/data";

export default async function AnalyticsPage() {
  const [profile, metrics, breakdowns, userPerformance] = await Promise.all([getCurrentProfile(), getDashboardMetrics(), getAnalyticsBreakdowns(), getUserPerformanceRows()]);
  return <AnalyticsCharts metrics={metrics} breakdowns={breakdowns} userPerformance={userPerformance} currentUserId={profile?.id ?? null} currentUserRole={profile?.role ?? null} />;
}

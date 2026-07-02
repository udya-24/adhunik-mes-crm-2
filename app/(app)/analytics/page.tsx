import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { UserAnalyticsPanel } from "@/components/analytics/user-analytics-drawer";
import { getCurrentProfile } from "@/lib/auth";
import { getAnalyticsBreakdowns, getDashboardMetrics, getUserPerformanceRows } from "@/lib/data";

export default async function AnalyticsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role === "USER") {
    return <UserAnalyticsPanel user={profile} currentUserId={profile.id} currentUserRole={profile.role} title="My Performance" />;
  }

  const [metrics, breakdowns, userPerformance] = await Promise.all([getDashboardMetrics(), getAnalyticsBreakdowns(), getUserPerformanceRows()]);
  return <AnalyticsCharts metrics={metrics} breakdowns={breakdowns} userPerformance={userPerformance} currentProfile={profile} />;
}

import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { getAnalyticsBreakdowns, getDashboardMetrics, getUserPerformanceRows } from "@/lib/data";

export default async function AnalyticsPage() {
  const [metrics, breakdowns, userPerformance] = await Promise.all([getDashboardMetrics(), getAnalyticsBreakdowns(), getUserPerformanceRows()]);
  return <AnalyticsCharts metrics={metrics} breakdowns={breakdowns} userPerformance={userPerformance} />;
}

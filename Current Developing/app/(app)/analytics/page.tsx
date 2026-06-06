import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { getAnalyticsBreakdowns, getDashboardMetrics } from "@/lib/data";

export default async function AnalyticsPage() {
  const [metrics, breakdowns] = await Promise.all([getDashboardMetrics(), getAnalyticsBreakdowns()]);
  return <AnalyticsCharts metrics={metrics} breakdowns={breakdowns} />;
}

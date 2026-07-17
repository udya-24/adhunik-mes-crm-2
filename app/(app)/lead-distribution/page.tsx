import { LeadDistributionDashboard } from "@/components/lead-distribution/lead-distribution-dashboard";
import { getDistributionOverviewAction } from "@/app/actions/lead-distribution";
import { requireRole } from "@/lib/auth";

export default async function LeadDistributionPage() {
  await requireRole(["ADMIN"]);
  const overview = await getDistributionOverviewAction();
  return <LeadDistributionDashboard initialOverview={overview} />;
}

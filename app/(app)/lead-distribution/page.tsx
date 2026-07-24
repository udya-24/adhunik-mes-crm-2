import { LeadDistributionDashboard } from "@/components/lead-distribution/lead-distribution-dashboard";
import { getBidderOwnershipAction, getDistributionOverviewAction } from "@/app/actions/lead-distribution";
import { requireRole } from "@/lib/auth";

export default async function LeadDistributionPage() {
  await requireRole(["ADMIN"]);
  const [overview, bidderAssignments] = await Promise.all([getDistributionOverviewAction(), getBidderOwnershipAction()]);
  return <LeadDistributionDashboard initialOverview={overview} initialBidderAssignments={bidderAssignments} />;
}

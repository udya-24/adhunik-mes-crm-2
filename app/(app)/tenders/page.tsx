import { TenderDataGrid } from "@/components/tenders/tender-data-grid";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableUsers, getLeadStatuses } from "@/lib/data";
import { canAssignLeads } from "@/lib/permissions";

export default async function TendersPage() {
  const profile = await getCurrentProfile();
  const canAssign = profile ? canAssignLeads(profile.role) : false;
  const canDelete = profile?.role === "ADMIN" || profile?.role === "MANAGER";
  const [users, leadStatuses] = await Promise.all([canAssign ? getAssignableUsers() : [], getLeadStatuses({ activeOnly: true })]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Pipeline" title="Tenders" description="Search, filter, assign, inspect, and export MES tender records." />
      <TenderDataGrid users={users} leadStatuses={leadStatuses} canAssign={canAssign} canDelete={canDelete} currentUserId={profile?.id ?? null} currentUserRole={profile?.role ?? null} />
    </div>
  );
}

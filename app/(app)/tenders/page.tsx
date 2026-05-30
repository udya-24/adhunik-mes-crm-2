import { TenderDataGrid } from "@/components/tenders/tender-data-grid";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableUsers } from "@/lib/data";
import { canAssignLeads } from "@/lib/permissions";

export default async function TendersPage() {
  const profile = await getCurrentProfile();
  const canAssign = profile ? canAssignLeads(profile.role) : false;
  const users = canAssign ? await getAssignableUsers() : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Tenders</h1>
        <p className="text-sm text-slate-600">Search, assign, upload, and export MES tender records.</p>
      </div>
      <TenderDataGrid users={users} canAssign={canAssign} />
    </div>
  );
}

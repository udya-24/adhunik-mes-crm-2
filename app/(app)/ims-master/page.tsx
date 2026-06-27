import { ImsMasterClient } from "@/components/ims/ims-master-client";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getImsMaster } from "@/lib/ims";

export default async function ImsMasterPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const params = await searchParams;
  const result = await getImsMaster({
    search: single(params.search),
    category: single(params.category),
    status: (single(params.status) as "active" | "inactive" | "all" | undefined) ?? "active",
    sort: single(params.sort),
    page: Number(single(params.page) ?? 1)
  });

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Inventory Source of Truth" title="IMS Master" description="Central product master for quotations, PI, invoices, purchase, inventory, dispatch, and BOQ matching." />
      <ImsMasterClient {...result} role={profile.role} />
    </div>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

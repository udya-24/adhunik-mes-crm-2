import { DeletedTendersTable } from "@/components/tenders/deleted-tenders-table";
import { PageHeader } from "@/components/ui/page-header";
import { getDeletedTenderRows } from "@/lib/data";

export default async function DeletedTendersPage() {
  const tenders = await getDeletedTenderRows();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin" title="Deleted Tenders" description="Review soft-deleted tender records and restore them when required." />
      <DeletedTendersTable tenders={tenders} />
    </div>
  );
}

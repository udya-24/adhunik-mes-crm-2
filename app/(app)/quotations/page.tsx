import { QuotationList } from "@/components/quotations/quotation-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireQuotationAccess } from "@/lib/quotation-access";
import { getQuotations } from "@/lib/quotations";

export default async function QuotationsPage() {
  const profile = await requireQuotationAccess();
  const quotations = await getQuotations();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Sales Documents" title="Quotations" description="Create, manage, and export professional customer quotations." />
      <QuotationList quotations={quotations} role={profile.role} currentUserId={profile.id} />
    </div>
  );
}

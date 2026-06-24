import { QuotationEditor } from "@/components/quotations/quotation-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireQuotationAccess } from "@/lib/quotation-access";

export default async function NewQuotationPage() {
  await requireQuotationAccess();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quotations" title="Create Quotation" description="Build a detailed quotation with editable items, totals, and commercial terms." />
      <QuotationEditor />
    </div>
  );
}

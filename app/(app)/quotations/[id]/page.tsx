import { notFound } from "next/navigation";
import { QuotationView } from "@/components/quotations/quotation-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireQuotationAccess } from "@/lib/quotation-access";
import { getQuotation } from "@/lib/quotations";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireQuotationAccess()]);
  const quotation = await getQuotation(id);
  if (!quotation) notFound();
  const canEdit = profile.role !== "USER" || quotation.created_by === profile.id;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quotation" title={quotation.quotation_no} description={`${quotation.customer_name} · ${quotation.contract_name || "No contract name"}`} />
      <QuotationView quotation={quotation} canEdit={canEdit} />
    </div>
  );
}

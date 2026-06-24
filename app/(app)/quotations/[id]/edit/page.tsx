import { notFound, redirect } from "next/navigation";
import { QuotationEditor } from "@/components/quotations/quotation-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireQuotationAccess } from "@/lib/quotation-access";
import { getQuotation } from "@/lib/quotations";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireQuotationAccess()]);
  const quotation = await getQuotation(id);
  if (!quotation) notFound();
  if (profile.role === "USER" && quotation.created_by !== profile.id) redirect(`/quotations/${id}`);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quotations" title={`Edit ${quotation.quotation_no}`} description="Update quotation details, line items, and terms." />
      <QuotationEditor quotation={quotation} />
    </div>
  );
}

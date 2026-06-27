import { notFound } from "next/navigation";
import { PiView } from "@/components/proforma-invoices/pi-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";
import { getProformaInvoice } from "@/lib/proforma-invoices";

export default async function ProformaInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireProformaInvoiceAccess()]);
  const invoice = await getProformaInvoice(id);
  if (!invoice) notFound();
  const canEdit = profile.role !== "USER" || invoice.created_by === profile.id;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Proforma Invoice" title={invoice.pi_no} description={`${invoice.indentor_name} - ${invoice.po_no || "No PO number"}`} />
      <PiView invoice={invoice} canEdit={canEdit} />
    </div>
  );
}

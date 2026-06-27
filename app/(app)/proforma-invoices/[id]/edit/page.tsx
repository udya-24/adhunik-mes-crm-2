import { notFound, redirect } from "next/navigation";
import { PiEditor } from "@/components/proforma-invoices/pi-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";
import { getProformaInvoice } from "@/lib/proforma-invoices";

export default async function EditProformaInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, requireProformaInvoiceAccess()]);
  const invoice = await getProformaInvoice(id);
  if (!invoice) notFound();
  if (profile.role === "USER" && invoice.created_by !== profile.id) redirect(`/proforma-invoices/${id}`);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Proforma Invoices" title={`Edit ${invoice.pi_no}`} description="Update PI details, items, terms, and signature details." />
      <PiEditor invoice={invoice} profile={profile} />
    </div>
  );
}

import { PiEditor } from "@/components/proforma-invoices/pi-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";

export default async function NewProformaInvoicePage() {
  const profile = await requireProformaInvoiceAccess();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Proforma Invoices" title="Create PI" description="Build a proforma invoice with editable items, commercial totals, terms, and signature details." />
      <PiEditor profile={profile} />
    </div>
  );
}

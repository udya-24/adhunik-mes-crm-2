import { PiList } from "@/components/proforma-invoices/pi-list";
import { PageHeader } from "@/components/ui/page-header";
import { requireProformaInvoiceAccess } from "@/lib/proforma-access";
import { getProformaInvoices } from "@/lib/proforma-invoices";

export default async function ProformaInvoicesPage() {
  const profile = await requireProformaInvoiceAccess();
  const invoices = await getProformaInvoices();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Sales Documents" title="Proforma Invoices" description="Create, preview, manage, duplicate, and export professional proforma invoices." />
      <PiList invoices={invoices} role={profile.role} currentUserId={profile.id} />
    </div>
  );
}

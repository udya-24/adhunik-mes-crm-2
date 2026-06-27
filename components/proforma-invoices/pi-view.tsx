"use client";

import Link from "next/link";
import { Copy, Download, FilePenLine, FileText, Loader2, Printer } from "lucide-react";
import { useState, useTransition } from "react";
import { duplicateProformaInvoiceAction } from "@/app/actions/proforma-invoices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PiDocumentPreview } from "@/components/proforma-invoices/pi-document-preview";
import { exportProformaInvoiceDocx, exportProformaInvoicePdf } from "@/lib/proforma-document";
import type { ProformaInvoice } from "@/lib/types";

export function PiView({ invoice, canEdit }: { invoice: ProformaInvoice; canEdit: boolean }) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  const [isDuplicating, startDuplicate] = useTransition();

  async function runExport(type: "pdf" | "docx") {
    setExporting(type);
    setError("");
    try {
      if (type === "pdf") await exportProformaInvoicePdf(invoice);
      else await exportProformaInvoiceDocx(invoice);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Document export failed.");
    } finally {
      setExporting(null);
    }
  }

  function duplicate() {
    startDuplicate(async () => {
      setError("");
      try {
        const result = await duplicateProformaInvoiceAction(invoice.id);
        window.location.href = `/proforma-invoices/${result.id}/edit`;
      } catch (duplicateError) {
        setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate PI.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit ? (
          <Link href={`/proforma-invoices/${invoice.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-navy-900 shadow-sm hover:bg-navy-50">
            <FilePenLine size={16} /> Edit
          </Link>
        ) : null}
        <Button variant="secondary" onClick={duplicate} disabled={isDuplicating}>
          {isDuplicating ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />} Duplicate
        </Button>
        <Button variant="secondary" onClick={() => runExport("pdf")} disabled={Boolean(exporting)}>
          {exporting === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Export PDF
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
        <Button onClick={() => runExport("docx")} disabled={Boolean(exporting)}>
          {exporting === "docx" ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} Export DOCX
        </Button>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      <Card className="mx-auto max-w-[1050px] overflow-hidden p-0">
        <PiDocumentPreview invoice={invoice} />
      </Card>
    </div>
  );
}

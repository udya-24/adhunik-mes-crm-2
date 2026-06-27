"use client";

import Link from "next/link";
import { Download, FilePenLine, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/quotations/quotation-list";
import { exportQuotationDocx, exportQuotationPdf, formatQuotationCurrency } from "@/lib/quotation-export";
import { defaultCompanyHeaderUrl } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { quotationCreatorName, quotationSignatureCompany } from "@/lib/quotation-signature";
import type { Quotation } from "@/lib/types";

export function QuotationView({ quotation, canEdit }: { quotation: Quotation; canEdit: boolean }) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");

  async function runExport(type: "pdf" | "docx") {
    setExporting(type);
    setError("");
    try {
      if (type === "pdf") await exportQuotationPdf(quotation);
      else await exportQuotationDocx(quotation);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Document export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit ? (
          <Link href={`/quotations/${quotation.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-navy-900 shadow-sm hover:bg-navy-50">
            <FilePenLine size={16} /> Edit
          </Link>
        ) : null}
        <Button variant="secondary" onClick={() => runExport("pdf")} disabled={Boolean(exporting)}>
          {exporting === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Export PDF
        </Button>
        <Button onClick={() => runExport("docx")} disabled={Boolean(exporting)}>
          {exporting === "docx" ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} Export DOCX
        </Button>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <Card className="mx-auto max-w-[1050px] overflow-hidden p-0">
        <img src={quotation.header_image_url || defaultCompanyHeaderUrl} alt="Adhunik Switchgears Pvt. Ltd. company header" className="h-auto w-full object-contain" />
        <div className="p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Company Name</p>
              <h2 className="mt-1 text-2xl font-bold text-navy-900">{quotation.customer_name}</h2>
              <p className="mt-1 max-w-xl whitespace-pre-wrap text-sm text-slate-600">{quotation.address || "-"}</p>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-navy-900">QUOTATION</h1>
              <p className="mt-2 font-bold text-slate-700">{quotation.quotation_no}</p>
              <p className="text-sm text-slate-500">{formatDate(quotation.quotation_date)}</p>
              <div className="mt-2"><StatusBadge status={quotation.status} /></div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Contract Name" value={quotation.contract_name} />
            <Info label="Contact Person" value={quotation.contact_person} />
            <Info label="Mobile Number" value={quotation.mobile_number} />
            <Info label="Email" value={quotation.email} />
            <Info label="GST Number" value={quotation.gst_number} />
          </div>

          <div className="table-scroll overflow-x-auto rounded-xl border border-border">
            <table className="min-w-[800px] w-full border-collapse text-sm">
              <thead className="bg-navy-900 text-white">
                <tr>
                  <th className="px-3 py-3 text-center">Sl. No.</th>
                  <th className="px-3 py-3 text-left">Item Description</th>
                  <th className="px-3 py-3 text-right">Quantity</th>
                  <th className="px-3 py-3 text-center">Unit</th>
                  <th className="px-3 py-3 text-right">Unit Price</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, index) => (
                  <tr key={item.id || index} className="border-t border-border align-top">
                    <td className="px-3 py-3 text-center">{index + 1}</td>
                    <td className="whitespace-pre-wrap px-3 py-3 leading-6">{item.item_description}</td>
                    <td className="px-3 py-3 text-right">{item.quantity}</td>
                    <td className="px-3 py-3 text-center">{item.unit}</td>
                    <td className="px-3 py-3 text-right">{formatQuotationCurrency(item.unit_price)}</td>
                    <td className="px-3 py-3 text-right font-bold">{formatQuotationCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <SummaryRow label="Subtotal" value={formatQuotationCurrency(quotation.items.reduce((sum, item) => sum + item.total_price, 0))} />
              <SummaryRow label="GST %" value={`${formatPercentage(quotation.gst_percentage)}%`} />
              <SummaryRow label="GST Amount" value={formatQuotationCurrency(quotation.gst_amount)} />
              <div className="flex items-center justify-between gap-4 bg-navy-900 px-4 py-4 text-white">
                <span className="text-base font-bold">Grand Total</span>
                <span className="text-lg font-bold">{formatQuotationCurrency(quotation.grand_total)}</span>
              </div>
            </div>
          </div>

          {quotation.terms.length ? (
            <div className="mt-7">
              <h3 className="mb-3 text-lg font-bold text-navy-900">Terms & Conditions</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                {quotation.terms.map((term, index) => (
                  <div key={term.id || index} className="grid border-t border-border first:border-t-0 sm:grid-cols-[0.3fr_1fr]">
                    <div className="bg-slate-50 px-4 py-3 font-bold text-navy-900">{term.term_key}</div>
                    <div className="whitespace-pre-wrap px-4 py-3 text-slate-700">{term.term_value || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-10 text-sm text-slate-800">
            <p className="font-semibold">For</p>
            <p className="mt-2 font-bold text-navy-900">{quotationSignatureCompany}</p>
            <div className="h-[52mm]" aria-hidden="true" />
            <p className="font-semibold">Yours Faithfully,</p>
            <p className="mt-2 font-bold text-navy-900">{quotationCreatorName(quotation)}</p>
            <p className="mt-1 font-semibold text-slate-700">{quotation.signature_designation || "-"}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{value || "-"}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3"><span className="font-semibold text-slate-600">{label}</span><span className="font-bold text-navy-900">{value}</span></div>;
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

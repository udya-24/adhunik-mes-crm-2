"use client";

import { piCompanyHeaderUrl } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { formatPiCurrency, piCompanyName, piCreatorName, piFixedFooter, piSubtotal } from "@/lib/proforma-document";
import type { ProformaInvoice } from "@/lib/types";
import { PiStatusBadge } from "@/components/proforma-invoices/pi-status-badge";

export function PiDocumentPreview({ invoice, showStatus = true }: { invoice: ProformaInvoice; showStatus?: boolean }) {
  return (
    <div className="overflow-hidden bg-white">
      <img src={piCompanyHeaderUrl} alt="Adhunik Switchgears Pvt. Ltd. PI header" className="h-auto w-full object-contain" />
      <div className="p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Company Name</p>
            <h2 className="mt-1 text-2xl font-bold text-navy-900">{invoice.indentor_name || "Company Name"}</h2>
            <p className="mt-1 max-w-xl whitespace-pre-wrap text-sm text-slate-600">{invoice.indentor_address || "-"}</p>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold text-navy-900">PROFORMA INVOICE</h1>
            <p className="mt-2 font-bold text-slate-700">{invoice.pi_no || "PI No."}</p>
            <p className="text-sm text-slate-500">{formatDate(invoice.pi_date)}</p>
            {showStatus ? <div className="mt-2"><PiStatusBadge status={invoice.status} /></div> : null}
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Our Ref No." value={invoice.our_ref_no} />
          <Info label="DP Code" value={invoice.dp_code} />
          <Info label="Mobile No." value={invoice.mobile_no} />
          <Info label="E-mail" value={invoice.email} />
          <Info label="GSTIN" value={invoice.gstin} />
          <Info label="PO No." value={invoice.po_no} />
          <Info label="PO Date" value={invoice.po_date ? formatDate(invoice.po_date) : null} />
          <Info label="Project" value={invoice.project} />
        </div>

        <div className="table-scroll overflow-x-auto rounded-xl border border-border">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead className="bg-navy-900 text-white">
              <tr>
                <th className="px-3 py-3 text-center">Sl. No.</th>
                <th className="px-3 py-3 text-left">Item Description</th>
                <th className="px-3 py-3 text-left">Model Type</th>
                <th className="px-3 py-3 text-right">Qty.</th>
                <th className="px-3 py-3 text-right">Unit Price (INR)</th>
                <th className="px-3 py-3 text-right">Total Price (INR)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id || index} className="border-t border-border align-top">
                  <td className="px-3 py-3 text-center">{index + 1}</td>
                  <td className="whitespace-pre-wrap px-3 py-3 leading-6">{item.item_description || "-"}</td>
                  <td className="px-3 py-3">{item.model_type || "-"}</td>
                  <td className="px-3 py-3 text-right">{item.quantity}</td>
                  <td className="px-3 py-3 text-right">{formatPiCurrency(item.unit_price)}</td>
                  <td className="px-3 py-3 text-right font-bold">{formatPiCurrency(item.quantity * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <SummaryRow label="Subtotal" value={formatPiCurrency(piSubtotal(invoice))} />
            <SummaryRow label="GST %" value={`${formatPercentage(invoice.gst_percentage)}%`} />
            <SummaryRow label="GST Amount" value={formatPiCurrency(invoice.gst_amount)} />
            <div className="flex items-center justify-between gap-4 bg-navy-900 px-4 py-4 text-white">
              <span className="text-base font-bold">Grand Total</span>
              <span className="text-lg font-bold">{formatPiCurrency(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

        {invoice.terms.length ? (
          <div className="mt-7">
            <h3 className="mb-3 text-lg font-bold text-navy-900">Terms & Conditions</h3>
            <div className="overflow-hidden rounded-xl border border-border">
              {invoice.terms.map((term, index) => (
                <div key={term.id || index} className="grid border-t border-border first:border-t-0 sm:grid-cols-[0.3fr_1fr]">
                  <div className="bg-slate-50 px-4 py-3 font-bold text-navy-900">{term.term_key || "-"}</div>
                  <div className="whitespace-pre-wrap px-4 py-3 text-slate-700">{term.term_value || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-10 text-sm text-slate-800">
          <p className="font-semibold">For</p>
          <p className="mt-2 font-bold text-navy-900">{piCompanyName}</p>
          <div className="h-[52mm]" aria-hidden="true" />
          <p className="font-semibold">Yours Faithfully,</p>
          <p className="mt-2 font-bold text-navy-900">{piCreatorName(invoice)}</p>
          <p className="mt-1 font-semibold text-slate-700">{invoice.signature_designation || "-"}</p>
          <p className="mt-1 text-slate-600">{[invoice.signature_email, invoice.signature_mobile].filter(Boolean).join(" | ") || "-"}</p>
        </div>

        <div className="mt-10 grid gap-5 border-t border-border pt-5 text-xs text-slate-700 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            {piFixedFooter.registeredOffice.map((line) => <p key={line} className={line.endsWith(":") ? "font-bold text-navy-900" : ""}>{line}</p>)}
          </div>
          <div>
            <p className="mb-2 font-bold text-navy-900">BANK INFORMATION</p>
            <div className="grid gap-1 sm:grid-cols-[9rem_1fr]">
              {piFixedFooter.bank.map(([label, value]) => (
                <div key={label} className="contents">
                  <p className="font-bold text-slate-800">{label}</p>
                  <p>{value || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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

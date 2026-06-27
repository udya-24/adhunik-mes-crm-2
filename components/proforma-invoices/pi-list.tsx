"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, Download, Eye, FilePenLine, FilePlus2, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { deleteProformaInvoiceAction, duplicateProformaInvoiceAction } from "@/app/actions/proforma-invoices";
import { PiStatusBadge } from "@/components/proforma-invoices/pi-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { formatDate } from "@/lib/date";
import { exportProformaInvoiceDocx, exportProformaInvoicePdf } from "@/lib/proforma-document";
import type { ProformaInvoice, ProformaInvoiceStatus, Role } from "@/lib/types";

const pageSize = 10;
const statuses: Array<"ALL" | ProformaInvoiceStatus> = ["ALL", "DRAFT", "SENT", "APPROVED", "CANCELLED"];

export function PiList({ invoices, role, currentUserId }: { invoices: ProformaInvoice[]; role: Role; currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ProformaInvoiceStatus>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isMutating, startMutation] = useTransition();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesSearch = needle
        ? [invoice.pi_no, invoice.indentor_name, invoice.po_no, invoice.project, invoice.status, invoice.creator?.full_name, invoice.creator?.email].some((value) => String(value ?? "").toLowerCase().includes(needle))
        : true;
      const matchesStatus = status === "ALL" || invoice.status === status;
      const matchesFrom = !fromDate || invoice.pi_date >= fromDate;
      const matchesTo = !toDate || invoice.pi_date <= toDate;
      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }, [fromDate, invoices, search, status, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  async function runExport(type: "pdf" | "docx", invoice: ProformaInvoice) {
    setExporting(`${type}-${invoice.id}`);
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

  function duplicate(invoice: ProformaInvoice) {
    startMutation(async () => {
      setError("");
      try {
        const result = await duplicateProformaInvoiceAction(invoice.id);
        window.location.href = `/proforma-invoices/${result.id}/edit`;
      } catch (duplicateError) {
        setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate PI.");
      }
    });
  }

  function remove(invoice: ProformaInvoice) {
    if (!window.confirm(`Delete PI ${invoice.pi_no}? This cannot be undone.`)) return;
    startMutation(async () => {
      setError("");
      try {
        await deleteProformaInvoiceAction(invoice.id);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete PI.");
      }
    });
  }

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-64 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input className={`${inputClass} w-full pl-10`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search PI, company, PO, project..." />
        </label>
        <Link href="/proforma-invoices/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-navy-700">
          <FilePlus2 size={16} /> Create PI
        </Link>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] xl:grid-cols-[14rem_12rem_12rem_auto]">
          <select className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value as "ALL" | ProformaInvoiceStatus); setPage(1); }}>
            {statuses.map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}
          </select>
          <input type="date" className={inputClass} value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} aria-label="From date" />
          <input type="date" className={inputClass} value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} aria-label="To date" />
          <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
        </div>
      </Card>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <Card className="overflow-hidden p-0">
        <div className="table-scroll overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">PI No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">PO No.</th>
                <th className="px-4 py-3">PO Date</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((invoice) => {
                const canEdit = role !== "USER" || invoice.created_by === currentUserId;
                const canDelete = role !== "USER";
                return (
                  <tr key={invoice.id} className="border-t border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-navy-900">{invoice.pi_no}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(invoice.pi_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{invoice.indentor_name}</td>
                    <td className="px-4 py-3 text-slate-600">{invoice.po_no || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{invoice.po_date ? formatDate(invoice.po_date) : "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{invoice.creator?.full_name || invoice.creator?.email || "Unknown"}</td>
                    <td className="px-4 py-3"><PiStatusBadge status={invoice.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ActionLink href={`/proforma-invoices/${invoice.id}`} label="View"><Eye size={15} /></ActionLink>
                        {canEdit ? <ActionLink href={`/proforma-invoices/${invoice.id}/edit`} label="Edit"><FilePenLine size={15} /></ActionLink> : null}
                        <ActionButton label="Duplicate" onClick={() => duplicate(invoice)} disabled={isMutating}><Copy size={15} /></ActionButton>
                        <ActionButton label="Export PDF" onClick={() => runExport("pdf", invoice)} disabled={Boolean(exporting)}>
                          {exporting === `pdf-${invoice.id}` ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
                          PDF
                        </ActionButton>
                        <ActionButton label="Export DOCX" onClick={() => runExport("docx", invoice)} disabled={Boolean(exporting)}>
                          {exporting === `docx-${invoice.id}` ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
                          DOCX
                        </ActionButton>
                        {canDelete ? <ActionButton label="Delete" onClick={() => remove(invoice)} disabled={isMutating} danger><Trash2 size={15} /></ActionButton> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500">No proforma invoices found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-slate-600">
          <p>Showing {visible.length ? (Math.min(page, pageCount) - 1) * pageSize + 1 : 0}-{Math.min(Math.min(page, pageCount) * pageSize, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
            <span className="font-semibold text-navy-900">Page {Math.min(page, pageCount)} / {pageCount}</span>
            <Button type="button" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ActionLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <Link href={href} title={label} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-bold text-slate-700 hover:bg-slate-100">{children}</Link>;
}

function ActionButton({ label, danger, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return <button type="button" title={label} className={`inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-2 text-xs font-bold disabled:opacity-40 ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-border text-slate-700 hover:bg-slate-100"}`} {...props}>{children}</button>;
}

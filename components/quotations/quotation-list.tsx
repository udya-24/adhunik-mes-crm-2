"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Download, Eye, FilePenLine, FilePlus2, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { deleteQuotationAction } from "@/app/actions/quotations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { exportQuotationDocx, exportQuotationPdf, formatQuotationCurrency } from "@/lib/quotation-export";
import type { Quotation, Role } from "@/lib/types";

export function QuotationList({ quotations, role, currentUserId }: { quotations: Quotation[]; role: Role; currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isDeleting, startDelete] = useTransition();
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? quotations.filter((quotation) => [quotation.quotation_no, quotation.customer_name, quotation.contract_name, quotation.status].some((value) => String(value ?? "").toLowerCase().includes(needle)))
      : quotations;
  }, [quotations, search]);

  async function runExport(type: "pdf" | "docx", quotation: Quotation) {
    setExporting(`${type}-${quotation.id}`);
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

  function remove(quotation: Quotation) {
    if (!window.confirm(`Delete quotation ${quotation.quotation_no}? This cannot be undone.`)) return;
    startDelete(async () => {
      try {
        await deleteQuotationAction(quotation.id);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete quotation.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-64 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input className={`${inputClass} w-full pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotation, company, contract..." />
        </label>
        <Link href="/quotations/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-navy-700">
          <FilePlus2 size={16} /> Create Quotation
        </Link>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <Card className="overflow-hidden p-0">
        <div className="table-scroll overflow-x-auto">
          <table className="min-w-[1050px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Quotation No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Contract Name</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Grand Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quotation) => {
                const canEdit = role !== "USER" || quotation.created_by === currentUserId;
                return (
                  <tr key={quotation.id} className="border-t border-border hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-navy-900">{quotation.quotation_no}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(quotation.quotation_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{quotation.customer_name}</td>
                    <td className="px-4 py-3 text-slate-600">{quotation.contract_name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{quotation.creator?.full_name || quotation.creator?.email || "Unknown"}</td>
                    <td className="px-4 py-3"><StatusBadge status={quotation.status} /></td>
                    <td className="px-4 py-3 text-right font-bold text-navy-900">{formatQuotationCurrency(quotation.grand_total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <ActionLink href={`/quotations/${quotation.id}`} label="View"><Eye size={15} /></ActionLink>
                        {canEdit ? <ActionLink href={`/quotations/${quotation.id}/edit`} label="Edit"><FilePenLine size={15} /></ActionLink> : null}
                        <ActionButton label="Export PDF" onClick={() => runExport("pdf", quotation)} disabled={Boolean(exporting)}>
                          {exporting === `pdf-${quotation.id}` ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
                          PDF
                        </ActionButton>
                        <ActionButton label="Export DOCX" onClick={() => runExport("docx", quotation)} disabled={Boolean(exporting)}>
                          {exporting === `docx-${quotation.id}` ? <Loader2 className="animate-spin" size={15} /> : <FileText size={15} />}
                          DOCX
                        </ActionButton>
                        {role === "ADMIN" ? <ActionButton label="Delete" onClick={() => remove(quotation)} disabled={isDeleting} danger><Trash2 size={15} /></ActionButton> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500">No quotations found.</td></tr>
              ) : null}
            </tbody>
          </table>
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

export function StatusBadge({ status }: { status: Quotation["status"] }) {
  const tone = status === "ACCEPTED" ? "green" : status === "REJECTED" ? "red" : status === "SENT" ? "blue" : "slate";
  return <Badge tone={tone}>{status}</Badge>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

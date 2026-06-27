"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { Download, Eye, FileSpreadsheet, Pencil, Plus, Power, Search, Trash2, Upload } from "lucide-react";
import { analyzeImsImportAction, importImsItemsAction, saveImsItemAction, setImsItemActiveAction, type ImsImportOption, type ImsImportRow } from "@/app/actions/ims";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { formatDateTime } from "@/lib/date";
import type { ImsImportHistory, ImsMasterItem, Role } from "@/lib/types";

const importColumns = [
  "item_code",
  "item_category",
  "item_description",
  "make",
  "model",
  "unit",
  "hsn_code",
  "remarks"
] as const;

const headerAliases: Record<string, keyof ImsImportRow> = {
  "item code": "item_code",
  "item category": "item_category",
  category: "item_category",
  "item description": "item_description",
  description: "item_description",
  make: "make",
  model: "model",
  unit: "unit",
  "hsn code": "hsn_code",
  hsn: "hsn_code",
  remarks: "remarks"
};

export function ImsMasterClient({
  items,
  total,
  page,
  pageSize,
  categories,
  history,
  role
}: {
  items: ImsMasterItem[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  history: ImsImportHistory[];
  role: Role;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = role === "ADMIN";
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Partial<ImsMasterItem> | null>(null);
  const [message, setMessage] = useState("");
  const [draftRows, setDraftRows] = useState<ImsImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState(1);
  const [option, setOption] = useState<ImsImportOption>("skip");
  const [analysis, setAnalysis] = useState<{ validRows: number; invalidRows: number; fileDuplicates: number; existingDuplicates: number } | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const currentQuery = useMemo(() => ({
    search: searchParams.get("search") ?? "",
    category: searchParams.get("category") ?? "",
    status: searchParams.get("status") ?? "active",
    sort: searchParams.get("sort") ?? "updated_at:desc"
  }), [searchParams]);

  function updateQuery(patch: Record<string, string | number>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value === 0) next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch)) next.set("page", "1");
    router.push(`/ims-master?${next.toString()}`);
  }

  async function saveItem(formData: FormData) {
    setMessage("");
    try {
      await saveImsItemAction({
        id: editing?.id,
        item_code: formText(formData, "item_code"),
        item_category: formText(formData, "item_category"),
        item_description: formText(formData, "item_description"),
        make: formText(formData, "make"),
        model: formText(formData, "model"),
        unit: formText(formData, "unit"),
        hsn_code: formText(formData, "hsn_code"),
        remarks: formText(formData, "remarks"),
        is_active: formData.get("is_active") === "on"
      });
      setEditing(null);
      setMessage("IMS item saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save IMS item.");
    }
  }

  async function parseFile(file: File) {
    setFileName(file.name);
    setMessage("");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    setDraftRows(rawRows.map(mapImportRow));
    setAnalysis(null);
    setStep(2);
  }

  async function validateImport() {
    const result = await analyzeImsImportAction(draftRows);
    setAnalysis(result);
    setStep(4);
  }

  async function importRows() {
    const result = await importImsItemsAction(draftRows, fileName, option);
    setMessage(`Imported ${result.rowsImported}, updated ${result.rowsUpdated}, skipped ${result.rowsSkipped}.`);
    setDraftRows([]);
    setAnalysis(null);
    setFileName("");
    setStep(1);
    router.refresh();
  }

  function exportRows(format: "csv" | "xlsx") {
    const rows = items.map(({ item_code, item_category, item_description, make, model, unit, hsn_code, remarks, is_active }) => ({
      "Item Code": item_code ?? "",
      Category: item_category,
      "Item Description": item_description,
      Make: make ?? "",
      Model: model ?? "",
      Unit: unit ?? "",
      HSN: hsn_code ?? "",
      Remarks: remarks ?? "",
      Status: is_active ? "Active" : "Inactive"
    }));
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
      download(new Blob([csv], { type: "text/csv;charset=utf-8" }), "ims-master.csv");
      return;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "IMS Master");
    XLSX.writeFile(workbook, "ims-master.xlsx");
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-lg border border-navy-100 bg-navy-50 p-3 text-sm font-semibold text-navy-900">{message}</div> : null}

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_12rem_13rem_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input className={`${inputClass} pl-10`} defaultValue={currentQuery.search} placeholder="Search description, category, make, model" onChange={(event) => updateQuery({ search: event.target.value })} />
          </label>
          <select className={inputClass} value={currentQuery.category} onChange={(event) => updateQuery({ category: event.target.value })}>
            <option value="">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className={inputClass} value={currentQuery.status} onChange={(event) => updateQuery({ status: event.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All status</option>
          </select>
          <select className={inputClass} value={currentQuery.sort} onChange={(event) => updateQuery({ sort: event.target.value })}>
            <option value="updated_at:desc">Recently updated</option>
            <option value="item_category:asc">Category A-Z</option>
            <option value="item_description:asc">Description A-Z</option>
            <option value="make:asc">Make A-Z</option>
          </select>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="w-10 px-0" onClick={() => exportRows("csv")} title="Export CSV" aria-label="Export CSV"><Download size={16} /></Button>
            <Button type="button" variant="secondary" className="w-10 px-0" onClick={() => exportRows("xlsx")} title="Export Excel" aria-label="Export Excel"><FileSpreadsheet size={16} /></Button>
            {isAdmin ? <Button type="button" className="w-10 px-0" onClick={() => setEditing({ is_active: true })} title="Add IMS item" aria-label="Add IMS item"><Plus size={16} /></Button> : null}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Item Code", "Category", "Item Description", "Make", "Model", "Unit", "HSN", "Status", "Actions"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-semibold text-navy-900">{item.item_code || "-"}</td>
                  <td className="px-4 py-3">{item.item_category}</td>
                  <td className="max-w-xl px-4 py-3">{item.item_description}</td>
                  <td className="px-4 py-3">{item.make || "-"}</td>
                  <td className="px-4 py-3">{item.model || "-"}</td>
                  <td className="px-4 py-3">{item.unit || "-"}</td>
                  <td className="px-4 py-3">{item.hsn_code || "-"}</td>
                  <td className="px-4 py-3"><Badge tone={item.is_active ? "green" : "slate"}>{item.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <IconAction label="View" onClick={() => setEditing(item)}><Eye size={15} /></IconAction>
                      {isAdmin ? <IconAction label="Edit" onClick={() => setEditing(item)}><Pencil size={15} /></IconAction> : null}
                      {isAdmin ? <IconAction label={item.is_active ? "Deactivate" : "Activate"} onClick={() => startTransition(async () => { await setImsItemActiveAction(item.id, !item.is_active); router.refresh(); })}><Power size={15} /></IconAction> : null}
                      {isAdmin ? <IconAction label="Soft delete" danger onClick={() => startTransition(async () => { await setImsItemActiveAction(item.id, false); router.refresh(); })}><Trash2 size={15} /></IconAction> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>No IMS items found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-600">{total} items</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })}>Previous</Button>
            <span className="font-semibold text-navy-900">Page {page} of {totalPages}</span>
            <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => updateQuery({ page: page + 1 })}>Next</Button>
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy-50 text-navy-700"><Upload size={18} /></span>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Import Wizard</h2>
              <p className="text-sm text-slate-500">Upload, preview, map, validate, and import XLSX or CSV files.</p>
            </div>
          </div>
          <div className="mb-4 grid gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-5">
            {["Upload", "Preview", "Map Columns", "Validate", "Import"].map((label, index) => (
              <span key={label} className={`rounded-lg border px-3 py-2 ${step >= index + 1 ? "border-navy-200 bg-navy-50 text-navy-900" : "border-border bg-white"}`}>{index + 1}. {label}</span>
            ))}
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-navy-200 bg-navy-50 p-5 text-center hover:bg-white">
            <Upload className="mb-2 text-navy-700" />
            <span className="text-sm font-semibold text-navy-900">{fileName || "Upload IMS master file"}</span>
            <span className="text-xs text-slate-500">.xlsx or .csv</span>
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => event.target.files?.[0] && parseFile(event.target.files[0])} />
          </label>
          {draftRows.length ? (
            <div className="mt-4 space-y-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-[900px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr>{importColumns.map((key) => <th key={key} className="px-3 py-2">{key}</th>)}</tr></thead>
                  <tbody>
                    {draftRows.slice(0, 8).map((row, index) => (
                      <tr key={index} className="border-t border-border">{importColumns.map((key) => <td key={key} className="px-3 py-2">{String(row[key] ?? "")}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:grid-cols-[15rem_1fr_auto]">
                <select className={inputClass} value={option} onChange={(event) => setOption(event.target.value as ImsImportOption)}>
                  <option value="skip">Skip Existing</option>
                  <option value="update">Update Existing</option>
                  <option value="replace">Replace Existing</option>
                </select>
                <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {analysis ? `${analysis.validRows} valid, ${analysis.invalidRows} invalid, ${analysis.fileDuplicates} file duplicates, ${analysis.existingDuplicates} existing duplicates.` : "Validate to calculate duplicates before import."}
                </div>
                {analysis ? <Button type="button" onClick={importRows} disabled={isPending}>Import</Button> : <Button type="button" onClick={validateImport}>Validate</Button>}
              </div>
            </div>
          ) : null}
          <h3 className="mt-6 font-bold text-navy-900">Import History</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-navy-900">{item.file_name}</p>
                <p className="text-slate-500">{item.rows_imported} imported, {item.rows_updated} updated, {item.rows_skipped} skipped</p>
                <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {editing ? <ImsForm item={editing} readOnly={!isAdmin} onClose={() => setEditing(null)} onSave={saveItem} /> : null}
    </div>
  );
}

function ImsForm({ item, readOnly, onClose, onSave }: { item: Partial<ImsMasterItem>; readOnly: boolean; onClose: () => void; onSave: (formData: FormData) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-3 sm:p-6" onMouseDown={onClose}>
      <form action={onSave} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-lift" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-navy-900">{item.id ? "IMS Item" : "New IMS Item"}</h2>
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
        <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
          <Field label="Item Code"><input name="item_code" className={inputClass} defaultValue={item.item_code ?? ""} /></Field>
          <Field label="Item Category"><input name="item_category" className={inputClass} defaultValue={item.item_category ?? ""} required /></Field>
          <div className="md:col-span-2"><Field label="Item Description"><textarea name="item_description" className={`${inputClass} min-h-24 py-2`} defaultValue={item.item_description ?? ""} required /></Field></div>
          <Field label="Make"><input name="make" className={inputClass} defaultValue={item.make ?? ""} /></Field>
          <Field label="Model"><input name="model" className={inputClass} defaultValue={item.model ?? ""} /></Field>
          <Field label="Unit"><input name="unit" className={inputClass} defaultValue={item.unit ?? ""} /></Field>
          <Field label="HSN Code"><input name="hsn_code" className={inputClass} defaultValue={item.hsn_code ?? ""} /></Field>
          <div className="md:col-span-2"><Field label="Remarks"><textarea name="remarks" className={`${inputClass} min-h-20 py-2`} defaultValue={item.remarks ?? ""} /></Field></div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900"><input type="checkbox" name="is_active" defaultChecked={item.is_active !== false} /> Active</label>
        </fieldset>
        {!readOnly ? <div className="mt-5 flex justify-end"><Button type="submit">Save IMS Item</Button></div> : null}
      </form>
    </div>
  );
}

function IconAction({ children, label, danger, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-lg border bg-white ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-border text-slate-600 hover:bg-slate-100"}`} {...props}>{children}</button>;
}

function mapImportRow(row: Record<string, unknown>) {
  const mapped: ImsImportRow = {};
  for (const [key, value] of Object.entries(row)) {
    const target = headerAliases[key.trim().toLowerCase()];
    if (target) mapped[target] = value;
  }
  return mapped;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

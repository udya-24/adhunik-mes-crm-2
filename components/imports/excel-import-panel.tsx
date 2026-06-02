"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload } from "lucide-react";
import { bulkImportTendersAction } from "@/app/actions/tenders";
import { DateTime } from "@/components/common/date-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, normalizeDateFields } from "@/lib/date-utils";

const columnMap: Record<string, string> = {
  "Tender ID": "tender_id",
  "Organisation Chain": "organisation_chain",
  GE: "ge",
  CWE: "cwe",
  "Tender Ref No": "tender_ref_no",
  "Tender Title": "tender_title",
  "Contract Date": "contract_date",
  "Bid Number": "bid_number",
  "Bidder Name": "bidder_name",
  Currency: "currency",
  "Awarded Value": "awarded_value",
  "Contact Number 1": "contact_number_1",
  "Contact Number 2": "contact_number_2",
  "Contact Number 3": "contact_number_3",
  Address: "address",
  Make: "make",
  Email: "email",
  "BOQ Attachment": "boq_attachment_url",
  "AOC Attachment": "aoc_attachment_url",
  "Tender Document Attachment": "tender_document_url",
  "Our Value (Adhunik)": "our_value"
};

export function ExcelImportPanel({ history }: { history: any[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");

  async function parseFile(file: File) {
    setFileName(file.name);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    setRows(
      rawRows.map((row) =>
        normalizeDateFields(Object.fromEntries(Object.entries(row).map(([key, value]) => [columnMap[key] ?? key, value])))
      )
    );
  }

  async function importRows() {
    const result = await bulkImportTendersAction(rows, fileName);
    setMessage(result?.error ?? `Imported ${result?.imported ?? 0} rows, skipped ${result?.duplicates ?? 0} duplicates.`);
  }

  return (
    <Card>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-50 text-navy-700"><FileSpreadsheet size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-navy-900">Excel Import</h1>
          <p className="text-sm text-slate-600">Supports XLSX, XLS, and CSV with preview, duplicate detection, and upload history.</p>
        </div>
      </div>
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-navy-50 p-6 text-center transition hover:bg-white">
        <Upload className="mb-2 text-navy-700" />
        <span className="text-sm font-semibold text-navy-900">Upload tender data</span>
        <span className="text-xs text-slate-500">XLSX, XLS, CSV</span>
        <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && parseFile(event.target.files[0])} />
      </label>
      {rows.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{rows.length} rows ready for preview</p>
            <Button onClick={importRows}>Import Valid Rows</Button>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>{Object.keys(rows[0]).slice(0, 8).map((key) => <th className="px-3 py-2" key={key}>{key}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {Object.keys(rows[0]).slice(0, 8).map((key) => (
                      <td className="px-3 py-2" key={key}>{formatPreviewValue(key, row[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {message && <p className="mt-3 rounded-xl bg-navy-50 p-3 text-sm font-semibold text-navy-900">{message}</p>}
      <h2 className="mt-8 font-bold text-navy-900">Upload History</h2>
      <div className="mt-3 space-y-2">
        {history.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
            <p className="font-semibold">{item.file_name}</p>
            <p className="text-slate-500">{item.imported_rows}/{item.total_rows} imported, {item.duplicate_rows} duplicates</p>
            <p className="text-slate-500">Uploaded <DateTime value={item.created_at} /></p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatPreviewValue(key: string, value: unknown) {
  if (key === "contract_date") return formatDate(typeof value === "string" ? value : undefined);
  return String(value ?? "");
}

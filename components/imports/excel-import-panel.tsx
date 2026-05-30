"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload } from "lucide-react";
import { bulkImportTendersAction } from "@/app/actions/tenders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
        Object.fromEntries(Object.entries(row).map(([key, value]) => [columnMap[key] ?? key, value]))
      )
    );
  }

  async function importRows() {
    const result = await bulkImportTendersAction(rows, fileName);
    setMessage(result?.error ?? `Imported ${result?.imported ?? 0} rows, skipped ${result?.duplicates ?? 0} duplicates.`);
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-navy-900">Excel Import</h1>
      <p className="mb-5 text-sm text-slate-600">Supports XLSX, XLS, and CSV with preview, duplicate detection, and upload history.</p>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 p-6 text-center">
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
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>{Object.keys(rows[0]).slice(0, 8).map((key) => <th className="px-3 py-2" key={key}>{key}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {Object.keys(rows[0]).slice(0, 8).map((key) => <td className="px-3 py-2" key={key}>{String(row[key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {message && <p className="mt-3 rounded-md bg-navy-50 p-3 text-sm text-navy-900">{message}</p>}
      <h2 className="mt-8 font-bold text-navy-900">Upload History</h2>
      <div className="mt-3 space-y-2">
        {history.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3 text-sm">
            <p className="font-semibold">{item.file_name}</p>
            <p className="text-slate-500">{item.imported_rows}/{item.total_rows} imported, {item.duplicate_rows} duplicates</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

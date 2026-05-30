"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, FileUp, Loader2, Search, Send } from "lucide-react";
import { assignLeadAction, updateLeadStatusAction } from "@/app/actions/tenders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { useTenders } from "@/hooks/use-tenders";
import { leadStatuses } from "@/lib/constants";
import type { Profile, Tender } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function TenderDataGrid({ users, canAssign }: { users: Profile[]; canAssign: boolean }) {
  const { data: tenders = [], error, isLoading, isFetching } = useTenders();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const tableColumnCount = canAssign ? 10 : 9;

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const filtered = useMemo(() => {
    return tenders.filter((tender) => {
      const haystack = [tender.tender_id, tender.ge, tender.cwe, tender.bidder_name].join(" ").toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [tenders, search]);

  function exportCsv() {
    const csv = [
      ["Tender ID", "GE", "CWE", "Bidder Name", "Awarded Value", "Assigned To", "Status", "Source Type"].join(","),
      ...filtered.map((tender) =>
        [tender.tender_id, tender.ge, tender.cwe, tender.bidder_name, tender.awarded_value, assignedToLabel(tender, userById), tender.lead_status, tender.source_type]
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "adhunik-tenders.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input className={`${inputClass} w-full pl-10`} placeholder="Search tender, GE, CWE, bidder" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={16} />
          Export
        </Button>
      </div>
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          Refreshing tenders...
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error instanceof Error ? error.message : "Tender records could not be loaded."}
        </div>
      )}
      {canAssign && <BulkAssign selected={selected} users={users} />}
      <div className="overflow-x-auto table-scroll">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {canAssign && (
                <th className="px-3 py-3">
                  <input type="checkbox" onChange={(event) => setSelected(event.target.checked ? filtered.map((tender) => tender.id) : [])} />
                </th>
              )}
              {["Tender ID", "GE", "CWE", "Bidder Name", "Awarded Value", "Assigned To", "Status", "Source Type", "Actions"].map((head) => (
                <th className="px-3 py-3" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-600" colSpan={tableColumnCount}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Loading tender records...
                  </span>
                </td>
              </tr>
            )}
            {!isLoading && !filtered.length && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-600" colSpan={tableColumnCount}>
                  No tender records found.
                </td>
              </tr>
            )}
            {filtered.map((tender) => (
              <tr key={tender.id} className="border-t border-border align-top">
                {canAssign && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(tender.id)}
                      onChange={(event) =>
                        setSelected((current) => (event.target.checked ? [...current, tender.id] : current.filter((id) => id !== tender.id)))
                      }
                    />
                  </td>
                )}
                <td className="px-3 py-3 font-semibold text-navy-900">{tender.tender_id}</td>
                <td className="px-3 py-3">{tender.ge || "-"}</td>
                <td className="px-3 py-3">{tender.cwe || "-"}</td>
                <td className="px-3 py-3">{tender.bidder_name || "-"}</td>
                <td className="px-3 py-3">{formatCurrency(tender.awarded_value)}</td>
                <td className="px-3 py-3">{assignedToLabel(tender, userById)}</td>
                <td className="px-3 py-3">
                  <StatusForm tender={tender} />
                </td>
                <td className="px-3 py-3">
                  <SourceTypeBadge sourceType={tender.source_type} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="h-8 px-2" title="View">
                      <Eye size={15} />
                    </Button>
                    {canAssign && <AssignForm tender={tender} users={users} />}
                    <Button variant="secondary" className="h-8 px-2" title="Upload files">
                      <FileUp size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function assignedToLabel(tender: Tender, userById: Map<string, Profile>) {
  if (tender.assigned_profile?.full_name) return tender.assigned_profile.full_name;
  if (!tender.assigned_to) return "Unassigned";
  const user = userById.get(tender.assigned_to);
  return user?.full_name || user?.email || tender.assigned_to;
}

function SourceTypeBadge({ sourceType }: { sourceType: Tender["source_type"] }) {
  const isManual = sourceType === "MANUAL_ENTRY";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        isManual ? "bg-amber-100 text-amber-800" : "bg-navy-50 text-navy-700"
      }`}
    >
      {sourceType}
    </span>
  );
}

function AssignForm({ tender, users }: { tender: Tender; users: Profile[] }) {
  return (
    <form action={assignLeadAction} className="flex gap-2">
      <input type="hidden" name="tenderId" value={tender.id} />
      <select name="assignedTo" required className="h-8 max-w-36 rounded-md border border-border px-2 text-xs">
        <option value="">User</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
        ))}
      </select>
      <input name="remarks" className="hidden" value="Assigned from tender grid" readOnly />
      <Button className="h-8 px-2" title="Assign">
        <Send size={15} />
      </Button>
    </form>
  );
}

function BulkAssign({ selected, users }: { selected: string[]; users: Profile[] }) {
  if (!selected.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
      {selected.length} selected. Bulk assignment is handled by submitting each selected lead with assignment history for auditability.
    </div>
  );
}

function StatusForm({ tender }: { tender: Tender }) {
  return (
    <form action={updateLeadStatusAction} className="flex gap-2">
      <input type="hidden" name="tenderId" value={tender.id} />
      <input type="hidden" name="notes" value="Status updated from tender grid" />
      <select name="status" defaultValue={tender.lead_status} className="h-8 rounded-md border border-border px-2 text-xs">
        {leadStatuses.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <Button variant="secondary" className="h-8 px-2" title="Update status">
        <CheckCircle2 size={15} />
      </Button>
    </form>
  );
}

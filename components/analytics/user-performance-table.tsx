"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { UserAnalyticsDrawer } from "@/components/analytics/user-analytics-drawer";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import type { Role, UserPerformanceRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type SortKey = "userName" | "role" | "assignedTenders" | "uploadedTenders" | "followUps" | "assignedOurValue" | "convertedTenders";
type SortDirection = "asc" | "desc";

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "userName", label: "User Name" },
  { key: "role", label: "Role" },
  { key: "assignedTenders", label: "Assigned Tenders", align: "right" },
  { key: "uploadedTenders", label: "Uploaded Tenders", align: "right" },
  { key: "followUps", label: "Follow-Ups", align: "right" },
  { key: "assignedOurValue", label: "Assigned Our Value", align: "right" },
  { key: "convertedTenders", label: "Converted Tenders", align: "right" }
];

export function UserPerformanceTable({
  rows,
  currentUserId,
  currentUserRole
}: {
  rows: UserPerformanceRow[];
  currentUserId: string | null;
  currentUserRole: Role | null;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("assignedTenders");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [analyticsUserId, setAnalyticsUserId] = useState<string | null>(null);
  const canOpenAll = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => roleFilter === "ALL" || row.role === roleFilter)
      .filter((row) => {
        if (!needle) return true;
        return [row.userName, row.email, row.role, row.managerName].some((value) => String(value ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => compareRows(a, b, sortKey, sortDirection));
  }, [rows, search, roleFilter, sortKey, sortDirection]);

  const selectedRow = analyticsUserId ? rows.find((row) => row.userId === analyticsUserId) ?? null : null;
  const selectedUser = selectedRow
    ? {
        id: selectedRow.userId,
        full_name: selectedRow.userName,
        email: selectedRow.email,
        role: selectedRow.role,
        manager_id: selectedRow.managerId,
        is_active: selectedRow.isActive,
        created_at: selectedRow.createdAt
      }
    : null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="space-y-4 px-5 pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Team Analytics</p>
            <h2 className="mt-1 font-bold text-navy-900">User Performance</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input className={`${inputClass} w-full pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, email, role, manager" />
            </label>
            <select className={inputClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "ALL")}>
              <option value="ALL">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="USER">User</option>
            </select>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto table-scroll">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={`px-3 py-3 ${column.align === "right" ? "text-right" : ""}`}>
                    <button type="button" className={`inline-flex items-center gap-1 font-bold ${column.align === "right" ? "justify-end" : ""}`} onClick={() => toggleSort(column.key)}>
                      {column.label}
                      <SortIcon active={sortKey === column.key} direction={sortDirection} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const canOpen = canOpenAll || row.userId === currentUserId;
                return (
                  <tr key={row.userId} className="border-t border-border hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold text-navy-900">
                      {canOpen ? (
                        <button type="button" className="text-left font-semibold text-navy-900 underline-offset-2 hover:underline" onClick={() => setAnalyticsUserId(row.userId)}>
                          {row.userName}
                        </button>
                      ) : (
                        row.userName
                      )}
                    </td>
                    <td className="px-3 py-3">{row.role}</td>
                    <td className="px-3 py-3 text-right">{row.assignedTenders}</td>
                    <td className="px-3 py-3 text-right">{row.uploadedTenders}</td>
                    <td className="px-3 py-3 text-right">{row.followUps}</td>
                    <td className="px-3 py-3 text-right font-semibold text-navy-900">{formatCurrency(row.assignedOurValue)}</td>
                    <td className="px-3 py-3 text-right">{row.convertedTenders}</td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                    No users match the current search and filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <UserAnalyticsDrawer
        user={selectedUser}
        canOpen={Boolean(selectedUser)}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => setAnalyticsUserId(null)}
      />
    </>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown size={14} className="text-slate-400" />;
  if (direction === "asc") return <ArrowUp size={14} className="text-navy-900" />;
  return <ArrowDown size={14} className="text-navy-900" />;
}

function compareRows(a: UserPerformanceRow, b: UserPerformanceRow, sortKey: SortKey, direction: SortDirection) {
  const modifier = direction === "asc" ? 1 : -1;
  const aValue = a[sortKey];
  const bValue = b[sortKey];

  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * modifier;
  }

  return String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, { numeric: true, sensitivity: "base" }) * modifier;
}

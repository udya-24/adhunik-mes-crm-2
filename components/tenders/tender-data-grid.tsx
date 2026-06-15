"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Eye, FileText, Loader2, Mail, MessageCircle, Pencil, Phone, Search, Send, Trash2, UploadCloud, UserRound, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addLeadRemarkAction, assignLeadAction, assignLeadToMeAction, bulkTenderAction, deleteTenderAction, getTenderHistoryAction, updateLeadStageAction, updateTenderAction } from "@/app/actions/tenders";
import { ContractDate } from "@/components/common/contract-date";
import { DateTime } from "@/components/common/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { useTenders } from "@/hooks/use-tenders";
import { sourceTypes } from "@/lib/constants";
import { formatDate } from "@/lib/date-utils";
import { invalidateTenderQueries } from "@/lib/queries/tenders";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog, LeadActivity, LeadAssignment, LeadRemark, LeadStatusHistory, LeadStatusMaster, Profile, Role, Tender, TenderFollowUp, TenderUpdateInput } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const stickyStatusHeaderClass = "sticky right-[340px] z-30 min-w-[7rem] bg-slate-50 px-2 py-2 font-bold";
const stickySourceHeaderClass = "sticky right-[200px] z-30 min-w-[140px] bg-slate-50 px-2 py-2 font-bold";
const stickyActionsHeaderClass = "sticky right-0 z-30 min-w-[200px] bg-slate-50 px-2 py-2 text-right font-bold";
const stickyStatusCellClass = "sticky right-[340px] z-20 min-w-[7rem] bg-white px-2 py-1.5 group-hover:bg-slate-50";
const stickySourceCellClass = "sticky right-[200px] z-20 min-w-[140px] bg-white px-2 py-1.5 group-hover:bg-slate-50";
const stickyActionsCellClass = "sticky right-0 z-20 min-w-[200px] bg-white px-2 py-1.5 text-right group-hover:bg-slate-50";

type AttachmentKey = "boq_attachment_url" | "aoc_attachment_url" | "tender_document_url";
type AttachmentNameKey = "boq_attachment_name" | "aoc_attachment_name" | "tender_document_attachment_name";
type AttachmentConfig = {
  key: AttachmentKey;
  nameKey: AttachmentNameKey;
  label: string;
  bucket: "boq" | "aoc" | "tender-documents";
};

const attachmentFields: AttachmentConfig[] = [
  { key: "boq_attachment_url", nameKey: "boq_attachment_name", label: "BOQ", bucket: "boq" },
  { key: "aoc_attachment_url", nameKey: "aoc_attachment_name", label: "AOC", bucket: "aoc" },
  { key: "tender_document_url", nameKey: "tender_document_attachment_name", label: "Tender Document", bucket: "tender-documents" }
];

const editTextFields = [
  ["organisation_chain", "Organisation Chain"],
  ["ge", "GE"],
  ["cwe", "CWE"],
  ["tender_ref_no", "Tender Ref No"],
  ["bid_number", "Bid Number"],
  ["bidder_name", "Bidder Name"],
  ["make", "Make"],
  ["email", "Email"],
  ["contact_number_1", "Contact Number 1"],
  ["contact_number_2", "Contact Number 2"],
  ["contact_number_3", "Contact Number 3"]
] as const;

type TenderDataGridProps = {
  users: Profile[];
  leadStatuses: LeadStatusMaster[];
  canAssign: boolean;
  canDelete: boolean;
  currentUserId: string | null;
  currentUserRole?: Role | null;
};

export function TenderDataGrid({
  users,
  leadStatuses,
  canAssign,
  canDelete,
  currentUserId,
  currentUserRole
}: TenderDataGridProps) {
  const queryClient = useQueryClient();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isBulkPending, startBulkTransition] = useTransition();
  const [search, setSearch] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("tender-search") ?? ""));
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [assignment, setAssignment] = useState("");
  const [page, setPage] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Number(localStorage.getItem("tender-page") ?? "1") || 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === "undefined") return 50;
    return Number(localStorage.getItem("tender-page-size") ?? "50") || 50;
  });
  const [openTender, setOpenTender] = useState<Tender | null>(null);
  const [editTarget, setEditTarget] = useState<Tender | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tender | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"assign" | "unassign" | "delete" | null>(null);
  const [bulkAssignedTo, setBulkAssignedTo] = useState("");
  const [bulkError, setBulkError] = useState("");
  const didMountFiltersRef = useRef(false);
  const { data: tenderPage = { rows: [], total: 0 }, error, isLoading, isFetching } = useTenders({ search, status, source, assignment, page, pageSize });
  const tenders = tenderPage.rows;
  const totalTenders = tenderPage.total;
  const totalPages = Math.max(1, Math.ceil(totalTenders / pageSize));
  const showingFrom = totalTenders ? (page - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(page * pageSize, totalTenders);
  const tableColumnCount = 14;
  const tableHeaders = [
    { label: "", className: "w-10 px-2 py-2" },
    { label: "Tender ID", className: "px-2 py-2 font-bold" },
    { label: "Tender Title", className: "px-2 py-2 font-bold" },
    { label: "GE", className: "px-2 py-2 font-bold" },
    { label: "CWE", className: "px-2 py-2 font-bold" },
    { label: "Bidder Name", className: "px-2 py-2 font-bold" },
    { label: "Contact", className: "px-2 py-2 font-bold" },
    { label: "Contract", className: "px-2 py-2 font-bold" },
    { label: "Awarded Value", className: "px-2 py-2 font-bold" },
    { label: "Our Value", className: "px-2 py-2 font-bold" },
    { label: "Assigned To", className: "px-2 py-2 font-bold" },
    { label: "Status", className: stickyStatusHeaderClass },
    { label: "Source", className: stickySourceHeaderClass },
    { label: "Actions", className: stickyActionsHeaderClass }
  ];

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const selectedTenders = useMemo(() => tenders.filter((tender) => selectedIds.includes(tender.id)), [selectedIds, tenders]);
  const allPageSelected = Boolean(tenders.length) && tenders.every((tender) => selectedIds.includes(tender.id));
  const visibleTenderIdKey = useMemo(() => tenders.map((tender) => tender.id).join("|"), [tenders]);

  useEffect(() => {
    localStorage.setItem("tender-search", search);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("tender-page", String(page));
  }, [page]);

  useEffect(() => {
    localStorage.setItem("tender-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (!didMountFiltersRef.current) {
      didMountFiltersRef.current = true;
      return;
    }
    setPage(1);
  }, [search, status, source, assignment, pageSize]);

  useEffect(() => {
    if (!isFetching && page > totalPages) setPage(totalPages);
  }, [isFetching, page, totalPages]);

  useEffect(() => {
    const visibleIds = new Set(visibleTenderIdKey ? visibleTenderIdKey.split("|") : []);

    setSelectedIds((current) => {
      const filtered = current.filter((id) => visibleIds.has(id));

      if (filtered.length === current.length && filtered.every((id, index) => id === current[index])) {
        return current;
      }

      return filtered;
    });
  }, [visibleTenderIdKey]);

  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  function exportCsv() {
    exportTenderCsv(tenders, userById, "adhunik-tenders.csv");
  }

  function exportSelectedCsv() {
    exportTenderCsv(selectedTenders, userById, "adhunik-selected-tenders.csv");
  }

  function toggleSelectAll() {
    setSelectedIds(allPageSelected ? [] : tenders.map((tender) => tender.id));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function handlePageClick(page: number) {
    setPage(page);
  }

  function runBulkAction() {
    if (!bulkAction) return;
    setBulkError("");
    startBulkTransition(async () => {
      try {
        await bulkTenderAction({ tenderIds: selectedIds, action: bulkAction, assignedTo: bulkAssignedTo || null });
        setBulkAction(null);
        setBulkAssignedTo("");
        setSelectedIds([]);
        await invalidateTenderQueries(queryClient);
      } catch (error) {
        setBulkError(error instanceof Error ? error.message : "Bulk operation failed.");
      }
    });
  }

  function exportTenderCsv(rows: Tender[], usersById: Map<string, Profile>, filename: string) {
    const csv = [
      [
        "Tender ID",
        "Organisation Chain",
        "GE",
        "CWE",
        "Tender Ref No",
        "Tender Title",
        "Contract Date",
        "Bid Number",
        "Bidder Name",
        "Contact Number 1",
        "Contact Number 2",
        "Contact Number 3",
        "Email",
        "Address",
        "Make",
        "Awarded Value",
        "Our Value",
        "Lead Stage",
        "Assigned To",
        "Assigned By",
        "Source Type",
        "Latest Remark",
        "Last Updated By",
        "Last Updated Date",
        "BOQ Attachment Name",
        "AOC Attachment Name",
        "Tender Document Attachment Name",
        "Created Date",
        "Updated Date",
        "Company Name",
        "Contact Person",
        "Mobile Number",
        "Contact Email",
        "Contact Address"
      ].join(","),
      ...rows.map((tender) =>
        [
          tender.tender_id,
          tender.organisation_chain,
          tender.ge,
          tender.cwe,
          tender.tender_ref_no,
          tender.tender_title,
          formatDate(tender.contract_date),
          tender.bid_number,
          tender.bidder_name,
          tender.contact_number_1,
          tender.contact_number_2,
          tender.contact_number_3,
          tender.email,
          tender.address,
          tender.make,
          formatCurrencyDisplay(tender.awarded_value),
          formatCurrencyDisplay(tender.our_value),
          leadStageLabel(tender),
          assignedToLabel(tender, usersById),
          tender.assigned_by_profile ? formatProfileDisplayName(tender.assigned_by_profile) : "",
          sourceTypeLabel(tender.source_type),
          tender.latest_remark,
          tender.last_updated_by_name,
          tender.last_activity_date,
          tender.boq_attachment_name,
          tender.aoc_attachment_name,
          tender.tender_document_attachment_name,
          tender.created_at,
          tender.updated_at,
          tender.bidder_name,
          tender.bidder_name,
          tender.contact_number_1,
          tender.email,
          tender.address
        ]
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    startDeleteTransition(async () => {
      try {
        await deleteTenderAction(deleteTarget.id);
        setDeleteTarget(null);
        setOpenTender((current) => (current?.id === deleteTarget.id ? null : current));
        await invalidateTenderQueries(queryClient);
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Tender could not be deleted.");
      }
    });
  }

  return (
    <>
    <Card className="space-y-4 overflow-hidden">
      <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_170px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input className={`${inputClass} w-full pl-10`} placeholder="Search tender, GE, CWE, bidder" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {leadStatuses.map((item) => <option key={item.id} value={leadStatusEnumFromName(item.status_name)}>{item.status_name}</option>)}
        </select>
        <select className={inputClass} value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">All sources</option>
          {sourceTypes.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={inputClass} value={assignment} onChange={(event) => setAssignment(event.target.value)}>
          <option value="">All assignments</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
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
      {canAssign && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-slate-50 p-3 text-sm">
          <span className="font-semibold text-navy-900">{selectedIds.length} selected</span>
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!selectedIds.length} onClick={() => setBulkAction("assign")}>Assign Selected</Button>
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!selectedIds.length} onClick={() => setBulkAction("unassign")}>Unassign Selected</Button>
          {canDelete && <Button variant="danger" className="h-8 px-3 text-xs" disabled={!selectedIds.length} onClick={() => setBulkAction("delete")}>Delete Selected</Button>}
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!selectedIds.length} onClick={exportSelectedCsv}>Export Selected</Button>
        </div>
      )}
      <div className="grid gap-3 md:hidden">
        {isLoading && (
          <div className="rounded-lg border border-border bg-slate-50 p-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading tender records...</span>
          </div>
        )}
        {!isLoading && !tenders.length && <div className="rounded-lg border border-border bg-slate-50 p-4 text-sm text-slate-600">No tender records found.</div>}
        {tenders.map((tender) => (
          <button
            key={tender.id}
            type="button"
            className="rounded-lg border border-border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
            onClick={() => setOpenTender(tender)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy-900">{tender.tender_id}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{tender.tender_title || "-"}</p>
              </div>
              <LeadStageBadge tender={tender} leadStatuses={leadStatuses} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <MobileTenderFact label="GE" value={tender.ge} />
              <MobileTenderFact label="CWE" value={tender.cwe} />
              <MobileTenderFact label="Awarded" value={formatCurrencyDisplay(tender.awarded_value)} />
              <MobileTenderFact label="Our Value" value={formatCurrencyDisplay(tender.our_value)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AssignmentBadge tender={tender} userById={userById} currentUserId={currentUserId} />
              <SourceTypeBadge sourceType={tender.source_type} />
            </div>
          </button>
        ))}
      </div>
      <div className="relative hidden w-full overflow-x-auto table-scroll md:block">
        <table className="w-full min-w-[2000px] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[40px]" />
            <col className="w-[8.5rem]" />
            <col className="w-[350px] min-w-[350px]" />
            <col className="w-[6.5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[220px] min-w-[220px]" />
            <col className="w-[180px] min-w-[180px]" />
            <col className="w-[6.5rem]" />
            <col className="w-[140px] min-w-[140px]" />
            <col className="w-[140px] min-w-[140px]" />
            <col className="w-[11rem]" />
            <col className="w-[7rem] min-w-[7rem]" />
            <col className="w-[140px] min-w-[140px]" />
            <col className="w-[200px] min-w-[200px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase text-slate-500 shadow-sm">
            <tr>
              {tableHeaders.map((head) => (
                <th className={head.className} key={head.label || "select"}>
                  {head.label ? head.label : <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} aria-label="Select all tenders on page" />}
                </th>
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
            {!isLoading && !tenders.length && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-600" colSpan={tableColumnCount}>
                  No tender records found.
                </td>
              </tr>
            )}
            {tenders.map((tender) => (
              <tr key={tender.id} className="group border-t border-border align-middle transition hover:bg-slate-50">
                <td className="px-2 py-1.5">
                  <input type="checkbox" checked={selectedIds.includes(tender.id)} onChange={() => toggleSelected(tender.id)} aria-label={`Select tender ${tender.tender_id}`} />
                </td>
                <td className="px-2 py-1.5 font-semibold text-navy-900" title={tender.tender_id}>
                  <span className="block truncate">{tender.tender_id}</span>
                </td>
                <td className="px-2 py-1.5" title={tender.tender_title || ""}>
                  <TwoLineText value={tender.tender_title} className="font-medium text-slate-800" />
                </td>
                <td className="px-2 py-1.5" title={tender.ge || ""}>
                  <TwoLineText value={tender.ge} />
                </td>
                <td className="px-2 py-1.5" title={tender.cwe || ""}>
                  <TwoLineText value={tender.cwe} />
                </td>
                <td className="px-2 py-1.5" title={tender.bidder_name || ""}>
                  <span className="block truncate font-semibold text-slate-900">{tender.bidder_name || "-"}</span>
                </td>
                <td className="px-2 py-1.5" title={[tender.contact_number_1, tender.email].filter(Boolean).join(" | ")}>
                  <ContactPreview tender={tender} />
                </td>
                <td className="px-2 py-1.5 text-slate-700" title={tender.contract_date || ""}><ContractDate tender={tender} /></td>
                <td className="px-2 py-1.5 font-semibold text-slate-900">{formatCurrencyDisplay(tender.awarded_value)}</td>
                <td className="px-2 py-1.5 font-semibold text-slate-900">{formatCurrencyDisplay(tender.our_value)}</td>
                <td className="px-2 py-1.5">
                  <AssignmentBadge tender={tender} userById={userById} currentUserId={currentUserId} />
                </td>
                <td className={stickyStatusCellClass}>
                  <LeadStageBadge tender={tender} leadStatuses={leadStatuses} />
                </td>
                <td className={stickySourceCellClass}>
                  <SourceTypeBadge sourceType={tender.source_type} />
                </td>
                <td className={stickyActionsCellClass}>
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <Button variant="secondary" className="h-7 w-7 rounded-md px-0" title="View details" onClick={() => setOpenTender(tender)}>
                      <Eye size={15} />
                    </Button>
                    {canEditTenderClient(tender, currentUserId, currentUserRole ?? null) && (
                      <Button variant="secondary" className="h-7 w-7 rounded-md px-0" title="Edit tender" onClick={() => setEditTarget(tender)}>
                        <Pencil size={14} />
                      </Button>
                    )}
                    {canAssign && (
                      <Button variant="secondary" className="h-7 w-7 rounded-md px-0" title="Assign lead" onClick={() => setOpenTender(tender)}>
                        <Send size={14} />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="danger" className="h-7 w-7 rounded-md px-0" title="Delete tender" onClick={() => setDeleteTarget(tender)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span>Showing {showingFrom}-{showingTo} of {totalTenders} tenders</span>
          <select className="h-9 rounded-md border border-border px-2 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="h-9" disabled={page <= 1} onClick={() => handlePageClick(page - 1)}>{"<< Previous"}</Button>
          {pageNumbers.map((pageNumber) => (
            <Button key={pageNumber} variant={pageNumber === page ? "primary" : "secondary"} className="h-9 min-w-9 px-3" disabled={pageNumber === page} onClick={() => handlePageClick(pageNumber)}>
              {pageNumber}
            </Button>
          ))}
          <Button variant="secondary" className="h-9" disabled={page >= totalPages} onClick={() => handlePageClick(page + 1)}>{"Next >>"}</Button>
        </div>
      </div>
    </Card>
    <ConfirmDeleteModal
      tender={deleteTarget}
      error={deleteError}
      isPending={isDeleting}
      onCancel={() => {
        if (!isDeleting) {
          setDeleteError("");
          setDeleteTarget(null);
        }
      }}
      onConfirm={confirmDelete}
    />
    <BulkActionModal
      action={bulkAction}
      count={selectedIds.length}
      users={users}
      assignedTo={bulkAssignedTo}
      error={bulkError}
      isPending={isBulkPending}
      onAssignedToChange={setBulkAssignedTo}
      onCancel={() => {
        if (!isBulkPending) {
          setBulkAction(null);
          setBulkError("");
        }
      }}
      onConfirm={runBulkAction}
    />
    <TenderEditModal
      tender={editTarget}
      users={users}
      canReassign={canAssign}
      onClose={() => setEditTarget(null)}
      onSaved={async (updatedTender) => {
        setEditTarget(null);
        setOpenTender((current) => (current?.id === updatedTender.id ? { ...current, ...updatedTender } : current));
        await invalidateTenderQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["tender-details"] });
      }}
    />
    <TenderDetailsDrawer
      tender={openTender}
      userById={userById}
      users={users}
      leadStatuses={leadStatuses}
      canAssign={canAssign}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole ?? null}
      onAssignedToCurrentUser={async () => {
        setOpenTender((current) => (current && currentUserId ? { ...current, assigned_to: currentUserId, assigned_by: currentUserId } : current));
        await invalidateTenderQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["tender-details"] });
      }}
      onClose={() => setOpenTender(null)}
    />
    </>
  );
}

function canEditTenderClient(tender: Tender, currentUserId: string | null, role: Role | null) {
  if (!currentUserId || !role) return false;
  return role === "ADMIN" || role === "MANAGER" || tender.uploaded_by === currentUserId || tender.assigned_to === currentUserId;
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ConfirmDeleteModal({
  tender,
  error,
  isPending,
  onCancel,
  onConfirm
}: {
  tender: Tender | null;
  error: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!tender) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-navy-900">Delete tender?</h2>
            <p className="mt-1 text-sm text-slate-600">
              This will move <span className="font-semibold text-slate-900">{tender.tender_id}</span> to Deleted Tenders. It can be restored by an admin.
            </p>
          </div>
        </div>
        {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function BulkActionModal({
  action,
  count,
  users,
  assignedTo,
  error,
  isPending,
  onAssignedToChange,
  onCancel,
  onConfirm
}: {
  action: "assign" | "unassign" | "delete" | null;
  count: number;
  users: Profile[];
  assignedTo: string;
  error: string;
  isPending: boolean;
  onAssignedToChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!action) return null;
  const title = action === "assign" ? "Assign selected tenders?" : action === "unassign" ? "Unassign selected tenders?" : "Delete selected tenders?";
  const requiresAssignee = action === "assign";

  return (
    <div className="fixed inset-0 z-[62] grid place-items-center bg-slate-950/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-navy-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">This operation will apply to {count} selected tender{count === 1 ? "" : "s"} and create audit history.</p>
          </div>
        </div>
        {requiresAssignee && (
          <Field label="Assign To">
            <select className={inputClass} value={assignedTo} onChange={(event) => onAssignedToChange(event.target.value)}>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{formatAssignableUserOption(user)}</option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button type="button" variant={action === "delete" ? "danger" : "primary"} onClick={onConfirm} disabled={isPending || (requiresAssignee && !assignedTo)}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

function TenderEditModal({
  tender,
  users,
  canReassign,
  onClose,
  onSaved
}: {
  tender: Tender | null;
  users: Profile[];
  canReassign: boolean;
  onClose: () => void;
  onSaved: (updatedTender: Tender) => Promise<void>;
}) {
  const [formState, setFormState] = useState<TenderUpdateInput | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Partial<Record<AttachmentKey, boolean>>>({});

  useEffect(() => {
    if (!tender) {
      setFormState(null);
      setError("");
      setUploading({});
      return;
    }

    setFormState({
      id: tender.id,
      tender_id: tender.tender_id,
      organisation_chain: tender.organisation_chain,
      ge: tender.ge,
      cwe: tender.cwe,
      tender_ref_no: tender.tender_ref_no,
      tender_title: tender.tender_title || "",
      contract_date: tender.contract_date,
      bid_number: tender.bid_number,
      bidder_name: tender.bidder_name,
      currency: tender.currency || "INR",
      awarded_value: tender.awarded_value,
      contact_number_1: tender.contact_number_1,
      contact_number_2: tender.contact_number_2,
      contact_number_3: tender.contact_number_3,
      address: tender.address,
      make: tender.make,
      email: tender.email,
      our_value: tender.our_value,
      boq_attachment_name: tender.boq_attachment_name,
      boq_attachment_url: tender.boq_attachment_url,
      aoc_attachment_name: tender.aoc_attachment_name,
      aoc_attachment_url: tender.aoc_attachment_url,
      tender_document_attachment_name: tender.tender_document_attachment_name,
      tender_document_url: tender.tender_document_url,
      assigned_to: tender.assigned_to
    });
    setError("");
  }, [tender]);

  if (!tender || !formState) return null;

  function setField<K extends keyof TenderUpdateInput>(key: K, value: TenderUpdateInput[K]) {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
  }

  async function uploadReplacement(config: AttachmentConfig, file: File) {
    const currentFormState = formState;
    if (!currentFormState) return;
    const supabase = createClient();
    const path = buildStoragePath(currentFormState.tender_id, file);
    setUploading((current) => ({ ...current, [config.key]: true }));

    const { error: uploadError } = await supabase.storage.from(config.bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    setUploading((current) => ({ ...current, [config.key]: false }));
    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
    setField(config.key, data.publicUrl);
    setField(config.nameKey, file.name);
  }

  async function handleFile(config: AttachmentConfig, file: File | null) {
    if (!file) return;
    setError("");
    try {
      await uploadReplacement(config, file);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Attachment could not be uploaded.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentFormState = formState;
    if (!currentFormState) return;
    setError("");
    setSaving(true);
    try {
      const result = await updateTenderAction(currentFormState);
      if (result.tender) {
        await onSaved(result.tender);
      } else {
        onClose();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Tender could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  const isBusy = saving || Object.values(uploading).some(Boolean);

  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/40 px-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-white p-5 shadow-lift">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Edit Tender</p>
            <h2 className="mt-1 text-xl font-bold text-navy-900">{tender.tender_id}</h2>
          </div>
          <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={onClose} disabled={isBusy} aria-label="Close edit modal">
            <X size={18} />
          </Button>
        </div>

        {error && <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Tender ID">
            <input required className={inputClass} value={formState.tender_id} onChange={(event) => setField("tender_id", event.target.value)} />
          </Field>
          <Field label="Tender Title">
            <input required className={inputClass} value={formState.tender_title} onChange={(event) => setField("tender_title", event.target.value)} />
          </Field>

          {editTextFields.map(([name, label]) => (
            <Field key={name} label={label}>
              <input
                type={name === "email" ? "email" : "text"}
                className={inputClass}
                value={(formState[name] as string | null) ?? ""}
                onChange={(event) => setField(name, event.target.value || null)}
              />
            </Field>
          ))}

          <Field label="Contract Date">
            <input type="date" className={inputClass} value={formState.contract_date ?? ""} onChange={(event) => setField("contract_date", event.target.value || null)} />
          </Field>
          <Field label="Currency">
            <input className={inputClass} value={formState.currency ?? "INR"} onChange={(event) => setField("currency", event.target.value || "INR")} />
          </Field>
          <Field label="Awarded Value">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={formState.awarded_value ?? ""}
              onChange={(event) => setField("awarded_value", event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
          <Field label="Our Value">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={formState.our_value ?? ""}
              onChange={(event) => setField("our_value", event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
          {canReassign && (
            <Field label="Assigned To">
              <select className={inputClass} value={formState.assigned_to ?? ""} onChange={(event) => setField("assigned_to", event.target.value || null)}>
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{formatAssignableUserOption(user)}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Address">
            <textarea className={`${inputClass} h-24 py-2`} value={formState.address ?? ""} onChange={(event) => setField("address", event.target.value || null)} />
          </Field>

          <div className="grid gap-3 sm:col-span-2 lg:grid-cols-3">
            {attachmentFields.map((config) => {
              const url = formState[config.key];
              const filename = formState[config.nameKey] || attachmentNameFromUrl(url);
              return (
                <div key={config.key} className="rounded-lg border border-border bg-slate-50 p-3">
                  <p className="text-sm font-bold text-navy-900">{config.label}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{filename || "No file uploaded"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {url && (
                      <a href={url} target="_blank" className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-navy-900 hover:bg-navy-50">
                        <Download size={14} />
                        Download
                      </a>
                    )}
                    <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-navy-900 hover:bg-navy-50">
                      {uploading[config.key] ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      Replace
                      <input type="file" accept=".pdf,.docx,.xlsx,.xls,.zip" className="hidden" onChange={(event) => handleFile(config, event.target.files?.[0] ?? null)} />
                    </label>
                    {url && (
                      <Button
                        type="button"
                        variant="danger"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          setField(config.key, null);
                          setField(config.nameKey, null);
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>Cancel</Button>
            <Button disabled={isBusy}>
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TwoLineText({ value, className = "" }: { value?: string | null; className?: string }) {
  return (
    <span
      className={`block overflow-hidden leading-4 text-slate-700 ${className}`}
      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
    >
      {value || "-"}
    </span>
  );
}

function MobileTenderFact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-2 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function ContactPreview({ tender }: { tender: Tender }) {
  const phone = tender.contact_number_1 || tender.contact_number_2 || tender.contact_number_3;
  if (!phone && !tender.email) return <span className="text-slate-400">-</span>;

  return (
    <div className="space-y-0.5 text-[11px] leading-4 text-slate-600">
      {phone && <ContactActions phone={phone} compact />}
      {tender.email && <span className="flex min-w-0 items-center gap-1 truncate"><Mail size={11} /> {tender.email}</span>}
    </div>
  );
}

function ContactActions({ phone, compact = false }: { phone: string; compact?: boolean }) {
  const hrefPhone = normalizeIndiaPhone(phone);
  if (!hrefPhone) return <span className="flex min-w-0 items-center gap-1 truncate"><Phone size={11} /> {phone}</span>;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <a className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md bg-navy-50 text-navy-700 hover:bg-navy-100" href={`tel:${hrefPhone}`} onClick={(event) => event.stopPropagation()} title={`Call ${phone}`}>
        <Phone size={compact ? 12 : 15} />
      </a>
      <a className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100" href={`https://wa.me/${hrefPhone.replace("+", "")}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={`WhatsApp ${phone}`}>
        <MessageCircle size={compact ? 12 : 15} />
      </a>
      <span className="min-w-0 truncate">{phone}</span>
    </span>
  );
}

function normalizeIndiaPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return "";
}

function assignedToLabel(tender: Tender, userById: Map<string, Profile>) {
  if (tender.assigned_profile) return formatProfileDisplayName(tender.assigned_profile);
  if (!tender.assigned_to) return "Unassigned";
  const user = userById.get(tender.assigned_to);
  return formatProfileDisplayName(user);
}

function formatAssignableUserOption(user: Profile) {
  return `${formatProfileDisplayName(user)} (${user.role})`;
}

function formatCurrencyDisplay(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return formatCurrency(value);
}

function buildStoragePath(tenderId: string, file: File) {
  const safeTenderId = tenderId.replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeName = file.name.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return `${safeTenderId}/${Date.now()}-${safeName}`;
}

function attachmentNameFromUrl(url?: string | null) {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() ?? "");
  } catch {
    return url.split("/").pop() ?? "";
  }
}

function sourceTypeLabel(sourceType: Tender["source_type"]) {
  return sourceType === "MANUAL_ENTRY" ? "Manual" : "Excel";
}

function SourceTypeBadge({ sourceType }: { sourceType: Tender["source_type"] }) {
  return (
    <Badge
      className={
        sourceType === "MANUAL_ENTRY"
          ? "min-w-[110px] justify-center whitespace-nowrap bg-[#FFF7E6] text-[#D97706] ring-[#FDE7BF]"
          : "min-w-[110px] justify-center whitespace-nowrap bg-[#EFF6FF] text-[#2563EB] ring-[#BFDBFE]"
      }
    >
      {sourceTypeLabel(sourceType)}
    </Badge>
  );
}

function AssignmentBadge({ tender, userById, currentUserId }: { tender: Tender; userById: Map<string, Profile>; currentUserId: string | null }) {
  if (!tender.assigned_to) return <Badge tone="orange">Unassigned</Badge>;
  return (
    <Badge tone={currentUserId && tender.assigned_to === currentUserId ? "blue" : "green"} className="max-w-full whitespace-normal text-left leading-4">
      {assignedToLabel(tender, userById)}
    </Badge>
  );
}

function AssignForm({ tender, users }: { tender: Tender; users: Profile[] }) {
  return (
    <form action={assignLeadAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="tenderId" value={tender.id} />
      <select name="assignedTo" required className="h-11 rounded-md border border-border px-2 text-sm sm:h-8 sm:max-w-36 sm:text-xs">
        <option value="">User</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{formatAssignableUserOption(user)}</option>
        ))}
      </select>
      <input name="remarks" className="hidden" value="Assigned from tender grid" readOnly />
      <Button className="h-11 px-3 sm:h-8 sm:px-2" title="Assign">
        <Send size={15} />
      </Button>
    </form>
  );
}

function AssignToMeButton({
  tender,
  currentUserId,
  currentUserRole,
  onAssigned
}: {
  tender: Tender;
  currentUserId: string | null;
  currentUserRole: Role | null;
  onAssigned: () => Promise<void> | void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canSelfAssign = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";
  const assignedToMe = Boolean(currentUserId && tender.assigned_to === currentUserId);
  if (!canSelfAssign || !currentUserId) return null;

  function assignToMe() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await assignLeadToMeAction(tender.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(result?.message ?? "Tender assigned to you successfully.");
      if (!result?.alreadyAssigned) await onAssigned();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-navy-900">{assignedToMe ? "Currently assigned to you" : "Assign this tender to yourself"}</p>
          <p className="text-xs text-slate-500">Available for admins and managers.</p>
        </div>
        <Button type="button" variant="secondary" disabled={assignedToMe || isPending} onClick={assignToMe}>
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />}
          Assign To Me
        </Button>
      </div>
      {message && <p className="mt-2 text-sm font-semibold text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function TenderDetailsDrawer({
  tender,
  userById,
  users,
  leadStatuses,
  canAssign,
  currentUserId,
  currentUserRole,
  onAssignedToCurrentUser,
  onClose
}: {
  tender: Tender | null;
  userById: Map<string, Profile>;
  users: Profile[];
  leadStatuses: LeadStatusMaster[];
  canAssign: boolean;
  currentUserId: string | null;
  currentUserRole: Role | null;
  onAssignedToCurrentUser: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { data: details = emptyTenderDetails, isLoading } = useTenderDetails(tender?.id);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  useEffect(() => {
    if (tender) setActiveTab("details");
  }, [tender?.id]);

  return (
    <div className={`fixed inset-0 z-50 ${tender ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!tender}>
      <div className={`absolute inset-0 bg-slate-950/30 transition-opacity ${tender ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 h-full w-full overflow-y-auto bg-white shadow-lift transition-transform duration-300 md:left-auto md:max-w-2xl md:border-l md:border-border ${
          tender ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {tender && (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-border bg-white/95 px-4 pb-4 pt-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Tender Details</p>
                <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">{tender.tender_title || tender.tender_id}</h2>
                <p className="mt-1 text-sm text-slate-600">{tender.organisation_chain || "Organisation not specified"}</p>
              </div>
              <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={onClose} aria-label="Close drawer">
                <X size={18} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <LeadStageBadge tender={tender} leadStatuses={leadStatuses} />
              <SourceTypeBadge sourceType={tender.source_type} />
              <AssignmentBadge tender={tender} userById={userById} currentUserId={currentUserId} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Awarded Value" value={formatCurrency(tender.awarded_value)} />
              <MetricTile label="Our Value" value={formatCurrency(tender.our_value)} />
              <MetricTile label="Contract Date" value={<ContractDate tender={tender} />} />
            </div>

            <div className="flex gap-2">
              <button className={`px-3 py-2 text-sm font-bold ${activeTab === "details" ? "border-b-2 border-navy-900 text-navy-900" : "text-slate-500"}`} onClick={() => setActiveTab("details")}>
                Details
              </button>
              <button className={`px-3 py-2 text-sm font-bold ${activeTab === "history" ? "border-b-2 border-navy-900 text-navy-900" : "text-slate-500"}`} onClick={() => setActiveTab("history")}>
                Tender History
              </button>
            </div>
            </div>

            {activeTab === "details" ? (
              <>
                {canAssign && (
                  <Section title="Assignment Controls">
                    <AssignToMeButton tender={tender} currentUserId={currentUserId} currentUserRole={currentUserRole} onAssigned={onAssignedToCurrentUser} />
                    <AssignForm tender={tender} users={users} />
                  </Section>
                )}

                <Section title="Lead Stage">
                  <LeadStageForm tender={tender} leadStatuses={leadStatuses} />
                </Section>

                <Section title="Lead Remarks">
                  <LeadRemarkForm tender={tender} />
                  {isLoading ? (
                    <LoadingSkeleton rows={2} />
                  ) : details.remarks.length ? (
                    <div className="mt-4 space-y-3">
                      {details.remarks.map((remark) => (
                        <TimelineItem
                          key={remark.id}
                          icon={<Pencil size={15} />}
                          title="Remark Added"
                          detail={
                            <>
                              {remark.user?.full_name || remark.user?.email || "Unknown"} - <DateTime value={remark.created_at} /> - {remark.remark}
                            </>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4"><EmptyDrawerState>No remarks yet</EmptyDrawerState></div>
                  )}
                </Section>

                <Section title="Assignment Information">
                  <AssignmentInfo tender={tender} details={details} userById={userById} currentUserId={currentUserId} />
                </Section>

                <Section title="Tender Information">
                  <InfoGrid
                    rows={[
                      ["Tender ID", tender.tender_id],
                      ["Reference No", tender.tender_ref_no],
                      ["Bid Number", tender.bid_number],
                      ["GE", tender.ge],
                      ["CWE", tender.cwe],
                      ["Make", tender.make],
                    ]}
                  />
                </Section>

                <Section title="Bidder Information">
                  <div className="space-y-3">
                    <InfoGrid
                      rows={[
                        ["Bidder Name", tender.bidder_name],
                        ["Email", tender.email],
                        ["Address", tender.address]
                      ]}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[tender.contact_number_1, tender.contact_number_2, tender.contact_number_3].filter(Boolean).map((phone, index) => (
                        <div key={`${phone}-${index}`} className="rounded-lg border border-border bg-slate-50 p-3 text-sm">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Contact {index + 1}</p>
                          <ContactActions phone={String(phone)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                <TenderDocuments tender={tender} />

                <Section title="Timeline">
                  <div className="space-y-3">
                    <TimelineItem icon={<FileText size={15} />} title="Tender created" detail={<DateTime value={tender.created_at} />} />
                    <TimelineItem icon={<CalendarClock size={15} />} title="Last updated" detail={<DateTime value={tender.updated_at ?? tender.created_at} />} />
                    <TimelineItem icon={<UserRound size={15} />} title="Assignment status" detail={assignedToLabel(tender, userById)} />
                    {details.statusHistory.map((history) => (
                      <TimelineItem
                        key={history.id}
                        icon={<CheckCircle2 size={15} />}
                        title="Lead Stage Changed"
                        detail={
                          <>
                            {history.user?.full_name || history.user?.email || "Unknown"} - <DateTime value={history.created_at} /> - {history.old_status?.status_name || "No Status"} to {history.new_status?.status_name || "No Status"} - {history.remarks || "No remarks"}
                          </>
                        }
                      />
                    ))}
                    {isLoading && <LoadingSkeleton rows={3} />}
                    {!isLoading && !details.activities.length && <EmptyDrawerState>No activities available</EmptyDrawerState>}
                    {details.activities.map((activity) => (
                      <TimelineItem
                        key={activity.id}
                        icon={<CheckCircle2 size={15} />}
                        title={activity.activity_type}
                        detail={
                          <>
                            Created by {activity.user?.full_name || activity.user?.email || "Unknown"} - Created at <DateTime value={activity.created_at} /> - {activity.activity_notes || "No remarks"}
                          </>
                        }
                      />
                    ))}
                  </div>
                </Section>

                <Section title="Assignment History">
                  {isLoading ? (
                    <LoadingSkeleton rows={2} />
                  ) : details.assignments.length ? (
                    <div className="space-y-3">
                      {details.assignments.map((assignment) => (
                        <TimelineItem
                          key={assignment.id}
                          icon={<UserRound size={15} />}
                        title={`Assigned to ${formatProfileDisplayName(assignment.assignee)}`}
                        detail={
                          <>
                              Assigned by {formatProfileDisplayName(assignment.assigner)} - Assigned date <DateTime value={assignment.assigned_date} /> - {assignment.remarks || "No remarks"}
                          </>
                        }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyDrawerState>No assignment history available</EmptyDrawerState>
                  )}
                </Section>

                <Section title="Follow-Ups">
                  {isLoading ? (
                    <LoadingSkeleton rows={2} />
                  ) : details.followUps.length ? (
                    <div className="space-y-3">
                      {details.followUps.map((followUp) => (
                        <TimelineItem
                          key={followUp.id}
                          icon={<CalendarClock size={15} />}
                          title={followUp.status}
                          detail={
                            <>
                              Created by {followUp.user?.full_name || followUp.user?.email || "Unknown"} - Follow up date <DateTime value={followUp.follow_up_date} /> - {followUp.remarks || "No remarks"}
                            </>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyDrawerState>No follow ups available</EmptyDrawerState>
                  )}
                </Section>
              </>
            ) : (
              <Section title="Tender History">
                {isLoading ? (
                  <LoadingSkeleton rows={3} />
                ) : details.auditLogs.length ? (
                  <div className="space-y-3">
                    {details.auditLogs.map((log) => (
                      <TimelineItem
                        key={log.id}
                        icon={<Pencil size={15} />}
                        title={historyTitle(log)}
                        detail={
                          <>
                            Changed by {log.user_name || "Unknown"} - Changed at <DateTime value={log.created_at} /> - {historyValue(log.old_data)} to {historyValue(log.new_data)}
                          </>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyDrawerState>No tender edits recorded yet</EmptyDrawerState>
                )}
              </Section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

type TenderDetails = {
  assignments: LeadAssignment[];
  followUps: TenderFollowUp[];
  activities: LeadActivity[];
  auditLogs: AuditLog[];
  remarks: LeadRemark[];
  statusHistory: LeadStatusHistory[];
};

const emptyTenderDetails: TenderDetails = {
  assignments: [],
  followUps: [],
  activities: [],
  auditLogs: [],
  remarks: [],
  statusHistory: []
};

function AssignmentInfo({
  tender,
  details,
  userById,
  currentUserId
}: {
  tender: Tender;
  details: TenderDetails;
  userById: Map<string, Profile>;
  currentUserId: string | null;
}) {
  const latestAssignment = details.assignments[0] ?? null;
  const uploadedByProfile = tender.uploaded_by_profile ?? null;
  const assignedToProfile = latestAssignment?.assignee ?? tender.assigned_profile ?? (tender.assigned_to ? userById.get(tender.assigned_to) : null);
  const assignedByProfile = latestAssignment?.assigner ?? tender.assigned_by_profile ?? (tender.assigned_by ? userById.get(tender.assigned_by) : null);
  const assignedOn = latestAssignment?.assigned_date ?? tender.assigned_date ?? null;
  const assignedRole = assignedToProfile?.role ?? tender.assigned_profile?.role ?? "Unknown User";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoValue label="Uploaded By">{formatProfileDisplayName(uploadedByProfile)}</InfoValue>
      <InfoValue label="Assigned To">
        <span>{tender.assigned_to ? formatProfileDisplayName(assignedToProfile) : "Unassigned"}</span>
        {currentUserId && tender.assigned_to === currentUserId && <Badge tone="blue">My Lead</Badge>}
      </InfoValue>
      <InfoValue label="Assigned By">{tender.assigned_by || latestAssignment ? formatProfileDisplayName(assignedByProfile) : "Unknown User"}</InfoValue>
      <InfoValue label="Assigned On"><DateTime value={assignedOn} /></InfoValue>
      <InfoValue label="Role">{tender.assigned_to ? assignedRole : "Unknown User"}</InfoValue>
    </div>
  );
}

type TenderDocument = {
  label: string;
  name: string | null;
  url: string | null;
};

function TenderDocuments({ tender }: { tender: Tender }) {
  const docs: TenderDocument[] = [
    {
      label: "BOQ",
      name: tender.boq_attachment_name,
      url: tender.boq_attachment_url
    },
    {
      label: "AOC",
      name: tender.aoc_attachment_name,
      url: tender.aoc_attachment_url
    },
    {
      label: "Tender",
      name: tender.tender_document_attachment_name,
      url: tender.tender_document_url
    }
  ];

  return (
    <Section title="Documents">
      <div className="space-y-2">
        {docs.map((doc) => (
          <DocRow key={doc.label} doc={doc} />
        ))}
      </div>
    </Section>
  );
}

function DocRow({ doc }: { doc: TenderDocument }) {
  if (!doc.url) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-500">
        <FileText size={15} />
        <span>{doc.label}: No file</span>
      </div>
    );
  }

  const fileName = doc.name || "Uploaded file";
  const isPDF = fileName.toLowerCase().endsWith(".pdf") || doc.url.toLowerCase().includes(".pdf");

  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
          <FileText size={15} className="shrink-0 text-slate-500" />
          <span className="truncate">{doc.label}: {fileName}</span>
        </span>
        <a
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          href={doc.url}
          download
        >
          <Download size={13} />
          Download
        </a>
      </div>
      {isPDF && (
        <iframe
          src={doc.url}
          className="mt-3 h-96 w-full rounded-md border border-border bg-white"
          title={`${doc.label} PDF preview`}
        />
      )}
    </div>
  );
}

function LeadStageBadge({ tender, leadStatuses }: { tender: Tender; leadStatuses: LeadStatusMaster[] }) {
  const statusName = leadStageLabel(tender);
  const masterStatus = leadStatuses.find((status) => status.status_name === statusName);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
      style={{ backgroundColor: masterStatus?.status_color || tender.lead_stage?.status_color || "#173b71" }}
    >
      {statusName}
    </span>
  );
}

function LeadStageForm({ tender, leadStatuses }: { tender: Tender; leadStatuses: LeadStatusMaster[] }) {
  const [selectedStatusId, setSelectedStatusId] = useState(() => selectedLeadStatusId(tender, leadStatuses));
  const [stageError, setStageError] = useState("");

  useEffect(() => {
    setSelectedStatusId(selectedLeadStatusId(tender, leadStatuses));
  }, [tender.id, tender.lead_status, leadStatuses]);

  async function submitLeadStage(formData: FormData) {
    setStageError("");
    const result = await updateLeadStageAction(formData);
    if (result?.error) setStageError(result.error);
  }

  return (
    <form action={submitLeadStage} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="tenderId" value={tender.id} />
      <Field label="Current Lead Stage">
        <select name="statusId" className={inputClass} value={selectedStatusId} onChange={(event) => setSelectedStatusId(event.target.value)}>
          {leadStatuses.map((status) => (
            <option key={status.id} value={status.id}>{status.status_name}</option>
          ))}
        </select>
      </Field>
      <Field label="Next Follow-Up Date">
        <input name="followUpDate" type="datetime-local" className={inputClass} />
      </Field>
      <Field label="Reminder Notes">
        <input name="reminderNotes" className={inputClass} placeholder="Optional reminder" />
      </Field>
      <Field label="Status Remark">
        <input name="statusRemark" className={inputClass} placeholder="Reason or note for this stage change" required />
      </Field>
      {stageError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 sm:col-span-2">{stageError}</p>}
      <div className="flex items-end sm:col-span-2">
        <Button disabled={!selectedStatusId || selectedStatusId.startsWith("fallback-")}>
          <CheckCircle2 size={16} />
          Update Stage
        </Button>
      </div>
    </form>
  );
}

function LeadRemarkForm({ tender }: { tender: Tender }) {
  return (
    <form action={addLeadRemarkAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="tenderId" value={tender.id} />
      <input name="remark" className={`${inputClass} flex-1`} placeholder="Add lead remark" required />
      <Button>
        <Pencil size={16} />
        Add Remark
      </Button>
    </form>
  );
}

function leadStageLabel(tender: Tender) {
  return tender.lead_stage?.status_name || leadStatusNameFromEnum(tender.lead_status);
}

function selectedLeadStatusId(tender: Tender, leadStatuses: LeadStatusMaster[]) {
  const statusName = leadStageLabel(tender);
  return leadStatuses.find((status) => status.status_name === statusName)?.id ?? leadStatuses[0]?.id ?? "";
}

function leadStatusNameFromEnum(status: Tender["lead_status"] | null | undefined) {
  const labels: Record<NonNullable<Tender["lead_status"]>, string> = {
    NEW: "New Lead",
    ASSIGNED: "New Lead",
    CONTACTED: "Contacted",
    FOLLOW_UP: "Follow Up Required",
    QUOTATION_SENT: "Quotation Sent",
    NEGOTIATION: "Price Negotiation",
    WON: "Order Received",
    LOST: "Lost To Competitor"
  };
  return status ? labels[status] : "No Status";
}

function leadStatusEnumFromName(statusName: string) {
  if (statusName === "Order Received") return "WON";
  if (statusName === "Lost To Competitor" || statusName === "No Requirement" || statusName === "Closed") return "LOST";
  if (statusName === "Quotation Sent") return "QUOTATION_SENT";
  if (statusName === "Price Negotiation") return "NEGOTIATION";
  if (statusName === "Follow Up Required" || statusName === "On Hold") return "FOLLOW_UP";
  if (["First Contact", "Contacted", "Requirement Received", "BOQ Requested", "BOQ Received", "Technical Discussion", "Sample Submitted", "PI Sent", "PI Waiting Approval", "Order Expected", "Not Reachable"].includes(statusName)) return "CONTACTED";
  return "NEW";
}

function useTenderDetails(tenderUuid?: string) {
  return useQuery({
    queryKey: ["tender-details", tenderUuid],
    enabled: Boolean(tenderUuid),
    queryFn: async () => {
      if (!tenderUuid) return emptyTenderDetails;

      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("id,role").eq("id", user.id).maybeSingle()
        : { data: null };
      const currentProfile = profile as Pick<Profile, "id" | "role"> | null;

      return {
        assignments: await fetchAssignmentHistory(supabase, tenderUuid, currentProfile),
        followUps: await fetchTenderFollowUps(supabase, tenderUuid, currentProfile),
        activities: await fetchActivityTimeline(supabase, tenderUuid, currentProfile),
        auditLogs: await getTenderHistoryAction(tenderUuid),
        remarks: await fetchLeadRemarks(supabase, tenderUuid, currentProfile),
        statusHistory: await fetchLeadStatusHistory(supabase, tenderUuid, currentProfile)
      };
    }
  });
}

async function fetchLeadStatusHistory(supabase: SupabaseBrowserClient, tenderUuid: string, profile: Pick<Profile, "id" | "role"> | null): Promise<LeadStatusHistory[]> {
  let query = supabase
    .from("lead_status_history")
    .select("*, tender:tenders!lead_status_history_tender_id_fkey(id), new_status:lead_status_master!lead_status_history_status_id_fkey(status_name,status_color), user:profiles!lead_status_history_updated_by_fkey(full_name,email)")
    .eq("tender_id", tenderUuid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (profile?.role === "USER") query = query.eq("updated_by", profile.id);
  const { data, error } = await query;
  if (error) {
    console.error("[TenderDetails] lead status history error:", error.message, error);
    return [];
  }
  return (data ?? []) as LeadStatusHistory[];
}

async function fetchLeadRemarks(supabase: SupabaseBrowserClient, tenderUuid: string, profile: Pick<Profile, "id" | "role"> | null): Promise<LeadRemark[]> {
  let query = supabase
    .from("lead_remarks")
    .select("*, tender:tenders!lead_remarks_tender_id_fkey(id), user:profiles!lead_remarks_user_id_fkey(full_name,email)")
    .eq("tender_id", tenderUuid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (profile?.role === "USER") query = query.eq("user_id", profile.id);
  const { data, error } = await query;
  if (error) {
    console.error("[TenderDetails] lead remarks error:", error.message, error);
    return [];
  }
  return (data ?? []) as LeadRemark[];
}

type SupabaseBrowserClient = ReturnType<typeof createClient>;

async function fetchAssignmentHistory(supabase: SupabaseBrowserClient, tenderUuid: string, profile: Pick<Profile, "id" | "role"> | null): Promise<LeadAssignment[]> {
  let query = supabase
    .from("lead_assignments")
    .select("*, tender:tenders!lead_assignments_tender_id_fkey(tender_id,bidder_name,ge,cwe), assignee:profiles!lead_assignments_assigned_to_fkey(full_name,email,role), assigner:profiles!lead_assignments_assigned_by_fkey(full_name,email,role)")
    .eq("tender_id", tenderUuid)
    .order("assigned_date", { ascending: false });

  if (profile?.role === "USER") query = query.eq("assigned_to", profile.id);

  const { data, error } = await query;

  if (error) {
    console.error("[TenderDetails] assignment history error:", error.message, error);
    return [];
  }

  return (data ?? []) as LeadAssignment[];
}

async function fetchTenderFollowUps(supabase: SupabaseBrowserClient, tenderUuid: string, profile: Pick<Profile, "id" | "role"> | null): Promise<TenderFollowUp[]> {
  let query = supabase
    .from("follow_ups")
    .select("*, user:profiles!follow_ups_user_id_fkey(full_name,email)")
    .eq("tender_id", tenderUuid)
    .order("follow_up_date", { ascending: false });

  if (profile?.role === "USER") query = query.eq("user_id", profile.id);

  const { data, error } = await query;

  if (error) {
    console.error("[TenderDetails] follow-ups error:", error.message, error);
    return [];
  }

  return (data ?? []) as TenderFollowUp[];
}

async function fetchActivityTimeline(supabase: SupabaseBrowserClient, tenderUuid: string, profile: Pick<Profile, "id" | "role"> | null): Promise<LeadActivity[]> {
  let query = supabase
    .from("lead_activities")
    .select("*, user:profiles!lead_activities_user_id_fkey(full_name,email)")
    .eq("tender_id", tenderUuid)
    .order("created_at", { ascending: false });

  if (profile?.role === "USER") query = query.eq("user_id", profile.id);

  const { data, error } = await query;

  if (error) {
    console.error("[TenderDetails] activity timeline error:", error.message, error);
    return [];
  }

  return (data ?? []) as LeadActivity[];
}

function historyTitle(log: AuditLog) {
  const field = formatHistoryFieldName(historyFieldName(log));
  if (log.action === "TENDER_EDITED") return `Tender Edited: ${field}`;
  if (log.action === "UPLOAD_ATTACHMENT") return `${field} Uploaded`;
  if (log.action === "REPLACE_ATTACHMENT") return `${field} Replaced`;
  if (log.action === "DELETE_ATTACHMENT") return `${field} Deleted`;
  if (log.action === "ASSIGNMENT_CHANGED") return "Assignment Changed";
  if (log.action === "STATUS_CHANGED") return "Status Changed";
  if (log.action === "BULK_ASSIGN") return "Bulk Assignment Changed";
  if (log.action === "BULK_UNASSIGN") return "Bulk Assignment Cleared";
  if (log.action === "BULK_DELETE") return "Bulk Tender Deleted";
  if (log.action === "DELETE_TENDER") return "Tender deleted";
  if (log.action === "RESTORE_TENDER") return "Tender restored";
  return `Updated ${field}`;
}

function historyFieldName(log: AuditLog) {
  const fieldName = log.new_data?.field_name ?? log.old_data?.field_name;
  return typeof fieldName === "string" && fieldName ? fieldName : "Tender";
}

function historyValue(data: AuditLog["old_data"]) {
  if (!data) return "-";
  if ("value" in data) return String(data.value ?? "-");
  return JSON.stringify(data);
}

function formatHistoryFieldName(fieldName: string) {
  const labels: Record<string, string> = {
    boq_attachment_name: "BOQ",
    boq_attachment_url: "BOQ",
    aoc_attachment_name: "AOC",
    aoc_attachment_url: "AOC",
    tender_document_attachment_name: "Tender Document",
    tender_document_url: "Tender Document",
    tender_ref_no: "Tender Ref No",
    lead_status: "Lead Stage",
    assigned_to: "Assigned To"
  };
  return labels[fieldName] ?? fieldName.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetricTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-navy-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">{title}</h3>
      {children}
    </section>
  );
}

function LoadingSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex animate-pulse gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyDrawerState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-slate-50 p-3 text-sm text-slate-500">{children}</p>;
}

function InfoValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-sm text-slate-800">{value || "-"}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-700">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

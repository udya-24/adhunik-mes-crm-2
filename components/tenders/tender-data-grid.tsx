"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, Eye, FileText, Loader2, Mail, Phone, Search, Send, Trash2, UserRound, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { assignLeadAction, deleteTenderAction, updateLeadStatusAction } from "@/app/actions/tenders";
import { ContractDate } from "@/components/common/contract-date";
import { DateTime } from "@/components/common/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { useTenders } from "@/hooks/use-tenders";
import { leadStatuses, sourceTypes } from "@/lib/constants";
import { formatDate } from "@/lib/date-utils";
import { invalidateTenderQueries } from "@/lib/queries/tenders";
import { formatProfileDisplayName } from "@/lib/profile-utils";
import { createClient } from "@/lib/supabase/client";
import type { LeadActivity, LeadAssignment, Profile, Tender, TenderFollowUp } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const stickyStatusHeaderClass = "sticky right-[300px] z-30 min-w-[7rem] bg-slate-50 px-2 py-2 font-bold";
const stickySourceHeaderClass = "sticky right-[160px] z-30 min-w-[140px] bg-slate-50 px-2 py-2 font-bold";
const stickyActionsHeaderClass = "sticky right-0 z-30 min-w-[160px] bg-slate-50 px-2 py-2 text-right font-bold";
const stickyStatusCellClass = "sticky right-[300px] z-20 min-w-[7rem] bg-white px-2 py-1.5 group-hover:bg-slate-50";
const stickySourceCellClass = "sticky right-[160px] z-20 min-w-[140px] bg-white px-2 py-1.5 group-hover:bg-slate-50";
const stickyActionsCellClass = "sticky right-0 z-20 min-w-[160px] bg-white px-2 py-1.5 text-right group-hover:bg-slate-50";

export function TenderDataGrid({
  users,
  canAssign,
  canDelete,
  currentUserId
}: {
  users: Profile[];
  canAssign: boolean;
  canDelete: boolean;
  currentUserId: string | null;
}) {
  const { data: tenders = [], error, isLoading, isFetching } = useTenders();
  const queryClient = useQueryClient();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [assignment, setAssignment] = useState("");
  const [openTender, setOpenTender] = useState<Tender | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tender | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const tableColumnCount = 13;
  const tableHeaders = [
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

  const filtered = useMemo(() => {
    return tenders.filter((tender) => {
      const haystack = [tender.tender_id, tender.ge, tender.cwe, tender.bidder_name].join(" ").toLowerCase();
      const isAssigned = Boolean(tender.assigned_to);
      const matchesAssignment = assignment === "assigned" ? isAssigned : assignment === "unassigned" ? !isAssigned : true;
      return (
        haystack.includes(search.toLowerCase()) &&
        (!status || tender.lead_status === status) &&
        (!source || tender.source_type === source) &&
        matchesAssignment
      );
    });
  }, [tenders, search, status, source, assignment]);

  function exportCsv() {
    const csv = [
      ["Tender ID", "GE", "CWE", "Bidder Name", "Contract Date", "Awarded Value", "Our Value", "Assigned To", "Status", "Source Type"].join(","),
      ...filtered.map((tender) =>
        [
          tender.tender_id,
          tender.ge,
          tender.cwe,
          tender.bidder_name,
          formatDate(tender.contract_date),
          formatCurrencyDisplay(tender.awarded_value),
          formatCurrencyDisplay(tender.our_value),
          assignedToLabel(tender, userById),
          tender.lead_status,
          sourceTypeLabel(tender.source_type)
        ]
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
          {leadStatuses.map((item) => <option key={item}>{item}</option>)}
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
      <div className="relative w-full overflow-x-auto table-scroll">
        <table className="w-full min-w-[1960px] table-fixed text-left text-xs">
          <colgroup>
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
            <col className="w-[160px] min-w-[160px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase text-slate-500 shadow-sm">
            <tr>
              {tableHeaders.map((head) => (
                <th className={head.className} key={head.label}>{head.label}</th>
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
              <tr key={tender.id} className="group border-t border-border align-middle transition hover:bg-slate-50">
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
                  <StatusBadge status={tender.lead_status} />
                </td>
                <td className={stickySourceCellClass}>
                  <SourceTypeBadge sourceType={tender.source_type} />
                </td>
                <td className={stickyActionsCellClass}>
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <Button variant="secondary" className="h-7 w-7 rounded-md px-0" title="View details" onClick={() => setOpenTender(tender)}>
                      <Eye size={15} />
                    </Button>
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
    <TenderDetailsDrawer tender={openTender} userById={userById} users={users} canAssign={canAssign} currentUserId={currentUserId} onClose={() => setOpenTender(null)} />
    </>
  );
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

function ContactPreview({ tender }: { tender: Tender }) {
  const phone = tender.contact_number_1 || tender.contact_number_2 || tender.contact_number_3;
  if (!phone && !tender.email) return <span className="text-slate-400">-</span>;

  return (
    <div className="space-y-0.5 text-[11px] leading-4 text-slate-600">
      {phone && <span className="flex min-w-0 items-center gap-1 truncate"><Phone size={11} /> {phone}</span>}
      {tender.email && <span className="flex min-w-0 items-center gap-1 truncate"><Mail size={11} /> {tender.email}</span>}
    </div>
  );
}

function assignedToLabel(tender: Tender, userById: Map<string, Profile>) {
  if (tender.assigned_profile) return formatProfileDisplayName(tender.assigned_profile);
  if (!tender.assigned_to) return "Unassigned";
  const user = userById.get(tender.assigned_to);
  return formatProfileDisplayName(user);
}

function formatCurrencyDisplay(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return formatCurrency(value);
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

function StatusBadge({ status }: { status: Tender["lead_status"] }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

function statusTone(status: Tender["lead_status"]) {
  if (status === "WON") return "green";
  if (status === "LOST") return "red";
  if (status === "FOLLOW_UP" || status === "NEGOTIATION") return "orange";
  if (status === "ASSIGNED" || status === "CONTACTED" || status === "QUOTATION_SENT") return "blue";
  return "slate";
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

function TenderDetailsDrawer({
  tender,
  userById,
  users,
  canAssign,
  currentUserId,
  onClose
}: {
  tender: Tender | null;
  userById: Map<string, Profile>;
  users: Profile[];
  canAssign: boolean;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const { data: details = emptyTenderDetails, isLoading } = useTenderDetails(tender?.id);
  const attachments = tender
    ? [
        ["BOQ", tender.boq_attachment_url],
        ["AOC", tender.aoc_attachment_url],
        ["Tender Document", tender.tender_document_url]
      ].filter(([, url]) => Boolean(url))
    : [];

  return (
    <div className={`fixed inset-0 z-50 ${tender ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!tender}>
      <div className={`absolute inset-0 bg-slate-950/30 transition-opacity ${tender ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-white shadow-lift transition-transform duration-300 ${
          tender ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {tender && (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Tender Details</p>
                <h2 className="mt-1 text-2xl font-bold text-navy-900">{tender.tender_title || tender.tender_id}</h2>
                <p className="mt-1 text-sm text-slate-600">{tender.organisation_chain || "Organisation not specified"}</p>
              </div>
              <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={onClose} aria-label="Close drawer">
                <X size={18} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={tender.lead_status} />
              <SourceTypeBadge sourceType={tender.source_type} />
              <AssignmentBadge tender={tender} userById={userById} currentUserId={currentUserId} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Awarded Value" value={formatCurrency(tender.awarded_value)} />
              <MetricTile label="Our Value" value={formatCurrency(tender.our_value)} />
              <MetricTile label="Contract Date" value={<ContractDate tender={tender} />} />
            </div>

            {canAssign && (
              <Section title="Assignment Controls">
                <AssignForm tender={tender} users={users} />
              </Section>
            )}

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
              <InfoGrid
                rows={[
                  ["Bidder Name", tender.bidder_name],
                  ["Email", tender.email],
                  ["Contact 1", tender.contact_number_1],
                  ["Contact 2", tender.contact_number_2],
                  ["Contact 3", tender.contact_number_3],
                  ["Address", tender.address]
                ]}
              />
            </Section>

            <Section title="Attachments">
              {attachments.length ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {attachments.map(([label, url]) => (
                    <a key={label} href={url ?? "#"} target="_blank" className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 p-3 text-sm font-semibold text-navy-900 hover:bg-navy-50">
                      <FileText size={16} />
                      {label}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No attachments uploaded.</p>
              )}
            </Section>

            <Section title="Timeline">
              <div className="space-y-3">
                <TimelineItem icon={<FileText size={15} />} title="Tender created" detail={<DateTime value={tender.created_at} />} />
                <TimelineItem icon={<CalendarClock size={15} />} title="Last updated" detail={<DateTime value={tender.updated_at} />} />
                <TimelineItem icon={<UserRound size={15} />} title="Assignment status" detail={assignedToLabel(tender, userById)} />
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
};

const emptyTenderDetails: TenderDetails = {
  assignments: [],
  followUps: [],
  activities: []
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
        activities: await fetchActivityTimeline(supabase, tenderUuid, currentProfile)
      };
    }
  });
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

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import {
  createBidderAssignmentAction,
  deleteBidderAssignmentAction,
  previewBidderSynchronizationAction,
  synchronizeExistingBiddersAction,
  updateBidderAssignmentAction,
  type BidderSynchronizationScope
} from "@/app/actions/lead-distribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Person = { id: string; full_name: string | null; email: string; role?: string };
type Rule = { id: string; bidder_name: string; assigned_user: string; assigned_by: string; assigned_at: string; is_active: boolean; remarks: string | null; assignee: Person | Person[] | null; assigner: Person | Person[] | null };
type PreviewRow = { rule_id: string | null; bidder_name: string; current_owner: string; new_owner: string; matching_tenders: number; already_assigned: number; unassigned: number; will_change: number };
type Preview = { scope: BidderSynchronizationScope; rulesProcessed: number; matchingTenders: number; alreadyAssigned: number; unassigned: number; willBeReassigned: number; willBeUpdated: number; willChange: number; skipped: number; rows: PreviewRow[] };
type Result = { rulesProcessed: number; matchingTenders: number; updated: number; skipped: number; errors: number; durationMs: number };

const scopes: { value: BidderSynchronizationScope; label: string }[] = [
  { value: "FUTURE_ONLY", label: "Future Tenders Only" },
  { value: "FUTURE_AND_UNASSIGNED", label: "Future + Existing Unassigned Matching Tenders" },
  { value: "FUTURE_AND_ALL", label: "Future + All Existing Matching Tenders" }
];

function person(value: Person | Person[] | null) { return Array.isArray(value) ? value[0] : value; }

export function BidderOwnership({ rows, users }: { rows: Rule[]; users: Person[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [assignedUser, setAssignedUser] = useState("");
  const [remarks, setRemarks] = useState("");
  const [editing, setEditing] = useState<Rule | null>(null);
  const [scope, setScope] = useState<BidderSynchronizationScope>("FUTURE_ONLY");
  const [operation, setOperation] = useState<"create" | "edit" | "all" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => { const q = query.trim().toLowerCase(); return !q ? rows : rows.filter((r) => r.bidder_name.toLowerCase().includes(q) || `${person(r.assignee)?.full_name || ""} ${person(r.assignee)?.email || ""}`.toLowerCase().includes(q)); }, [query, rows]);

  function openCreate() { setScope("FUTURE_ONLY"); setOperation("create"); loadPreview("create", "FUTURE_ONLY"); }
  function openEdit(rule: Rule) { setEditing({ ...rule }); setAssignedUser(rule.assigned_user); setScope("FUTURE_ONLY"); setOperation("edit"); loadPreview("edit", "FUTURE_ONLY", rule, rule.assigned_user); }
  function openAll() { setScope("FUTURE_AND_ALL"); setOperation("all"); loadPreview("all", "FUTURE_AND_ALL"); }
  function loadPreview(kind: "create" | "edit" | "all", nextScope: BidderSynchronizationScope, rule = editing, owner = assignedUser) {
    setError(""); setPreview(null);
    startTransition(async () => {
      try {
        setPreview(await previewBidderSynchronizationAction(kind === "all"
          ? { scope: nextScope }
          : kind === "edit" && rule
            ? { scope: nextScope, bidderName: rule.bidder_name, assignedUser: owner }
            : { scope: nextScope, bidderName, assignedUser: owner }) as Preview);
      } catch (e) { setError(e instanceof Error ? e.message : "Preview failed"); }
    });
  }
  function changeScope(next: BidderSynchronizationScope) { setScope(next); if (operation) loadPreview(operation, next); }
  function execute() {
    if (!operation) return;
    setError("");
    startTransition(async () => {
      try {
        let completed: Result;
        if (operation === "create") completed = await createBidderAssignmentAction({ bidderName, assignedUser, remarks, scope }) as Result;
        else if (operation === "edit" && editing) completed = await updateBidderAssignmentAction({ id: editing.id, bidderName: editing.bidder_name, assignedUser, remarks: editing.remarks || "", isActive: editing.is_active, scope }) as Result;
        else completed = await synchronizeExistingBiddersAction(scope) as Result;
        setResult(completed); setOperation(null); setPreview(null); setEditing(null);
        if (operation === "create") { setBidderName(""); setAssignedUser(""); setRemarks(""); }
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Synchronization failed"); }
    });
  }
  function remove(id: string, name: string) {
    if (!confirm(`Deactivate bidder ownership for ${name}?`)) return;
    setError(""); startTransition(async () => { try { await deleteBidderAssignmentAction(id); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); } });
  }

  return <section id="bidder-ownership" className="space-y-4">
    <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-blue-600">Bidder Ownership</p><h2 className="mt-1 text-xl font-bold text-navy-900">Create assignment</h2><p className="text-sm text-slate-500">Choose an existing bidder name or type a new one.</p></div><div className="grid w-full gap-3 md:grid-cols-4 xl:w-auto xl:min-w-[760px]"><input list="bidder-names" className="h-10 rounded-lg border px-3" placeholder="Bidder name" value={bidderName} onChange={(e) => setBidderName(e.target.value)} /><datalist id="bidder-names">{rows.map((r) => <option key={r.id} value={r.bidder_name} />)}</datalist><select className="h-10 rounded-lg border px-3" value={assignedUser} onChange={(e) => setAssignedUser(e.target.value)}><option value="">Select User/Manager</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}</select><input className="h-10 rounded-lg border px-3" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} /><Button disabled={pending || !bidderName.trim() || !assignedUser} onClick={openCreate}>Save</Button></div></div></Card>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {result && <Completion result={result} onClose={() => setResult(null)} />}
    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-bold text-navy-900">Bidder Assignment</h2><p className="text-sm text-slate-500">One active owner per normalized bidder name</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400" /><input className="h-10 outline-none" placeholder="Search bidder or user" value={query} onChange={(e) => setQuery(e.target.value)} /></label><Button variant="secondary" onClick={openAll} disabled={pending}><RefreshCw size={16} />Synchronize Existing Tenders</Button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Bidder Name</th><th>Assigned User</th><th>Assigned By</th><th>Assigned Date</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{visible.map((r) => <tr key={r.id} className="border-t"><td className="p-4 font-semibold text-navy-900">{r.bidder_name}</td><td>{person(r.assignee)?.full_name || person(r.assignee)?.email}</td><td>{person(r.assigner)?.full_name || person(r.assigner)?.email}</td><td>{new Date(r.assigned_at).toLocaleString("en-IN")}</td><td><Badge tone={r.is_active ? "green" : "gray"}>{r.is_active ? "Active" : "Inactive"}</Badge></td><td className="max-w-[220px] truncate">{r.remarks || "-"}</td><td><div className="flex gap-1"><button className="rounded p-2 hover:bg-slate-100" title="Edit" onClick={() => openEdit(r)}><Pencil size={16} /></button><button className="rounded p-2 hover:bg-slate-100" title="Transfer owner" onClick={() => openEdit(r)}><ArrowRightLeft size={16} /></button>{r.is_active && <button className="rounded p-2 text-red-600 hover:bg-red-50" title="Deactivate" onClick={() => remove(r.id, r.bidder_name)}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-sm text-slate-500">No bidder assignments found.</p>}</div></Card>
    {operation && <Modal title={operation === "all" ? "Synchronize Existing Tenders" : operation === "create" ? "Apply New Bidder Rule" : "Edit Bidder Assignment"} close={() => { setOperation(null); setPreview(null); }}>
      {operation === "edit" && editing && <div className="mb-4 grid gap-3 sm:grid-cols-2"><input className="h-10 rounded-lg border px-3" value={editing.bidder_name} onChange={(e) => { setEditing({ ...editing, bidder_name: e.target.value }); setPreview(null); }} /><select className="h-10 rounded-lg border px-3" value={assignedUser} onChange={(e) => { setAssignedUser(e.target.value); setPreview(null); }}>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}</select><textarea className="rounded-lg border p-3 sm:col-span-2" value={editing.remarks || ""} onChange={(e) => setEditing({ ...editing, remarks: e.target.value })} /><label className="flex gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />Active</label></div>}
      <p className="mb-2 text-sm font-semibold text-navy-900">Apply Rule To</p><div className="space-y-2">{scopes.map((item) => <label key={item.value} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="radio" checked={scope === item.value} onChange={() => changeScope(item.value)} />{item.label}</label>)}</div>
      <PreviewTable preview={preview} loading={pending} />
      {!preview && !pending && <Button className="mt-4" variant="secondary" onClick={() => operation && loadPreview(operation, scope)}>Refresh Preview</Button>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => { setOperation(null); setPreview(null); }}>Cancel</Button><Button disabled={pending} onClick={execute}>{operation === "all" ? "Synchronize" : "Apply Rule"}</Button></div>
    </Modal>}
  </section>;
}

function PreviewTable({ preview, loading }: { preview: Preview | null; loading: boolean }) {
  if (loading) return <p className="mt-4 text-sm text-slate-500">Preparing preview...</p>;
  if (!preview) return null;
  const metrics = [["Bidder Rules", preview.rulesProcessed], ["Matching Existing Tenders", preview.matchingTenders], ["Already Assigned Correctly", preview.alreadyAssigned], ["Currently Unassigned", preview.unassigned], ["Will Be Reassigned", preview.willBeReassigned], ["Will Be Updated", preview.willBeUpdated], ["Skipped", preview.skipped]];
  return <div className="mt-5"><h4 className="mb-2 font-semibold text-navy-900">Preview</h4><div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="border-l-2 border-blue-500 pl-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-navy-900">{value}</p></div>)}</div><div className="max-h-[42vh] overflow-auto rounded-lg border"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Bidder</th><th>Current Owner</th><th>New Owner</th><th>Matching Tenders</th><th>Already Assigned</th><th>Unassigned</th><th>Will Change</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rule_id || row.bidder_name} className="border-t"><td className="p-3 font-semibold">{row.bidder_name}</td><td>{row.current_owner}</td><td>{row.new_owner}</td><td>{row.matching_tenders}</td><td>{row.already_assigned}</td><td>{row.unassigned}</td><td className="font-semibold text-blue-700">{row.will_change}</td></tr>)}</tbody></table></div></div>;
}

function Completion({ result, onClose }: { result: Result; onClose: () => void }) {
  const metrics = [["Processed", result.rulesProcessed], ["Updated", result.updated], ["Skipped", result.skipped], ["Errors", result.errors], ["Duration", `${(result.durationMs / 1000).toFixed(2)}s`]];
  return <Card className="border-emerald-200 bg-emerald-50"><div className="flex justify-between"><h3 className="font-bold text-emerald-900">Synchronization Complete</h3><button title="Close" onClick={onClose}><X size={18} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value]) => <div key={label} className="border-l-2 border-emerald-500 pl-3"><p className="text-xs text-emerald-800">{label}</p><p className="font-bold text-emerald-950">{value}</p></div>)}</div></Card>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><Card className="max-h-[92vh] w-full max-w-5xl overflow-auto p-6"><div className="mb-4 flex justify-between"><h3 className="font-bold text-navy-900">{title}</h3><button title="Close" onClick={close}><X size={20} /></button></div>{children}</Card></div>; }

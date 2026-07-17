"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Play, RefreshCw, Users, X } from "lucide-react";
import {
  createDistributionBatchAction, getDistributionReportAction, previewDistributionAction,
  processDistributionChunkAction, type DistributionAlgorithm, type DistributionOrder, type DistributionQuantityMode
} from "@/app/actions/lead-distribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

type PoolUser = { id: string; full_name: string | null; email: string; role: "USER" | "MANAGER"; current_assigned: number; current_active: number; total_awarded_value: number; follow_up_count: number; last_login: string | null };
type Batch = { id: string; started_at: string; algorithm: DistributionAlgorithm; selected_users: string[]; total_tenders: number; completed_tenders: number; status: string; completed_at: string | null; assignment_order: DistributionOrder; requested_quantity: number; remaining_quantity: number };
type Preview = { totalTenders: number; assigning: number; remaining: number; algorithm: DistributionAlgorithm; assignmentOrder: DistributionOrder; warning: string | null; allocations: { userId: string; name: string; currentWorkload: number; assigned: number }[] };
type Overview = { pool: PoolUser[]; unassigned: number; lastBatch: Batch | null; pending: number };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const algorithmNames = { LEAST_LOADED: "Least Loaded", ROUND_ROBIN: "Round Robin", RANDOM: "Random" } as const;
const orderNames: Record<DistributionOrder, string> = { OLDEST_FIRST: "Oldest First", NEWEST_FIRST: "Newest First", HIGHEST_VALUE: "Highest Awarded Value First", LOWEST_VALUE: "Lowest Awarded Value First", RANDOM: "Random" };

export function LeadDistributionDashboard({ initialOverview }: { initialOverview: Overview }) {
  const router = useRouter();
  const [algorithm, setAlgorithm] = useState<DistributionAlgorithm>("LEAST_LOADED");
  const [quantityMode, setQuantityMode] = useState<DistributionQuantityMode>("ALL_UNASSIGNED");
  const [specificNumber, setSpecificNumber] = useState(100);
  const [keepNumber, setKeepNumber] = useState(50);
  const [assignmentOrder, setAssignmentOrder] = useState<DistributionOrder>("OLDEST_FIRST");
  const [selected, setSelected] = useState(() => new Set<string>());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const quantityValue = quantityMode === "SPECIFIC_NUMBER" ? specificNumber : quantityMode === "KEEP_UNASSIGNED" ? keepNumber : 0;
  const selectedForAssignment = quantityMode === "SPECIFIC_NUMBER" ? Math.min(specificNumber, initialOverview.unassigned) : quantityMode === "KEEP_UNASSIGNED" ? Math.max(initialOverview.unassigned - keepNumber, 0) : initialOverview.unassigned;
  const remaining = initialOverview.unassigned - selectedForAssignment;
  const liveWarning = quantityMode !== "ALL_UNASSIGNED" && quantityValue > initialOverview.unassigned ? `Only ${initialOverview.unassigned.toLocaleString("en-IN")} unassigned leads are available.` : "";
  const estimatedSeconds = Math.max(1, Math.ceil((preview?.assigning ?? 0) / 1000));

  function choose(ids: string[]) { setSelected(new Set(ids)); setPreview(null); }
  function toggle(id: string) { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next); setPreview(null); }
  function requestInput() { return { algorithm, assignmentOrder, quantityMode, quantityValue, selectedUsers: [...selected] }; }
  function runPreview() {
    setError("");
    startTransition(async () => {
      try { setPreview(await previewDistributionAction(requestInput()) as Preview); }
      catch (e) { setError(e instanceof Error ? e.message : "Preview failed"); }
    });
  }
  function startDistribution() {
    setConfirmStart(false); setError("");
    startTransition(async () => {
      try {
        let current = await createDistributionBatchAction(requestInput()) as Batch;
        setBatch(current);
        while (current.status !== "COMPLETED" && current.status !== "FAILED") {
          current = await processDistributionChunkAction(current.id) as Batch;
          setBatch(current);
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Distribution failed"); }
    });
  }
  const progress = batch?.total_tenders ? Math.min(100, (batch.completed_tenders / batch.total_tenders) * 100) : 0;

  return <div className="space-y-6">
    <PageHeader eyebrow="Assignments" title="Lead Distribution" description="Automatically distribute unassigned tenders across your active team." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Total Unassigned" value={initialOverview.unassigned} />
      <Metric label="Selected For Assignment" value={selectedForAssignment} />
      <Metric label="Remaining" value={remaining} />
      <Metric label="Selected Users" value={selected.size} />
      <Metric label="Algorithm" value={algorithmNames[algorithm]} small />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="p-5"><h2 className="font-bold text-navy-900">Assignment Mode</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(algorithmNames) as DistributionAlgorithm[]).map((item) => <label key={item} className={`cursor-pointer rounded-xl border p-4 ${algorithm === item ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input type="radio" className="mr-2" checked={algorithm === item} onChange={() => { setAlgorithm(item); setPreview(null); }} />{algorithmNames[item]}</label>)}
      </div></Card>
      <Card className="p-5"><h2 className="font-bold text-navy-900">Lead Distribution Scope</h2><div className="mt-4 space-y-4">
        <label className="flex items-center gap-3"><input type="radio" checked={quantityMode === "ALL_UNASSIGNED"} onChange={() => { setQuantityMode("ALL_UNASSIGNED"); setPreview(null); }} />Assign All Unassigned Leads</label>
        <label className="flex flex-wrap items-center gap-3"><input type="radio" checked={quantityMode === "SPECIFIC_NUMBER"} onChange={() => { setQuantityMode("SPECIFIC_NUMBER"); setPreview(null); }} />Assign Specific Number <input type="number" min={0} className="h-10 w-28 rounded-lg border border-slate-300 px-3" value={specificNumber} onFocus={() => setQuantityMode("SPECIFIC_NUMBER")} onChange={(e) => { setSpecificNumber(Math.max(0, Math.floor(Number(e.target.value) || 0))); setPreview(null); }} /><span>Leads</span></label>
        <label className="flex flex-wrap items-center gap-3"><input type="radio" checked={quantityMode === "KEEP_UNASSIGNED"} onChange={() => { setQuantityMode("KEEP_UNASSIGNED"); setPreview(null); }} />Keep Specific Number Unassigned <input type="number" min={0} className="h-10 w-28 rounded-lg border border-slate-300 px-3" value={keepNumber} onFocus={() => setQuantityMode("KEEP_UNASSIGNED")} onChange={(e) => { setKeepNumber(Math.max(0, Math.floor(Number(e.target.value) || 0))); setPreview(null); }} /><span>Leads</span></label>
        {liveWarning && <p className="rounded-lg bg-orange-50 p-3 text-sm font-medium text-orange-700">{liveWarning}</p>}
      </div></Card>
    </div>

    <Card className="p-5"><h2 className="font-bold text-navy-900">Assignment Order</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(orderNames) as DistributionOrder[]).map((item) => <label key={item} className={`cursor-pointer rounded-xl border p-4 text-sm ${assignmentOrder === item ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input type="radio" className="mr-2" checked={assignmentOrder === item} onChange={() => { setAssignmentOrder(item); setPreview(null); }} />{orderNames[item]}</label>)}</div></Card>

    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="cursor-pointer p-5 font-bold text-navy-900">Advanced Filters</summary><div className="border-t border-slate-100 p-5"><p className="mb-4 text-sm text-slate-500">Filter architecture placeholder. These controls do not affect distribution yet.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{["GE", "CWE", "State", "Organisation", "Tender Value", "Tender Status"].map((filter) => <label key={filter} className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600"><input type="checkbox" disabled />{filter}</label>)}</div></div></details>

    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="font-bold text-navy-900">Distribution Pool</h2><p className="text-sm text-slate-500">Every active User and Manager</p></div><div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => choose(initialOverview.pool.map((u) => u.id))}>Select All</Button><Button variant="secondary" onClick={() => choose([])}>Clear All</Button>
      <Button variant="secondary" onClick={() => choose(initialOverview.pool.filter((u) => u.role === "USER").map((u) => u.id))}>Only Users</Button><Button variant="secondary" onClick={() => choose(initialOverview.pool.filter((u) => u.role === "MANAGER").map((u) => u.id))}>Only Managers</Button>
    </div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Select</th><th>Team member</th><th>Role</th><th>Assigned</th><th>Active leads</th><th>Awarded value</th><th>Follow-ups</th><th>Last login</th></tr></thead><tbody>
      {initialOverview.pool.map((user) => <tr key={user.id} className="border-t border-slate-100 hover:bg-blue-50/40"><td className="p-4"><input type="checkbox" className="h-4 w-4" checked={selected.has(user.id)} onChange={() => toggle(user.id)} /></td><td><div className="flex items-center gap-3"><Avatar name={user.full_name || user.email} /><div><p className="font-semibold text-navy-900">{user.full_name || user.email}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td><td><Badge tone={user.role === "MANAGER" ? "orange" : "blue"}>{user.role}</Badge></td><td>{user.current_assigned}</td><td>{user.current_active}</td><td>{money.format(user.total_awarded_value || 0)}</td><td>{user.follow_up_count}</td><td>{user.last_login ? new Date(user.last_login).toLocaleString("en-IN") : "Not available"}</td></tr>)}
    </tbody></table></div></Card>

    <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500">{selected.size} team members selected</p><Button onClick={runPreview} disabled={!selected.size || isPending}><RefreshCw size={16} className={isPending ? "animate-spin" : ""} />Preview Distribution</Button></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!initialOverview.unassigned && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-800">Nothing to distribute.</div>}

    {preview && <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Distribution Preview</p><h2 className="mt-1 text-2xl font-bold text-navy-900">Assigning {preview.assigning.toLocaleString("en-IN")} leads</h2><p className="text-sm text-slate-500">Estimated completion: {estimatedSeconds} seconds</p></div><Button onClick={() => setConfirmStart(true)} disabled={!selected.size || !preview.assigning || isPending}><Play size={16} />Start Distribution</Button></div>{preview.warning && <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm font-medium text-orange-700">{preview.warning}</p>}<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total Unassigned" value={preview.totalTenders} /><Metric label="Assigning" value={preview.assigning} /><Metric label="Remaining" value={preview.remaining} /><Metric label="Algorithm" value={algorithmNames[algorithm]} small /><Metric label="Order" value={orderNames[assignmentOrder]} small /></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{preview.allocations.map((row) => <div key={row.userId} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-navy-900">{row.name}</p><div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Current {row.currentWorkload}</span><strong className="text-blue-700">+ {row.assigned}</strong></div></div>)}</div></Card>}

    {batch && <Card className="p-5">{batch.status === "COMPLETED" ? <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex gap-3"><CheckCircle2 className="text-emerald-600" /><div><h2 className="text-xl font-bold text-navy-900">Lead Distribution Completed</h2><p className="text-sm text-slate-600">Assigned {batch.completed_tenders.toLocaleString("en-IN")} · Remaining {batch.remaining_quantity.toLocaleString("en-IN")} · {batch.selected_users.length} users</p><p className="text-sm text-slate-600">{algorithmNames[batch.algorithm]} · {orderNames[batch.assignment_order]}</p><p className="text-xs text-slate-500">Duration {duration(batch)}</p></div></div><div className="flex flex-wrap gap-2"><Button onClick={() => setReportOpen(true)}>View Report</Button><Button variant="secondary" onClick={() => exportBatch(batch, "excel")}><Download size={15} />Export Excel</Button><Button variant="secondary" onClick={() => exportBatch(batch, "pdf")}><Download size={15} />Export PDF</Button></div></div> : <><div className="flex justify-between text-sm"><strong>Assigned</strong><span>{batch.completed_tenders.toLocaleString("en-IN")} / {batch.total_tenders.toLocaleString("en-IN")}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-gradient-to-r from-blue-600 to-orange-500 transition-all" style={{ width: `${progress}%` }} /></div></>}</Card>}
    {confirmStart && preview && <Dialog title="Confirm distribution" onClose={() => setConfirmStart(false)}><p>You are about to assign <strong>{preview.assigning.toLocaleString("en-IN")}</strong> tenders.</p><p className="mt-2"><strong>{preview.remaining.toLocaleString("en-IN")}</strong> tenders will remain unassigned.</p><p className="mt-3 font-semibold">Continue?</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmStart(false)}>No</Button><Button onClick={startDistribution}>Yes</Button></div></Dialog>}
    {reportOpen && batch && <ReportDialog batch={batch} onClose={() => setReportOpen(false)} />}
  </div>;
}

function Metric({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) { return <Card className="border-l-4 border-l-orange-400 p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 font-bold text-navy-900 ${small ? "text-sm" : "text-2xl"}`}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p></Card>; }
function Avatar({ name }: { name: string }) { return <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 text-sm font-bold text-white">{name.split(/\s+/).slice(0,2).map((v) => v[0]).join("").toUpperCase()}</div>; }
function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-lg font-bold text-navy-900">{title}</h2><button onClick={onClose}><X size={20} /></button></div><div className="mt-4 text-sm text-slate-600">{children}</div></div></div>; }
function duration(batch: Batch) { if (!batch.completed_at) return "—"; const ms = new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime(); return `${(ms / 1000).toFixed(1)} seconds`; }

function ReportDialog({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { getDistributionReportAction(batch.id, 1, 100).then((r) => setRows(r.rows)).finally(() => setLoading(false)); }, [batch.id]);
  return <Dialog title="Distribution Report" onClose={onClose}><div className="mb-4 flex gap-2"><Button variant="secondary" onClick={() => exportBatch(batch, "excel")} disabled={!rows.length}><Download size={15} />Export Excel</Button><Button variant="secondary" onClick={() => exportBatch(batch, "pdf")} disabled={!rows.length}><Download size={15} />Export PDF</Button></div><div className="max-h-[60vh] overflow-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b"><th className="p-2">Tender</th><th>Old User</th><th>New User</th><th>Assigned At</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-b"><td className="p-2">{r.tender?.tender_id || r.tender_id}</td><td>{profileName(r.old_profile)}</td><td>{profileName(r.new_profile)}</td><td>{new Date(r.assigned_at).toLocaleString("en-IN")}</td></tr>)}</tbody></table>{loading && <p className="p-4">Loading report…</p>}</div>{batch.total_tenders > 100 && <p className="mt-3 text-xs text-slate-500">Showing the first 100 rows. Exports include the complete batch.</p>}</Dialog>;
}
async function loadAllReportRows(batch: Batch) { const output: any[] = []; for (let page = 1; output.length < batch.total_tenders; page++) { const result = await getDistributionReportAction(batch.id, page, 5000); output.push(...result.rows); if (!result.rows.length || output.length >= result.total) break; } return output; }
async function exportBatch(batch: Batch, format: "excel" | "pdf") { const rows = await loadAllReportRows(batch); if (format === "excel") { const XLSX = await import("xlsx"); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(reportRow)), "Distribution"); XLSX.writeFile(wb, `lead-distribution-${batch.id}.xlsx`); return; } const { jsPDF } = await import("jspdf"); const autoTable = (await import("jspdf-autotable")).default; const doc = new jsPDF({ orientation: "landscape" }); doc.text("Lead Distribution Report", 14, 14); autoTable(doc, { head: [["Tender", "Old User", "New User", "Assigned At"]], body: rows.map((r) => Object.values(reportRow(r))) }); doc.save(`lead-distribution-${batch.id}.pdf`); }
function profileName(value: any) { const p = Array.isArray(value) ? value[0] : value; return p?.full_name || p?.email || "Unassigned"; }
function reportRow(r: any) { return { Tender: r.tender?.tender_id || r.tender_id, "Old User": profileName(r.old_profile), "New User": profileName(r.new_profile), "Assigned At": new Date(r.assigned_at).toLocaleString("en-IN") }; }

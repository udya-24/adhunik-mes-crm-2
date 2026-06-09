import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { upsertLeadStatusAction } from "@/app/actions/settings";
import { aiModules } from "@/lib/constants";
import type { LeadStatusMaster } from "@/lib/types";

export function SettingsPanel({ leadStatuses }: { leadStatuses: LeadStatusMaster[] }) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Workspace" title="Settings" description="Storage, AI roadmap, and operational configuration for the MES CRM." />
      <Card>
        <h2 className="font-bold text-navy-900">Lead Status Management</h2>
        <form action={upsertLeadStatusAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_140px_120px]">
          <Field label="Status Name">
            <input name="status_name" className={inputClass} required />
          </Field>
          <Field label="Order">
            <input name="sort_order" type="number" min="1" className={inputClass} required defaultValue={leadStatuses.length + 1} />
          </Field>
          <Field label="Color">
            <input name="status_color" type="color" className="h-10 w-full rounded-lg border border-border bg-white px-2" defaultValue="#173b71" />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input name="is_active" type="checkbox" defaultChecked />
            Active
          </label>
          <button className="inline-flex h-10 items-center justify-center rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white md:col-span-4">Add Status</button>
        </form>
        <div className="mt-5 space-y-3">
          {leadStatuses.map((status) => (
            <form key={status.id} action={upsertLeadStatusAction} className="grid gap-3 rounded-lg border border-border bg-slate-50 p-3 md:grid-cols-[1fr_120px_140px_120px_auto]">
              <input type="hidden" name="id" value={status.id.startsWith("fallback-") ? "" : status.id} />
              <input name="status_name" className={inputClass} defaultValue={status.status_name} required />
              <input name="sort_order" type="number" min="1" className={inputClass} defaultValue={status.sort_order} required />
              <input name="status_color" type="color" className="h-10 w-full rounded-lg border border-border bg-white px-2" defaultValue={status.status_color} />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input name="is_active" type="checkbox" defaultChecked={status.is_active} />
                Active
              </label>
              <button className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-navy-900">Save</button>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-bold text-navy-900">Storage Buckets</h2>
        <p className="mt-2 text-sm text-slate-600">Configured folders: /boq, /aoc, /tender-documents, /quotations.</p>
      </Card>
      <Card>
        <h2 className="font-bold text-navy-900">Phase 2 AI Architecture</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {aiModules.map((module) => (
            <div key={module} className="rounded-xl border border-border bg-slate-50 p-3 text-sm font-semibold text-navy-900">{module}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

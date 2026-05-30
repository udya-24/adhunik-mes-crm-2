import { Card } from "@/components/ui/card";
import { aiModules } from "@/lib/constants";

export function SettingsPanel() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
      <Card>
        <h2 className="font-bold text-navy-900">Storage Buckets</h2>
        <p className="mt-2 text-sm text-slate-600">Configured folders: /boq, /aoc, /tender-documents, /quotations.</p>
      </Card>
      <Card>
        <h2 className="font-bold text-navy-900">Phase 2 AI Architecture</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {aiModules.map((module) => (
            <div key={module} className="rounded-md border border-border p-3 text-sm font-semibold text-navy-900">{module}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

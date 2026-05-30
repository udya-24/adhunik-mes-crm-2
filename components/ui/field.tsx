import { cn } from "@/lib/utils";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

export const inputClass = cn(
  "h-10 rounded-md border border-border bg-white px-3 text-sm text-slate-900 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
);

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-soft md:flex-row md:items-center md:justify-between", className)}>
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-navy-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

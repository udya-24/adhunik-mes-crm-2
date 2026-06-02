import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "blue" | "amber" | "orange" | "green" | "red" | "slate";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  blue: "bg-navy-50 text-navy-700 ring-navy-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  orange: "bg-orange-50 text-orange-600 ring-orange-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-50 text-slate-700 ring-slate-200"
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1", tones[tone], className)}
      {...props}
    />
  );
}

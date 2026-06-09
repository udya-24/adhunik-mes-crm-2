import { Card } from "@/components/ui/card";
import type { AgeingBucket } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Timer } from "lucide-react";

export function AgeingWidgets({ buckets }: { buckets: AgeingBucket[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {buckets.map((bucket) => (
        <Card key={bucket.name}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{bucket.name}</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Timer size={18} />
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-navy-900">{bucket.count}</p>
          <div className="mt-3 space-y-1 text-xs font-semibold text-slate-600">
            <p>Our Value: {formatCurrency(bucket.ourValue)}</p>
            <p>Awarded: {formatCurrency(bucket.awardedValue)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

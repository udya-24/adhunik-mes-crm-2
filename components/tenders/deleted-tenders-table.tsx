"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { restoreTenderAction } from "@/app/actions/tenders";
import { DateTime } from "@/components/common/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Profile, Tender } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type DeletedTenderRow = Tender & {
  deleted_by_profile?: Pick<Profile, "full_name" | "email"> | null;
};

export function DeletedTendersTable({ tenders }: { tenders: DeletedTenderRow[] }) {
  const [rows, setRows] = useState(tenders);
  const [restoreTarget, setRestoreTarget] = useState<DeletedTenderRow | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [isRestoring, startRestoreTransition] = useTransition();

  function confirmRestore() {
    if (!restoreTarget) return;
    setRestoreError("");
    startRestoreTransition(async () => {
      try {
        await restoreTenderAction(restoreTarget.id);
        setRows((current) => current.filter((row) => row.id !== restoreTarget.id));
        setRestoreTarget(null);
      } catch (error) {
        setRestoreError(error instanceof Error ? error.message : "Tender could not be restored.");
      }
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[9rem]" />
              <col className="w-[18rem]" />
              <col className="w-[10rem]" />
              <col className="w-[9rem]" />
              <col className="w-[11rem]" />
              <col className="w-[12rem]" />
              <col className="w-[7rem]" />
            </colgroup>
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                {["Tender ID", "Tender Title", "Bidder", "Awarded", "Deleted By", "Deleted At", ""].map((head) => (
                  <th key={head} className="px-3 py-3 font-bold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((tender) => (
                <tr key={tender.id} className="border-t border-border align-middle hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-navy-900">{tender.tender_id}</td>
                  <td className="px-3 py-2 text-slate-700">{tender.tender_title || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{tender.bidder_name || "-"}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(tender.awarded_value)}</td>
                  <td className="px-3 py-2 text-slate-700">{tender.deleted_by_profile?.full_name || tender.deleted_by_profile?.email || "-"}</td>
                  <td className="px-3 py-2 text-slate-700"><DateTime value={tender.deleted_at} /></td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="secondary" className="h-8 px-3" onClick={() => setRestoreTarget(tender)}>
                      <RefreshCcw size={15} />
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-600">
                    No deleted tenders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {rows.length > 0 && (
        <div className="text-sm text-slate-600">
          <Badge tone="slate">{rows.length} deleted</Badge>
        </div>
      )}

      <RestoreModal
        tender={restoreTarget}
        error={restoreError}
        isPending={isRestoring}
        onCancel={() => {
          if (!isRestoring) {
            setRestoreError("");
            setRestoreTarget(null);
          }
        }}
        onConfirm={confirmRestore}
      />
    </>
  );
}

function RestoreModal({
  tender,
  error,
  isPending,
  onCancel,
  onConfirm
}: {
  tender: DeletedTenderRow | null;
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
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-50 text-green-700">
            <RefreshCcw size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-navy-900">Restore tender?</h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{tender.tender_id}</span> will return to the active tender list and reports.
            </p>
          </div>
        </div>
        {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Restore
          </Button>
        </div>
      </div>
    </div>
  );
}

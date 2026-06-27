import { Badge } from "@/components/ui/badge";
import type { ProformaInvoice } from "@/lib/types";

export function PiStatusBadge({ status }: { status: ProformaInvoice["status"] }) {
  const tone = status === "APPROVED" ? "green" : status === "CANCELLED" ? "red" : status === "SENT" ? "blue" : "slate";
  return <Badge tone={tone}>{status}</Badge>;
}

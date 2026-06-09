import { SettingsPanel } from "@/components/settings/settings-panel";
import { getLeadStatuses } from "@/lib/data";

export default async function SettingsPage() {
  const leadStatuses = await getLeadStatuses();
  return <SettingsPanel leadStatuses={leadStatuses} />;
}

import { IntelligenceTable } from "@/components/intelligence/intelligence-table";
import { getContractorIntelligence } from "@/lib/data";

export default async function ContractorIntelligencePage() {
  const rows = await getContractorIntelligence();
  return <IntelligenceTable rows={rows} />;
}

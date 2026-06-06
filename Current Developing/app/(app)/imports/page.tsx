import { ExcelImportPanel } from "@/components/imports/excel-import-panel";
import { ManualTenderForm } from "@/components/tenders/manual-tender-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile } from "@/lib/auth";
import { getUploadHistory } from "@/lib/data";
import { canUseExcelImport } from "@/lib/permissions";

export default async function ImportsPage() {
  const profile = await getCurrentProfile();
  const showExcelImport = profile ? canUseExcelImport(profile.role) : false;
  const history = showExcelImport ? await getUploadHistory() : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Data Capture" title="Tender Intake" description="Create manual tender records and import bulk Excel tender data based on role permissions." />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {showExcelImport && <ExcelImportPanel history={history} />}
        <ManualTenderForm />
      </div>
    </div>
  );
}

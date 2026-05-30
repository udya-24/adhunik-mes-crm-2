"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import { createTenderAction } from "@/app/actions/tenders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { invalidateTenderQueries } from "@/lib/queries/tenders";
import { createClient } from "@/lib/supabase/client";
import type { ManualTenderInsert } from "@/lib/types";

type AttachmentKey = "boq_attachment_url" | "aoc_attachment_url" | "tender_document_url";

type AttachmentConfig = {
  key: AttachmentKey;
  label: string;
  bucket: "boq" | "aoc" | "tender-documents";
};

const attachmentFields: AttachmentConfig[] = [
  { key: "boq_attachment_url", label: "BOQ Attachment", bucket: "boq" },
  { key: "aoc_attachment_url", label: "AOC Attachment", bucket: "aoc" },
  { key: "tender_document_url", label: "Tender Document Attachment", bucket: "tender-documents" }
];

const textFields = [
  ["organisation_chain", "Organisation Chain"],
  ["ge", "GE"],
  ["cwe", "CWE"],
  ["tender_ref_no", "Tender Ref No"],
  ["bid_number", "Bid Number"],
  ["bidder_name", "Bidder Name"],
  ["make", "Make"],
  ["email", "Email"],
  ["contact_number_1", "Contact Number 1"],
  ["contact_number_2", "Contact Number 2"],
  ["contact_number_3", "Contact Number 3"]
] as const;

function textValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value.length ? value : null;
}

function numberValue(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  return raw.length ? Number(raw) : null;
}

function buildStoragePath(tenderId: string, file: File) {
  const safeTenderId = tenderId.replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeName = file.name.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return `${safeTenderId}/${Date.now()}-${safeName}`;
}

export function ManualTenderForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Partial<Record<AttachmentKey, boolean>>>({});
  const [attachments, setAttachments] = useState<Partial<Record<AttachmentKey, string>>>({});

  const isBusy = useMemo(() => saving || Object.values(uploading).some(Boolean), [saving, uploading]);

  async function uploadTenderFile(config: AttachmentConfig, file: File, tenderId: string) {
    const supabase = createClient();
    const path = buildStoragePath(tenderId, file);
    setUploading((current) => ({ ...current, [config.key]: true }));

    const { error } = await supabase.storage.from(config.bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    setUploading((current) => ({ ...current, [config.key]: false }));

    if (error) {
      console.error(`Supabase storage upload error for ${config.bucket}`, error);
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
    setAttachments((current) => ({ ...current, [config.key]: data.publicUrl }));
    return data.publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const tenderId = String(formData.get("tender_id") ?? "").trim();
    const tenderTitle = String(formData.get("tender_title") ?? "").trim();

    if (!tenderId || !tenderTitle) {
      setToast({ type: "error", message: "Tender ID and Tender Title are required." });
      return;
    }

    setSaving(true);
    try {
      const uploadedUrls: Partial<Record<AttachmentKey, string>> = { ...attachments };

      for (const config of attachmentFields) {
        const file = formData.get(config.key);
        if (file instanceof File && file.size > 0) {
          uploadedUrls[config.key] = await uploadTenderFile(config, file, tenderId);
        }
      }

      const payload: ManualTenderInsert = {
        tender_id: tenderId,
        tender_title: tenderTitle,
        organisation_chain: textValue(formData, "organisation_chain"),
        ge: textValue(formData, "ge"),
        cwe: textValue(formData, "cwe"),
        tender_ref_no: textValue(formData, "tender_ref_no"),
        contract_date: textValue(formData, "contract_date"),
        bid_number: textValue(formData, "bid_number"),
        bidder_name: textValue(formData, "bidder_name"),
        currency: textValue(formData, "currency") ?? "INR",
        awarded_value: numberValue(formData, "awarded_value"),
        contact_number_1: textValue(formData, "contact_number_1"),
        contact_number_2: textValue(formData, "contact_number_2"),
        contact_number_3: textValue(formData, "contact_number_3"),
        address: textValue(formData, "address"),
        make: textValue(formData, "make"),
        email: textValue(formData, "email"),
        our_value: numberValue(formData, "our_value"),
        boq_attachment_url: uploadedUrls.boq_attachment_url ?? null,
        aoc_attachment_url: uploadedUrls.aoc_attachment_url ?? null,
        tender_document_url: uploadedUrls.tender_document_url ?? null
      };

      await createTenderAction(payload);
      await invalidateTenderQueries(queryClient);
      setToast({ type: "success", message: "Manual tender entry saved successfully." });
      setAttachments({});
      form.reset();
      router.refresh();
    } catch (error) {
      console.error("Manual tender save failed", error);
      setToast({ type: "error", message: error instanceof Error ? error.message : "Manual tender entry could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-navy-900">Manual Tender Entry</h1>
      <p className="mb-5 text-sm text-slate-600">Manual and Excel records use the same tenders table with source tracking.</p>

      {toast && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm font-medium ${
            toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tender ID">
          <input name="tender_id" required className={inputClass} />
        </Field>
        <Field label="Tender Title">
          <input name="tender_title" required className={inputClass} />
        </Field>

        {textFields.map(([name, label]) => (
          <Field key={name} label={label}>
            <input name={name} type={name === "email" ? "email" : "text"} className={inputClass} />
          </Field>
        ))}

        <Field label="Contract Date">
          <input name="contract_date" type="date" className={inputClass} />
        </Field>
        <Field label="Currency">
          <input name="currency" defaultValue="INR" className={inputClass} />
        </Field>
        <Field label="Awarded Value">
          <input name="awarded_value" type="number" min="0" step="0.01" className={inputClass} />
        </Field>
        <Field label="Our Value">
          <input name="our_value" type="number" min="0" step="0.01" className={inputClass} />
        </Field>
        <Field label="Address">
          <textarea name="address" className={`${inputClass} h-24 py-2`} />
        </Field>

        <div className="grid gap-4 sm:col-span-2 lg:grid-cols-3">
          {attachmentFields.map((field) => (
            <Field key={field.key} label={field.label}>
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-slate-50 px-3 py-4 text-center text-sm text-slate-600 hover:bg-slate-100">
                {uploading[field.key] ? <Loader2 className="mb-2 animate-spin text-navy-700" size={20} /> : <UploadCloud className="mb-2 text-navy-700" size={20} />}
                <span className="font-semibold text-navy-900">{attachments[field.key] ? "Uploaded" : "Choose file"}</span>
                <span className="text-xs">PDF, DOCX, XLSX, ZIP</span>
                <input name={field.key} type="file" accept=".pdf,.docx,.xlsx,.xls,.zip" className="hidden" />
              </label>
            </Field>
          ))}
        </div>

        <div className="sm:col-span-2">
          <Button disabled={isBusy}>
            {isBusy && <Loader2 size={16} className="animate-spin" />}
            {isBusy ? "Saving..." : "Add Manual Entry"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

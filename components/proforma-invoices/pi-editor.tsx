"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { createProformaInvoiceAction, updateProformaInvoiceAction } from "@/app/actions/proforma-invoices";
import { ImsItemCombobox } from "@/components/ims/ims-item-combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { piCompanyHeaderUrl } from "@/lib/constants";
import { formatPiCurrency } from "@/lib/proforma-document";
import type { Profile, ProformaInvoice, ProformaInvoiceInput, ProformaInvoiceItem, ProformaInvoiceStatus, ProformaInvoiceTerm } from "@/lib/types";

const defaultTerms: ProformaInvoiceTerm[] = [
  { term_key: "Payment Terms", term_value: "", display_order: 0 },
  { term_key: "Delivery", term_value: "", display_order: 1 },
  { term_key: "Validity", term_value: "", display_order: 2 },
  { term_key: "Freight", term_value: "", display_order: 3 }
];

const emptyItem: ProformaInvoiceItem = { line_no: 1, ims_master_id: null, item_category: "", item_description: "", make: "", model_type: "", quantity: 1, unit_price: 0, total_price: 0 };

export function PiEditor({ invoice, profile }: { invoice?: ProformaInvoice; profile: Profile }) {
  const router = useRouter();
  const profileMobile = String((profile as Profile & { mobile?: string | null; mobile_no?: string | null }).mobile ?? (profile as Profile & { mobile_no?: string | null }).mobile_no ?? "");
  const [form, setForm] = useState(() => ({
    pi_no: invoice?.pi_no ?? "",
    pi_date: invoice?.pi_date ?? new Date().toISOString().slice(0, 10),
    our_ref_no: invoice?.our_ref_no ?? "",
    dp_code: invoice?.dp_code ?? "",
    mobile_no: invoice?.mobile_no ?? "",
    indentor_name: invoice?.indentor_name ?? "",
    indentor_address: invoice?.indentor_address ?? "",
    email: invoice?.email ?? "",
    gstin: invoice?.gstin ?? "",
    po_no: invoice?.po_no ?? "",
    po_date: invoice?.po_date ?? "",
    project: invoice?.project ?? "",
    status: invoice?.status ?? "DRAFT" as ProformaInvoiceStatus,
    gst_percentage: invoice?.gst_percentage ?? 0,
    signature_designation: invoice?.signature_designation ?? "",
    signature_email: invoice?.signature_email ?? profile.email ?? "",
    signature_mobile: invoice?.signature_mobile ?? profileMobile
  }));
  const [items, setItems] = useState<ProformaInvoiceItem[]>(invoice?.items.length ? invoice.items : [{ ...emptyItem }]);
  const [terms, setTerms] = useState<ProformaInvoiceTerm[]>(invoice?.terms.length ? invoice.terms : defaultTerms);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0), [items]);
  const gstAmount = useMemo(() => subtotal * Math.max(0, Number(form.gst_percentage) || 0) / 100, [form.gst_percentage, subtotal]);
  const grandTotal = subtotal + gstAmount;

  function setValue(name: keyof typeof form, value: string | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateItem(index: number, patch: Partial<ProformaInvoiceItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateTerm(index: number, patch: Partial<ProformaInvoiceTerm>) {
    setTerms((current) => current.map((term, termIndex) => termIndex === index ? { ...term, ...patch } : term));
  }

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const payload: ProformaInvoiceInput = {
        ...form,
        our_ref_no: form.our_ref_no || null,
        dp_code: form.dp_code || null,
        mobile_no: form.mobile_no || null,
        indentor_address: form.indentor_address || null,
        email: form.email || null,
        gstin: form.gstin || null,
        po_no: form.po_no || null,
        po_date: form.po_date || null,
        project: form.project || null,
        signature_designation: form.signature_designation || null,
        signature_email: form.signature_email || null,
        signature_mobile: form.signature_mobile || null,
        items: items.map((item, index) => ({ ...item, line_no: index + 1, total_price: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) })),
        terms: terms.map((term, index) => ({ ...term, display_order: index }))
      };
      const result = invoice ? await updateProformaInvoiceAction(invoice.id, payload) : await createProformaInvoiceAction(payload);
      setMessage({ type: "success", text: "Proforma invoice saved successfully." });
      router.push(`/proforma-invoices/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save proforma invoice." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
        {message ? (
          <div className={`rounded-xl border p-3 text-sm font-semibold ${message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message.text}
          </div>
        ) : null}

        <Card>
          <h2 className="text-xl font-bold text-navy-900">Fixed PI Header</h2>
          <p className="mt-1 text-sm text-slate-500">Used automatically for preview, PDF, and DOCX.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <img src={piCompanyHeaderUrl} alt="Adhunik Switchgears Pvt. Ltd. PI header" className="h-auto w-full object-contain" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-5 text-xl font-bold text-navy-900">PI Details</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="PI No."><input className={inputClass} value={form.pi_no} onChange={(event) => setValue("pi_no", event.target.value)} required /></Field>
            <Field label="Date"><input type="date" className={inputClass} value={form.pi_date} onChange={(event) => setValue("pi_date", event.target.value)} required /></Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(event) => setValue("status", event.target.value as ProformaInvoiceStatus)}>
                {["DRAFT", "SENT", "APPROVED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Our Ref No."><input className={inputClass} value={form.our_ref_no} onChange={(event) => setValue("our_ref_no", event.target.value)} /></Field>
            <Field label="DP Code"><input className={inputClass} value={form.dp_code} onChange={(event) => setValue("dp_code", event.target.value)} /></Field>
            <Field label="Mobile No."><input className={inputClass} value={form.mobile_no} onChange={(event) => setValue("mobile_no", event.target.value)} /></Field>
            <Field label="Indentor Name"><input className={inputClass} value={form.indentor_name} onChange={(event) => setValue("indentor_name", event.target.value)} required /></Field>
            <Field label="E-mail"><input type="email" className={inputClass} value={form.email} onChange={(event) => setValue("email", event.target.value)} /></Field>
            <Field label="GSTIN"><input className={inputClass} value={form.gstin} onChange={(event) => setValue("gstin", event.target.value)} /></Field>
            <Field label="PO No."><input className={inputClass} value={form.po_no} onChange={(event) => setValue("po_no", event.target.value)} /></Field>
            <Field label="PO Date"><input type="date" className={inputClass} value={form.po_date} onChange={(event) => setValue("po_date", event.target.value)} /></Field>
            <Field label="Project"><input className={inputClass} value={form.project} onChange={(event) => setValue("project", event.target.value)} /></Field>
            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Indentor Address"><textarea className={`${inputClass} min-h-24 w-full py-2`} value={form.indentor_address} onChange={(event) => setValue("indentor_address", event.target.value)} /></Field>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Items</h2>
              <p className="text-sm text-slate-500">Totals update live as quantities and prices change.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { ...emptyItem, line_no: current.length + 1 }])}>
              <Plus size={16} /> Add Row
            </Button>
          </div>
          <div className="table-scroll overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-20 px-3 py-3 text-center">Sl. No.</th>
                  <th className="min-w-[520px] px-3 py-3">IMS Item</th>
                  <th className="w-40 px-3 py-3">Model Type</th>
                  <th className="w-28 px-3 py-3">Qty.</th>
                  <th className="w-40 px-3 py-3">Unit Price</th>
                  <th className="w-40 px-3 py-3 text-right">Total</th>
                  <th className="w-36 px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-t border-border align-top">
                    <td className="px-3 py-3 text-center font-bold text-navy-900">{index + 1}</td>
                    <td className="px-3 py-3">
                      <ImsItemCombobox
                        category={item.item_category}
                        search={item.item_description}
                        onCategoryChange={(value) => updateItem(index, { item_category: value })}
                        onSearchChange={(value) => updateItem(index, { item_description: value, ims_master_id: null })}
                        onSelect={(imsItem) => updateItem(index, {
                          ims_master_id: imsItem.id,
                          item_category: imsItem.item_category,
                          item_description: imsItem.item_description,
                          make: imsItem.make ?? "",
                          model_type: imsItem.model ?? item.model_type ?? ""
                        })}
                      />
                      <input className={`${inputClass} mt-2 w-full`} value={item.make ?? ""} placeholder="Make" onChange={(event) => updateItem(index, { make: event.target.value })} />
                    </td>
                    <td className="px-3 py-3"><input className={`${inputClass} w-full`} value={item.model_type || ""} onChange={(event) => updateItem(index, { model_type: event.target.value })} /></td>
                    <td className="px-3 py-3"><input type="number" min="0" step="0.001" className={`${inputClass} w-full`} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></td>
                    <td className="px-3 py-3"><input type="number" min="0" step="0.01" className={`${inputClass} w-full`} value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} /></td>
                    <td className="px-3 py-4 text-right font-bold text-navy-900">{formatPiCurrency(item.quantity * item.unit_price)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label="Move row up" disabled={index === 0} onClick={() => setItems(move(items, index, index - 1))}><ArrowUp size={15} /></IconButton>
                        <IconButton label="Move row down" disabled={index === items.length - 1} onClick={() => setItems(move(items, index, index + 1))}><ArrowDown size={15} /></IconButton>
                        <IconButton label="Delete row" disabled={items.length === 1} onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} danger><Trash2 size={15} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-border bg-slate-50 p-5">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <SummaryRow label="Subtotal" value={formatPiCurrency(subtotal)} />
              <div className="grid grid-cols-[1fr_9rem] items-center gap-4 border-b border-border px-4 py-3">
                <label htmlFor="pi-gst-percentage" className="font-semibold text-slate-600">GST %</label>
                <div className="relative">
                  <input id="pi-gst-percentage" type="number" min="0" step="0.01" className={`${inputClass} w-full pr-8 text-right`} value={form.gst_percentage} onChange={(event) => setValue("gst_percentage", Math.max(0, Number(event.target.value) || 0))} />
                  <span className="pointer-events-none absolute right-3 top-2.5 text-sm font-bold text-slate-400">%</span>
                </div>
              </div>
              <SummaryRow label="GST Amount" value={formatPiCurrency(gstAmount)} />
              <div className="flex items-center justify-between gap-4 bg-navy-900 px-4 py-4 text-white">
                <span className="text-base font-bold">Grand Total</span>
                <span className="text-lg font-bold">{formatPiCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-navy-900">Terms & Conditions</h2>
              <p className="text-sm text-slate-500">Edit, add, delete, or reorder terms.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setTerms((current) => [...current, { term_key: "", term_value: "", display_order: current.length }])}>
              <Plus size={16} /> Add Term
            </Button>
          </div>
          <div className="space-y-3">
            {terms.map((term, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 md:grid-cols-[0.35fr_1fr_auto]">
                <input className={inputClass} placeholder="Term" value={term.term_key} onChange={(event) => updateTerm(index, { term_key: event.target.value })} />
                <textarea className={`${inputClass} min-h-20 py-2`} placeholder="Value" value={term.term_value} onChange={(event) => updateTerm(index, { term_value: event.target.value })} />
                <div className="flex items-center justify-end gap-1">
                  <IconButton label="Move term up" disabled={index === 0} onClick={() => setTerms(move(terms, index, index - 1))}><ArrowUp size={15} /></IconButton>
                  <IconButton label="Move term down" disabled={index === terms.length - 1} onClick={() => setTerms(move(terms, index, index + 1))}><ArrowDown size={15} /></IconButton>
                  <IconButton label="Delete term" onClick={() => setTerms(terms.filter((_, termIndex) => termIndex !== index))} danger><Trash2 size={15} /></IconButton>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-5 text-xl font-bold text-navy-900">Signature</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Designation"><input className={inputClass} value={form.signature_designation} onChange={(event) => setValue("signature_designation", event.target.value)} placeholder="Sales Manager" /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={form.signature_email} onChange={(event) => setValue("signature_email", event.target.value)} /></Field>
            <Field label="Mobile"><input className={inputClass} value={form.signature_mobile} onChange={(event) => setValue("signature_mobile", event.target.value)} /></Field>
          </div>
        </Card>

      <div className="sticky bottom-4 z-20 flex justify-end">
        <Button className="min-w-40 shadow-lift" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? "Saving..." : "Save PI"}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3"><span className="font-semibold text-slate-600">{label}</span><span className="font-bold text-navy-900">{value}</span></div>;
}

function IconButton({ children, label, danger, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} className={`grid h-9 w-9 place-items-center rounded-lg border bg-white disabled:opacity-30 ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-border text-slate-600 hover:bg-slate-100"}`} {...props}>
      {children}
    </button>
  );
}

function move<T>(rows: T[], from: number, to: number) {
  if (to < 0 || to >= rows.length) return rows;
  const copy = [...rows];
  const [row] = copy.splice(from, 1);
  copy.splice(to, 0, row);
  return copy;
}

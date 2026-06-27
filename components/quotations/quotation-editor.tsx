"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { createQuotationAction, updateQuotationAction } from "@/app/actions/quotations";
import { ImsItemCombobox } from "@/components/ims/ims-item-combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { defaultCompanyHeaderUrl } from "@/lib/constants";
import { formatQuotationCurrency } from "@/lib/quotation-export";
import type { Quotation, QuotationInput, QuotationItem, QuotationStatus, QuotationTerm } from "@/lib/types";

const defaultTerms: QuotationTerm[] = [
  { term_key: "GST", term_value: "Extra as applicable", display_order: 0 },
  { term_key: "Payment Terms", term_value: "", display_order: 1 },
  { term_key: "Delivery", term_value: "", display_order: 2 },
  { term_key: "Validity", term_value: "30 days", display_order: 3 },
  { term_key: "Freight", term_value: "", display_order: 4 }
];

const emptyItem: QuotationItem = { line_no: 1, ims_master_id: null, item_category: "", item_description: "", make: "", model: "", quantity: 1, unit: "Nos", unit_price: 0, total_price: 0 };

export function QuotationEditor({ quotation }: { quotation?: Quotation }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    quotation_no: quotation?.quotation_no ?? "",
    quotation_date: quotation?.quotation_date ?? new Date().toISOString().slice(0, 10),
    contract_name: quotation?.contract_name ?? "",
    customer_name: quotation?.customer_name ?? "",
    address: quotation?.address ?? "",
    gst_number: quotation?.gst_number ?? "",
    contact_person: quotation?.contact_person ?? "",
    mobile_number: quotation?.mobile_number ?? "",
    email: quotation?.email ?? "",
    header_image_url: quotation?.header_image_url ?? null,
    signature_designation: quotation?.signature_designation ?? "",
    status: quotation?.status ?? "DRAFT" as QuotationStatus,
    gst_percentage: quotation?.gst_percentage ?? 0
  }));
  const [items, setItems] = useState<QuotationItem[]>(quotation?.items.length ? quotation.items : [{ ...emptyItem }]);
  const [terms, setTerms] = useState<QuotationTerm[]>(quotation?.terms.length ? quotation.terms : defaultTerms);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const displayedHeaderUrl = form.header_image_url || defaultCompanyHeaderUrl;

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items]
  );
  const gstAmount = useMemo(() => subtotal * Math.max(0, Number(form.gst_percentage) || 0) / 100, [form.gst_percentage, subtotal]);
  const grandTotal = subtotal + gstAmount;

  function setValue(name: keyof typeof form, value: string | number | null) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateItem(index: number, patch: Partial<QuotationItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateTerm(index: number, patch: Partial<QuotationTerm>) {
    setTerms((current) => current.map((term, termIndex) => termIndex === index ? { ...term, ...patch } : term));
  }

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const payload: QuotationInput = {
        ...form,
        items: items.map((item, index) => ({
          ...item,
          line_no: index + 1,
          total_price: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
        })),
        terms: terms.map((term, index) => ({ ...term, display_order: index }))
      };
      const result = quotation
        ? await updateQuotationAction(quotation.id, payload)
        : await createQuotationAction(payload);
      setMessage({ type: "success", text: "Quotation saved successfully." });
      router.push(`/quotations/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save quotation." });
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
        <div className="mb-5">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Company Standard Header</h2>
            <p className="text-sm text-slate-500">Applied automatically to previews and exported documents.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <img src={displayedHeaderUrl} alt="Adhunik Switchgears Pvt. Ltd. company header" className="h-auto w-full object-contain" />
        </div>
        {form.header_image_url ? <p className="mt-2 text-xs font-semibold text-amber-700">This existing quotation uses a custom header. The company standard is used whenever no custom header is configured.</p> : null}
      </Card>

      <Card>
        <h2 className="mb-5 text-xl font-bold text-navy-900">Quotation Details</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Quotation No"><input className={inputClass} value={form.quotation_no} onChange={(event) => setValue("quotation_no", event.target.value)} required /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={form.quotation_date} onChange={(event) => setValue("quotation_date", event.target.value)} required /></Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => setValue("status", event.target.value)}>
              {["DRAFT", "SENT", "ACCEPTED", "REJECTED"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          <Field label="Contract Name"><input className={inputClass} value={form.contract_name} onChange={(event) => setValue("contract_name", event.target.value)} /></Field>
          <Field label="Company Name"><input className={inputClass} value={form.customer_name} onChange={(event) => setValue("customer_name", event.target.value)} placeholder="Enter company name" required /></Field>
          <Field label="GST Number"><input className={inputClass} value={form.gst_number} onChange={(event) => setValue("gst_number", event.target.value)} /></Field>
          <Field label="Contact Person"><input className={inputClass} value={form.contact_person} onChange={(event) => setValue("contact_person", event.target.value)} /></Field>
          <Field label="Mobile Number"><input className={inputClass} value={form.mobile_number} onChange={(event) => setValue("mobile_number", event.target.value)} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => setValue("email", event.target.value)} /></Field>
          <Field label="Designation">
            <input
              className={inputClass}
              value={form.signature_designation}
              onChange={(event) => setValue("signature_designation", event.target.value)}
              placeholder="Sales Manager"
              list="quotation-designations"
            />
            <datalist id="quotation-designations">
              {[
                "Sales Executive",
                "Senior Sales Executive",
                "Sales Manager",
                "General Manager",
                "Business Development Executive",
                "Regional Sales Manager",
                "Director",
                "Authorized Signatory"
              ].map((designation) => <option key={designation} value={designation} />)}
            </datalist>
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Address"><textarea className={`${inputClass} min-h-24 w-full py-2`} value={form.address} onChange={(event) => setValue("address", event.target.value)} /></Field>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Items</h2>
            <p className="text-sm text-slate-500">Totals calculate automatically. Multi-line descriptions expand their rows.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { ...emptyItem, line_no: current.length + 1 }])}>
            <Plus size={16} /> Add Row
          </Button>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-20 px-3 py-3 text-center">Sl. No.</th>
                <th className="px-3 py-3">IMS Item</th>
                <th className="w-28 px-3 py-3">Quantity</th>
                <th className="w-28 px-3 py-3">Units</th>
                <th className="w-36 px-3 py-3">Unit Price</th>
                <th className="w-36 px-3 py-3 text-right">Total</th>
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
                        model: imsItem.model ?? "",
                        unit: imsItem.unit || item.unit || "Nos"
                      })}
                    />
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input className={`${inputClass} w-full`} value={item.make ?? ""} placeholder="Make" onChange={(event) => updateItem(index, { make: event.target.value })} />
                      <input className={`${inputClass} w-full`} value={item.model ?? ""} placeholder="Model" onChange={(event) => updateItem(index, { model: event.target.value })} />
                    </div>
                  </td>
                  <td className="px-3 py-3"><input type="number" min="0" step="0.001" className={`${inputClass} w-full`} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></td>
                  <td className="px-3 py-3"><input className={`${inputClass} w-full`} value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} /></td>
                  <td className="px-3 py-3"><input type="number" min="0" step="0.01" className={`${inputClass} w-full`} value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} /></td>
                  <td className="px-3 py-4 text-right font-bold text-navy-900">{formatQuotationCurrency(item.quantity * item.unit_price)}</td>
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
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <span className="font-semibold text-slate-600">Subtotal</span>
              <span className="font-bold text-navy-900">{formatQuotationCurrency(subtotal)}</span>
            </div>
            <div className="grid grid-cols-[1fr_9rem] items-center gap-4 border-b border-border px-4 py-3">
              <label htmlFor="gst-percentage" className="font-semibold text-slate-600">GST %</label>
              <div className="relative">
                <input
                  id="gst-percentage"
                  type="number"
                  min="0"
                  step="0.01"
                  list="gst-rates"
                  className={`${inputClass} w-full pr-8 text-right`}
                  value={form.gst_percentage}
                  onChange={(event) => setValue("gst_percentage", Math.max(0, Number(event.target.value) || 0))}
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-sm font-bold text-slate-400">%</span>
                <datalist id="gst-rates">
                  {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate} />)}
                </datalist>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <span className="font-semibold text-slate-600">GST Amount</span>
              <span className="font-bold text-navy-900">{formatQuotationCurrency(gstAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 bg-navy-900 px-4 py-4 text-white">
              <span className="text-base font-bold">Grand Total</span>
              <span className="text-lg font-bold">{formatQuotationCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Terms & Conditions</h2>
            <p className="text-sm text-slate-500">Edit, add, delete, or reorder key-value terms.</p>
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

      <div className="sticky bottom-4 z-20 flex justify-end">
        <Button className="min-w-40 shadow-lift" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Quotation"}
        </Button>
      </div>
    </div>
  );
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

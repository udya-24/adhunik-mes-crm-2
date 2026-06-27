"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { getAllImsCategories } from "@/lib/ims";
import type { ImsItemInput, ImsMasterItem } from "@/lib/types";

export type ImsImportOption = "replace" | "update" | "skip";

export type ImsImportRow = {
  item_code?: unknown;
  item_category?: unknown;
  item_description?: unknown;
  make?: unknown;
  model?: unknown;
  unit?: unknown;
  hsn_code?: unknown;
  remarks?: unknown;
};

type ExistingKey = Record<string, { id: string; is_active: boolean }>;
type NormalizedItem = {
  item_code: string | null;
  item_category: string;
  item_description: string;
  make: string | null;
  model: string | null;
  unit: string | null;
  hsn_code: string | null;
  remarks: string | null;
  is_active: boolean;
};
type NormalizedImportRow = { item: NormalizedItem; key: string };

export async function searchImsItemsAction(input: { category?: string; search?: string; limit?: number }) {
  await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = createAdminClient();
  const search = cleanText(input.search);
  const limit = Math.min(30, Math.max(5, Number(input.limit) || 12));
  let query = supabase
    .from("ims_master")
    .select("id,item_code,item_category,item_description,make,model,unit,hsn_code,is_active")
    .eq("is_active", true)
    .order("item_description")
    .limit(limit);

  if (input.category) query = query.eq("item_category", input.category);
  if (search) {
    const escaped = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`item_description.ilike.%${escaped}%,item_category.ilike.%${escaped}%,model.ilike.%${escaped}%,make.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<ImsMasterItem, "id" | "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code" | "is_active">[];
}

export async function getImsCategoriesAction() {
  await requireRole(["ADMIN", "MANAGER", "USER"]);
  return getAllImsCategories();
}

export async function saveImsItemAction(input: Partial<ImsItemInput> & { id?: string }) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = createAdminClient();
  const row = normalizeItem(input);
  const duplicateQuery = supabase
    .from("ims_master")
    .select("id")
    .eq("item_category_key", keyPart(row.item_category))
    .eq("item_description_key", keyPart(row.item_description));
  const { data: duplicate, error: duplicateError } = input.id
    ? await duplicateQuery.neq("id", input.id).maybeSingle()
    : await duplicateQuery.maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) throw new Error("An IMS item with this category and description already exists.");

  if (input.id) {
    const { error } = await supabase.from("ims_master").update({ ...row, updated_by: profile.id }).eq("id", input.id);
    if (error) throw new Error(error.message);
    revalidatePath("/ims-master");
    return { id: input.id };
  }

  const { data, error } = await supabase.from("ims_master").insert({ ...row, created_by: profile.id, updated_by: profile.id }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/ims-master");
  return { id: data.id as string };
}

export async function setImsItemActiveAction(id: string, isActive: boolean) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = createAdminClient();
  const { error } = await supabase.from("ims_master").update({ is_active: isActive, updated_by: profile.id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ims-master");
}

export async function analyzeImsImportAction(rows: ImsImportRow[]) {
  await requireRole(["ADMIN"]);
  const normalized = rows.map(normalizeImportRow).filter((row): row is NormalizedImportRow => Boolean(row));
  const seen = new Set<string>();
  let fileDuplicates = 0;
  for (const row of normalized) {
    if (seen.has(row.key)) fileDuplicates += 1;
    seen.add(row.key);
  }
  const existing = await loadExistingByKeys(Array.from(seen));
  return {
    validRows: normalized.length,
    invalidRows: rows.length - normalized.length,
    fileDuplicates,
    existingDuplicates: Object.keys(existing).length
  };
}

export async function importImsItemsAction(rows: ImsImportRow[], fileName: string, option: ImsImportOption) {
  const profile = await requireRole(["ADMIN"]);
  const supabase = createAdminClient();
  const normalized = rows.map(normalizeImportRow).filter((row): row is NormalizedImportRow => Boolean(row));
  const uniqueRows = new Map<string, NormalizedImportRow>();
  let duplicateRows = 0;
  for (const row of normalized) {
    if (uniqueRows.has(row.key)) duplicateRows += 1;
    uniqueRows.set(row.key, row);
  }

  const existing = await loadExistingByKeys(Array.from(uniqueRows.keys()));
  const inserts: Record<string, unknown>[] = [];
  let rowsUpdated = 0;
  let rowsSkipped = rows.length - normalized.length + duplicateRows;

  for (const row of uniqueRows.values()) {
    const existingItem = existing[row.key];
    if (existingItem) {
      if (option === "skip") {
        rowsSkipped += 1;
        continue;
      }
      const patch = option === "replace" ? row.item : mergeDefined(row.item);
      const { error } = await supabase.from("ims_master").update({ ...patch, is_active: true, updated_by: profile.id }).eq("id", existingItem.id);
      if (error) throw new Error(error.message);
      rowsUpdated += 1;
      continue;
    }
    inserts.push({ ...row.item, is_active: true, created_by: profile.id, updated_by: profile.id });
  }

  let rowsImported = 0;
  if (inserts.length) {
    const { error } = await supabase.from("ims_master").insert(inserts);
    if (error) throw new Error(error.message);
    rowsImported = inserts.length;
  }

  const { error: historyError } = await supabase.from("ims_import_history").insert({
    file_name: fileName || "IMS import",
    imported_by: profile.id,
    rows_imported: rowsImported,
    rows_updated: rowsUpdated,
    rows_skipped: rowsSkipped,
    duplicate_rows: duplicateRows
  });
  if (historyError) throw new Error(historyError.message);

  revalidatePath("/ims-master");
  return { rowsImported, rowsUpdated, rowsSkipped, duplicateRows };
}

function normalizeItem(input: Record<string, unknown>): NormalizedItem {
  const item_category = cleanRequiredText(input.item_category);
  const item_description = cleanRequiredText(input.item_description);
  return {
    item_code: cleanText(input.item_code),
    item_category,
    item_description,
    make: cleanText(input.make),
    model: cleanText(input.model),
    unit: cleanText(input.unit),
    hsn_code: cleanText(input.hsn_code),
    remarks: cleanText(input.remarks),
    is_active: input.is_active !== false
  };
}

function normalizeImportRow(row: ImsImportRow): NormalizedImportRow | null {
  try {
    const item = normalizeItem({
      item_code: row.item_code,
      item_category: row.item_category,
      item_description: row.item_description,
      make: row.make,
      model: row.model,
      unit: row.unit,
      hsn_code: row.hsn_code,
      remarks: row.remarks,
      is_active: true
    });
    return { item, key: makeKey(item.item_category, item.item_description) };
  } catch {
    return null;
  }
}

function cleanText(value: unknown, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error("Item Category and Item Description are required.");
  return text || null;
}

function cleanRequiredText(value: unknown) {
  const text = cleanText(value, true);
  if (!text) throw new Error("Item Category and Item Description are required.");
  return text;
}

function keyPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeKey(category: string, description: string) {
  return `${keyPart(category)}||${keyPart(description)}`;
}

async function loadExistingByKeys(keys: string[]): Promise<ExistingKey> {
  if (!keys.length) return {};
  const supabase = createAdminClient();
  const categories = Array.from(new Set(keys.map((key) => key.split("||")[0])));
  const { data, error } = await supabase
    .from("ims_master")
    .select("id,item_category_key,item_description_key,is_active")
    .in("item_category_key", categories);
  if (error) throw new Error(error.message);
  const requested = new Set(keys);
  return Object.fromEntries(
    (data ?? [])
      .map((row) => [`${row.item_category_key}||${row.item_description_key}`, { id: row.id, is_active: row.is_active }])
      .filter(([key]) => requested.has(key as string))
  ) as ExistingKey;
}

function mergeDefined(item: NormalizedItem) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null && value !== ""));
}

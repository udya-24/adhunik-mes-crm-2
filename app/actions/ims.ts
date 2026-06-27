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
  const limit = Math.min(30, Math.max(5, Number(input.limit) || 20));
  const tokens = tokenizeSearch(search ?? "");
  const candidateLimit = Math.max(120, limit * 8);
  let query = supabase
    .from("ims_master")
    .select("id,item_code,item_category,item_description,make,model,unit,hsn_code,is_active")
    .eq("is_active", true)
    .limit(search ? candidateLimit : limit);

  if (input.category) query = query.eq("item_category", input.category);
  if (search) {
    query = query.or(buildCandidateFilter(search, tokens));
  } else {
    query = query.order("item_description");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Pick<ImsMasterItem, "id" | "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code" | "is_active">[];
  return search ? rankImsItems(rows, search, tokens).slice(0, limit) : rows;
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

function buildCandidateFilter(search: string, tokens: string[]) {
  const fields = ["item_code", "item_description", "item_category", "make", "model", "hsn_code"];
  const terms = Array.from(new Set([search, ...tokens, ...tokens.filter((token) => token.length >= 4).map((token) => token.slice(0, 3))].filter(Boolean)));
  return terms
    .flatMap((term) => fields.map((field) => `${field}.ilike.%${escapeLike(term)}%`))
    .join(",");
}

function escapeLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

function tokenizeSearch(value: string) {
  const normalized = normalizeSearchText(value);
  const baseTokens = normalized.match(/[a-z]+|\d+[a-z]*|[a-z]*\d+/g) ?? [];
  const splitTokens = baseTokens.flatMap((token) => token.match(/[a-z]+|\d+[a-z]*/g) ?? [token]);
  return Array.from(new Set([...baseTokens, ...splitTokens].filter((token) => token.length > 0)));
}

function rankImsItems<T extends Pick<ImsMasterItem, "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code">>(items: T[], search: string, tokens: string[]) {
  const query = normalizeSearchText(search);
  const compactQuery = compact(search);
  return items
    .map((item) => ({ item, score: scoreImsItem(item, query, compactQuery, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.item_description).localeCompare(String(b.item.item_description), "en-IN"))
    .map(({ item }) => item);
}

function scoreImsItem(item: Pick<ImsMasterItem, "item_code" | "item_category" | "item_description" | "make" | "model" | "unit" | "hsn_code">, query: string, compactQuery: string, tokens: string[]) {
  const code = normalizeSearchText(item.item_code ?? "");
  const codeCompact = compact(item.item_code ?? "");
  const description = normalizeSearchText(item.item_description ?? "");
  const category = normalizeSearchText(item.item_category ?? "");
  const make = normalizeSearchText(item.make ?? "");
  const model = normalizeSearchText(item.model ?? "");
  const hsn = normalizeSearchText(item.hsn_code ?? "");
  const searchable = [code, description, category, make, model, hsn].filter(Boolean).join(" ");
  const searchableCompact = compact(searchable);
  const words = tokenizeSearch(searchable);
  let score = 0;

  if (code && code === query) score += 10000;
  if (codeCompact && codeCompact === compactQuery) score += 9800;
  if (description.startsWith(query)) score += 8000;
  if (compact(description).startsWith(compactQuery)) score += 7600;
  if (compactQuery && searchableCompact.includes(compactQuery)) score += 1200;

  let matchedTokens = 0;
  for (const token of tokens) {
    const compactToken = compact(token);
    const tokenScore = scoreToken(token, compactToken, { code, description, category, make, model, hsn, words, searchableCompact });
    if (tokenScore > 0) matchedTokens += 1;
    score += tokenScore;
  }

  if (tokens.length && matchedTokens === tokens.length) score += 5000;
  else score += matchedTokens * 700;

  return score;
}

function scoreToken(
  token: string,
  compactToken: string,
  fields: { code: string; description: string; category: string; make: string; model: string; hsn: string; words: string[]; searchableCompact: string }
) {
  if (!token) return 0;
  if (fields.code === token || compact(fields.code) === compactToken) return 2200;
  if (fields.description.split(" ").some((word) => word === token)) return 1500;
  if (fields.description.includes(token)) return 1100;
  if (fields.category.includes(token) || fields.make.includes(token) || fields.model.includes(token)) return 850;
  if (fields.hsn.includes(token)) return 650;
  if (fields.searchableCompact.includes(compactToken)) return 550;
  if (fields.words.some((word) => isFuzzyMatch(token, word))) return 300;
  return 0;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function compact(value: string) {
  return normalizeSearchText(value).replaceAll(" ", "");
}

function isFuzzyMatch(token: string, word: string) {
  if (token.length < 4 || word.length < 4) return false;
  const distance = levenshtein(token, word);
  return distance <= (token.length > 5 || word.length > 5 ? 2 : 1);
}

function levenshtein(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let i = 1; i <= b.length; i += 1) {
    let previous = i;
    for (let j = 1; j <= a.length; j += 1) {
      const current = rows[j];
      rows[j] = b[i - 1] === a[j - 1] ? rows[j - 1] : Math.min(rows[j - 1], previous, rows[j]) + 1;
      rows[j - 1] = previous;
      previous = current;
    }
    rows[a.length] = previous;
  }
  return rows[a.length];
}

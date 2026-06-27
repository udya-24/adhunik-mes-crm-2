import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { ImsImportHistory, ImsMasterItem } from "@/lib/types";

export type ImsListParams = {
  search?: string;
  category?: string;
  status?: "active" | "inactive" | "all";
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type ImsListResult = {
  items: ImsMasterItem[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  history: ImsImportHistory[];
};

const sortableColumns = new Set(["item_code", "item_category", "item_description", "make", "model", "unit", "hsn_code", "created_at", "updated_at"]);
const categoryBatchSize = 1000;

export async function getImsMaster(params: ImsListParams = {}): Promise<ImsListResult> {
  noStore();
  await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = createAdminClient();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = params.status ?? "active";
  const search = String(params.search ?? "").trim();
  const sort = parseSort(params.sort);

  let query = supabase.from("ims_master").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("is_active", status === "active");
  if (params.category) query = query.eq("item_category", params.category);
  if (search) {
    const escaped = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`item_description.ilike.%${escaped}%,item_category.ilike.%${escaped}%,model.ilike.%${escaped}%,make.ilike.%${escaped}%`);
  }

  const [{ data, error, count }, categories, historyResult] = await Promise.all([
    query.order(sort.column, { ascending: sort.ascending }).range(from, to),
    getAllImsCategories(),
    supabase.from("ims_import_history").select("*").order("created_at", { ascending: false }).limit(8)
  ]);

  if (error) throw new Error(error.message);
  if (historyResult.error) throw new Error(historyResult.error.message);

  return {
    items: (data ?? []) as ImsMasterItem[],
    total: count ?? 0,
    page,
    pageSize,
    categories,
    history: (historyResult.data ?? []) as ImsImportHistory[]
  };
}

export async function getAllImsCategories() {
  const supabase = createAdminClient();
  const categories = new Set<string>();

  for (let from = 0; ; from += categoryBatchSize) {
    const to = from + categoryBatchSize - 1;
    const { data, error } = await supabase
      .from("ims_master")
      .select("item_category")
      .order("item_category", { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const category = String(row.item_category ?? "").trim();
      if (category) categories.add(category);
    }
    if (!data || data.length < categoryBatchSize) break;
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b, "en-IN"));
}

export async function getImsItem(id: string): Promise<ImsMasterItem | null> {
  noStore();
  await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("ims_master").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ImsMasterItem | null;
}

function parseSort(value?: string) {
  const [rawColumn = "updated_at", rawDirection = "desc"] = String(value ?? "").split(":");
  const column = sortableColumns.has(rawColumn) ? rawColumn : "updated_at";
  return { column, ascending: rawDirection === "asc" };
}

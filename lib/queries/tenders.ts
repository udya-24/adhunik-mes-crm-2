import type { QueryClient } from "@tanstack/react-query";

export type TenderQueryParams = {
  search: string;
  status: string;
  source: string;
  assignment: string;
  page: number;
  pageSize: number;
};

export const tenderQueryKeys = {
  all: ["tenders"] as const,
  list: (params: TenderQueryParams) => ["tenders", params] as const
};

export function invalidateTenderQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: tenderQueryKeys.all });
}

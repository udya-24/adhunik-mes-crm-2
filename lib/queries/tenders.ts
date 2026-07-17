import type { QueryClient } from "@tanstack/react-query";

export type TenderQueryParams = {
  viewerId: string;
  viewerRole: string;
  search: string;
  status: string;
  source: string;
  assignment: string;
  assignedTo: string;
  page: number;
  pageSize: number;
};

export function resolveTenderPagination(totalRows: number, requestedPage: number, requestedPageSize: number) {
  const pageSize = Math.max(1, Math.floor(requestedPageSize) || 1);
  const maxPage = Math.max(1, Math.ceil(Math.max(0, totalRows) / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), maxPage);
  const from = (page - 1) * pageSize;
  const to = Math.min(from + pageSize - 1, Math.max(0, totalRows - 1));
  return { page, pageSize, maxPage, from, to };
}

export const tenderQueryKeys = {
  all: ["tenders"] as const,
  list: (params: TenderQueryParams) => ["tenders", params] as const
};

export function invalidateTenderQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: tenderQueryKeys.all });
}

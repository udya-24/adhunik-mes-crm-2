import type { QueryClient } from "@tanstack/react-query";

export const tenderQueryKeys = {
  all: ["tenders"] as const
};

export function invalidateTenderQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: tenderQueryKeys.all });
}

import { formatDate } from "@/lib/date-utils";

type ContractDateValue = {
  contract_date?: string | null;
};

export function ContractDate({ tender }: { tender: ContractDateValue | null | undefined }) {
  const formatted = formatDate(tender?.contract_date);
  console.log("Contract Date", tender?.contract_date, formatted);

  return <>{formatted}</>;
}

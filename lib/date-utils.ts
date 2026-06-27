import { formatDate as formatStableDate, formatDateTime } from "@/lib/date";

const IST_TIME_ZONE = "Asia/Kolkata";
export const tenderDateFields = ["contract_date"] as const;

function parseSupabaseUTC(value: string | Date) {
  if (value instanceof Date) return value;

  const trimmed = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasTimezone) return new Date(trimmed);

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

export function formatDateIST(value: string | Date | null) {
  return formatStableDate(value);
}

export function formatDate(dateValue: string | null | undefined) {
  return formatStableDate(dateValue);
}

export function formatDateTimeIST(value: string | Date | null) {
  return formatDateTime(value);
}

export function utcNowISOString() {
  return new Date().toISOString();
}

export function excelDateToISO(serial: number) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + serial * 86400000);

  return date.toISOString().split("T")[0];
}

function toISODate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;

  return date.toISOString().split("T")[0];
}

export function normalizeDateValue(value: unknown) {
  if (value === "" || value === null || value === undefined) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelDateToISO(value);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toISODate(Number(year), Number(month), Number(day)) ?? trimmed;
  }

  const indianDateMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (indianDateMatch) {
    const [, day, month, year] = indianDateMatch;
    return toISODate(Number(year), Number(month), Number(day)) ?? trimmed;
  }

  return trimmed;
}

export function normalizeDateFields<T extends Record<string, unknown>>(row: T, fields: readonly string[] = tenderDateFields) {
  return fields.reduce<Record<string, unknown>>(
    (normalized, field) => {
      if (field in normalized) {
        normalized[field] = normalizeDateValue(normalized[field]);
      }
      return normalized;
    },
    { ...row }
  ) as T;
}

export function getISTDayBoundsISO(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(date);

  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(valueByType.get("year"));
  const month = Number(valueByType.get("month"));
  const day = Number(valueByType.get("day"));
  const startUtc = new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString()
  };
}

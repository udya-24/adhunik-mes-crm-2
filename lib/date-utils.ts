const IST_TIME_ZONE = "Asia/Kolkata";

function parseSupabaseUTC(value: string | Date) {
  if (value instanceof Date) return value;

  const trimmed = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasTimezone) return new Date(trimmed);

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

export function formatDateIST(value: string | Date | null) {
  if (!value) return "-";

  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).formatToParts(parseSupabaseUTC(value));
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("day")} ${valueByType.get("month")} ${valueByType.get("year")}`;
}

export function formatDateTimeIST(value: string | Date | null) {
  if (!value) return "-";

  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(parseSupabaseUTC(value));
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const period = String(valueByType.get("dayPeriod") ?? "").toUpperCase();

  return `${valueByType.get("day")} ${valueByType.get("month")} ${valueByType.get("year")}, ${valueByType.get("hour")}:${valueByType.get("minute")}:${valueByType.get("second")} ${period}`;
}

export function utcNowISOString() {
  return new Date().toISOString();
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

const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";

type DateInput = string | Date | null | undefined;

function parseDateTime(value: string | Date) {
  if (value instanceof Date) return value;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+05:30`);
  }

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasTimezone) return new Date(trimmed);

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

function partsFor(value: string | Date) {
  const date = parseDateTime(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  return new Map(parts.map((part) => [part.type, part.value]));
}

export function formatDate(value: DateInput, fallback = "-") {
  if (!value) return fallback;
  const parts = partsFor(value);
  if (!parts) return fallback;
  return `${parts.get("day")}/${parts.get("month")}/${parts.get("year")}`;
}

export function formatTime(value: DateInput, fallback = "-") {
  if (!value) return fallback;
  const parts = partsFor(value);
  if (!parts) return fallback;
  return `${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`;
}

export function formatDateTime(value: DateInput, fallback = "-") {
  if (!value) return fallback;
  return `${formatDate(value, fallback)}, ${formatTime(value, fallback)}`;
}

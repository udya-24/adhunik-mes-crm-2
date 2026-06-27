import { formatDate, formatDateTime, formatTime } from "@/lib/date";

type DateTimeProps = {
  value?: string | Date | null;
  variant?: "date" | "datetime" | "time";
  fallback?: string;
  className?: string;
};

export function DateTime({ value, variant = "datetime", fallback = "-", className }: DateTimeProps) {
  if (!value) return <span className={className}>{fallback}</span>;

  const formatted = variant === "date" ? formatDate(value) : variant === "time" ? formatTime(value) : formatDateTime(value);
  const dateTime = typeof value === "string" ? value : value.toISOString();

  return (
    <time className={className} dateTime={dateTime}>
      {formatted}
    </time>
  );
}

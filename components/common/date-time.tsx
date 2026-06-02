import { formatDateIST, formatDateTimeIST } from "@/lib/date-utils";

type DateTimeProps = {
  value?: string | Date | null;
  variant?: "date" | "datetime";
  fallback?: string;
  className?: string;
};

export function DateTime({ value, variant = "datetime", fallback = "-", className }: DateTimeProps) {
  if (!value) return <span className={className}>{fallback}</span>;

  const formatted = variant === "date" ? formatDateIST(value) : formatDateTimeIST(value);
  const dateTime = typeof value === "string" ? value : value.toISOString();

  return (
    <time className={className} dateTime={dateTime}>
      {formatted}
    </time>
  );
}

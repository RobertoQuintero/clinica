import { formatPeriodDate } from "@/lib/payroll/periodFormat";

const MEXICAN_PESO_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** 1234.5 -> "$1,234.50". */
export function formatPayrollCurrency(amount: number): string {
  return MEXICAN_PESO_FORMATTER.format(amount);
}

/** "2026-09-21 12:05:00" -> "21 sep 2026, 12:05". Opera sobre el string, sin pasar por `Date`. */
export function formatCalculatedAt(dateTimeString: string): string {
  return `${formatPeriodDate(dateTimeString.slice(0, 10))}, ${dateTimeString.slice(11, 16)}`;
}

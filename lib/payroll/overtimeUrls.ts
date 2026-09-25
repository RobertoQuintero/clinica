import type { OvertimeStatusFilter } from "@/interfaces/payroll_overtime";

type FilterableStatus = Exclude<OvertimeStatusFilter, "all">;

/** Valor de `?estado=` por filtro; "all" no se escribe en la URL. */
export const OVERTIME_STATUS_URL_VALUES: Record<FilterableStatus, string> = {
  pending: "pendiente",
  authorized: "autorizada",
  rejected: "rechazada",
};

export function readOvertimeStatus(rawValue: string): OvertimeStatusFilter {
  const match = (Object.entries(OVERTIME_STATUS_URL_VALUES) as [FilterableStatus, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}

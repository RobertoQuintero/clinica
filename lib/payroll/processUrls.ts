import { PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";

export interface IPayrollProcessUrlFilters {
  idPeriod:    number | null;
  payrollType: PayrollType;
  idPuesto:    number | null;
  search:      string;
}

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function readSingleParam(searchParams: SearchParamsInput, key: string): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function readPositiveInteger(rawValue: string): number | null {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** URL `tipo=operativa|fiscal`; operativa por defecto. */
export function readPayrollType(rawValue: string): PayrollType {
  return rawValue === PAYROLL_TYPE.F.urlValue ? "F" : "O";
}

/** `?periodo=&tipo=&puesto=&q=`; los parámetros vacíos o null no se escriben. */
function buildPayrollQueryString({ idPeriod, payrollType, idPuesto, search }: IPayrollProcessUrlFilters): string {
  const searchParams = new URLSearchParams();
  if (idPeriod !== null) searchParams.set("periodo", String(idPeriod));
  searchParams.set("tipo", PAYROLL_TYPE[payrollType].urlValue);
  if (idPuesto !== null) searchParams.set("puesto", String(idPuesto));
  const trimmedSearch = search.trim();
  if (trimmedSearch) searchParams.set("q", trimmedSearch);
  return searchParams.toString();
}

/** Enlace a la tabla de Procesar nómina con los mismos filtros ("Regresar"). */
export function buildPayrollProcessHref(filters: IPayrollProcessUrlFilters): string {
  return `/dashboard/nomina/procesar?${buildPayrollQueryString(filters)}`;
}

/** Enlace al detalle de nómina de un empleado (tabla de Procesar, Anterior / Siguiente, toggle). */
export function buildPayrollEmployeeDetailHref(idEmpleado: number, filters: IPayrollProcessUrlFilters): string {
  return `/dashboard/nomina/procesar/${idEmpleado}?${buildPayrollQueryString(filters)}`;
}

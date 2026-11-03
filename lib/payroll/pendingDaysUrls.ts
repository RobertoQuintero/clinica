import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";

export interface IPendingDaysUrlFilters {
  idPeriod: number | null;
  search:   string;
  page:     number;
}

/** `?periodo=&q=&pagina=` de la pantalla de Días pendientes de pago. */
export function readPendingDaysSearchParams(searchParams: SearchParamsInput): IPendingDaysUrlFilters {
  return {
    idPeriod: readPositiveInteger(readSingleParam(searchParams, "periodo")),
    search: readSingleParam(searchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(searchParams, "pagina")) ?? 1,
  };
}

/** Enlace a la pantalla con los mismos filtros (sin `pagina` si es la 1, para no ensuciar la URL). */
export function buildPendingDaysHref(filters: Pick<IPendingDaysUrlFilters, "idPeriod" | "search">, page: number = 1): string {
  const searchParams = new URLSearchParams();
  if (filters.idPeriod !== null) searchParams.set("periodo", String(filters.idPeriod));
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch) searchParams.set("q", trimmedSearch);
  if (page > 1) searchParams.set("pagina", String(page));
  const query = searchParams.toString();
  return query ? `/dashboard/nomina/dias-pendientes?${query}` : "/dashboard/nomina/dias-pendientes";
}

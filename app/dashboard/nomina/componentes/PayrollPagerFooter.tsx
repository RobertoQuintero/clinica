import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  /** Ruta de la pantalla, p. ej. "/dashboard/nomina/faltas". */
  basePath: string;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
  page: number;
  totalPages: number;
  summaryText: string;
}

const PAGER_BUTTON =
  "p-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-300 transition-colors";

function buildPageHref(basePath: string, currentSearchParams: Record<string, string>, page: number): string {
  const searchParams = new URLSearchParams(currentSearchParams);
  if (page > 1) searchParams.set("pagina", String(page));
  else searchParams.delete("pagina");
  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Pie de las tablas de nómina por periodo: resumen del rango mostrado y paginación por enlaces. */
export default function PayrollPagerFooter({ basePath, currentSearchParams, page, totalPages, summaryText }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 bg-[#eff4ff] dark:bg-zinc-800 border-t border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
      <span>{summaryText}</span>
      <nav aria-label="Paginación" className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildPageHref(basePath, currentSearchParams, page - 1)}
            aria-label="Página anterior"
            className={`${PAGER_BUTTON} hover:bg-white dark:hover:bg-zinc-700`}
          >
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span aria-hidden className={`${PAGER_BUTTON} opacity-40`}>
            <ChevronLeft size={16} />
          </span>
        )}
        <span className="text-xs font-semibold text-[#0b1c30] dark:text-zinc-100">
          Página {page} de {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={buildPageHref(basePath, currentSearchParams, page + 1)}
            aria-label="Página siguiente"
            className={`${PAGER_BUTTON} hover:bg-white dark:hover:bg-zinc-700`}
          >
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span aria-hidden className={`${PAGER_BUTTON} opacity-40`}>
            <ChevronRight size={16} />
          </span>
        )}
      </nav>
    </div>
  );
}

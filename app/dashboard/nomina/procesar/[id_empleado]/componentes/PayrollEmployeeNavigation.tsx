import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPayrollEmployeeDetailHref, type IPayrollProcessUrlFilters } from "@/lib/payroll/processUrls";

interface Props {
  previousEmployeeId: number | null;
  nextEmployeeId: number | null;
  filters: IPayrollProcessUrlFilters;
}

const STEP_BASE_CLASSES =
  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors";
const STEP_ENABLED_CLASSES =
  "text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0051d5]";
const STEP_DISABLED_CLASSES = "text-[#c4c6d0] dark:text-zinc-600 cursor-not-allowed";

function NavigationStep({
  employeeId,
  filters,
  label,
  icon,
  iconPosition,
  roundedClassName,
}: {
  employeeId: number | null;
  filters: IPayrollProcessUrlFilters;
  label: string;
  icon: ReactNode;
  iconPosition: "start" | "end";
  roundedClassName: string;
}) {
  const content = (
    <>
      {iconPosition === "start" && icon}
      {label}
      {iconPosition === "end" && icon}
    </>
  );

  // En los extremos no hay a dónde ir: no es enlace, solo se ve deshabilitado.
  if (employeeId === null) {
    return (
      <span aria-disabled="true" className={`${STEP_BASE_CLASSES} ${STEP_DISABLED_CLASSES} ${roundedClassName}`}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={buildPayrollEmployeeDetailHref(employeeId, filters)}
      className={`${STEP_BASE_CLASSES} ${STEP_ENABLED_CLASSES} ${roundedClassName}`}
    >
      {content}
    </Link>
  );
}

/** Anterior / Siguiente en el orden de la tabla de Procesar, con sus filtros de puesto y búsqueda. */
export default function PayrollEmployeeNavigation({ previousEmployeeId, nextEmployeeId, filters }: Props) {
  return (
    <nav
      aria-label="Empleado anterior y siguiente"
      className="inline-flex divide-x divide-[#c4c6d0] dark:divide-zinc-700 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900"
    >
      <NavigationStep
        employeeId={previousEmployeeId}
        filters={filters}
        label="Anterior"
        icon={<ChevronLeft size={16} aria-hidden />}
        iconPosition="start"
        roundedClassName="rounded-l-lg"
      />
      <NavigationStep
        employeeId={nextEmployeeId}
        filters={filters}
        label="Siguiente"
        icon={<ChevronRight size={16} aria-hidden />}
        iconPosition="end"
        roundedClassName="rounded-r-lg"
      />
    </nav>
  );
}

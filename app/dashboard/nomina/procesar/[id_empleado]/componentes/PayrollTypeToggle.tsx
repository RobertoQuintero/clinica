import Link from "next/link";
import type { PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { buildPayrollEmployeeDetailHref, type IPayrollProcessUrlFilters } from "@/lib/payroll/processUrls";

interface Props {
  idEmpleado: number;
  filters: IPayrollProcessUrlFilters;   // conserva periodo, puesto y q; solo cambia el tipo
}

/** Operativa | Fiscal con enlaces: la URL (`tipo`) es la fuente de verdad, sin estado en el cliente. */
export default function PayrollTypeToggle({ idEmpleado, filters }: Props) {
  return (
    <nav
      aria-label="Tipo de nómina"
      className="flex gap-1 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 p-1 self-start"
    >
      {(Object.keys(PAYROLL_TYPE) as PayrollType[]).map((payrollType) => {
        const isSelected = payrollType === filters.payrollType;
        return (
          <Link
            key={payrollType}
            href={buildPayrollEmployeeDetailHref(idEmpleado, { ...filters, payrollType })}
            aria-current={isSelected ? "page" : undefined}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5] ${
              isSelected
                ? "bg-white dark:bg-zinc-700 text-[#0b1c30] dark:text-zinc-50 font-semibold shadow-sm"
                : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
            }`}
          >
            {PAYROLL_TYPE[payrollType].label}
          </Link>
        );
      })}
    </nav>
  );
}

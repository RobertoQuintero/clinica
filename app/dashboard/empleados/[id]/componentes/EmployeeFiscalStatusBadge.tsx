import { IEmployeeRecord } from "@/interfaces/employee";
import { getStampingIssues, isFiscalEmployee } from "@/lib/payroll/payrollStampingReadiness";

interface Props {
  employee: IEmployeeRecord;
}

/** Chip de completitud fiscal del encabezado. No se muestra si el empleado no es fiscal. */
export default function EmployeeFiscalStatusBadge({ employee }: Props) {
  if (!isFiscalEmployee(employee)) return null;

  const issueCount = getStampingIssues(employee, employee.clave_estado_sat).length;

  if (issueCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-[#0051d5]/10 text-[#0051d5] border border-[#0051d5]/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
        Datos fiscales completos
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
      {issueCount === 1 ? "Falta 1 dato fiscal" : `Faltan ${issueCount} datos fiscales`}
    </span>
  );
}

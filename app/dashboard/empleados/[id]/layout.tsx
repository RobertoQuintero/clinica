import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEmployeeById, getEmployeeCatalogs } from "../actions";
import { syncVacationEntitlements } from "@/lib/vacations/entitlementSync";
import { getCurrentVacationStatus } from "./vacaciones/actions";
import { getTerminationCauses } from "./bajas/actions";
import EmployeeHeader from "./componentes/EmployeeHeader";
import EmployeeTabs from "./componentes/EmployeeTabs";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export default async function EmployeeDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);

  const [employee, catalogs, terminationCauses] = await Promise.all([
    getEmployeeById(id_empleado),
    getEmployeeCatalogs(),
    getTerminationCauses(),
  ]);

  if (!employee) notFound();

  // Genera los años que falten antes de leer el estatus; si falla, el badge usa lo que ya existe.
  await syncVacationEntitlements(employee.id_empresa, id_empleado);
  const vacation = await getCurrentVacationStatus(id_empleado);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/empleados"
          className="inline-flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] dark:hover:text-blue-400 mb-2"
        >
          <ArrowLeft size={14} />
          Empleados
        </Link>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Expediente del empleado</h2>
      </div>

      <EmployeeHeader
        employee={employee}
        catalogs={catalogs}
        terminationCauses={terminationCauses}
        vacation={vacation}
      />

      <EmployeeTabs id_empleado={id_empleado} />

      {children}
    </div>
  );
}

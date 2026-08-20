import { getEmployees, getEmployeeCatalogs } from "./actions";
import EmployeeSummaryCards from "./componentes/EmployeeSummaryCards";
import EmployeesTable from "./componentes/EmployeesTable";

/** Server Component: trae empleados y catálogos de una vez; los filtros viven en el cliente. */
export default async function EmpleadosPage() {
  const [employees, catalogs] = await Promise.all([getEmployees(), getEmployeeCatalogs()]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Empleados</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Gestiona la información del personal clínico y administrativo.
        </p>
      </div>

      <EmployeeSummaryCards employees={employees} />

      <EmployeesTable employees={employees} catalogs={catalogs} />
    </div>
  );
}

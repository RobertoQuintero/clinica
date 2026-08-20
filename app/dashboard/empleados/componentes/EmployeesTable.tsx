"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { IEmployeeListItem } from "@/interfaces/employee";
import { IEmployeeCatalogs } from "../actions";
import EmployeeRow from "./EmployeeRow";

type StatusFilter = "todos" | "activos" | "inactivos";

interface Props {
  employees: IEmployeeListItem[];
  catalogs: IEmployeeCatalogs;
}

export default function EmployeesTable({ employees, catalogs }: Props) {
  const [search, setSearch]                 = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sucursalFilter, setSucursalFilter]     = useState("");
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>("todos");

  // El modal de alta/edición se conecta en el Paso 6 (EmployeeModal.tsx); el estado ya
  // queda listo aquí para no reestructurar la tabla cuando se agregue.
  const [showModal, setShowModal]           = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<IEmployeeListItem | null>(null);

  const openNew = () => {
    setEditingEmployee(null);
    setShowModal(true);
  };

  const openEdit = (employee: IEmployeeListItem) => {
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (query) {
        const matchesName = employee.nombre_completo.toLowerCase().includes(query);
        const matchesCode = employee.codigo_empleado.toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }
      if (departmentFilter && employee.id_department !== Number(departmentFilter)) return false;
      if (sucursalFilter && employee.id_sucursal !== Number(sucursalFilter)) return false;
      if (statusFilter === "activos" && !employee.activo) return false;
      if (statusFilter === "inactivos" && employee.activo) return false;
      return true;
    });
  }, [employees, search, departmentFilter, sucursalFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
        >
          <Plus size={18} />
          Nuevo Empleado
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747780] dark:text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 pl-10 pr-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-[#747780] dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="flex-1 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          >
            <option value="">Todos los departamentos</option>
            {catalogs.departments.map((department) => (
              <option key={department.id_department} value={department.id_department}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={sucursalFilter}
            onChange={(e) => setSucursalFilter(e.target.value)}
            className="flex-1 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          >
            <option value="">Todas las sucursales</option>
            {catalogs.sucursales.map((sucursal) => (
              <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="flex-1 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all"
          >
            <option value="todos">Todos los estatus</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Empleado</th>
                <th className="px-6 py-4 font-semibold">WhatsApp</th>
                <th className="px-6 py-4 font-semibold">Puesto / Departamento</th>
                <th className="px-6 py-4 font-semibold">Sucursal</th>
                <th className="px-6 py-4 font-semibold">Ingreso</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                    Sin empleados que coincidan con los filtros
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <EmployeeRow key={employee.id_empleado} employee={employee} onEdit={openEdit} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paso 6: <EmployeeModal employee={editingEmployee ?? undefined} catalogs={catalogs} onClose={() => setShowModal(false)} /> */}
    </div>
  );
}

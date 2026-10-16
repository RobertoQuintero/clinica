"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import type { IEmployeeTermination, ITerminationCause } from "@/interfaces/employee_termination";
import { fetchEmployeeTerminations } from "@/lib/terminations/terminationQueries";

/** Causas de baja activas del catálogo IMSS/IDSE, en el orden de la clave. */
export async function getTerminationCauses(): Promise<ITerminationCause[]> {
  return (await db.queryParams(
    `SELECT [clave], [nombre], [tipo_terminacion_sugerido]
       FROM [CentroPodologico].[RH].[cat_causas_baja]
      WHERE [status] = 1
      ORDER BY [clave]`,
    {}
  )) as ITerminationCause[];
}

/** Bajas del empleado (vigente y anuladas), de la más reciente a la más antigua. */
export async function getEmployeeTerminations(
  id_empleado: number
): Promise<IEmployeeTermination[]> {
  // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];
  return fetchEmployeeTerminations(id_empleado);
}

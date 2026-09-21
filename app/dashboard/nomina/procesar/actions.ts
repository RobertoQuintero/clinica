"use server";

import db from "@/database/connection";
import {
  IPayrollEmployeeRow,
  IPayrollExcludedEmployee,
  IPayrollProcessFilters,
  IPayrollProcessPage,
} from "@/interfaces/payroll_calculation";
import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { ActionResult, assertPayrollAccess, PERIOD_ROW_SELECT } from "@/lib/payroll/access";
import { addZeroToday } from "@/utils/date_helpper";

const PERIOD_FROM = `
  FROM [CentroPodologico].[payroll].[periods] p
  JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period`;

/** Nombre completo con un solo espacio entre partes no vacías, para mostrar y para buscar. */
const EMPLOYEE_FULL_NAME_SQL = `LTRIM(RTRIM(
  e.nombre
  + ISNULL(' ' + NULLIF(e.apellido_paterno, ''), '')
  + ISNULL(' ' + NULLIF(e.apellido_materno, ''), '')))`;

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\[%_]/g, (character) => `[${character}]`);
}

async function resolvePeriod(idSucursal: number, idPeriod: number | null): Promise<IPayrollPeriodRow | null> {
  if (idPeriod !== null) {
    // Un periodo de otra sucursal no se distingue de uno inexistente.
    const rows = await db.queryParams(
      `SELECT ${PERIOD_ROW_SELECT} ${PERIOD_FROM}
        WHERE p.id_period = @id_period AND p.id_sucursal = @id_sucursal`,
      { id_period: idPeriod, id_sucursal: idSucursal },
    );
    return (rows[0] as IPayrollPeriodRow | undefined) ?? null;
  }

  // Sin periodo pedido: el activo en curso; si no hay, el de inicio más reciente.
  const rows = await db.queryParams(
    `SELECT TOP 1 ${PERIOD_ROW_SELECT} ${PERIOD_FROM}
      WHERE p.id_sucursal = @id_sucursal
      ORDER BY CASE WHEN CAST(@today AS date) BETWEEN p.fecha_inicio AND p.fecha_fin THEN 0 ELSE 1 END,
               p.fecha_inicio DESC, p.id_period DESC`,
    { id_sucursal: idSucursal, today: addZeroToday(new Date()) },
  );
  return (rows[0] as IPayrollPeriodRow | undefined) ?? null;
}

export async function getPayrollProcessPage(
  filters: IPayrollProcessFilters,
): Promise<ActionResult<IPayrollProcessPage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  try {
    const periodOptionsPromise = db.queryParams(
      `SELECT p.id_period, p.codigo,
              CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
              CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
              p.status
         FROM [CentroPodologico].[payroll].[periods] p
        WHERE p.id_sucursal = @id_sucursal
        ORDER BY p.fecha_inicio DESC, p.id_period DESC`,
      { id_sucursal },
    );
    const [period, periodOptions] = await Promise.all([
      resolvePeriod(id_sucursal, filters.idPeriod),
      periodOptionsPromise,
    ]);

    const emptyPage: IPayrollProcessPage = {
      period,
      periodOptions: periodOptions as IPayrollProcessPage["periodOptions"],
      rows: [],
      totals: { employees: 0, importeSalario: 0 },
      puestoOptions: [],
      excludedEmployees: [],
      lastCalculatedAt: null,
    };
    if (!period) return { ok: true, data: emptyPage };

    const rowConditions = [
      "pe.id_period = @id_period",
      "pe.tipo_nomina = @tipo_nomina",
    ];
    const rowParams: Record<string, unknown> = {
      id_period: period.id_period,
      tipo_nomina: filters.payrollType,
    };
    if (filters.idPuesto !== null) {
      rowConditions.push("e.id_puesto = @id_puesto");
      rowParams.id_puesto = filters.idPuesto;
    }
    const search = filters.search.trim();
    if (search) {
      rowConditions.push(`(${EMPLOYEE_FULL_NAME_SQL} LIKE @search OR e.codigo_empleado LIKE @search)`);
      rowParams.search = `%${escapeLikePattern(search)}%`;
    }

    // Salario del tipo seleccionado, con la misma regla de elegibilidad que usa el cálculo.
    const salaryColumn = filters.payrollType === "F" ? "e.salario_diario_fiscal" : "e.salario_diario";

    const [rows, totals, puestoOptions, excludedEmployees, lastCalculated] = await Promise.all([
      db.queryParams(
        `SELECT pe.id_period_employee, pe.id_empleado, e.codigo_empleado,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                e.id_puesto, pu.name AS nombre_puesto, pe.tipo_nomina,
                pe.salario_diario, pe.dias, pe.importe_salario,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
          WHERE ${rowConditions.join(" AND ")}
          ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, pe.id_empleado`,
        rowParams,
      ),
      db.queryParams(
        `SELECT COUNT(*) AS employees, ISNULL(SUM(importe_salario), 0) AS importe_salario
           FROM [CentroPodologico].[payroll].[period_employees]
          WHERE id_period = @id_period AND tipo_nomina = @tipo_nomina`,
        { id_period: period.id_period, tipo_nomina: filters.payrollType },
      ),
      db.queryParams(
        `SELECT DISTINCT pu.id_puesto, pu.name
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
          WHERE pe.id_period = @id_period AND pe.tipo_nomina = @tipo_nomina
          ORDER BY pu.name`,
        { id_period: period.id_period, tipo_nomina: filters.payrollType },
      ),
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo
           FROM [CentroPodologico].[RH].[empleados] e
          WHERE e.status = 1 AND e.activo = 1
            AND e.id_sucursal = @id_sucursal
            AND e.id_periodo_pago = @id_payment_period
            AND e.fecha_ingreso <= CAST(@fecha_fin AS date)
            AND (${salaryColumn} IS NULL OR ${salaryColumn} <= 0)
          ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
        {
          id_sucursal,
          id_payment_period: period.id_payment_period,
          fecha_fin: period.fecha_fin,
        },
      ),
      db.queryParams(
        `SELECT CONVERT(varchar(19), MAX(calculated_at), 120) AS last_calculated_at
           FROM [CentroPodologico].[payroll].[period_employees]
          WHERE id_period = @id_period`,
        { id_period: period.id_period },
      ),
    ]);

    return {
      ok: true,
      data: {
        ...emptyPage,
        rows: rows.map((row: IPayrollEmployeeRow) => ({
          ...row,
          salario_diario: Number(row.salario_diario),
          dias: Number(row.dias),
          importe_salario: Number(row.importe_salario),
        })),
        totals: {
          employees: Number(totals[0]?.employees ?? 0),
          importeSalario: Number(totals[0]?.importe_salario ?? 0),
        },
        puestoOptions: puestoOptions.map((row: { id_puesto: number; name: string }) => ({
          id_puesto: row.id_puesto,
          name: row.name,
        })),
        excludedEmployees: excludedEmployees as IPayrollExcludedEmployee[],
        lastCalculatedAt: lastCalculated[0]?.last_calculated_at ?? null,
      },
    };
  } catch (error) {
    console.error("getPayrollProcessPage", error);
    return { ok: false, message: "No se pudo cargar el cálculo de nómina" };
  }
}

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
import { calculatePayrollPeriodSchema, revertPayrollCalculationSchema } from "@/lib/payroll/schemas";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

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

const PERIOD_NOT_CALCULABLE_MARKER = "PERIOD_NOT_CALCULABLE";
const PERIOD_NOT_REVERTIBLE_MARKER = "PERIOD_NOT_REVERTIBLE";

/** Traduce los errores de SQL Server de calcular/revertir nómina a un mensaje en español. */
function describePayrollCalculationError(error: unknown): string {
  const sqlError = error as { message?: string; number?: number };
  if (sqlError.message?.includes(PERIOD_NOT_CALCULABLE_MARKER)) {
    return "El periodo no existe en esta sucursal o ya no está en estatus Programada o En cálculo";
  }
  if (sqlError.message?.includes(PERIOD_NOT_REVERTIBLE_MARKER)) {
    return "El periodo no existe en esta sucursal o ya no está en estatus En cálculo";
  }
  if (sqlError.number === 2627 || sqlError.number === 2601 || sqlError.number === 1205) {
    return "Otro usuario modificó la nómina al mismo tiempo. Intenta de nuevo";
  }
  return "No se pudo procesar la nómina del periodo";
}

function revalidatePayrollPaths() {
  revalidatePath("/dashboard/nomina/procesar");
  revalidatePath("/dashboard/nomina/periodos");
}

/**
 * Calcular (estatus 1) y Recalcular (estatus 2): en un solo batch con bloqueo reemplaza el
 * snapshot del periodo (filas 'O' y 'F') y deja el periodo en estatus 2 (En cálculo).
 * La regla de elegibilidad y de días vive aquí; `lib/payroll/salaryCalculation.ts` la espeja.
 */
export async function calculatePayrollPeriod(
  input: unknown,
): Promise<ActionResult<{ operativa: number; fiscal: number }>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_user } = access.data;

  const parsed = calculatePayrollPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const rows = await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @id_payment_period smallint, @fecha_inicio date, @fecha_fin date;
       SELECT @id_payment_period = id_payment_period,
              @fecha_inicio      = fecha_inicio,
              @fecha_fin         = fecha_fin
         FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal AND status IN (1, 2);
       IF @id_payment_period IS NULL
         THROW 50003, '${PERIOD_NOT_CALCULABLE_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[period_employees] WHERE id_period = @id_period;

       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, importe_salario, calculated_by, calculated_at)
       SELECT @id_period, e.id_empleado, salary.tipo_nomina, salary.salario_diario, paid.dias,
              ROUND(salary.salario_diario * paid.dias, 2),
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[RH].[empleados] e
        CROSS APPLY (VALUES ('O', e.salario_diario), ('F', e.salario_diario_fiscal))
                    AS salary (tipo_nomina, salario_diario)
        CROSS APPLY (SELECT DATEDIFF(day,
                              CASE WHEN e.fecha_ingreso > @fecha_inicio THEN e.fecha_ingreso ELSE @fecha_inicio END,
                              @fecha_fin) + 1 AS dias) AS paid
        WHERE e.status = 1 AND e.activo = 1
          AND e.id_sucursal = @id_sucursal
          AND e.id_periodo_pago = @id_payment_period
          AND e.fecha_ingreso <= @fecha_fin
          AND salary.salario_diario > 0;

       UPDATE [CentroPodologico].[payroll].[periods]
          SET status = 2, updated_at = CAST(@calculated_at AS datetime2(0))
        WHERE id_period = @id_period;

       COMMIT;

       SELECT ISNULL(SUM(CASE WHEN tipo_nomina = 'O' THEN 1 ELSE 0 END), 0) AS operativa,
              ISNULL(SUM(CASE WHEN tipo_nomina = 'F' THEN 1 ELSE 0 END), 0) AS fiscal
         FROM [CentroPodologico].[payroll].[period_employees]
        WHERE id_period = @id_period;`,
      {
        id_period: parsed.data.id_period,
        id_sucursal,
        calculated_by: id_user,
        calculated_at: buildDate(new Date()),
      },
    );

    revalidatePayrollPaths();
    return {
      ok: true,
      data: { operativa: Number(rows[0]?.operativa ?? 0), fiscal: Number(rows[0]?.fiscal ?? 0) },
    };
  } catch (error) {
    console.error("calculatePayrollPeriod", error);
    return { ok: false, message: describePayrollCalculationError(error) };
  }
}

/** Revertir a Programada (solo estatus 2): borra el snapshot y regresa el periodo a estatus 1. */
export async function revertPayrollCalculation(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = revertPayrollCalculationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       IF NOT EXISTS (
         SELECT 1 FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_period = @id_period AND id_sucursal = @id_sucursal AND status = 2
       )
         THROW 50004, '${PERIOD_NOT_REVERTIBLE_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[period_employees] WHERE id_period = @id_period;

       UPDATE [CentroPodologico].[payroll].[periods]
          SET status = 1, updated_at = CAST(@updated_at AS datetime2(0))
        WHERE id_period = @id_period;

       COMMIT;`,
      {
        id_period: parsed.data.id_period,
        id_sucursal,
        updated_at: buildDate(new Date()),
      },
    );

    revalidatePayrollPaths();
    return { ok: true, data: null };
  } catch (error) {
    console.error("revertPayrollCalculation", error);
    return { ok: false, message: describePayrollCalculationError(error) };
  }
}

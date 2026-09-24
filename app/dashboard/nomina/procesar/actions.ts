"use server";

import db from "@/database/connection";
import {
  IPayrollEmployeeDetail,
  IPayrollEmployeeDetailFilters,
  IPayrollEmployeeRow,
  IPayrollEmployeeSnapshot,
  IPayrollExcludedEmployee,
  IPayrollProcessFilters,
  IPayrollProcessPage,
  PayrollType,
} from "@/interfaces/payroll_calculation";
import { ICommissionTier } from "@/interfaces/payroll_commission";
import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { IPayrollPaidTreatment } from "@/interfaces/payroll_treatment_commission";
import { ActionResult, assertPayrollAccess, PERIOD_ROW_SELECT } from "@/lib/payroll/access";
import { buildPerceptionLines } from "@/lib/payroll/perceptionLines";
import { getCommissionTiers } from "../comisiones/actions";
import {
  calculatePayrollPeriodSchema,
  payrollEmployeeDetailFiltersSchema,
  revertPayrollCalculationSchema,
} from "@/lib/payroll/schemas";
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

/** Orden de la tabla de Procesar; Anterior / Siguiente del detalle lo sigue. Determinista gracias al id. */
const PAYROLL_EMPLOYEE_ORDER_BY = "e.apellido_paterno, e.apellido_materno, e.nombre, pe.id_empleado";

/**
 * Condiciones del snapshot de un periodo y tipo, con los filtros de puesto y búsqueda de Procesar.
 * Compartido por la tabla y por Anterior / Siguiente del detalle para que recorran el mismo conjunto.
 */
function buildPayrollEmployeeConditions(filters: {
  idPeriod: number;
  payrollType: PayrollType;
  idPuesto: number | null;
  search: string;
}): { conditions: string[]; params: Record<string, unknown> } {
  const conditions = ["pe.id_period = @id_period", "pe.tipo_nomina = @tipo_nomina"];
  const params: Record<string, unknown> = {
    id_period: filters.idPeriod,
    tipo_nomina: filters.payrollType,
  };
  if (filters.idPuesto !== null) {
    conditions.push("e.id_puesto = @id_puesto");
    params.id_puesto = filters.idPuesto;
  }
  const search = filters.search.trim();
  if (search) {
    conditions.push(`(${EMPLOYEE_FULL_NAME_SQL} LIKE @search OR e.codigo_empleado LIKE @search)`);
    params.search = `%${escapeLikePattern(search)}%`;
  }
  return { conditions, params };
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
      totals: { employees: 0, importeSalario: 0, importeComision: 0, importeComisionTratamientos: 0, totalPercepciones: 0 },
      puestoOptions: [],
      excludedEmployees: [],
      lastCalculatedAt: null,
    };
    if (!period) return { ok: true, data: emptyPage };

    const { conditions: rowConditions, params: rowParams } = buildPayrollEmployeeConditions({
      idPeriod: period.id_period,
      payrollType: filters.payrollType,
      idPuesto: filters.idPuesto,
      search: filters.search,
    });

    // Salario del tipo seleccionado, con la misma regla de elegibilidad que usa el cálculo.
    const salaryColumn = filters.payrollType === "F" ? "e.salario_diario_fiscal" : "e.salario_diario";

    const [rows, totals, puestoOptions, excludedEmployees, lastCalculated] = await Promise.all([
      db.queryParams(
        `SELECT pe.id_period_employee, pe.id_empleado, e.codigo_empleado,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                e.id_puesto, pu.name AS nombre_puesto, pe.tipo_nomina,
                pe.salario_diario, pe.dias, pe.importe_salario,
                pe.consultas_atendidas, pe.importe_comision,
                pe.tratamientos_onicomicosis, pe.importe_comision_tratamientos,
                pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos AS total_percepciones,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
          WHERE ${rowConditions.join(" AND ")}
          ORDER BY ${PAYROLL_EMPLOYEE_ORDER_BY}`,
        rowParams,
      ),
      db.queryParams(
        `SELECT COUNT(*) AS employees,
                ISNULL(SUM(importe_salario), 0) AS importe_salario,
                ISNULL(SUM(importe_comision), 0) AS importe_comision,
                ISNULL(SUM(importe_comision_tratamientos), 0) AS importe_comision_tratamientos
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
          consultas_atendidas: Number(row.consultas_atendidas),
          importe_comision: Number(row.importe_comision),
          tratamientos_onicomicosis: Number(row.tratamientos_onicomicosis),
          importe_comision_tratamientos: Number(row.importe_comision_tratamientos),
          total_percepciones: Number(row.total_percepciones),
        })),
        totals: {
          employees: Number(totals[0]?.employees ?? 0),
          importeSalario: Number(totals[0]?.importe_salario ?? 0),
          importeComision: Number(totals[0]?.importe_comision ?? 0),
          importeComisionTratamientos: Number(totals[0]?.importe_comision_tratamientos ?? 0),
          totalPercepciones:
            Math.round(
              (Number(totals[0]?.importe_salario ?? 0) +
                Number(totals[0]?.importe_comision ?? 0) +
                Number(totals[0]?.importe_comision_tratamientos ?? 0)) *
                100,
            ) / 100,
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

/**
 * Detalle de nómina de un empleado en un periodo y tipo. `data: null` si el periodo no es de la
 * sucursal o si el empleado no se encuentra (ni es de la sucursal del periodo ni tiene snapshot en él).
 */
export async function getPayrollEmployeeDetail(
  filters: IPayrollEmployeeDetailFilters,
): Promise<ActionResult<IPayrollEmployeeDetail | null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = payrollEmployeeDetailFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { idEmpleado, idPeriod, payrollType, idPuesto, search } = parsed.data;

  try {
    const period = await resolvePeriod(id_sucursal, idPeriod);
    if (!period) return { ok: true, data: null };

    const { conditions: navigationConditions, params: navigationParams } = buildPayrollEmployeeConditions({
      idPeriod: period.id_period,
      payrollType,
      idPuesto,
      search,
    });

    const [employeeRows, snapshotRows, navigationRows, paidTreatmentRows] = await Promise.all([
      // Cuenta como encontrado si es de la sucursal del periodo o si tiene snapshot en el periodo
      // (cubre a quien cambió de sucursal después del cálculo).
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                ISNULL(pu.name, '') AS nombre_puesto,
                e.foto_url, e.activo,
                CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso
           FROM [CentroPodologico].[RH].[empleados] e
           LEFT JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
          WHERE e.id_empleado = @id_empleado
            AND (e.id_sucursal = @id_sucursal
                 OR EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employees] pe
                             WHERE pe.id_period = @id_period AND pe.id_empleado = e.id_empleado))`,
        { id_empleado: idEmpleado, id_sucursal: period.id_sucursal, id_period: period.id_period },
      ),
      db.queryParams(
        `SELECT pe.salario_diario, pe.dias, pe.importe_salario,
                pe.consultas_atendidas, pe.importe_comision,
                pe.tratamientos_onicomicosis, pe.importe_por_tratamiento, pe.importe_comision_tratamientos,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
          WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = @tipo_nomina`,
        { id_period: period.id_period, id_empleado: idEmpleado, tipo_nomina: payrollType },
      ),
      // Mismo conjunto y orden que la tabla de Procesar; sin fila si el empleado no está en él.
      db.queryParams(
        `WITH ordered_employees AS (
           SELECT pe.id_empleado,
                  LAG(pe.id_empleado)  OVER (ORDER BY ${PAYROLL_EMPLOYEE_ORDER_BY}) AS previous_employee_id,
                  LEAD(pe.id_empleado) OVER (ORDER BY ${PAYROLL_EMPLOYEE_ORDER_BY}) AS next_employee_id
             FROM [CentroPodologico].[payroll].[period_employees] pe
             JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
             JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
            WHERE ${navigationConditions.join(" AND ")}
         )
         SELECT previous_employee_id, next_employee_id
           FROM ordered_employees
          WHERE id_empleado = @id_empleado`,
        { ...navigationParams, id_empleado: idEmpleado },
      ),
      // Solo la nómina operativa comisiona por tratamientos; en fiscal no hay desglose.
      payrollType === "O"
        ? db.queryParams(
            `SELECT pet.id_tratamiento,
                    LTRIM(RTRIM(
                      ISNULL(p.[nombre], '')
                      + ISNULL(' ' + NULLIF(p.[apellido_paterno], ''), '')
                      + ISNULL(' ' + NULLIF(p.[apellido_materno], ''), ''))) AS nombre_paciente,
                    CONVERT(varchar(19), pet.fecha_liquidacion, 120) AS fecha_liquidacion,
                    CAST(pet.total_parciales AS float) AS total_parciales
               FROM [CentroPodologico].[payroll].[period_employee_treatments] pet
               JOIN [CentroPodologico].[payroll].[period_employees] pe
                 ON pe.id_period_employee = pet.id_period_employee
               LEFT JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t ON t.id_tratamiento = pet.id_tratamiento
               LEFT JOIN [CentroPodologico].[dbo].[consultas] c ON c.id_consulta = t.id_consulta
               LEFT JOIN [CentroPodologico].[dbo].[pacientes] p ON p.id_paciente = c.id_paciente
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'O'
              ORDER BY pet.fecha_liquidacion, pet.id_tratamiento`,
            { id_period: period.id_period, id_empleado: idEmpleado },
          )
        : Promise.resolve([]),
    ]);

    const employeeRow = employeeRows[0];
    if (!employeeRow) return { ok: true, data: null };

    const employee: IPayrollEmployeeDetail["employee"] = {
      id_empleado: Number(employeeRow.id_empleado),
      codigo_empleado: employeeRow.codigo_empleado,
      nombre_completo: employeeRow.nombre_completo,
      nombre_puesto: employeeRow.nombre_puesto,
      foto_url: employeeRow.foto_url || null,
      activo: Boolean(employeeRow.activo),
      fecha_ingreso: employeeRow.fecha_ingreso,
    };

    const snapshotRow = snapshotRows[0];
    const snapshot: IPayrollEmployeeSnapshot | null = snapshotRow
      ? {
          salario_diario: Number(snapshotRow.salario_diario),
          dias: Number(snapshotRow.dias),
          importe_salario: Number(snapshotRow.importe_salario),
          consultas_atendidas: Number(snapshotRow.consultas_atendidas),
          importe_comision: Number(snapshotRow.importe_comision),
          tratamientos_onicomicosis: Number(snapshotRow.tratamientos_onicomicosis),
          importe_por_tratamiento: Number(snapshotRow.importe_por_tratamiento),
          importe_comision_tratamientos: Number(snapshotRow.importe_comision_tratamientos),
          calculated_at: snapshotRow.calculated_at,
        }
      : null;

    // El catálogo solo se consulta si hay comisión que describir.
    const commissionTiers =
      snapshot && snapshot.importe_comision > 0 ? await getCommissionTiersOrEmpty() : [];
    const perceptions = snapshot
      ? buildPerceptionLines(snapshot, employee.fecha_ingreso, period.fecha_inicio, commissionTiers)
      : [];
    const totalPerceptions =
      Math.round(perceptions.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;

    const paidTreatments: IPayrollPaidTreatment[] = snapshot
      ? paidTreatmentRows.map((row: IPayrollPaidTreatment) => ({
          id_tratamiento: Number(row.id_tratamiento),
          nombre_paciente: row.nombre_paciente,
          fecha_liquidacion: row.fecha_liquidacion,
          total_parciales: Number(row.total_parciales),
        }))
      : [];

    const navigationRow = snapshot ? navigationRows[0] : undefined;

    return {
      ok: true,
      data: {
        period,
        employee,
        snapshot,
        perceptions,
        totalPerceptions,
        paidTreatments,
        navigation: {
          previousEmployeeId: navigationRow?.previous_employee_id ?? null,
          nextEmployeeId: navigationRow?.next_employee_id ?? null,
        },
      },
    };
  } catch (error) {
    console.error("getPayrollEmployeeDetail", error);
    return { ok: false, message: "No se pudo cargar el detalle de nómina del empleado" };
  }
}

async function getCommissionTiersOrEmpty(): Promise<ICommissionTier[]> {
  const result = await getCommissionTiers();
  return result.ok ? result.data : [];
}

const PERIOD_NOT_CALCULABLE_MARKER = "PERIOD_NOT_CALCULABLE";
const PERIOD_NOT_REVERTIBLE_MARKER = "PERIOD_NOT_REVERTIBLE";
const TREATMENT_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_treatments_tratamiento";

/** Traduce los errores de SQL Server de calcular/revertir nómina a un mensaje en español. */
function describePayrollCalculationError(error: unknown): string {
  const sqlError = error as { message?: string; number?: number };
  if (sqlError.message?.includes(PERIOD_NOT_CALCULABLE_MARKER)) {
    return "El periodo no existe en esta sucursal o ya no está en estatus Programada o En cálculo";
  }
  if (sqlError.message?.includes(PERIOD_NOT_REVERTIBLE_MARKER)) {
    return "El periodo no existe en esta sucursal o ya no está en estatus En cálculo";
  }
  if (sqlError.message?.includes(TREATMENT_ALREADY_PAID_CONSTRAINT)) {
    return "Otro cálculo tomó alguno de estos tratamientos al mismo tiempo. Intenta de nuevo.";
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
 * La comisión por consultas (spec 56) también se resuelve aquí; `lib/payroll/commissionTiers.ts` la espeja.
 * La comisión por tratamientos de onicomicosis (spec 57) también: `lib/payroll/treatmentCommission.ts` la espeja
 * y, si divergen, manda este SQL.
 * Solo la nómina operativa ('O') comisiona; las filas 'F' quedan en 0. `cancelada` es nullable y
 * NULL significa "no cancelada" (así lo lee la app), por eso `ISNULL(c.[cancelada], 0) = 0`.
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

       -- El cascade de period_employee_treatments libera los tratamientos que este periodo tenía pagados.
       DELETE FROM [CentroPodologico].[payroll].[period_employees] WHERE id_period = @id_period;

       -- Spec 57: tratamientos de onicomicosis liquidados en el rango y aún no pagados por ningún periodo.
       ;WITH partials AS (
         SELECT p.[id_tratamiento], p.[id_tratamiento_pago], p.[created_at],
                SUM(p.[total]) OVER (PARTITION BY p.[id_tratamiento]
                                     ORDER BY p.[created_at], p.[id_tratamiento_pago]
                                     ROWS UNBOUNDED PRECEDING) AS acumulado
           FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos] p
          WHERE p.[id_tratamiento_pago_tipo] = 2 AND p.[status] = 1
       )
       SELECT u.[id_empleado], t.[id_tratamiento], liq.[created_at] AS fecha_liquidacion, liq.acumulado
         INTO #liquidated
         FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
         JOIN [CentroPodologico].[dbo].[users] u    ON u.[id_user] = t.[id_usuario]
         JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = u.[id_empleado]
         JOIN [CentroPodologico].[payroll].[treatment_commission_settings] s ON s.[id_empresa] = e.[id_empresa]
        CROSS APPLY (SELECT TOP 1 pa.[created_at], pa.acumulado
                       FROM partials pa
                      WHERE pa.[id_tratamiento] = t.[id_tratamiento] AND pa.acumulado >= s.[umbral_liquidacion]
                      ORDER BY pa.[created_at], pa.[id_tratamiento_pago]) liq
        WHERE ISNULL(t.[id_stage], 0) <> 6
          AND liq.[created_at] >= @fecha_inicio
          AND liq.[created_at] <  DATEADD(day, 1, @fecha_fin)
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_treatments] pet
                           WHERE pet.[id_tratamiento] = t.[id_tratamiento]);

       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, importe_salario,
          consultas_atendidas, importe_comision,
          tratamientos_onicomicosis, importe_por_tratamiento, importe_comision_tratamientos,
          calculated_by, calculated_at)
       SELECT @id_period, e.id_empleado, salary.tipo_nomina, salary.salario_diario, paid.dias,
              ROUND(salary.salario_diario * paid.dias, 2),
              ISNULL(attended.consultas, 0), ISNULL(tier.importe, 0),
              ISNULL(paid_treatments.tratamientos, 0),
              CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END,
              ROUND(ISNULL(paid_treatments.tratamientos, 0)
                    * CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END, 2),
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[RH].[empleados] e
         LEFT JOIN [CentroPodologico].[payroll].[treatment_commission_settings] treatment_settings
                ON treatment_settings.[id_empresa] = e.[id_empresa]
        CROSS APPLY (VALUES ('O', e.salario_diario), ('F', e.salario_diario_fiscal))
                    AS salary (tipo_nomina, salario_diario)
        CROSS APPLY (SELECT DATEDIFF(day,
                              CASE WHEN e.fecha_ingreso > @fecha_inicio THEN e.fecha_ingreso ELSE @fecha_inicio END,
                              @fecha_fin) + 1 AS dias) AS paid
        OUTER APPLY (
          SELECT COUNT(*) AS consultas
            FROM [CentroPodologico].[dbo].[consultas] c
            JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = c.[id_podologo]
           WHERE salary.tipo_nomina = 'O'
             AND u.[id_empleado] = e.[id_empleado]
             AND c.[deleted_at] IS NULL
             AND ISNULL(c.[cancelada], 0) = 0
             AND c.[fecha_fin] IS NOT NULL
             AND c.[fecha] >= @fecha_inicio
             AND c.[fecha] <  DATEADD(day, 1, @fecha_fin)
        ) AS attended
        OUTER APPLY (
          SELECT TOP 1 t.[importe]
            FROM [CentroPodologico].[payroll].[commission_tiers] t
           WHERE t.[id_empresa]    = e.[id_empresa]
             AND t.[min_consultas] <= attended.consultas
             AND (t.[max_consultas] IS NULL OR t.[max_consultas] >= attended.consultas)
           ORDER BY t.[min_consultas] DESC
        ) AS tier
        OUTER APPLY (
          SELECT COUNT(*) AS tratamientos
            FROM #liquidated l
           WHERE salary.tipo_nomina = 'O' AND l.[id_empleado] = e.[id_empleado]
        ) AS paid_treatments
        WHERE e.status = 1 AND e.activo = 1
          AND e.id_sucursal = @id_sucursal
          AND e.id_periodo_pago = @id_payment_period
          AND e.fecha_ingreso <= @fecha_fin
          AND salary.salario_diario > 0;

       -- Desglose y candado anti doble pago: solo los tratamientos de quien entró a la nómina operativa.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_treatments]
         (id_period_employee, id_tratamiento, fecha_liquidacion, total_parciales)
       SELECT pe.[id_period_employee], l.[id_tratamiento], l.[fecha_liquidacion], l.[acumulado]
         FROM #liquidated l
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = l.[id_empleado] AND pe.[tipo_nomina] = 'O';

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

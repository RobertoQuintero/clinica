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
import { IPayrollOvertimeDay } from "@/interfaces/payroll_overtime";
import { IPayrollSoldProduct } from "@/interfaces/payroll_product_sales_commission";
import { IPayrollPaidTreatment } from "@/interfaces/payroll_treatment_commission";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { ELIGIBLE_EMPLOYEE_BASE_CONDITIONS, ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS } from "@/lib/payroll/eligibleEmployees";
import { buildPerceptionLines } from "@/lib/payroll/perceptionLines";
import { resolvePeriod } from "@/lib/payroll/period";
import { getCommissionTiers } from "../comisiones/actions";
import {
  calculatePayrollPeriodSchema,
  payrollEmployeeDetailFiltersSchema,
  revertPayrollCalculationSchema,
} from "@/lib/payroll/schemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

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
      totals: { employees: 0, importeSalario: 0, importeComision: 0, importeComisionTratamientos: 0, importeComisionProductos: 0, importeHorasExtra: 0, totalPercepciones: 0 },
      puestoOptions: [],
      excludedEmployees: [],
      lastCalculatedAt: null,
      overtimeRecalculationNeeded: false,
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
                pe.piezas_vendidas, pe.importe_comision_productos,
                pe.horas_extra_dobles, pe.horas_extra_triples,
                pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples AS importe_horas_extra,
                pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos
                  + pe.importe_comision_productos
                  + pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples AS total_percepciones,
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
                ISNULL(SUM(importe_comision_tratamientos), 0) AS importe_comision_tratamientos,
                ISNULL(SUM(importe_comision_productos), 0) AS importe_comision_productos,
                ISNULL(SUM(importe_horas_extra_dobles + importe_horas_extra_triples), 0) AS importe_horas_extra
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
          piezas_vendidas: Number(row.piezas_vendidas),
          importe_comision_productos: Number(row.importe_comision_productos),
          horas_extra_dobles: Number(row.horas_extra_dobles),
          horas_extra_triples: Number(row.horas_extra_triples),
          importe_horas_extra: Number(row.importe_horas_extra),
          total_percepciones: Number(row.total_percepciones),
        })),
        totals: {
          employees: Number(totals[0]?.employees ?? 0),
          importeSalario: Number(totals[0]?.importe_salario ?? 0),
          importeComision: Number(totals[0]?.importe_comision ?? 0),
          importeComisionTratamientos: Number(totals[0]?.importe_comision_tratamientos ?? 0),
          importeComisionProductos: Number(totals[0]?.importe_comision_productos ?? 0),
          importeHorasExtra: Number(totals[0]?.importe_horas_extra ?? 0),
          totalPercepciones:
            Math.round(
              (Number(totals[0]?.importe_salario ?? 0) +
                Number(totals[0]?.importe_comision ?? 0) +
                Number(totals[0]?.importe_comision_tratamientos ?? 0) +
                Number(totals[0]?.importe_comision_productos ?? 0) +
                Number(totals[0]?.importe_horas_extra ?? 0)) *
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

    const [employeeRows, snapshotRows, navigationRows, paidTreatmentRows, soldProductRows, overtimeDayRows] = await Promise.all([
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
                pe.piezas_vendidas, pe.importe_comision_productos,
                pe.horas_extra_dobles, pe.horas_extra_triples,
                pe.importe_horas_extra_dobles, pe.importe_horas_extra_triples,
                pe.limite_horas_dobles_aplicado,
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
      // Ventas de productos pagadas en el renglón operativo, agrupadas por producto y bono congelado.
      payrollType === "O"
        ? db.queryParams(
            `SELECT ps.id_producto, ISNULL(p.[name], '') AS nombre_producto, ps.bono_venta,
                    CAST(SUM(ps.cantidad) AS float) AS piezas,
                    CAST(SUM(ps.importe_comision) AS float) AS importe_comision
               FROM [CentroPodologico].[payroll].[period_employee_product_sales] ps
               JOIN [CentroPodologico].[payroll].[period_employees] pe
                 ON pe.id_period_employee = ps.id_period_employee
               LEFT JOIN [CentroPodologico].[inventory].[Products] p ON p.id_product = ps.id_producto
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'O'
              GROUP BY ps.id_producto, p.[name], ps.bono_venta
              ORDER BY SUM(ps.importe_comision) DESC, p.[name]`,
            { id_period: period.id_period, id_empleado: idEmpleado },
          )
        : Promise.resolve([]),
      // Días de horas extra pagados en el renglón operativo (spec 61); en fiscal no hay desglose.
      payrollType === "O"
        ? db.queryParams(
            `SELECT CONVERT(varchar(10), o.fecha, 120) AS fecha,
                    o.horas_autorizadas, o.horas_dobles, o.horas_triples,
                    o.importe_dobles, o.importe_triples
               FROM [CentroPodologico].[payroll].[period_employee_overtime] o
               JOIN [CentroPodologico].[payroll].[period_employees] pe
                 ON pe.id_period_employee = o.id_period_employee
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'O'
              ORDER BY o.fecha`,
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
          piezas_vendidas: Number(snapshotRow.piezas_vendidas),
          importe_comision_productos: Number(snapshotRow.importe_comision_productos),
          horas_extra_dobles: Number(snapshotRow.horas_extra_dobles),
          horas_extra_triples: Number(snapshotRow.horas_extra_triples),
          importe_horas_extra_dobles: Number(snapshotRow.importe_horas_extra_dobles),
          importe_horas_extra_triples: Number(snapshotRow.importe_horas_extra_triples),
          limite_horas_dobles_aplicado: Number(snapshotRow.limite_horas_dobles_aplicado),
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

    const soldProducts: IPayrollSoldProduct[] = snapshot
      ? soldProductRows.map((row: IPayrollSoldProduct) => ({
          id_producto: Number(row.id_producto),
          nombre_producto: row.nombre_producto,
          piezas: Number(row.piezas),
          bono_venta: Number(row.bono_venta),
          importe_comision: Number(row.importe_comision),
        }))
      : [];

    const overtimeDays: IPayrollOvertimeDay[] = snapshot
      ? overtimeDayRows.map((row: IPayrollOvertimeDay) => ({
          fecha: row.fecha,
          horas_autorizadas: Number(row.horas_autorizadas),
          horas_dobles: Number(row.horas_dobles),
          horas_triples: Number(row.horas_triples),
          importe_dobles: Number(row.importe_dobles),
          importe_triples: Number(row.importe_triples),
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
        soldProducts,
        overtimeDays,
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
const PRODUCT_SALE_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_product_sales_linea";
const OVERTIME_DAY_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_overtime_empleado_fecha";

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
  if (sqlError.message?.includes(PRODUCT_SALE_ALREADY_PAID_CONSTRAINT)) {
    return "Otro cálculo tomó algunas de estas ventas al mismo tiempo. Intenta de nuevo.";
  }
  if (sqlError.message?.includes(OVERTIME_DAY_ALREADY_PAID_CONSTRAINT)) {
    return "Otro cálculo tomó algunas de estas horas extra al mismo tiempo. Intenta de nuevo.";
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
 * La comisión por venta de productos (spec 58) también: `lib/payroll/productSalesCommission.ts` la espeja
 * y, si divergen, manda este SQL.
 * Las horas extra autorizadas (spec 61) también: `lib/payroll/overtimePay.ts` las espeja y, si divergen, manda este SQL.
 * Solo la nómina operativa ('O') comisiona y paga horas extra; las filas 'F' quedan en 0. `cancelada` es nullable y
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

       -- El cascade de period_employee_treatments y period_employee_product_sales libera lo que este periodo tenía pagado.
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

       -- Spec 58: líneas vendidas en el rango con bono_venta y aún no pagadas por ningún periodo.
       SELECT u.[id_empleado], CAST('C' AS char(1)) AS origen,
              cp.[id_consulta_producto] AS id_linea_origen, c.[id_consulta] AS id_documento_origen,
              cp.[id_producto], c.[fecha] AS fecha_venta,
              CAST(cp.[cantidad] AS decimal(18,4)) AS cantidad, p.[bono_venta]
         INTO #product_sales
         FROM [CentroPodologico].[dbo].[consulta_productos] cp
         JOIN [CentroPodologico].[dbo].[consultas] c       ON c.[id_consulta] = cp.[id_consulta]
         JOIN [CentroPodologico].[dbo].[users] u           ON u.[id_user]     = c.[id_podologo]
         JOIN [CentroPodologico].[inventory].[Products] p  ON p.[id_product]  = cp.[id_producto]
        WHERE u.[id_empleado] IS NOT NULL
          AND cp.[status] = 1
          AND c.[deleted_at] IS NULL
          AND ISNULL(c.[cancelada], 0) = 0
          AND c.[fecha] >= @fecha_inicio AND c.[fecha] < DATEADD(day, 1, @fecha_fin)
          AND p.[bono_venta] > 0
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_product_sales] ps
                           WHERE ps.[origen] = 'C' AND ps.[id_linea_origen] = cp.[id_consulta_producto])
       UNION ALL
       SELECT u.[id_empleado], 'V', vd.[id_venta_detalle], v.[id_venta],
              vd.[id_producto], v.[created_at], vd.[cantidad], p.[bono_venta]
         FROM [CentroPodologico].[dbo].[VentasDetalle] vd
         JOIN [CentroPodologico].[dbo].[Ventas] v          ON v.[id_venta]   = vd.[id_venta]
         JOIN [CentroPodologico].[dbo].[users] u           ON u.[id_user]    = v.[id_usuario]
         JOIN [CentroPodologico].[inventory].[Products] p  ON p.[id_product] = vd.[id_producto]
        WHERE u.[id_empleado] IS NOT NULL
          AND v.[status] = 1
          AND v.[created_at] >= @fecha_inicio AND v.[created_at] < DATEADD(day, 1, @fecha_fin)
          AND p.[bono_venta] > 0
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_product_sales] ps
                           WHERE ps.[origen] = 'V' AND ps.[id_linea_origen] = vd.[id_venta_detalle]);

       -- Spec 61: días con horas extra autorizadas en el rango y aún no pagados por ningún periodo.
       -- Solo de empleados elegibles a la nómina operativa y de empresas con configuración. Las primeras
       -- limite_horas_dobles_periodo horas (en orden cronológico) son dobles y el resto triples; el día que cruza se parte.
       ;WITH authorized_days AS (
         SELECT a.[id_empleado], a.[fecha], a.[horas_autorizadas] AS horas,
                s.[limite_horas_dobles_periodo] AS limite, e.[salario_diario],
                SUM(a.[horas_autorizadas]) OVER (PARTITION BY a.[id_empleado]
                                                 ORDER BY a.[fecha]
                                                 ROWS UNBOUNDED PRECEDING) - a.[horas_autorizadas] AS acumulado_previo
           FROM [CentroPodologico].[payroll].[overtime_authorizations] a
           JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = a.[id_empleado]
           JOIN [CentroPodologico].[payroll].[overtime_settings] s ON s.[id_empresa] = e.[id_empresa]
          WHERE a.[estado] = 'A'
            AND a.[fecha] >= @fecha_inicio AND a.[fecha] <= @fecha_fin
            AND a.[fecha] >= e.[fecha_ingreso]
            AND ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
            AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_overtime] po
                             WHERE po.[id_empleado] = a.[id_empleado] AND po.[fecha] = a.[fecha])
       ), split_days AS (
         SELECT d.*, CAST(CASE WHEN d.limite - d.acumulado_previo <= 0 THEN 0
                               WHEN d.limite - d.acumulado_previo >= d.horas THEN d.horas
                               ELSE d.limite - d.acumulado_previo END AS decimal(4,1)) AS horas_dobles
           FROM authorized_days d
       )
       SELECT sd.[id_empleado], sd.[fecha], sd.horas AS horas_autorizadas,
              sd.horas_dobles, CAST(sd.horas - sd.horas_dobles AS decimal(4,1)) AS horas_triples,
              ROUND(sd.horas_dobles * sd.[salario_diario] * 2 / 8, 2) AS importe_dobles,
              ROUND((sd.horas - sd.horas_dobles) * sd.[salario_diario] * 3 / 8, 2) AS importe_triples
         INTO #overtime_days
         FROM split_days sd;

       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, importe_salario,
          consultas_atendidas, importe_comision,
          tratamientos_onicomicosis, importe_por_tratamiento, importe_comision_tratamientos,
          piezas_vendidas, importe_comision_productos,
          horas_extra_dobles, horas_extra_triples, importe_horas_extra_dobles, importe_horas_extra_triples,
          limite_horas_dobles_aplicado,
          calculated_by, calculated_at)
       SELECT @id_period, e.id_empleado, salary.tipo_nomina, salary.salario_diario, paid.dias,
              ROUND(salary.salario_diario * paid.dias, 2),
              ISNULL(attended.consultas, 0), ISNULL(tier.importe, 0),
              ISNULL(paid_treatments.tratamientos, 0),
              CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END,
              ROUND(ISNULL(paid_treatments.tratamientos, 0)
                    * CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END, 2),
              ISNULL(product_sales.piezas, 0), ISNULL(product_sales.importe, 0),
              ISNULL(overtime.dobles, 0), ISNULL(overtime.triples, 0),
              ISNULL(overtime.importe_dobles, 0), ISNULL(overtime.importe_triples, 0),
              CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(overtime_settings.[limite_horas_dobles_periodo], 0) ELSE 0 END,
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[RH].[empleados] e
         LEFT JOIN [CentroPodologico].[payroll].[treatment_commission_settings] treatment_settings
                ON treatment_settings.[id_empresa] = e.[id_empresa]
         LEFT JOIN [CentroPodologico].[payroll].[overtime_settings] overtime_settings
                ON overtime_settings.[id_empresa] = e.[id_empresa]
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
        OUTER APPLY (
          SELECT SUM(ps.[cantidad]) AS piezas,
                 SUM(ROUND(ps.[cantidad] * ps.[bono_venta], 2)) AS importe
            FROM #product_sales ps
           WHERE salary.tipo_nomina = 'O' AND ps.[id_empleado] = e.[id_empleado]
        ) AS product_sales
        OUTER APPLY (
          SELECT SUM(od.[horas_dobles]) AS dobles, SUM(od.[horas_triples]) AS triples,
                 SUM(od.[importe_dobles]) AS importe_dobles, SUM(od.[importe_triples]) AS importe_triples
            FROM #overtime_days od
           WHERE salary.tipo_nomina = 'O' AND od.[id_empleado] = e.[id_empleado]
        ) AS overtime
        WHERE ${ELIGIBLE_EMPLOYEE_BASE_CONDITIONS}
          AND salary.salario_diario > 0;

       -- Desglose y candado anti doble pago: solo los tratamientos de quien entró a la nómina operativa.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_treatments]
         (id_period_employee, id_tratamiento, fecha_liquidacion, total_parciales)
       SELECT pe.[id_period_employee], l.[id_tratamiento], l.[fecha_liquidacion], l.[acumulado]
         FROM #liquidated l
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = l.[id_empleado] AND pe.[tipo_nomina] = 'O';

       -- Desglose y candado anti doble pago de ventas: solo las líneas de quien entró a la nómina operativa.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_product_sales]
         (id_period_employee, origen, id_linea_origen, id_documento_origen, id_producto,
          fecha_venta, cantidad, bono_venta, importe_comision)
       SELECT pe.[id_period_employee], s.[origen], s.[id_linea_origen], s.[id_documento_origen], s.[id_producto],
              s.[fecha_venta], s.[cantidad], s.[bono_venta], ROUND(s.[cantidad] * s.[bono_venta], 2)
         FROM #product_sales s
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = s.[id_empleado] AND pe.[tipo_nomina] = 'O';

       -- Desglose y candado anti doble pago de horas extra: solo los días de quien entró a la nómina operativa.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_overtime]
         (id_period_employee, id_empleado, fecha, horas_autorizadas, horas_dobles, horas_triples,
          importe_dobles, importe_triples)
       SELECT pe.[id_period_employee], od.[id_empleado], od.[fecha], od.[horas_autorizadas],
              od.[horas_dobles], od.[horas_triples], od.[importe_dobles], od.[importe_triples]
         FROM #overtime_days od
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = od.[id_empleado] AND pe.[tipo_nomina] = 'O';

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

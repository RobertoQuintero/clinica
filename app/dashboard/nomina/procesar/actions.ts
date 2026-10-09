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
import { IPayrollDiscountedAbsence } from "@/interfaces/payroll_absence";
import { IsrSkipReason } from "@/interfaces/payroll_isr";
import { IPayrollDiscountedLateness } from "@/interfaces/payroll_lateness";
import { ICommissionTier } from "@/interfaces/payroll_commission";
import { IPayrollOvertimeDay } from "@/interfaces/payroll_overtime";
import { IPayrollSoldProduct } from "@/interfaces/payroll_product_sales_commission";
import { IPayrollPaidTreatment } from "@/interfaces/payroll_treatment_commission";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { isAbsenceRecalculationNeeded } from "@/lib/payroll/absenceRecalculation";
import { isAttendanceBonusRecalculationNeeded } from "@/lib/payroll/attendanceBonusRecalculation";
import { isShiftExtensionBonusRecalculationNeeded } from "@/lib/payroll/shiftExtensionBonusRecalculation";
import { isLatenessRecalculationNeeded } from "@/lib/payroll/latenessRecalculation";
import { isPunctualityBonusRecalculationNeeded } from "@/lib/payroll/punctualityBonusRecalculation";
import { isOvertimeRecalculationNeeded } from "@/lib/payroll/overtimeRecalculation";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
  ELIGIBLE_EMPLOYEE_BASE_CONDITIONS,
  ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { buildPerceptionLines } from "@/lib/payroll/perceptionLines";
import {
  ATTENDANCE_BONUS_APPLY_SQL,
  ATTENDANCE_BONUS_INSERT_COLUMNS_SQL,
  ATTENDANCE_BONUS_SELECT_SQL,
} from "@/lib/payroll/attendanceBonusSql";
import {
  SHIFT_EXTENSION_BONUS_APPLY_SQL,
  SHIFT_EXTENSION_BONUS_INSERT_COLUMNS_SQL,
  SHIFT_EXTENSION_BONUS_SELECT_SQL,
  SHIFT_EXTENSION_WORKED_DAYS_SQL,
} from "@/lib/payroll/shiftExtensionBonusSql";
import {
  PUNCTUALITY_BONUS_APPLY_SQL,
  PUNCTUALITY_BONUS_INSERT_COLUMNS_SQL,
  PUNCTUALITY_BONUS_SELECT_SQL,
} from "@/lib/payroll/punctualityBonusSql";
import { ISR_BRACKET_APPLY_SQL, ISR_PARAMETERS_SQL, ISR_UPDATE_SET_SQL } from "@/lib/payroll/isrSql";
import { ISR_DEDUCTION_ID } from "@/lib/payroll/constants";
import { resolvePeriod } from "@/lib/payroll/period";
import { getCommissionTiers } from "../comisiones/actions";
import {
  calculatePayrollPeriodSchema,
  payrollEmployeeDetailFiltersSchema,
  revertPayrollCalculationSchema,
} from "@/lib/payroll/schemas";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\[%_]/g, (character) => `[${character}]`);
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
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
      totals: { employees: 0, importeSalario: 0, importeComision: 0, importeComisionTratamientos: 0, importeComisionProductos: 0, importeHorasExtra: 0, importeBonoPuntualidad: 0, importeBonoAsistencia: 0, importeBonoExtension: 0, totalPercepciones: 0, importeIsr: 0, totalNeto: 0 },
      isrNotCalculated: [],
      puestoOptions: [],
      excludedEmployees: [],
      lastCalculatedAt: null,
      overtimeRecalculationNeeded: false,
      absenceRecalculationNeeded: false,
      latenessRecalculationNeeded: false,
      punctualityBonusRecalculationNeeded: false,
      attendanceBonusRecalculationNeeded: false,
      shiftExtensionBonusRecalculationNeeded: false,
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

    const [
      rows,
      totals,
      isrNotCalculatedRows,
      puestoOptions,
      excludedEmployees,
      lastCalculated,
      overtimeRecalculationNeeded,
      absenceRecalculationNeeded,
      latenessRecalculationNeeded,
      punctualityBonusRecalculationNeeded,
      attendanceBonusRecalculationNeeded,
      shiftExtensionBonusRecalculationNeeded,
    ] = await Promise.all([
      db.queryParams(
        `SELECT pe.id_period_employee, pe.id_empleado, e.codigo_empleado,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                e.id_puesto, pu.name AS nombre_puesto, pe.tipo_nomina,
                pe.salario_diario, pe.dias, pe.dias_falta,
                pe.dias_retardo, pe.dias_retardo_sin_tope, pe.importe_salario,
                pe.consultas_atendidas, pe.importe_comision,
                pe.tratamientos_onicomicosis, pe.importe_comision_tratamientos,
                pe.piezas_vendidas, pe.importe_comision_productos,
                pe.horas_extra_dobles, pe.horas_extra_triples,
                pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples AS importe_horas_extra,
                pe.bono_puntualidad_resultado, pe.bono_puntualidad_retardos, pe.bono_puntualidad_faltas,
                pe.bono_puntualidad_maximo, CAST(pe.importe_bono_puntualidad AS float) AS importe_bono_puntualidad,
                pe.bono_asistencia_resultado, pe.bono_asistencia_faltas,
                CAST(pe.importe_bono_asistencia AS float) AS importe_bono_asistencia,
                pe.bono_extension_asignado, pe.bono_extension_dias,
                CAST(pe.importe_bono_extension AS float) AS importe_bono_extension,
                pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos
                  + pe.importe_comision_productos
                  + pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples
                  + pe.importe_bono_puntualidad + pe.importe_bono_asistencia
                  + pe.importe_bono_extension AS total_percepciones,
                pe.isr_estado, CAST(pe.isr_retenido AS float) AS isr_retenido,
                CAST(deductions.total AS float) AS total_deducciones,
                CAST(pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos
                  + pe.importe_comision_productos
                  + pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples
                  + pe.importe_bono_puntualidad + pe.importe_bono_asistencia
                  + pe.importe_bono_extension - deductions.total AS float) AS neto,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
          CROSS APPLY (SELECT ISNULL(SUM(d.importe), 0) AS total
                         FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                        WHERE d.id_period_employee = pe.id_period_employee) AS deductions
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
                ISNULL(SUM(importe_horas_extra_dobles + importe_horas_extra_triples), 0) AS importe_horas_extra,
                CAST(ISNULL(SUM(importe_bono_puntualidad), 0) AS float) AS importe_bono_puntualidad,
                CAST(ISNULL(SUM(importe_bono_asistencia), 0) AS float) AS importe_bono_asistencia,
                CAST(ISNULL(SUM(importe_bono_extension), 0) AS float) AS importe_bono_extension,
                CAST(ISNULL(SUM(deductions.isr), 0) AS float) AS importe_isr,
                CAST(ISNULL(SUM(deductions.total), 0) AS float) AS total_deducciones
           FROM [CentroPodologico].[payroll].[period_employees] pe
          CROSS APPLY (SELECT ISNULL(SUM(d.importe), 0) AS total,
                              ISNULL(SUM(CASE WHEN d.id_deduction = @isr_deduction_id THEN d.importe END), 0) AS isr
                         FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                        WHERE d.id_period_employee = pe.id_period_employee) AS deductions
          WHERE id_period = @id_period AND tipo_nomina = @tipo_nomina`,
        { id_period: period.id_period, tipo_nomina: filters.payrollType, isr_deduction_id: ISR_DEDUCTION_ID },
      ),
      // Spec 70: renglones "ISR no calculado" por motivo, de todo el tipo (sin filtros de puesto ni búsqueda).
      db.queryParams(
        `SELECT isr_motivo, COUNT(*) AS employees
           FROM [CentroPodologico].[payroll].[period_employees]
          WHERE id_period = @id_period AND tipo_nomina = @tipo_nomina AND isr_estado = 'N'
          GROUP BY isr_motivo
          ORDER BY isr_motivo`,
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
      isOvertimeRecalculationNeeded(period.id_period),
      isAbsenceRecalculationNeeded(period.id_period),
      isLatenessRecalculationNeeded(period.id_period),
      isPunctualityBonusRecalculationNeeded(period.id_period),
      isAttendanceBonusRecalculationNeeded(period.id_period),
      isShiftExtensionBonusRecalculationNeeded(period.id_period),
    ]);

    const totalPercepciones = roundToCents(
      Number(totals[0]?.importe_salario ?? 0) +
        Number(totals[0]?.importe_comision ?? 0) +
        Number(totals[0]?.importe_comision_tratamientos ?? 0) +
        Number(totals[0]?.importe_comision_productos ?? 0) +
        Number(totals[0]?.importe_horas_extra ?? 0) +
        Number(totals[0]?.importe_bono_puntualidad ?? 0) +
        Number(totals[0]?.importe_bono_asistencia ?? 0) +
        Number(totals[0]?.importe_bono_extension ?? 0),
    );

    return {
      ok: true,
      data: {
        ...emptyPage,
        rows: rows.map((row: IPayrollEmployeeRow) => ({
          ...row,
          salario_diario: Number(row.salario_diario),
          dias: Number(row.dias),
          dias_falta: Number(row.dias_falta),
          dias_retardo: Number(row.dias_retardo),
          dias_retardo_sin_tope: Number(row.dias_retardo_sin_tope),
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
          bono_puntualidad_retardos: Number(row.bono_puntualidad_retardos),
          bono_puntualidad_faltas: Number(row.bono_puntualidad_faltas),
          bono_puntualidad_maximo:
            row.bono_puntualidad_maximo === null ? null : Number(row.bono_puntualidad_maximo),
          importe_bono_puntualidad: Number(row.importe_bono_puntualidad),
          bono_asistencia_faltas: Number(row.bono_asistencia_faltas),
          importe_bono_asistencia: Number(row.importe_bono_asistencia),
          bono_extension_asignado: Boolean(row.bono_extension_asignado),
          bono_extension_dias: Number(row.bono_extension_dias),
          importe_bono_extension: Number(row.importe_bono_extension),
          total_percepciones: Number(row.total_percepciones),
          isr_retenido: row.isr_retenido === null ? null : Number(row.isr_retenido),
          total_deducciones: Number(row.total_deducciones),
          neto: Number(row.neto),
        })),
        totals: {
          employees: Number(totals[0]?.employees ?? 0),
          importeSalario: Number(totals[0]?.importe_salario ?? 0),
          importeComision: Number(totals[0]?.importe_comision ?? 0),
          importeComisionTratamientos: Number(totals[0]?.importe_comision_tratamientos ?? 0),
          importeComisionProductos: Number(totals[0]?.importe_comision_productos ?? 0),
          importeHorasExtra: Number(totals[0]?.importe_horas_extra ?? 0),
          importeBonoPuntualidad: Number(totals[0]?.importe_bono_puntualidad ?? 0),
          importeBonoAsistencia: Number(totals[0]?.importe_bono_asistencia ?? 0),
          importeBonoExtension: Number(totals[0]?.importe_bono_extension ?? 0),
          totalPercepciones,
          importeIsr: Number(totals[0]?.importe_isr ?? 0),
          totalNeto: roundToCents(totalPercepciones - Number(totals[0]?.total_deducciones ?? 0)),
        },
        isrNotCalculated: (isrNotCalculatedRows as { isr_motivo: IsrSkipReason; employees: number }[]).map((row) => ({
          reason: row.isr_motivo,
          employees: Number(row.employees),
        })),
        puestoOptions: puestoOptions.map((row: { id_puesto: number; name: string }) => ({
          id_puesto: row.id_puesto,
          name: row.name,
        })),
        excludedEmployees: excludedEmployees as IPayrollExcludedEmployee[],
        lastCalculatedAt: lastCalculated[0]?.last_calculated_at ?? null,
        overtimeRecalculationNeeded,
        absenceRecalculationNeeded,
        latenessRecalculationNeeded,
        punctualityBonusRecalculationNeeded,
        attendanceBonusRecalculationNeeded,
        shiftExtensionBonusRecalculationNeeded,
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

    const [
      employeeRows,
      snapshotRows,
      navigationRows,
      paidTreatmentRows,
      soldProductRows,
      overtimeDayRows,
      discountedAbsenceRows,
      discountedLatenessRows,
    ] = await Promise.all([
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
        `SELECT pe.salario_diario, pe.dias, pe.dias_falta,
                pe.dias_retardo, pe.dias_retardo_sin_tope, pe.importe_salario,
                pe.consultas_atendidas, pe.importe_comision,
                pe.tratamientos_onicomicosis, pe.importe_por_tratamiento, pe.importe_comision_tratamientos,
                pe.piezas_vendidas, pe.importe_comision_productos,
                pe.horas_extra_dobles, pe.horas_extra_triples,
                pe.importe_horas_extra_dobles, pe.importe_horas_extra_triples,
                pe.limite_horas_dobles_aplicado,
                pe.bono_puntualidad_resultado, pe.bono_puntualidad_retardos, pe.bono_puntualidad_faltas,
                pe.bono_puntualidad_maximo, CAST(pe.importe_bono_puntualidad AS float) AS importe_bono_puntualidad,
                pe.bono_asistencia_resultado, pe.bono_asistencia_faltas,
                CAST(pe.importe_bono_asistencia AS float) AS importe_bono_asistencia,
                pe.bono_extension_asignado, pe.bono_extension_dias,
                CAST(pe.importe_bono_extension AS float) AS importe_bono_extension,
                pe.isr_estado, pe.isr_motivo,
                CAST(pe.isr_base_gravable AS float)             AS isr_base_gravable,
                pe.isr_ejercicio_tarifa,
                CAST(pe.isr_limite_inferior AS float)           AS isr_limite_inferior,
                CAST(pe.isr_cuota_fija AS float)                AS isr_cuota_fija,
                CAST(pe.isr_porcentaje_excedente AS float)      AS isr_porcentaje_excedente,
                CAST(pe.isr_causado AS float)                   AS isr_causado,
                CAST(pe.subsidio_monto_mensual AS float)        AS subsidio_monto_mensual,
                CONVERT(varchar(10), pe.subsidio_monto_vigente_desde, 120)  AS subsidio_monto_vigente_desde,
                CAST(pe.subsidio_tope_ingreso_mensual AS float) AS subsidio_tope_ingreso_mensual,
                CONVERT(varchar(10), pe.subsidio_tope_vigente_desde, 120)   AS subsidio_tope_vigente_desde,
                CAST(pe.subsidio_factor_dias_mes AS float)      AS subsidio_factor_dias_mes,
                CONVERT(varchar(10), pe.subsidio_factor_vigente_desde, 120) AS subsidio_factor_vigente_desde,
                pe.subsidio_con_derecho,
                CAST(pe.subsidio_causado AS float)              AS subsidio_causado,
                CAST(pe.subsidio_aplicado AS float)             AS subsidio_aplicado,
                CAST(pe.isr_retenido AS float)                  AS isr_retenido,
                CAST((SELECT ISNULL(SUM(d.importe), 0)
                        FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                       WHERE d.id_period_employee = pe.id_period_employee) AS float) AS total_deducciones,
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
      // Faltas descontadas en el renglón del tipo seleccionado (spec 62); existen en operativa y en fiscal.
      db.queryParams(
        `SELECT CONVERT(varchar(10), pa.fecha, 120) AS fecha
           FROM [CentroPodologico].[payroll].[period_employee_absences] pa
           JOIN [CentroPodologico].[payroll].[period_employees] pe
             ON pe.id_period_employee = pa.id_period_employee
          WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = @tipo_nomina
          ORDER BY pa.fecha`,
        { id_period: period.id_period, id_empleado: idEmpleado, tipo_nomina: payrollType },
      ),
      // Retardos descontados en el renglón del tipo seleccionado (spec 63); existen en operativa y en fiscal.
      db.queryParams(
        `SELECT CONVERT(varchar(10), pl.fecha, 120)           AS fecha,
                CONVERT(varchar(5), pl.hora_entrada_1, 108)   AS hora_entrada_1,
                CONVERT(varchar(8), pl.hora_llegada, 108)     AS hora_llegada,
                pl.minutos_retardo, pl.clasificacion
           FROM [CentroPodologico].[payroll].[period_employee_lateness] pl
           JOIN [CentroPodologico].[payroll].[period_employees] pe
             ON pe.id_period_employee = pl.id_period_employee
          WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = @tipo_nomina
          ORDER BY pl.fecha`,
        { id_period: period.id_period, id_empleado: idEmpleado, tipo_nomina: payrollType },
      ),
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
          dias_falta: Number(snapshotRow.dias_falta),
          dias_retardo: Number(snapshotRow.dias_retardo),
          dias_retardo_sin_tope: Number(snapshotRow.dias_retardo_sin_tope),
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
          bono_puntualidad_resultado: snapshotRow.bono_puntualidad_resultado,
          bono_puntualidad_retardos: Number(snapshotRow.bono_puntualidad_retardos),
          bono_puntualidad_faltas: Number(snapshotRow.bono_puntualidad_faltas),
          bono_puntualidad_maximo:
            snapshotRow.bono_puntualidad_maximo === null ? null : Number(snapshotRow.bono_puntualidad_maximo),
          importe_bono_puntualidad: Number(snapshotRow.importe_bono_puntualidad),
          bono_asistencia_resultado: snapshotRow.bono_asistencia_resultado,
          bono_asistencia_faltas: Number(snapshotRow.bono_asistencia_faltas),
          importe_bono_asistencia: Number(snapshotRow.importe_bono_asistencia),
          bono_extension_asignado: Boolean(snapshotRow.bono_extension_asignado),
          bono_extension_dias: Number(snapshotRow.bono_extension_dias),
          importe_bono_extension: Number(snapshotRow.importe_bono_extension),
          isr_estado: snapshotRow.isr_estado,
          isr_motivo: snapshotRow.isr_motivo ?? null,
          isr_base_gravable: toNullableNumber(snapshotRow.isr_base_gravable),
          isr_ejercicio_tarifa: toNullableNumber(snapshotRow.isr_ejercicio_tarifa),
          isr_limite_inferior: toNullableNumber(snapshotRow.isr_limite_inferior),
          isr_cuota_fija: toNullableNumber(snapshotRow.isr_cuota_fija),
          isr_porcentaje_excedente: toNullableNumber(snapshotRow.isr_porcentaje_excedente),
          isr_causado: toNullableNumber(snapshotRow.isr_causado),
          subsidio_monto_mensual: toNullableNumber(snapshotRow.subsidio_monto_mensual),
          subsidio_monto_vigente_desde: snapshotRow.subsidio_monto_vigente_desde ?? null,
          subsidio_tope_ingreso_mensual: toNullableNumber(snapshotRow.subsidio_tope_ingreso_mensual),
          subsidio_tope_vigente_desde: snapshotRow.subsidio_tope_vigente_desde ?? null,
          subsidio_factor_dias_mes: toNullableNumber(snapshotRow.subsidio_factor_dias_mes),
          subsidio_factor_vigente_desde: snapshotRow.subsidio_factor_vigente_desde ?? null,
          subsidio_con_derecho:
            snapshotRow.subsidio_con_derecho === null ? null : Boolean(snapshotRow.subsidio_con_derecho),
          subsidio_causado: toNullableNumber(snapshotRow.subsidio_causado),
          subsidio_aplicado: toNullableNumber(snapshotRow.subsidio_aplicado),
          isr_retenido: toNullableNumber(snapshotRow.isr_retenido),
          calculated_at: snapshotRow.calculated_at,
        }
      : null;
    const totalDeductions = snapshotRow ? Number(snapshotRow.total_deducciones) : 0;

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

    const discountedAbsences: IPayrollDiscountedAbsence[] = snapshot
      ? discountedAbsenceRows.map((row: IPayrollDiscountedAbsence) => ({ fecha: row.fecha }))
      : [];

    const discountedLateness: IPayrollDiscountedLateness[] = snapshot
      ? (
          discountedLatenessRows as {
            fecha: string;
            hora_entrada_1: string;
            hora_llegada: string;
            minutos_retardo: number;
            clasificacion: "G" | "A";
          }[]
        ).map((row) => ({
          fecha: row.fecha,
          hora_entrada_1: row.hora_entrada_1,
          hora_llegada: row.hora_llegada,
          minutos_retardo: Number(row.minutos_retardo),
          classification: row.clasificacion === "G" ? "severe" : "accumulable",
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
        totalDeductions,
        paidTreatments,
        soldProducts,
        overtimeDays,
        discountedAbsences,
        discountedLateness,
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
const ABSENCE_ALREADY_DISCOUNTED_CONSTRAINT = "UQ_period_employee_absences_empleado_fecha_tipo";
const LATENESS_ALREADY_DISCOUNTED_CONSTRAINT = "UQ_period_employee_lateness_empleado_fecha_tipo";

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
  if (sqlError.message?.includes(ABSENCE_ALREADY_DISCOUNTED_CONSTRAINT)) {
    return "Otro cálculo tomó algunas de estas faltas al mismo tiempo. Intenta de nuevo.";
  }
  if (sqlError.message?.includes(LATENESS_ALREADY_DISCOUNTED_CONSTRAINT)) {
    return "Otro cálculo tomó algunos de estos retardos al mismo tiempo. Intenta de nuevo.";
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
 * Las faltas injustificadas (spec 62) también: `lib/payroll/absenceDetection.ts` las espeja y, si divergen, manda este SQL.
 * Restan días pagados en las dos nóminas ('O' y 'F'); `dias` guarda los días netos.
 * Los retardos injustificados (spec 63) también: `lib/payroll/latenessDetection.ts` los espeja y, si divergen, manda este SQL.
 * Descuentan sueldo base en las dos nóminas sin tocar `dias`: `importe_salario = salario × (dias − dias_retardo)`.
 * El ISR de la nómina fiscal (spec 70) también, solo para las filas 'F': `lib/payroll/isrCalculation.ts` lo espeja y, si
 * divergen, manda este SQL. Escribe la fila ISR de `period_employee_deductions`, que el cascade borra al recalcular o revertir.
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

       -- Spec 62: faltas injustificadas del periodo. Un día es falta si el empleado con control de faltas (usuario
       -- podólogo activo) tiene horario ese día de la semana ISO, el día es anterior a hoy y no es anterior a su fecha de ingreso,
       -- y no hay ninguna checada ni justificación. Hoy llega como parámetro: nunca se usa GETDATE().
       -- lib/payroll/absenceDetection.ts lo espeja para la pantalla y, si divergen, manda este SQL.
       DECLARE @today date = CAST(@today_text AS date);
       ;WITH period_days AS (
         SELECT @fecha_inicio AS fecha
         UNION ALL
         SELECT DATEADD(day, 1, fecha) FROM period_days WHERE fecha < @fecha_fin
       )
       SELECT e.[id_empleado], d.[fecha]
         INTO #absences
         FROM [CentroPodologico].[RH].[empleados] e
        CROSS JOIN period_days d
        WHERE ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
          AND d.[fecha] >= e.[fecha_ingreso]
          AND d.[fecha] <  @today
          AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[empleado_horarios] h
                       WHERE h.[id_empleado] = e.[id_empleado]
                         AND h.[dia_semana] = (DATEDIFF(day, '19000101', d.[fecha]) % 7) + 1)
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[asistencias] a
                           WHERE a.[id_empleado] = e.[id_empleado]
                             AND a.[fecha_hora] >= d.[fecha]
                             AND a.[fecha_hora] <  DATEADD(day, 1, d.[fecha]))
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[absence_justifications] aj
                           WHERE aj.[id_empleado] = e.[id_empleado] AND aj.[fecha] = d.[fecha])
       OPTION (MAXRECURSION 400);

       -- Spec 63: retardos injustificados del periodo. Un día es retardo si el empleado con control (el mismo universo que
       -- las faltas) tiene horario ese día de la semana ISO, el día no es anterior a su fecha de ingreso ni posterior a hoy
       -- (hoy sí cuenta), tiene una checada 'entrada' y la primera llegó más de tolerancia_minutos después de hora_entrada_1
       -- (minutos completos: los segundos se truncan), y no hay justificación. Grave a partir de minutos_retardo_grave.
       -- Una empresa sin fila en lateness_settings no genera retardos. Spec 64: #lateness lista todos los retardos
       -- injustificados (el bono cuenta graves y acumulables), y cuenta_para_descuento marca los que sí descuentan sueldo:
       -- los graves, y los acumulables solo si la empresa tiene escalones para la frecuencia del periodo (sin escalones no se
       -- descuentan y tampoco deben bloquear el día). El descuento y su candado filtran por esa columna.
       -- lib/payroll/latenessDetection.ts lo espeja para la pantalla y, si divergen, manda este SQL.
       ;WITH period_days AS (
         SELECT @fecha_inicio AS fecha
         UNION ALL
         SELECT DATEADD(day, 1, fecha) FROM period_days WHERE fecha < @fecha_fin
       )
       SELECT e.[id_empleado], d.[fecha], h.[hora_entrada_1],
              CAST(CONVERT(varchar(8), first_entry.[llegada], 108) AS time(0)) AS hora_llegada,
              CAST(late.[minutos] AS smallint) AS minutos_retardo,
              CAST(CASE WHEN late.[minutos] >= ls.[minutos_retardo_grave] THEN 'G' ELSE 'A' END AS char(1)) AS clasificacion,
              CAST(CASE WHEN late.[minutos] >= ls.[minutos_retardo_grave]
                          OR EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[lateness_tiers] lt
                                      WHERE lt.[id_empresa] = e.[id_empresa] AND lt.[id_payment_period] = @id_payment_period)
                        THEN 1 ELSE 0 END AS bit) AS cuenta_para_descuento
          INTO #lateness
         FROM [CentroPodologico].[RH].[empleados] e
         JOIN [CentroPodologico].[payroll].[lateness_settings] ls ON ls.[id_empresa] = e.[id_empresa]
        CROSS JOIN period_days d
         JOIN [CentroPodologico].[RH].[empleado_horarios] h
           ON h.[id_empleado] = e.[id_empleado]
          AND h.[dia_semana] = (DATEDIFF(day, '19000101', d.[fecha]) % 7) + 1
        CROSS APPLY (SELECT MIN(a.[fecha_hora]) AS llegada
                       FROM [CentroPodologico].[RH].[asistencias] a
                      WHERE a.[id_empleado] = e.[id_empleado]
                        AND a.[tipo] = 'entrada'
                        AND a.[fecha_hora] >= d.[fecha]
                        AND a.[fecha_hora] <  DATEADD(day, 1, d.[fecha])) first_entry
        CROSS APPLY (SELECT DATEDIFF(second, h.[hora_entrada_1],
                                     CAST(CONVERT(varchar(8), first_entry.[llegada], 108) AS time(0))) / 60 AS minutos) late
        WHERE ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
          AND d.[fecha] >= e.[fecha_ingreso]
          AND d.[fecha] <= @today
          AND first_entry.[llegada] IS NOT NULL
          AND late.[minutos] > ls.[tolerancia_minutos]
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[lateness_justifications] lj
                           WHERE lj.[id_empleado] = e.[id_empleado] AND lj.[fecha] = d.[fecha])
       OPTION (MAXRECURSION 400);

       ${SHIFT_EXTENSION_WORKED_DAYS_SQL}

       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, dias_falta, dias_retardo, dias_retardo_sin_tope,
          importe_salario, consultas_atendidas, importe_comision,
          tratamientos_onicomicosis, importe_por_tratamiento, importe_comision_tratamientos,
          piezas_vendidas, importe_comision_productos,
          horas_extra_dobles, horas_extra_triples, importe_horas_extra_dobles, importe_horas_extra_triples,
          limite_horas_dobles_aplicado,
          ${PUNCTUALITY_BONUS_INSERT_COLUMNS_SQL},
          ${ATTENDANCE_BONUS_INSERT_COLUMNS_SQL},
          ${SHIFT_EXTENSION_BONUS_INSERT_COLUMNS_SQL},
          calculated_by, calculated_at)
       SELECT @id_period, e.id_empleado, salary.tipo_nomina, salary.salario_diario, net.dias, absences.dias_falta,
              lateness_days.dias_retardo, lateness_days.dias_retardo_sin_tope,
              ROUND(salary.salario_diario * (net.dias - lateness_days.dias_retardo), 2),
              ISNULL(attended.consultas, 0), ISNULL(tier.importe, 0),
              ISNULL(paid_treatments.tratamientos, 0),
              CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END,
              ROUND(ISNULL(paid_treatments.tratamientos, 0)
                    * CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(treatment_settings.[importe_por_tratamiento], 0) ELSE 0 END, 2),
              ISNULL(product_sales.piezas, 0), ISNULL(product_sales.importe, 0),
              ISNULL(overtime.dobles, 0), ISNULL(overtime.triples, 0),
              ISNULL(overtime.importe_dobles, 0), ISNULL(overtime.importe_triples, 0),
              CASE WHEN salary.tipo_nomina = 'O' THEN ISNULL(overtime_settings.[limite_horas_dobles_periodo], 0) ELSE 0 END,
              ${PUNCTUALITY_BONUS_SELECT_SQL},
              ${ATTENDANCE_BONUS_SELECT_SQL},
              ${SHIFT_EXTENSION_BONUS_SELECT_SQL},
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[RH].[empleados] e
         LEFT JOIN [CentroPodologico].[payroll].[treatment_commission_settings] treatment_settings
                ON treatment_settings.[id_empresa] = e.[id_empresa]
         LEFT JOIN [CentroPodologico].[payroll].[overtime_settings] overtime_settings
                ON overtime_settings.[id_empresa] = e.[id_empresa]
         LEFT JOIN [CentroPodologico].[payroll].[lateness_settings] lateness_settings
                ON lateness_settings.[id_empresa] = e.[id_empresa]
        CROSS APPLY (VALUES ('O', e.salario_diario), ('F', e.salario_diario_fiscal))
                    AS salary (tipo_nomina, salario_diario)
        CROSS APPLY (SELECT DATEDIFF(day,
                              CASE WHEN e.fecha_ingreso > @fecha_inicio THEN e.fecha_ingreso ELSE @fecha_inicio END,
                              @fecha_fin) + 1 AS dias) AS paid
        OUTER APPLY (
          SELECT COUNT(*) AS dias_falta
            FROM #absences ab
           WHERE ab.[id_empleado] = e.[id_empleado]
             AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_absences] pea
                              WHERE pea.[id_empleado] = ab.[id_empleado] AND pea.[fecha] = ab.[fecha]
                                AND pea.[tipo_nomina] = salary.tipo_nomina)
        ) AS absences
        CROSS APPLY (SELECT paid.dias - absences.dias_falta AS dias) AS net
        -- Spec 63: retardos por contar en este tipo de nómina (los que otro periodo ya descontó para el mismo tipo se omiten).
        OUTER APPLY (
          SELECT ISNULL(SUM(CASE WHEN l.[clasificacion] = 'G' THEN 1 ELSE 0 END), 0) AS graves,
                 ISNULL(SUM(CASE WHEN l.[clasificacion] = 'A' THEN 1 ELSE 0 END), 0) AS acumulables
            FROM #lateness l
           WHERE l.[id_empleado] = e.[id_empleado]
             AND l.[cuenta_para_descuento] = 1
             AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_lateness] ple
                              WHERE ple.[id_empleado] = l.[id_empleado] AND ple.[fecha] = l.[fecha]
                                AND ple.[tipo_nomina] = salary.tipo_nomina)
        ) AS lateness_counts
        -- Ciclo de los escalones de la frecuencia del periodo: ciclo = el mayor valor de retardos.
        OUTER APPLY (
          SELECT MAX(t.[retardos]) AS ciclo
            FROM [CentroPodologico].[payroll].[lateness_tiers] t
           WHERE t.[id_empresa] = e.[id_empresa] AND t.[id_payment_period] = @id_payment_period
        ) AS lateness_cycle
        OUTER APPLY (
          SELECT t.[dias_descuento]
            FROM [CentroPodologico].[payroll].[lateness_tiers] t
           WHERE t.[id_empresa] = e.[id_empresa] AND t.[id_payment_period] = @id_payment_period
             AND t.[retardos] = lateness_cycle.ciclo
        ) AS top_tier
        OUTER APPLY (
          SELECT TOP 1 t.[dias_descuento]
            FROM [CentroPodologico].[payroll].[lateness_tiers] t
           WHERE t.[id_empresa] = e.[id_empresa] AND t.[id_payment_period] = @id_payment_period
             AND t.[retardos] <= lateness_counts.acumulables % lateness_cycle.ciclo
           ORDER BY t.[retardos] DESC
        ) AS remainder_tier
        OUTER APPLY (
          SELECT lateness_counts.graves * ISNULL(lateness_settings.[dias_descuento_retardo_grave], 0)
                 + CASE WHEN lateness_cycle.ciclo IS NULL THEN 0
                        ELSE (lateness_counts.acumulables / lateness_cycle.ciclo) * top_tier.[dias_descuento]
                             + ISNULL(remainder_tier.[dias_descuento], 0) END AS sin_tope
        ) AS lateness_raw
        -- El descuento nunca pasa de los días pagados: el sueldo base no queda negativo.
        CROSS APPLY (SELECT CAST(lateness_raw.sin_tope AS decimal(5,1)) AS dias_retardo_sin_tope,
                            CAST(CASE WHEN lateness_raw.sin_tope > net.dias THEN net.dias ELSE lateness_raw.sin_tope END
                                 AS decimal(4,1)) AS dias_retardo) AS lateness_days
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
        ) AS overtime${PUNCTUALITY_BONUS_APPLY_SQL}${ATTENDANCE_BONUS_APPLY_SQL}${SHIFT_EXTENSION_BONUS_APPLY_SQL}
        WHERE ${ELIGIBLE_EMPLOYEE_BASE_CONDITIONS}
          AND salary.salario_diario > 0;

       -- Spec 70: ISR de los renglones 'F' recién insertados. Va después del INSERT porque la base es importe_salario,
       -- que se calcula ahí. Los renglones 'O' se quedan en 'X'.
       ${ISR_PARAMETERS_SQL}

       UPDATE pe
          SET ${ISR_UPDATE_SET_SQL}
         FROM [CentroPodologico].[payroll].[period_employees] pe${ISR_BRACKET_APPLY_SQL}
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F';

       -- Spec 70: una fila de deducción ISR por renglón 'F' calculado, aunque el retenido sea 0.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_deductions]
         (id_period_employee, id_deduction, importe)
       SELECT pe.[id_period_employee], ${ISR_DEDUCTION_ID}, pe.[isr_retenido]
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[isr_estado] = 'C';

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

       -- Spec 62: desglose y candado de faltas. Cada falta se descuenta una vez por tipo de nómina ('O' y 'F'): se
       -- omiten las que otro periodo ya descontó para ese mismo tipo (el mismo criterio que cuenta dias_falta arriba).
       INSERT INTO [CentroPodologico].[payroll].[period_employee_absences]
         (id_period_employee, id_empleado, tipo_nomina, fecha)
       SELECT pe.[id_period_employee], a.[id_empleado], pe.[tipo_nomina], a.[fecha]
         FROM #absences a
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = a.[id_empleado]
        WHERE NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_absences] pea
                           WHERE pea.[id_empleado] = a.[id_empleado] AND pea.[fecha] = a.[fecha]
                             AND pea.[tipo_nomina] = pe.[tipo_nomina]);

       -- Spec 63: desglose y candado de retardos. Cada retardo se descuenta una vez por tipo de nómina ('O' y 'F'): se
       -- omiten los que otro periodo ya descontó para ese mismo tipo (el mismo criterio que cuenta lateness_counts arriba).
       INSERT INTO [CentroPodologico].[payroll].[period_employee_lateness]
         (id_period_employee, id_empleado, tipo_nomina, fecha, hora_entrada_1, hora_llegada, minutos_retardo, clasificacion)
       SELECT pe.[id_period_employee], l.[id_empleado], pe.[tipo_nomina], l.[fecha],
              l.[hora_entrada_1], l.[hora_llegada], l.[minutos_retardo], l.[clasificacion]
         FROM #lateness l
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = l.[id_empleado]
        WHERE l.[cuenta_para_descuento] = 1
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_lateness] ple
                           WHERE ple.[id_empleado] = l.[id_empleado] AND ple.[fecha] = l.[fecha]
                             AND ple.[tipo_nomina] = pe.[tipo_nomina]);

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
        today_text: addZeroToday(new Date()),
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

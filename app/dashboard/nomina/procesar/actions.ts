"use server";

import db from "@/database/connection";
import {
  IPayrollEmployeeDetail,
  IPayrollEmployeeDetailFilters,
  IImssNotCalculatedGroup,
  IPayrollEmployeeRow,
  IPayrollEmployeeSnapshot,
  IPayrollExcludedEmployee,
  IPayrollPerceptionLine,
  IPayrollPerceptionLineBase,
  IPayrollProcessFilters,
  IPayrollProcessPage,
  PayrollType,
} from "@/interfaces/payroll_calculation";
import { IPayrollDiscountedAbsence } from "@/interfaces/payroll_absence";
import type { IPeriodEmployeePerception } from "@/interfaces/payroll_exemption";
import type { IPtuPaymentBreakdown } from "@/interfaces/payroll_ptu";
import type { Article174SkipReason, IArticle174IsrBreakdown } from "@/interfaces/payroll_christmas_bonus";
import type { ImssSkipReason } from "@/interfaces/payroll_imss";
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
import { isExemptionRecalculationNeeded } from "@/lib/payroll/exemptionRecalculation";
import { isIsrRecalculationNeeded } from "@/lib/payroll/isrRecalculation";
import { isVacationPayRecalculationNeeded } from "@/lib/payroll/vacationPayRecalculation";
import { isExtraordinaryRecalculationNeeded } from "@/lib/payroll/extraordinaryRecalculation";
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
import { CHRISTMAS_BONUS_SNAPSHOT_SQL } from "@/lib/payroll/christmasBonusSql";
import {
  PTU_ALREADY_PAID_CONSTRAINT,
  PTU_PAYMENT_SNAPSHOT_SQL,
  PTU_ZERO_DAILY_CAP_MARKER,
} from "@/lib/payroll/ptuPaymentSql";
import { PTU_DISTRIBUTION_NOT_CLOSED_MARKER, PTU_NO_PAYABLE_ROWS_MARKER } from "@/lib/payroll/ptuPaymentSource";
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
import {
  IMSS_APPLY_SQL,
  IMSS_BREAKDOWN_SELECT_SQL,
  IMSS_INSERT_COLUMNS_SQL,
  IMSS_PARAMETERS_SQL,
  IMSS_SELECT_SQL,
  IMSS_UPDATE_SET_SQL,
  toImssBreakdown,
} from "@/lib/payroll/imssSql";
import {
  IMSS_DEDUCTION_ID,
  ISR_DEDUCTION_ID,
  OVERTIME_DOUBLE_PERCEPTION_ID,
  OVERTIME_TRIPLE_PERCEPTION_ID,
  PAID_VACATION_PERCEPTION_ID,
  PERCEPTION_LINE_KEY_BY_ID,
  SALARY_PERCEPTION_ID,
  VACATION_PREMIUM_PERCEPTION_ID,
  VACATION_PREMIUM_PERCENT,
} from "@/lib/payroll/constants";
import { describePerceptionExemption } from "@/lib/payroll/exemptionCalculation";
import {
  EXEMPTION_APPLY_SQL,
  EXEMPTION_INSERT_COLUMNS_SQL,
  EXEMPTION_PARAMETERS_SQL,
  EXEMPTION_SELECT_SQL,
} from "@/lib/payroll/exemptionSql";
import { resolvePeriod } from "@/lib/payroll/period";
import { NOT_ON_PAID_LEAVE_CONDITION } from "@/lib/payroll/paidLeaveExclusionSql";
import { VACATION_PAY_EVENTS_SQL } from "@/lib/payroll/vacationPaySql";
import { getCommissionTiers } from "../comisiones/actions";
import {
  calculatePayrollPeriodSchema,
  payrollEmployeeDetailFiltersSchema,
  payrollProcessFiltersSchema,
  revertPayrollCalculationSchema,
} from "@/lib/payroll/schemas";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\[%_]/g, (character) => `[${character}]`);
}

/** Agrupa los renglones 'N' del IMSS por motivo, conservando el orden por motivo y por nombre del SQL. */
function groupImssNotCalculated(
  rows: { imss_motivo: ImssSkipReason; id_empleado: number; nombre_completo: string }[],
): IImssNotCalculatedGroup[] {
  const groupsByReason = new Map<ImssSkipReason, IImssNotCalculatedGroup>();
  for (const row of rows) {
    const group = groupsByReason.get(row.imss_motivo) ?? { reason: row.imss_motivo, employees: 0, affected: [] };
    group.employees += 1;
    group.affected.push({ id_empleado: row.id_empleado, nombre_completo: row.nombre_completo });
    groupsByReason.set(row.imss_motivo, group);
  }
  return [...groupsByReason.values()];
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

const MISSING_TAX_BREAKDOWN_NOTE = "Recalcula la nómina para ver el gravado y exento";

const PERCEPTION_ID_BY_LINE_KEY = new Map(
  Object.entries(PERCEPTION_LINE_KEY_BY_ID).map(([idPerception, lineKey]) => [lineKey, Number(idPerception)]),
);

function toTaxBreakdown(perception: IPeriodEmployeePerception): NonNullable<IPayrollPerceptionLine["taxBreakdown"]> {
  return {
    taxed: perception.importe_gravado,
    exempt: perception.importe_exento,
    note: describePerceptionExemption(perception),
  };
}

/**
 * Liga cada línea de la tarjeta "Percepciones totales" con su renglón guardado (spec 73), por
 * `PERCEPTION_LINE_KEY_BY_ID`. En operativa no hay desglose. Un renglón guardado sin línea se agrega al final con la
 * descripción del catálogo, para que el Detalle nunca esconda un importe. Una línea sin renglón guardado es de un
 * snapshot anterior a la spec 73 (o tiene importe 0, que no genera renglón).
 */
function attachTaxBreakdown(
  lines: IPayrollPerceptionLineBase[],
  payrollType: PayrollType,
  storedPerceptions: IPeriodEmployeePerception[],
): IPayrollPerceptionLine[] {
  if (payrollType !== "F") return lines.map((line) => ({ ...line, taxBreakdown: null }));

  const storedById = new Map(storedPerceptions.map((perception) => [perception.id_perception, perception]));
  const shownIds = new Set<number>();

  const linesWithBreakdown: IPayrollPerceptionLine[] = lines.map((line) => {
    const idPerception = PERCEPTION_ID_BY_LINE_KEY.get(line.key);
    const stored = idPerception === undefined ? undefined : storedById.get(idPerception);
    if (stored) {
      shownIds.add(stored.id_perception);
      return { ...line, taxBreakdown: toTaxBreakdown(stored) };
    }
    const note = line.amount === 0 ? "Sin importe: no genera percepción fiscal" : MISSING_TAX_BREAKDOWN_NOTE;
    return {
      ...line,
      taxBreakdown: line.amount === 0 ? { taxed: 0, exempt: 0, note } : { taxed: null, exempt: null, note },
    };
  });

  const orphanLines: IPayrollPerceptionLine[] = storedPerceptions
    .filter((perception) => !shownIds.has(perception.id_perception))
    .map((perception) => ({
      key: `percepcion_${perception.id_perception}`,
      label: perception.description,
      description: `Clave SAT ${perception.clave_sat}`,
      note: null,
      amount: perception.importe,
      taxBreakdown: toTaxBreakdown(perception),
    }));

  return [...linesWithBreakdown, ...orphanLines];
}

/** Suma de lo gravado o lo exento de las líneas; null si no hay desglose en alguna (operativa, "No calculado"…). */
function sumTaxBreakdown(lines: IPayrollPerceptionLine[], field: "taxed" | "exempt"): number | null {
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    const amount = line.taxBreakdown?.[field];
    if (amount === null || amount === undefined) return null;
    total += amount;
  }
  return roundToCents(total);
}

/** Columnas `ptu_*` que el SELECT de Procesar trae de `period_employee_ptu` (todas null fuera de un periodo PTU). */
interface IPtuPaymentRowColumns {
  ptu_id_ptu_distribution: number | null;
  ptu_ejercicio_reparto: number | null;
  ptu_dias_trabajados: number | null;
  ptu_ptu_dias: number | null;
  ptu_ptu_salario: number | null;
  ptu_ptu_bruto: number | null;
  ptu_tope_tres_meses: number | null;
  ptu_promedio_tres_anios: number | null;
  ptu_anios_promedio: number | null;
  ptu_ptu_final: number | null;
}

function toPtuPaymentBreakdown(columns: IPtuPaymentRowColumns): IPtuPaymentBreakdown | null {
  if (columns.ptu_id_ptu_distribution === null || columns.ptu_id_ptu_distribution === undefined) return null;
  return {
    id_ptu_distribution: Number(columns.ptu_id_ptu_distribution),
    ejercicio_reparto: Number(columns.ptu_ejercicio_reparto),
    dias: Number(columns.ptu_dias_trabajados),
    ptu_dias: Number(columns.ptu_ptu_dias),
    ptu_salario: Number(columns.ptu_ptu_salario),
    ptu_bruto: Number(columns.ptu_ptu_bruto),
    tope_tres_meses: Number(columns.ptu_tope_tres_meses),
    promedio_tres_anios: toNullableNumber(columns.ptu_promedio_tres_anios),
    anios_promedio: toNullableNumber(columns.ptu_anios_promedio),
    ptu_final: Number(columns.ptu_ptu_final),
  };
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
  input: IPayrollProcessFilters,
): Promise<ActionResult<IPayrollProcessPage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsedFilters = payrollProcessFiltersSchema.safeParse(input);
  if (!parsedFilters.success) {
    return { ok: false, message: parsedFilters.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const filters = { ...parsedFilters.data };

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
      totals: { employees: 0, importeSalario: 0, importeComision: 0, importeComisionTratamientos: 0, importeComisionProductos: 0, importeHorasExtra: 0, importeBonoPuntualidad: 0, importeBonoAsistencia: 0, importeBonoExtension: 0, importeVacaciones: 0, importeAguinaldo: 0, importePtu: 0, importeGravado: 0, importeExento: 0, totalPercepciones: 0, importeIsr: 0, importeImss: 0, totalNeto: 0 },
      isrNotCalculated: [],
      imssNotCalculated: [],
      puestoOptions: [],
      excludedEmployees: [],
      lastCalculatedAt: null,
      overtimeRecalculationNeeded: false,
      absenceRecalculationNeeded: false,
      latenessRecalculationNeeded: false,
      punctualityBonusRecalculationNeeded: false,
      attendanceBonusRecalculationNeeded: false,
      shiftExtensionBonusRecalculationNeeded: false,
      isrRecalculationNeeded: false,
      exemptionRecalculationNeeded: false,
      vacationPayRecalculationNeeded: false,
      extraordinaryRecalculationNeeded: false,
    };
    if (!period) return { ok: true, data: emptyPage };

    // Spec 90: la PTU solo existe en la nómina fiscal; un periodo PTU ignora `tipo=operativa` de la URL.
    const isPtuPeriod = period.tipo_periodo === "E" && period.concepto_extraordinario === "P";
    if (isPtuPeriod) filters.payrollType = "F";

    const { conditions: rowConditions, params: rowParams } = buildPayrollEmployeeConditions({
      idPeriod: period.id_period,
      payrollType: filters.payrollType,
      idPuesto: filters.idPuesto,
      search: filters.search,
    });

    const isOrdinaryPeriod = period.tipo_periodo === "O";

    // Salario del tipo seleccionado, con la misma regla de elegibilidad que usa el cálculo.
    const salaryColumn = filters.payrollType === "F" ? "e.salario_diario_fiscal" : "e.salario_diario";

    const [
      rows,
      totals,
      isrNotCalculatedRows,
      imssNotCalculatedRows,
      puestoOptions,
      excludedEmployees,
      lastCalculated,
      overtimeRecalculationNeeded,
      absenceRecalculationNeeded,
      latenessRecalculationNeeded,
      punctualityBonusRecalculationNeeded,
      attendanceBonusRecalculationNeeded,
      shiftExtensionBonusRecalculationNeeded,
      isrRecalculationNeeded,
      exemptionRecalculationNeeded,
      vacationPayRecalculationNeeded,
      extraordinaryRecalculationNeeded,
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
                pe.dias_prima_vacacional, CAST(pe.importe_prima_vacacional AS float) AS importe_prima_vacacional,
                pe.dias_vacaciones_pagadas, CAST(pe.importe_vacaciones_pagadas AS float) AS importe_vacaciones_pagadas,
                pe.dias_aguinaldo, CAST(pe.importe_aguinaldo AS float) AS importe_aguinaldo,
                CAST(pe.importe_ptu AS float) AS importe_ptu,
                ptu.id_ptu_distribution AS ptu_id_ptu_distribution, ptu.ejercicio_reparto AS ptu_ejercicio_reparto,
                ptu.dias AS ptu_dias_trabajados, CAST(ptu.ptu_dias AS float) AS ptu_ptu_dias,
                CAST(ptu.ptu_salario AS float) AS ptu_ptu_salario, CAST(ptu.ptu_bruto AS float) AS ptu_ptu_bruto,
                CAST(ptu.tope_tres_meses AS float) AS ptu_tope_tres_meses,
                CAST(ptu.promedio_tres_anios AS float) AS ptu_promedio_tres_anios,
                ptu.anios_promedio AS ptu_anios_promedio, CAST(ptu.ptu_final AS float) AS ptu_ptu_final,
                CAST(taxes.gravado AS float) AS importe_gravado, CAST(taxes.exento AS float) AS importe_exento,
                pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos
                  + pe.importe_comision_productos
                  + pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples
                  + pe.importe_bono_puntualidad + pe.importe_bono_asistencia
                  + pe.importe_bono_extension
                  + pe.importe_prima_vacacional + pe.importe_vacaciones_pagadas
                  + pe.importe_aguinaldo + pe.importe_ptu AS total_percepciones,
                -- Spec 87: en un periodo extraordinario el ISR vive en el desglose del art. 174, no en las columnas isr_*.
                ISNULL(article174.isr_estado, pe.isr_estado) AS isr_estado,
                CAST(CASE WHEN article174.id_period_employee IS NOT NULL THEN article174.isr_retenido
                          ELSE pe.isr_retenido END AS float) AS isr_retenido,
                pe.imss_estado, pe.imss_motivo, CAST(pe.imss_retenido AS float) AS imss_retenido,
                CAST(deductions.total AS float) AS total_deducciones,
                CAST(pe.importe_salario + pe.importe_comision + pe.importe_comision_tratamientos
                  + pe.importe_comision_productos
                  + pe.importe_horas_extra_dobles + pe.importe_horas_extra_triples
                  + pe.importe_bono_puntualidad + pe.importe_bono_asistencia
                  + pe.importe_bono_extension
                  + pe.importe_prima_vacacional + pe.importe_vacaciones_pagadas
                  + pe.importe_aguinaldo + pe.importe_ptu - deductions.total AS float) AS neto,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
           LEFT JOIN [CentroPodologico].[payroll].[period_employee_isr_article174] article174
                  ON article174.id_period_employee = pe.id_period_employee
           LEFT JOIN [CentroPodologico].[payroll].[period_employee_ptu] ptu
                  ON ptu.id_period_employee = pe.id_period_employee
          CROSS APPLY (SELECT ISNULL(SUM(d.importe), 0) AS total
                         FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                        WHERE d.id_period_employee = pe.id_period_employee) AS deductions
          -- Spec 87: gravado y exento del aguinaldo; null en operativa o si algún exento quedó sin calcular.
          OUTER APPLY (SELECT CASE WHEN pe.tipo_nomina = 'F' AND MAX(CASE WHEN pep.exencion_estado = 'N' THEN 1 ELSE 0 END) = 0
                                   THEN ISNULL(SUM(pep.importe_gravado), 0) END AS gravado,
                              CASE WHEN pe.tipo_nomina = 'F' AND MAX(CASE WHEN pep.exencion_estado = 'N' THEN 1 ELSE 0 END) = 0
                                   THEN ISNULL(SUM(pep.importe_exento), 0) END AS exento
                         FROM [CentroPodologico].[payroll].[period_employee_perceptions] pep
                        WHERE pep.id_period_employee = pe.id_period_employee) AS taxes
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
                CAST(ISNULL(SUM(importe_prima_vacacional + importe_vacaciones_pagadas), 0) AS float) AS importe_vacaciones,
                CAST(ISNULL(SUM(importe_aguinaldo), 0) AS float) AS importe_aguinaldo,
                CAST(ISNULL(SUM(importe_ptu), 0) AS float) AS importe_ptu,
                CAST(ISNULL(SUM(taxes.gravado), 0) AS float) AS importe_gravado,
                CAST(ISNULL(SUM(taxes.exento), 0) AS float) AS importe_exento,
                CAST(ISNULL(SUM(deductions.isr), 0) AS float) AS importe_isr,
                CAST(ISNULL(SUM(deductions.imss), 0) AS float) AS importe_imss,
                CAST(ISNULL(SUM(deductions.total), 0) AS float) AS total_deducciones
           FROM [CentroPodologico].[payroll].[period_employees] pe
          CROSS APPLY (SELECT ISNULL(SUM(d.importe), 0) AS total,
                              ISNULL(SUM(CASE WHEN d.id_deduction = @isr_deduction_id THEN d.importe END), 0) AS isr,
                              ISNULL(SUM(CASE WHEN d.id_deduction = @imss_deduction_id THEN d.importe END), 0) AS imss
                         FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                        WHERE d.id_period_employee = pe.id_period_employee) AS deductions
          CROSS APPLY (SELECT ISNULL(SUM(pep.importe_gravado), 0) AS gravado, ISNULL(SUM(pep.importe_exento), 0) AS exento
                         FROM [CentroPodologico].[payroll].[period_employee_perceptions] pep
                        WHERE pep.id_period_employee = pe.id_period_employee) AS taxes
          WHERE id_period = @id_period AND tipo_nomina = @tipo_nomina`,
        {
          id_period: period.id_period,
          tipo_nomina: filters.payrollType,
          isr_deduction_id: ISR_DEDUCTION_ID,
          imss_deduction_id: IMSS_DEDUCTION_ID,
        },
      ),
      // Spec 70: renglones "ISR no calculado" por motivo, de todo el tipo (sin filtros de puesto ni búsqueda).
      db.queryParams(
        `SELECT not_calculated.isr_motivo, COUNT(*) AS employees
           FROM (
             SELECT isr_motivo
               FROM [CentroPodologico].[payroll].[period_employees]
              WHERE id_period = @id_period AND tipo_nomina = @tipo_nomina AND isr_estado = 'N'
             UNION ALL
             -- Spec 87: ISR art. 174 del aguinaldo de un periodo extraordinario.
             SELECT a.isr_motivo
               FROM [CentroPodologico].[payroll].[period_employee_isr_article174] a
               JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.id_period_employee = a.id_period_employee
              WHERE pe.id_period = @id_period AND pe.tipo_nomina = @tipo_nomina AND a.isr_estado = 'N'
           ) AS not_calculated
          GROUP BY not_calculated.isr_motivo
          ORDER BY not_calculated.isr_motivo`,
        { id_period: period.id_period, tipo_nomina: filters.payrollType },
      ),
      // Spec 91: renglones "IMSS no calculado" con su motivo y el empleado, de todo el tipo (sin filtros de puesto ni búsqueda).
      db.queryParams(
        `SELECT pe.imss_motivo, e.id_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo
           FROM [CentroPodologico].[payroll].[period_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
          WHERE pe.id_period = @id_period AND pe.tipo_nomina = @tipo_nomina AND pe.imss_estado = 'N'
          ORDER BY pe.imss_motivo, e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
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
      isPtuPeriod ? Promise.resolve([]) : db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo
           FROM [CentroPodologico].[RH].[empleados] e
          WHERE e.status = 1 AND e.activo = 1
            AND e.id_sucursal = @id_sucursal
            ${period.tipo_periodo === "E" ? "" : "AND e.id_periodo_pago = @id_payment_period"}
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
      // Spec 87: un periodo extraordinario no tiene horas extra, faltas, retardos, bonos, ISR de la spec 70 ni
      // vacaciones; esos avisos compararían contra un cálculo que nunca los incluyó. El del exento sí le aplica.
      isOrdinaryPeriod ? isOvertimeRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isAbsenceRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isLatenessRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isPunctualityBonusRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isAttendanceBonusRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isShiftExtensionBonusRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? isIsrRecalculationNeeded(period.id_period) : false,
      isExemptionRecalculationNeeded(period.id_period),
      isOrdinaryPeriod ? isVacationPayRecalculationNeeded(period.id_period) : false,
      isOrdinaryPeriod ? false : isExtraordinaryRecalculationNeeded(period.id_period),
    ]);

    const totalPercepciones = roundToCents(
      Number(totals[0]?.importe_salario ?? 0) +
        Number(totals[0]?.importe_comision ?? 0) +
        Number(totals[0]?.importe_comision_tratamientos ?? 0) +
        Number(totals[0]?.importe_comision_productos ?? 0) +
        Number(totals[0]?.importe_horas_extra ?? 0) +
        Number(totals[0]?.importe_bono_puntualidad ?? 0) +
        Number(totals[0]?.importe_bono_asistencia ?? 0) +
        Number(totals[0]?.importe_bono_extension ?? 0) +
        Number(totals[0]?.importe_vacaciones ?? 0) +
        Number(totals[0]?.importe_aguinaldo ?? 0) +
        Number(totals[0]?.importe_ptu ?? 0),
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
          dias_prima_vacacional: Number(row.dias_prima_vacacional),
          importe_prima_vacacional: Number(row.importe_prima_vacacional),
          dias_vacaciones_pagadas: Number(row.dias_vacaciones_pagadas),
          importe_vacaciones_pagadas: Number(row.importe_vacaciones_pagadas),
          dias_aguinaldo: Number(row.dias_aguinaldo),
          importe_aguinaldo: Number(row.importe_aguinaldo),
          importe_ptu: Number(row.importe_ptu),
          ptu: toPtuPaymentBreakdown(row as unknown as IPtuPaymentRowColumns),
          importe_gravado: toNullableNumber(row.importe_gravado),
          importe_exento: toNullableNumber(row.importe_exento),
          total_percepciones: Number(row.total_percepciones),
          isr_retenido: row.isr_retenido === null ? null : Number(row.isr_retenido),
          imss_retenido: row.imss_retenido === null ? null : Number(row.imss_retenido),
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
          importeVacaciones: Number(totals[0]?.importe_vacaciones ?? 0),
          importeAguinaldo: Number(totals[0]?.importe_aguinaldo ?? 0),
          importePtu: Number(totals[0]?.importe_ptu ?? 0),
          importeGravado: Number(totals[0]?.importe_gravado ?? 0),
          importeExento: Number(totals[0]?.importe_exento ?? 0),
          totalPercepciones,
          importeIsr: Number(totals[0]?.importe_isr ?? 0),
          importeImss: Number(totals[0]?.importe_imss ?? 0),
          totalNeto: roundToCents(totalPercepciones - Number(totals[0]?.total_deducciones ?? 0)),
        },
        isrNotCalculated: (isrNotCalculatedRows as { isr_motivo: IsrSkipReason | Article174SkipReason; employees: number }[]).map((row) => ({
          reason: row.isr_motivo,
          employees: Number(row.employees),
        })),
        imssNotCalculated: groupImssNotCalculated(
          imssNotCalculatedRows as { imss_motivo: ImssSkipReason; id_empleado: number; nombre_completo: string }[],
        ),
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
        isrRecalculationNeeded,
        exemptionRecalculationNeeded,
        vacationPayRecalculationNeeded,
        extraordinaryRecalculationNeeded,
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
  const { idEmpleado, idPeriod, idPuesto, search } = parsed.data;
  let payrollType = parsed.data.payrollType;

  try {
    const period = await resolvePeriod(id_sucursal, idPeriod);
    if (!period) return { ok: true, data: null };

    // Spec 90: la PTU solo existe en la nómina fiscal; un periodo PTU ignora `tipo=operativa` de la URL.
    if (period.tipo_periodo === "E" && period.concepto_extraordinario === "P") payrollType = "F";

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
      storedPerceptionRows,
      article174Rows,
      imssRows,
    ] = await Promise.all([
      // Cuenta como encontrado si es de la sucursal del periodo o si tiene snapshot en el periodo
      // (cubre a quien cambió de sucursal después del cálculo).
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                ISNULL(pu.name, '') AS nombre_puesto,
                e.foto_url, e.activo,
                CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso,
                e.tipo_regimen
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
                pe.dias_prima_vacacional, CAST(pe.importe_prima_vacacional AS float) AS importe_prima_vacacional,
                pe.dias_vacaciones_pagadas, CAST(pe.importe_vacaciones_pagadas AS float) AS importe_vacaciones_pagadas,
                pe.dias_aguinaldo, CAST(pe.importe_aguinaldo AS float) AS importe_aguinaldo,
                CAST(pe.importe_ptu AS float) AS importe_ptu,
                ptu.id_ptu_distribution AS ptu_id_ptu_distribution, ptu.ejercicio_reparto AS ptu_ejercicio_reparto,
                ptu.dias AS ptu_dias_trabajados, CAST(ptu.ptu_dias AS float) AS ptu_ptu_dias,
                CAST(ptu.ptu_salario AS float) AS ptu_ptu_salario, CAST(ptu.ptu_bruto AS float) AS ptu_ptu_bruto,
                CAST(ptu.tope_tres_meses AS float) AS ptu_tope_tres_meses,
                CAST(ptu.promedio_tres_anios AS float) AS ptu_promedio_tres_anios,
                ptu.anios_promedio AS ptu_anios_promedio, CAST(ptu.ptu_final AS float) AS ptu_ptu_final,
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
                pe.imss_estado, pe.imss_motivo, CAST(pe.imss_retenido AS float) AS imss_retenido,
                CAST((SELECT ISNULL(SUM(d.importe), 0)
                        FROM [CentroPodologico].[payroll].[period_employee_deductions] d
                       WHERE d.id_period_employee = pe.id_period_employee) AS float) AS total_deducciones,
                CONVERT(varchar(19), pe.calculated_at, 120) AS calculated_at
           FROM [CentroPodologico].[payroll].[period_employees] pe
           LEFT JOIN [CentroPodologico].[payroll].[period_employee_ptu] ptu
                  ON ptu.id_period_employee = pe.id_period_employee
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
      // Días de horas extra pagados en el renglón del tipo seleccionado (specs 61 y 75); existen en operativa y en fiscal.
      db.queryParams(
        `SELECT CONVERT(varchar(10), o.fecha, 120) AS fecha,
                o.horas_autorizadas, o.horas_dobles, o.horas_triples,
                o.importe_dobles, o.importe_triples
           FROM [CentroPodologico].[payroll].[period_employee_overtime] o
           JOIN [CentroPodologico].[payroll].[period_employees] pe
             ON pe.id_period_employee = o.id_period_employee
          WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = @tipo_nomina
            AND o.tipo_nomina = @tipo_nomina
          ORDER BY o.fecha`,
        { id_period: period.id_period, id_empleado: idEmpleado, tipo_nomina: payrollType },
      ),
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
      // Percepciones del renglón fiscal con su gravado y exento (spec 73); en operativa no hay.
      payrollType === "F"
        ? db.queryParams(
            `SELECT r.id_perception, c.clave_sat, c.[description],
                    CAST(r.importe AS float) AS importe, r.eventos,
                    r.exencion_estado, r.exencion_motivo, r.tipo_limite_exencion,
                    CAST(r.umas_limite AS float) AS umas_limite,
                    CAST(r.porcentaje_exento AS float) AS porcentaje_exento,
                    r.periodicidad_limite,
                    CAST(r.uma_diaria AS float) AS uma_diaria,
                    CONVERT(varchar(10), r.uma_vigente_desde, 120) AS uma_vigente_desde,
                    CAST(r.tope_exento AS float) AS tope_exento,
                    CAST(r.exento_consumido_previo AS float) AS exento_consumido_previo,
                    CAST(r.importe_exento AS float) AS importe_exento,
                    CAST(r.importe_gravado AS float) AS importe_gravado
               FROM [CentroPodologico].[payroll].[period_employee_perceptions] r
               JOIN [CentroPodologico].[payroll].[period_employees] pe
                 ON pe.id_period_employee = r.id_period_employee
               JOIN [CentroPodologico].[payroll].[perceptions] c ON c.id_perception = r.id_perception
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'F'
              ORDER BY r.id_perception`,
            { id_period: period.id_period, id_empleado: idEmpleado },
          )
        : Promise.resolve([]),
      // Spec 87/90: desglose congelado del ISR art. 174 (solo en el renglón fiscal de un periodo extraordinario, de aguinaldo o PTU).
      payrollType === "F" && period.tipo_periodo === "E"
        ? db.queryParams(
            `SELECT a.isr_estado, a.isr_motivo,
                    CAST(a.base_gravable AS float)             AS base_gravable,
                    CAST(a.ingreso_ordinario_mensual AS float) AS ingreso_ordinario_mensual,
                    CAST(a.parte_mensualizada AS float)        AS parte_mensualizada,
                    a.ejercicio_tarifa,
                    CAST(a.limite_inferior_ordinario AS float) AS limite_inferior_ordinario,
                    CAST(a.cuota_fija_ordinario AS float)      AS cuota_fija_ordinario,
                    CAST(a.porcentaje_ordinario AS float)      AS porcentaje_ordinario,
                    CAST(a.isr_ordinario AS float)             AS isr_ordinario,
                    CAST(a.limite_inferior_total AS float)     AS limite_inferior_total,
                    CAST(a.cuota_fija_total AS float)          AS cuota_fija_total,
                    CAST(a.porcentaje_total AS float)          AS porcentaje_total,
                    CAST(a.isr_total AS float)                 AS isr_total,
                    CAST(a.diferencia_isr AS float)            AS diferencia_isr,
                    CAST(a.tasa AS float)                      AS tasa,
                    CAST(a.isr_retenido AS float)              AS isr_retenido
               FROM [CentroPodologico].[payroll].[period_employee_isr_article174] a
               JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.id_period_employee = a.id_period_employee
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'F'`,
            { id_period: period.id_period, id_empleado: idEmpleado },
          )
        : Promise.resolve([]),
      // Spec 91: desglose congelado de la cuota obrera; solo existe para los renglones fiscales en 'C'.
      payrollType === "F"
        ? db.queryParams(
            `SELECT ${IMSS_BREAKDOWN_SELECT_SQL}
               FROM [CentroPodologico].[payroll].[period_employee_imss] i
               JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.id_period_employee = i.id_period_employee
              WHERE pe.id_period = @id_period AND pe.id_empleado = @id_empleado AND pe.tipo_nomina = 'F'`,
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
      tipo_regimen: employeeRow.tipo_regimen ?? null,
    };

    // Spec 78: el snapshot trae la prima y las vacaciones pagadas; buildPerceptionLines las vuelve líneas.
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
          dias_prima_vacacional: Number(snapshotRow.dias_prima_vacacional),
          importe_prima_vacacional: Number(snapshotRow.importe_prima_vacacional),
          dias_vacaciones_pagadas: Number(snapshotRow.dias_vacaciones_pagadas),
          importe_vacaciones_pagadas: Number(snapshotRow.importe_vacaciones_pagadas),
          dias_aguinaldo: Number(snapshotRow.dias_aguinaldo),
          importe_aguinaldo: Number(snapshotRow.importe_aguinaldo),
          importe_ptu: Number(snapshotRow.importe_ptu),
          ptu: toPtuPaymentBreakdown(snapshotRow as IPtuPaymentRowColumns),
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
          imss_estado: snapshotRow.imss_estado,
          imss_motivo: snapshotRow.imss_motivo ?? null,
          imss_retenido: toNullableNumber(snapshotRow.imss_retenido),
          imss: imssRows[0] ? toImssBreakdown(imssRows[0] as Record<string, unknown>) : null,
          calculated_at: snapshotRow.calculated_at,
        }
      : null;
    const totalDeductions = snapshotRow ? Number(snapshotRow.total_deducciones) : 0;

    // El catálogo solo se consulta si hay comisión que describir.
    const commissionTiers =
      snapshot && snapshot.importe_comision > 0 ? await getCommissionTiersOrEmpty() : [];
    const baseLines = snapshot
      ? buildPerceptionLines(snapshot, employee.fecha_ingreso, period.fecha_inicio, commissionTiers, period.concepto_extraordinario ?? "O")
      : [];
    const perceptions = snapshot
      ? attachTaxBreakdown(baseLines, payrollType, storedPerceptionRows as IPeriodEmployeePerception[])
      : [];
    const totalPerceptions =
      Math.round(perceptions.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    const totalTaxed = sumTaxBreakdown(perceptions, "taxed");
    const totalExempt = sumTaxBreakdown(perceptions, "exempt");

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

    const article174Row = article174Rows[0] as Record<string, unknown> | undefined;
    const article174: IArticle174IsrBreakdown | null = article174Row
      ? {
          isr_estado: article174Row.isr_estado as "C" | "N",
          isr_motivo: (article174Row.isr_motivo as Article174SkipReason | null) ?? null,
          base_gravable: toNullableNumber(article174Row.base_gravable),
          ingreso_ordinario_mensual: toNullableNumber(article174Row.ingreso_ordinario_mensual),
          parte_mensualizada: toNullableNumber(article174Row.parte_mensualizada),
          ejercicio_tarifa: toNullableNumber(article174Row.ejercicio_tarifa),
          limite_inferior_ordinario: toNullableNumber(article174Row.limite_inferior_ordinario),
          cuota_fija_ordinario: toNullableNumber(article174Row.cuota_fija_ordinario),
          porcentaje_ordinario: toNullableNumber(article174Row.porcentaje_ordinario),
          isr_ordinario: toNullableNumber(article174Row.isr_ordinario),
          limite_inferior_total: toNullableNumber(article174Row.limite_inferior_total),
          cuota_fija_total: toNullableNumber(article174Row.cuota_fija_total),
          porcentaje_total: toNullableNumber(article174Row.porcentaje_total),
          isr_total: toNullableNumber(article174Row.isr_total),
          diferencia_isr: toNullableNumber(article174Row.diferencia_isr),
          tasa: toNullableNumber(article174Row.tasa),
          isr_retenido: toNullableNumber(article174Row.isr_retenido),
        }
      : null;

    const navigationRow = snapshot ? navigationRows[0] : undefined;

    return {
      ok: true,
      data: {
        period,
        employee,
        snapshot,
        perceptions,
        totalPerceptions,
        totalTaxed,
        totalExempt,
        totalDeductions,
        article174,
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
const OVERTIME_DAY_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_overtime_empleado_fecha_tipo";
const ABSENCE_ALREADY_DISCOUNTED_CONSTRAINT = "UQ_period_employee_absences_empleado_fecha_tipo";
const LATENESS_ALREADY_DISCOUNTED_CONSTRAINT = "UQ_period_employee_lateness_empleado_fecha_tipo";
const VACATION_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_vacations_entitlement_concepto_tipo";

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
  if (sqlError.message?.includes(VACATION_ALREADY_PAID_CONSTRAINT)) {
    return "Otro cálculo tomó la prima o las vacaciones de este empleado al mismo tiempo. Intenta de nuevo.";
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
 * Calcular y Recalcular un periodo extraordinario (spec 87): en un solo batch con el periodo leído con
 * UPDLOCK/HOLDLOCK borra el snapshot, inserta el aguinaldo de cada empleado elegible y deja el periodo en estatus 2.
 * Revertir funciona igual que en un ordinario gracias al cascade de `period_employees`.
 */
async function calculateExtraordinaryPayrollPeriod(
  idPeriod: number,
  idSucursal: number,
  idUser: number,
): Promise<ActionResult<{ operativa: number; fiscal: number }>> {
  try {
    const rows = await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @id_payment_period smallint, @fecha_inicio date, @fecha_fin date;
       SELECT @id_payment_period = id_payment_period,
              @fecha_inicio      = fecha_inicio,
              @fecha_fin         = fecha_fin
         FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal AND status IN (1, 2)
          AND tipo_periodo = 'E' AND concepto_extraordinario = 'A';
       IF @id_payment_period IS NULL
         THROW 50003, '${PERIOD_NOT_CALCULABLE_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[period_employees] WHERE id_period = @id_period;
       ${CHRISTMAS_BONUS_SNAPSHOT_SQL}

       UPDATE [CentroPodologico].[payroll].[periods]
          SET status = 2, updated_at = CAST(@calculated_at AS datetime2(0))
        WHERE id_period = @id_period;

       COMMIT;

       SELECT ISNULL(SUM(CASE WHEN tipo_nomina = 'O' THEN 1 ELSE 0 END), 0) AS operativa,
              ISNULL(SUM(CASE WHEN tipo_nomina = 'F' THEN 1 ELSE 0 END), 0) AS fiscal
         FROM [CentroPodologico].[payroll].[period_employees]
        WHERE id_period = @id_period;`,
      { id_period: idPeriod, id_sucursal: idSucursal, calculated_by: idUser, calculated_at: buildDate(new Date()) },
    );

    revalidatePayrollPaths();
    return {
      ok: true,
      data: { operativa: Number(rows[0]?.operativa ?? 0), fiscal: Number(rows[0]?.fiscal ?? 0) },
    };
  } catch (error) {
    console.error("calculateExtraordinaryPayrollPeriod", error);
    return { ok: false, message: describePayrollCalculationError(error) };
  }
}

/** Traduce los errores del cálculo de la PTU (spec 90); `paymentYear` es el ejercicio del periodo. */
function describePtuPaymentError(error: unknown, paymentYear: number): string {
  const sqlError = error as { message?: string };
  const message = sqlError.message ?? "";
  if (message.includes(PTU_DISTRIBUTION_NOT_CLOSED_MARKER)) {
    return `Cierra primero el reparto de PTU ${paymentYear - 1}`;
  }
  if (message.includes(PTU_NO_PAYABLE_ROWS_MARKER)) {
    return `Nadie de esta sucursal cobra PTU ${paymentYear - 1}`;
  }
  if (message.includes(PTU_ZERO_DAILY_CAP_MARKER)) {
    const names = message.slice(message.indexOf(`${PTU_ZERO_DAILY_CAP_MARKER}:`) + PTU_ZERO_DAILY_CAP_MARKER.length + 1);
    return `El reparto de PTU ${paymentYear - 1} tiene trabajadores sin salario diario tope: ${names}. Reábrelo, corrígelo y ciérralo de nuevo`;
  }
  if (message.includes(PTU_ALREADY_PAID_CONSTRAINT)) {
    return `Alguno de estos trabajadores ya cobró la PTU de ${paymentYear - 1}`;
  }
  return describePayrollCalculationError(error);
}

/**
 * Calcular y Recalcular un periodo extraordinario de PTU (spec 90): en un solo batch con el periodo y el reparto
 * leídos con UPDLOCK/HOLDLOCK borra el snapshot, inserta una fila fiscal por fila pagable del reparto cerrado de la
 * sucursal y pasa la PTU por el motor de gravado/exento. Revertir funciona igual que en un ordinario gracias al cascade.
 */
async function calculatePtuPaymentPeriod(
  idPeriod: number,
  idSucursal: number,
  idUser: number,
  paymentYear: number,
): Promise<ActionResult<{ operativa: number; fiscal: number }>> {
  try {
    const rows = await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @id_payment_period smallint, @ejercicio smallint, @fecha_inicio date, @fecha_fin date;
       SELECT @id_payment_period = id_payment_period,
              @ejercicio         = ejercicio,
              @fecha_inicio      = fecha_inicio,
              @fecha_fin         = fecha_fin
         FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal AND status IN (1, 2)
          AND tipo_periodo = 'E' AND concepto_extraordinario = 'P';
       IF @id_payment_period IS NULL
         THROW 50003, '${PERIOD_NOT_CALCULABLE_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[period_employees] WHERE id_period = @id_period;
       ${PTU_PAYMENT_SNAPSHOT_SQL}

       UPDATE [CentroPodologico].[payroll].[periods]
          SET status = 2, updated_at = CAST(@calculated_at AS datetime2(0))
        WHERE id_period = @id_period;

       COMMIT;

       SELECT ISNULL(SUM(CASE WHEN tipo_nomina = 'O' THEN 1 ELSE 0 END), 0) AS operativa,
              ISNULL(SUM(CASE WHEN tipo_nomina = 'F' THEN 1 ELSE 0 END), 0) AS fiscal
         FROM [CentroPodologico].[payroll].[period_employees]
        WHERE id_period = @id_period;`,
      { id_period: idPeriod, id_sucursal: idSucursal, calculated_by: idUser, calculated_at: buildDate(new Date()) },
    );

    revalidatePayrollPaths();
    return {
      ok: true,
      data: { operativa: Number(rows[0]?.operativa ?? 0), fiscal: Number(rows[0]?.fiscal ?? 0) },
    };
  } catch (error) {
    console.error("calculatePtuPaymentPeriod", error);
    return { ok: false, message: describePtuPaymentError(error, paymentYear) };
  }
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
 * La prima vacacional y los días no disfrutados pagados (spec 78) también, en las dos nóminas con el salario de cada tipo:
 * `lib/payroll/vacationPay.ts` los espeja y, si divergen, manda este SQL. Los eventos salen de `VACATION_PAY_EVENTS_SQL`.
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
    // Spec 87/90: el periodo extraordinario tiene su propio cálculo según el concepto; el resto del batch es del ordinario.
    const periodTypeRows = await db.queryParams(
      `SELECT tipo_periodo, concepto_extraordinario, ejercicio FROM [CentroPodologico].[payroll].[periods]
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal`,
      { id_period: parsed.data.id_period, id_sucursal },
    );
    if (periodTypeRows[0]?.tipo_periodo === "E") {
      if (periodTypeRows[0].concepto_extraordinario === "P") {
        return calculatePtuPaymentPeriod(
          parsed.data.id_period,
          id_sucursal,
          id_user,
          Number(periodTypeRows[0].ejercicio),
        );
      }
      return calculateExtraordinaryPayrollPeriod(parsed.data.id_period, id_sucursal, id_user);
    }

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

       -- Spec 61 y 75: días con horas extra autorizadas en el rango y aún no pagados por ningún periodo, por tipo de
       -- nómina ('O' con salario_diario, 'F' con salario_diario_fiscal). Solo de empleados elegibles a la nómina
       -- operativa y de empresas con configuración. Las primeras limite_horas_dobles_periodo horas (en orden
       -- cronológico, por empleado y tipo) son dobles y el resto triples; el día que cruza se parte.
       ;WITH authorized_days AS (
         SELECT a.[id_empleado], salary.[tipo_nomina], a.[fecha], a.[horas_autorizadas] AS horas,
                s.[limite_horas_dobles_periodo] AS limite, salary.[salario_diario],
                SUM(a.[horas_autorizadas]) OVER (PARTITION BY a.[id_empleado], salary.[tipo_nomina]
                                                 ORDER BY a.[fecha]
                                                 ROWS UNBOUNDED PRECEDING) - a.[horas_autorizadas] AS acumulado_previo
           FROM [CentroPodologico].[payroll].[overtime_authorizations] a
           JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = a.[id_empleado]
           JOIN [CentroPodologico].[payroll].[overtime_settings] s ON s.[id_empresa] = e.[id_empresa]
          CROSS APPLY (VALUES ('O', e.[salario_diario]), ('F', e.[salario_diario_fiscal]))
                      AS salary ([tipo_nomina], [salario_diario])
          WHERE a.[estado] = 'A'
            AND salary.[salario_diario] > 0
            AND a.[fecha] >= @fecha_inicio AND a.[fecha] <= @fecha_fin
            AND a.[fecha] >= e.[fecha_ingreso]
            AND ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
            AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_overtime] po
                             WHERE po.[id_empleado] = a.[id_empleado] AND po.[fecha] = a.[fecha]
                               AND po.[tipo_nomina] = salary.[tipo_nomina])
       ), split_days AS (
         SELECT d.*, CAST(CASE WHEN d.limite - d.acumulado_previo <= 0 THEN 0
                               WHEN d.limite - d.acumulado_previo >= d.horas THEN d.horas
                               ELSE d.limite - d.acumulado_previo END AS decimal(4,1)) AS horas_dobles
           FROM authorized_days d
       )
       SELECT sd.[id_empleado], sd.[tipo_nomina], sd.[fecha], sd.horas AS horas_autorizadas,
              sd.horas_dobles, CAST(sd.horas - sd.horas_dobles AS decimal(4,1)) AS horas_triples,
              ROUND(sd.horas_dobles * sd.[salario_diario] * 2 / 8, 2) AS importe_dobles,
              ROUND((sd.horas - sd.horas_dobles) * sd.[salario_diario] * 3 / 8, 2) AS importe_triples
         INTO #overtime_days
         FROM split_days sd;

       -- Spec 78: prima vacacional y días no disfrutados pagados cuyo evento cae en el rango, por tipo de nómina
       -- ('O' con salario_diario, 'F' con salario_diario_fiscal; un tipo con salario 0 no genera filas). Se excluyen,
       -- antes de calcular, los conceptos que otro periodo ya pagó en ese tipo (el DELETE de arriba ya liberó los de este).
       -- lib/payroll/vacationPay.ts lo espeja y, si divergen, manda este SQL.
       SELECT ev.[id_empleado], salary.[tipo_nomina], ev.[id_vacation_entitlement], ev.[concepto], ev.[fecha_evento],
              CAST(ev.[dias] AS int) AS dias,
              CAST(CASE WHEN ev.[concepto] = 'P'
                        THEN ROUND(ev.[dias] * salary.[salario_diario] * ${VACATION_PREMIUM_PERCENT} / 100, 2)
                        ELSE ROUND(ev.[dias] * salary.[salario_diario], 2) END AS decimal(12,2)) AS importe
         INTO #vacation_pay
         FROM (${VACATION_PAY_EVENTS_SQL}
              ) ev
         JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = ev.[id_empleado]
        CROSS APPLY (VALUES ('O', e.[salario_diario]), ('F', e.[salario_diario_fiscal]))
                    AS salary ([tipo_nomina], [salario_diario])
        WHERE salary.[salario_diario] > 0
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_vacations] pev
                           WHERE pev.[id_vacation_entitlement] = ev.[id_vacation_entitlement]
                             AND pev.[concepto] = ev.[concepto]
                             AND pev.[tipo_nomina] = salary.[tipo_nomina]);

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
          AND ${NOT_ON_PAID_LEAVE_CONDITION}
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
          AND ${NOT_ON_PAID_LEAVE_CONDITION}
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
          dias_prima_vacacional, importe_prima_vacacional, dias_vacaciones_pagadas, importe_vacaciones_pagadas,
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
              ISNULL(overtime_settings.[limite_horas_dobles_periodo], 0),
              ${PUNCTUALITY_BONUS_SELECT_SQL},
              ${ATTENDANCE_BONUS_SELECT_SQL},
              ${SHIFT_EXTENSION_BONUS_SELECT_SQL},
              vacation.dias_prima, vacation.importe_prima, vacation.dias_pagadas, vacation.importe_pagadas,
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
           WHERE od.[id_empleado] = e.[id_empleado] AND od.[tipo_nomina] = salary.tipo_nomina
        ) AS overtime
        -- Spec 78: totales del periodo; pueden sumar conceptos de más de un año de derecho.
        OUTER APPLY (
          SELECT ISNULL(SUM(CASE WHEN vp.[concepto] = 'P' THEN vp.[dias] END), 0)    AS dias_prima,
                 ISNULL(SUM(CASE WHEN vp.[concepto] = 'P' THEN vp.[importe] END), 0) AS importe_prima,
                 ISNULL(SUM(CASE WHEN vp.[concepto] = 'D' THEN vp.[dias] END), 0)    AS dias_pagadas,
                 ISNULL(SUM(CASE WHEN vp.[concepto] = 'D' THEN vp.[importe] END), 0) AS importe_pagadas
            FROM #vacation_pay vp
           WHERE vp.[id_empleado] = e.[id_empleado] AND vp.[tipo_nomina] = salary.tipo_nomina
        ) AS vacation${PUNCTUALITY_BONUS_APPLY_SQL}${ATTENDANCE_BONUS_APPLY_SQL}${SHIFT_EXTENSION_BONUS_APPLY_SQL}
        WHERE ${ELIGIBLE_EMPLOYEE_BASE_CONDITIONS}
          AND salary.salario_diario > 0;

       -- Spec 73: percepciones de los renglones 'F' con su gravado y exento. Cada spec de percepción fiscal nueva
       -- agrega su UNION ALL a #fiscal_perception_lines (id_perception, importe y, solo en periodicidad 'E', eventos).
       -- Hoy el sueldo, las horas extra dobles y triples (spec 75), la prima vacacional y las vacaciones pagadas (spec 78).
       -- Va después del snapshot (de ahí salen los importes)
       -- y antes del ISR, que suma lo gravado.
       CREATE TABLE #fiscal_perception_lines (
         id_period_employee int NOT NULL,
         id_perception      smallint NOT NULL,
         importe            decimal(12,2) NOT NULL,
         eventos            smallint NULL
       );
       INSERT INTO #fiscal_perception_lines (id_period_employee, id_perception, importe, eventos)
       SELECT pe.[id_period_employee], ${SALARY_PERCEPTION_ID}, pe.[importe_salario], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_salario] > 0
       UNION ALL
       SELECT pe.[id_period_employee], ${OVERTIME_DOUBLE_PERCEPTION_ID}, pe.[importe_horas_extra_dobles], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_horas_extra_dobles] > 0
       UNION ALL
       SELECT pe.[id_period_employee], ${OVERTIME_TRIPLE_PERCEPTION_ID}, pe.[importe_horas_extra_triples], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_horas_extra_triples] > 0
       UNION ALL
       SELECT pe.[id_period_employee], ${VACATION_PREMIUM_PERCEPTION_ID}, pe.[importe_prima_vacacional], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_prima_vacacional] > 0
       UNION ALL
       SELECT pe.[id_period_employee], ${PAID_VACATION_PERCEPTION_ID}, pe.[importe_vacaciones_pagadas], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_vacaciones_pagadas] > 0;

       ${EXEMPTION_PARAMETERS_SQL}

       -- La regla se lee del catálogo en este momento y queda congelada en el renglón.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_perceptions] (${EXEMPTION_INSERT_COLUMNS_SQL})
       SELECT ${EXEMPTION_SELECT_SQL}
         FROM #fiscal_perception_lines fl
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period_employee] = fl.[id_period_employee]
         JOIN [CentroPodologico].[payroll].[perceptions] exemption_rule
           ON exemption_rule.[id_perception] = fl.[id_perception]${EXEMPTION_APPLY_SQL};

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

       -- Spec 91: cuota obrera del IMSS de los renglones 'F'. Va después del ISR porque el tope al neto lo descuenta.
       -- Los renglones 'O' se quedan en 'X'. El desglose y la deducción solo existen para los 'C', aunque retengan 0.
       ${IMSS_PARAMETERS_SQL}

       UPDATE pe
          SET ${IMSS_UPDATE_SET_SQL}
         FROM [CentroPodologico].[payroll].[period_employees] pe${IMSS_APPLY_SQL}
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F';

       INSERT INTO [CentroPodologico].[payroll].[period_employee_imss]
         ([id_period_employee], ${IMSS_INSERT_COLUMNS_SQL})
       SELECT pe.[id_period_employee],
              ${IMSS_SELECT_SQL}
         FROM [CentroPodologico].[payroll].[period_employees] pe${IMSS_APPLY_SQL}
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[imss_estado] = 'C';

       INSERT INTO [CentroPodologico].[payroll].[period_employee_deductions]
         (id_period_employee, id_deduction, importe)
       SELECT pe.[id_period_employee], ${IMSS_DEDUCTION_ID}, pe.[imss_retenido]
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[imss_estado] = 'C';

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

       -- Spec 75: desglose y candado anti doble pago de horas extra, por tipo de nómina: cada día se une al renglón
       -- de su tipo. Un empleado sin renglón de ese tipo (salario en 0) ni paga ni bloquea el día en ese tipo.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_overtime]
         (id_period_employee, id_empleado, tipo_nomina, fecha, horas_autorizadas, horas_dobles, horas_triples,
          importe_dobles, importe_triples)
       SELECT pe.[id_period_employee], od.[id_empleado], od.[tipo_nomina], od.[fecha], od.[horas_autorizadas],
              od.[horas_dobles], od.[horas_triples], od.[importe_dobles], od.[importe_triples]
         FROM #overtime_days od
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = od.[id_empleado] AND pe.[tipo_nomina] = od.[tipo_nomina];

       -- Spec 78: desglose y candado de la prima y los días pagados, por tipo de nómina: cada concepto se une al renglón
       -- de su tipo. El UNIQUE (entitlement, concepto, tipo) impide pagarlo dos veces; Recalcular y Revertir lo liberan
       -- con el DELETE de period_employees (ON DELETE CASCADE).
       INSERT INTO [CentroPodologico].[payroll].[period_employee_vacations]
         (id_period_employee, id_vacation_entitlement, tipo_nomina, concepto, fecha_evento, dias, importe)
       SELECT pe.[id_period_employee], vp.[id_vacation_entitlement], vp.[tipo_nomina], vp.[concepto],
              vp.[fecha_evento], vp.[dias], vp.[importe]
         FROM #vacation_pay vp
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period] = @id_period AND pe.[id_empleado] = vp.[id_empleado] AND pe.[tipo_nomina] = vp.[tipo_nomina];

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

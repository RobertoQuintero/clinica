"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import {
  IVacationBadgeSummary,
  IVacationEntitlement,
  IVacationEntitlementView,
  IVacationLogEntry,
  IVacationPayrollPayment,
} from "@/interfaces/vacation";
import { getVacationPremiumStatus } from "@/lib/payroll/vacationPay";
import { assertVacationAccess } from "@/lib/vacations/vacationAccess";
import { calculateVacationEndDate } from "@/lib/vacations/vacationDates";
import {
  getDaysToPay,
  getVacationBadgeSummary,
  getVacationStatus,
} from "@/lib/vacations/vacationStatus";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import {
  cancelVacationBlockSchema,
  markVacationDaysPaidSchema,
  payrollPeriodForDateSchema,
  rescheduleVacationBlockSchema,
  revertVacationPaymentSchema,
  scheduleVacationBlockSchema,
} from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function revalidateVacationViews(id_empleado: number) {
  revalidatePath(`/dashboard/empleados/${id_empleado}`, "layout");
  revalidatePath("/dashboard/empleados");
}

/** Años de derecho del empleado (más reciente primero) con estatus derivado y bitácora. */
export async function getEmployeeVacations(
  id_empleado: number
): Promise<IVacationEntitlementView[]> {
  // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const entitlements = (await db.queryParams(
    `SELECT [id_vacation_entitlement],
            [id_empleado],
            [anio_servicio],
            CONVERT(varchar(10), [fecha_aniversario],           120) AS fecha_aniversario,
            CONVERT(varchar(10), [fecha_limite_solicitud],      120) AS fecha_limite_solicitud,
            CONVERT(varchar(10), [fecha_siguiente_aniversario], 120) AS fecha_siguiente_aniversario,
            [dias_derecho],
            CONVERT(varchar(10), [fecha_inicio], 120) AS fecha_inicio,
            CONVERT(varchar(10), [fecha_fin],    120) AS fecha_fin,
            [dias_tomados],
            CONVERT(varchar(19), [solicitado_at], 120) AS solicitado_at,
            CONVERT(varchar(10), [fecha_pago],   120) AS fecha_pago,
            [dias_pagados],
            [comentario_pago]
       FROM [CentroPodologico].[RH].[vacation_entitlements]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [anio_servicio] DESC`,
    { id_empleado }
  )) as IVacationEntitlement[];

  if (entitlements.length === 0) return [];

  const logRows = (await db.queryParams(
    `SELECT l.[id_vacation_entitlement],
            l.[id_log],
            l.[accion],
            CONVERT(varchar(10), l.[fecha_inicio_anterior], 120) AS fecha_inicio_anterior,
            CONVERT(varchar(10), l.[fecha_fin_anterior],    120) AS fecha_fin_anterior,
            l.[dias_tomados_anterior],
            CONVERT(varchar(10), l.[fecha_inicio_nueva],    120) AS fecha_inicio_nueva,
            CONVERT(varchar(10), l.[fecha_fin_nueva],       120) AS fecha_fin_nueva,
            l.[dias_tomados_nueva],
            CONVERT(varchar(10), l.[fecha_pago],            120) AS fecha_pago,
            l.[dias_pagados],
            l.[motivo],
            u.[nombre] AS created_by_name,
            CONVERT(varchar(19), l.[created_at], 120) AS created_at
       FROM [CentroPodologico].[RH].[vacation_entitlement_log] l
       JOIN [CentroPodologico].[RH].[vacation_entitlements] v
         ON v.[id_vacation_entitlement] = l.[id_vacation_entitlement]
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = l.[created_by]
      WHERE v.[id_empleado] = @id_empleado
      ORDER BY l.[created_at] DESC, l.[id_log] DESC`,
    { id_empleado }
  )) as (IVacationLogEntry & { id_vacation_entitlement: number })[];

  const logByEntitlement = new Map<number, IVacationLogEntry[]>();
  for (const { id_vacation_entitlement, ...entry } of logRows) {
    const entries = logByEntitlement.get(id_vacation_entitlement) ?? [];
    entries.push(entry);
    logByEntitlement.set(id_vacation_entitlement, entries);
  }

  // Spec 78: lo que la nómina ya pagó de cada año (prima y días), con el código del periodo que lo tomó.
  const payrollPaymentRows = (await db.queryParams(
    `SELECT pev.[id_vacation_entitlement], pev.[concepto], pev.[tipo_nomina], p.[id_period], p.[codigo] AS codigo_periodo
       FROM [CentroPodologico].[payroll].[period_employee_vacations] pev
       JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.[id_period_employee] = pev.[id_period_employee]
       JOIN [CentroPodologico].[payroll].[periods] p ON p.[id_period] = pe.[id_period]
       JOIN [CentroPodologico].[RH].[vacation_entitlements] ve ON ve.[id_vacation_entitlement] = pev.[id_vacation_entitlement]
      WHERE ve.[id_empleado] = @id_empleado
      ORDER BY p.[fecha_inicio], pev.[tipo_nomina]`,
    { id_empleado }
  )) as (IVacationPayrollPayment & { id_vacation_entitlement: number })[];

  const paymentsByEntitlement = new Map<number, IVacationPayrollPayment[]>();
  for (const { id_vacation_entitlement, ...payment } of payrollPaymentRows) {
    const payments = paymentsByEntitlement.get(id_vacation_entitlement) ?? [];
    payments.push({ ...payment, id_period: Number(payment.id_period) });
    paymentsByEntitlement.set(id_vacation_entitlement, payments);
  }

  const today = addZeroToday(new Date());
  return entitlements.map((entitlement) => {
    const payrollPayments = paymentsByEntitlement.get(entitlement.id_vacation_entitlement) ?? [];
    return {
      ...entitlement,
      status: getVacationStatus(entitlement, today),
      dias_por_pagar: getDaysToPay(entitlement, today),
      log: logByEntitlement.get(entitlement.id_vacation_entitlement) ?? [],
      payroll_payments: payrollPayments,
      premium_status: getVacationPremiumStatus(entitlement, payrollPayments),
      paid_days_in_payroll: payrollPayments.some((payment) => payment.concepto === "D"),
    };
  });
}

/**
 * Spec 78: periodo de nómina de la sucursal y la frecuencia de pago del empleado que contiene `fecha`; es el que
 * pagaría los días no disfrutados con esa fecha de pago. `data` es `null` si ningún periodo la contiene.
 * Es una lectura que depende del cliente (cambia con el input del modal), por eso es una server action.
 */
export async function getPayrollPeriodForDate(
  input: unknown
): Promise<ActionResult<{ id_period: number; codigo: string } | null>> {
  try {
    const parsed = payrollPeriodForDateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, fecha } = parsed.data;

    // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };
    if (employee.id_periodo_pago === null) return { ok: true, data: null };

    const rows = (await db.queryParams(
      `SELECT TOP 1 [id_period], [codigo]
         FROM [CentroPodologico].[payroll].[periods]
        WHERE [id_sucursal] = @id_sucursal
          AND [id_payment_period] = @id_payment_period
          AND CAST(@fecha AS date) BETWEEN [fecha_inicio] AND [fecha_fin]
        ORDER BY [fecha_inicio]`,
      { id_sucursal: employee.id_sucursal, id_payment_period: employee.id_periodo_pago, fecha }
    )) as { id_period: number; codigo: string }[];

    return {
      ok: true,
      data: rows[0] ? { id_period: Number(rows[0].id_period), codigo: rows[0].codigo } : null,
    };
  } catch (error) {
    console.error("getPayrollPeriodForDate", error);
    return { ok: false, message: "No se pudo consultar el periodo de nómina" };
  }
}

/** Días ISO (1 = lunes … 7 = domingo) con fila en el horario del empleado. Vacío = sin horario. */
export async function getEmployeeWorkingWeekdays(id_empleado: number): Promise<number[]> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const rows = (await db.queryParams(
    `SELECT [dia_semana]
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [dia_semana]`,
    { id_empleado }
  )) as { dia_semana: number }[];

  return rows.map((row) => row.dia_semana);
}

/**
 * Captura el bloque único de vacaciones de un año de derecho (spec 76). `fecha_fin` se recalcula
 * aquí con el horario actual; la condición de estado se repite en el `UPDATE … WHERE` para que una
 * captura concurrente afecte 0 filas y devuelva `{ ok: false }`.
 */
export async function scheduleVacationBlock(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = scheduleVacationBlockSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, fecha_inicio, dias_tomados } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const [entitlement] = (await db.queryParams(
      `SELECT v.[dias_derecho],
              CONVERT(varchar(10), v.[fecha_aniversario],           120) AS fecha_aniversario,
              CONVERT(varchar(10), v.[fecha_limite_solicitud],      120) AS fecha_limite_solicitud,
              CONVERT(varchar(10), v.[fecha_siguiente_aniversario], 120) AS fecha_siguiente_aniversario,
              CASE WHEN v.[anio_servicio] = (SELECT MAX(x.[anio_servicio])
                                               FROM [CentroPodologico].[RH].[vacation_entitlements] x
                                              WHERE x.[id_empleado] = v.[id_empleado])
                   THEN 1 ELSE 0 END AS is_current_year
         FROM [CentroPodologico].[RH].[vacation_entitlements] v
        WHERE v.[id_vacation_entitlement] = @id_vacation_entitlement
          AND v.[id_empleado] = @id_empleado`,
      { id_vacation_entitlement, id_empleado }
    )) as {
      dias_derecho: number;
      fecha_aniversario: string;
      fecha_limite_solicitud: string;
      fecha_siguiente_aniversario: string;
      is_current_year: number;
    }[];
    if (!entitlement) return { ok: false, message: "El año de vacaciones no existe" };
    if (!entitlement.is_current_year) {
      return { ok: false, message: "Solo se puede capturar el año vigente" };
    }

    const today = addZeroToday(new Date());
    if (today > entitlement.fecha_limite_solicitud) {
      return { ok: false, message: "La fecha límite para solicitar este año ya venció" };
    }
    if (dias_tomados > entitlement.dias_derecho) {
      return { ok: false, message: `El empleado solo tiene ${entitlement.dias_derecho} días de derecho` };
    }
    if (fecha_inicio < entitlement.fecha_aniversario) {
      return { ok: false, message: "El bloque no puede empezar antes del aniversario" };
    }

    const workingWeekdays = await getEmployeeWorkingWeekdays(id_empleado);
    if (workingWeekdays.length === 0) {
      return { ok: false, message: "Sin horario definido: captura el horario del empleado primero" };
    }

    const fecha_fin = calculateVacationEndDate(fecha_inicio, dias_tomados, workingWeekdays);
    if (!fecha_fin) return { ok: false, message: "No se pudo calcular la fecha de fin" };
    if (fecha_fin >= entitlement.fecha_siguiente_aniversario) {
      return {
        ok: false,
        message: "El bloque terminaría en el siguiente año de servicio; las vacaciones no son acumulativas",
      };
    }

    const requestedAt = buildDate(new Date());
    const wasSaved = await db.transaction(async (tx) => {
      const updatedRows = await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_inicio]   = @fecha_inicio,
                [fecha_fin]      = @fecha_fin,
                [dias_tomados]   = @dias_tomados,
                [solicitado_by]  = @id_user,
                [solicitado_at]  = @solicitado_at
         OUTPUT INSERTED.[id_vacation_entitlement]
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_inicio] IS NULL
            AND [fecha_pago] IS NULL
            AND [fecha_limite_solicitud] >= @today`,
        {
          id_vacation_entitlement,
          id_empleado,
          fecha_inicio,
          fecha_fin,
          dias_tomados,
          id_user: access.data.id_user,
          solicitado_at: requestedAt,
          today,
        }
      );
      if (updatedRows.length === 0) return false;

      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion], [fecha_inicio_nueva], [fecha_fin_nueva],
            [dias_tomados_nueva], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'C', @fecha_inicio, @fecha_fin,
            @dias_tomados, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          fecha_inicio,
          fecha_fin,
          dias_tomados,
          id_user: access.data.id_user,
          created_at: requestedAt,
        }
      );
      return true;
    });
    if (!wasSaved) {
      return { ok: false, message: "Este año ya tiene un bloque capturado o ya no admite captura" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al capturar las vacaciones" };
  }
}

/**
 * Reprograma un bloque que aún no empieza (spec 76). Mismas reglas de fechas que la captura,
 * salvo la fecha límite: se puede reprogramar después de ella porque la solicitud fue a tiempo.
 * `solicitado_at` no cambia. Las fechas anteriores salen de `OUTPUT DELETED` para que la bitácora
 * refleje exactamente lo que se sobrescribió.
 */
export async function rescheduleVacationBlock(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = rescheduleVacationBlockSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, fecha_inicio, dias_tomados, motivo } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const [entitlement] = (await db.queryParams(
      `SELECT [dias_derecho],
              CONVERT(varchar(10), [fecha_aniversario],           120) AS fecha_aniversario,
              CONVERT(varchar(10), [fecha_siguiente_aniversario], 120) AS fecha_siguiente_aniversario
         FROM [CentroPodologico].[RH].[vacation_entitlements]
        WHERE [id_vacation_entitlement] = @id_vacation_entitlement
          AND [id_empleado] = @id_empleado`,
      { id_vacation_entitlement, id_empleado }
    )) as { dias_derecho: number; fecha_aniversario: string; fecha_siguiente_aniversario: string }[];
    if (!entitlement) return { ok: false, message: "El año de vacaciones no existe" };

    if (dias_tomados > entitlement.dias_derecho) {
      return { ok: false, message: `El empleado solo tiene ${entitlement.dias_derecho} días de derecho` };
    }
    if (fecha_inicio < entitlement.fecha_aniversario) {
      return { ok: false, message: "El bloque no puede empezar antes del aniversario" };
    }

    const workingWeekdays = await getEmployeeWorkingWeekdays(id_empleado);
    if (workingWeekdays.length === 0) {
      return { ok: false, message: "Sin horario definido: captura el horario del empleado primero" };
    }

    const fecha_fin = calculateVacationEndDate(fecha_inicio, dias_tomados, workingWeekdays);
    if (!fecha_fin) return { ok: false, message: "No se pudo calcular la fecha de fin" };
    if (fecha_fin >= entitlement.fecha_siguiente_aniversario) {
      return {
        ok: false,
        message: "El bloque terminaría en el siguiente año de servicio; las vacaciones no son acumulativas",
      };
    }

    const today = addZeroToday(new Date());
    const changedAt = buildDate(new Date());
    const wasSaved = await db.transaction(async (tx) => {
      const previousRows = (await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_inicio] = @fecha_inicio,
                [fecha_fin]    = @fecha_fin,
                [dias_tomados] = @dias_tomados
         OUTPUT CONVERT(varchar(10), DELETED.[fecha_inicio], 120) AS fecha_inicio_anterior,
                CONVERT(varchar(10), DELETED.[fecha_fin],    120) AS fecha_fin_anterior,
                DELETED.[dias_tomados]                            AS dias_tomados_anterior
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_inicio] IS NOT NULL
            AND [fecha_inicio] > @today
            AND [fecha_pago] IS NULL`,
        { id_vacation_entitlement, id_empleado, fecha_inicio, fecha_fin, dias_tomados, today }
      )) as { fecha_inicio_anterior: string; fecha_fin_anterior: string; dias_tomados_anterior: number }[];
      if (previousRows.length === 0) return false;

      const [previous] = previousRows;
      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion],
            [fecha_inicio_anterior], [fecha_fin_anterior], [dias_tomados_anterior],
            [fecha_inicio_nueva], [fecha_fin_nueva], [dias_tomados_nueva],
            [motivo], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'R',
            @fecha_inicio_anterior, @fecha_fin_anterior, @dias_tomados_anterior,
            @fecha_inicio, @fecha_fin, @dias_tomados,
            @motivo, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          ...previous,
          fecha_inicio,
          fecha_fin,
          dias_tomados,
          motivo,
          id_user: access.data.id_user,
          created_at: changedAt,
        }
      );
      return true;
    });
    if (!wasSaved) {
      return { ok: false, message: "El bloque ya empezó, fue cancelado o ya tiene un pago registrado" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al reprogramar las vacaciones" };
  }
}

/** Cancela un bloque que aún no empieza: lo deja en NULL y registra `'X'` con motivo (spec 76). */
export async function cancelVacationBlock(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = cancelVacationBlockSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, motivo } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const today = addZeroToday(new Date());
    const changedAt = buildDate(new Date());
    const wasCancelled = await db.transaction(async (tx) => {
      const previousRows = (await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_inicio]  = NULL,
                [fecha_fin]     = NULL,
                [dias_tomados]  = NULL,
                [solicitado_by] = NULL,
                [solicitado_at] = NULL
         OUTPUT CONVERT(varchar(10), DELETED.[fecha_inicio], 120) AS fecha_inicio_anterior,
                CONVERT(varchar(10), DELETED.[fecha_fin],    120) AS fecha_fin_anterior,
                DELETED.[dias_tomados]                            AS dias_tomados_anterior
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_inicio] IS NOT NULL
            AND [fecha_inicio] > @today
            AND [fecha_pago] IS NULL`,
        { id_vacation_entitlement, id_empleado, today }
      )) as { fecha_inicio_anterior: string; fecha_fin_anterior: string; dias_tomados_anterior: number }[];
      if (previousRows.length === 0) return false;

      const [previous] = previousRows;
      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion],
            [fecha_inicio_anterior], [fecha_fin_anterior], [dias_tomados_anterior],
            [motivo], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'X',
            @fecha_inicio_anterior, @fecha_fin_anterior, @dias_tomados_anterior,
            @motivo, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          ...previous,
          motivo,
          id_user: access.data.id_user,
          created_at: changedAt,
        }
      );
      return true;
    });
    if (!wasCancelled) {
      return { ok: false, message: "El bloque ya empezó, ya fue cancelado o ya tiene un pago registrado" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al cancelar las vacaciones" };
  }
}

/**
 * Marca como pagados los días sobrantes de un año en `por_pagar` (spec 76). `dias_pagados` lo calcula
 * la base de datos (derecho − tomados); el estatus se repite en el `WHERE`: bloque terminado con días
 * sobrantes o, sin bloque, fecha límite vencida, y sin pago previo.
 */
export async function markVacationDaysPaid(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = markVacationDaysPaidSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, fecha_pago, comentario } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const today = addZeroToday(new Date());
    const paidAt = buildDate(new Date());
    const wasPaid = await db.transaction(async (tx) => {
      const paidRows = (await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_pago]      = @fecha_pago,
                [dias_pagados]    = [dias_derecho] - ISNULL([dias_tomados], 0),
                [comentario_pago] = @comentario,
                [pagado_by]       = @id_user,
                [pagado_at]       = @pagado_at
         OUTPUT INSERTED.[dias_pagados] AS dias_pagados
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_pago] IS NULL
            AND [dias_derecho] - ISNULL([dias_tomados], 0) > 0
            AND (   ([fecha_fin] IS NOT NULL AND [fecha_fin] < @today)
                 OR ([fecha_inicio] IS NULL AND [fecha_limite_solicitud] < @today))`,
        {
          id_vacation_entitlement,
          id_empleado,
          fecha_pago,
          comentario: comentario ? comentario : null,
          id_user: access.data.id_user,
          pagado_at: paidAt,
          today,
        }
      )) as { dias_pagados: number }[];
      if (paidRows.length === 0) return false;

      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion], [fecha_pago], [dias_pagados],
            [motivo], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'P', @fecha_pago, @dias_pagados,
            @comentario, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          fecha_pago,
          dias_pagados: paidRows[0].dias_pagados,
          comentario: comentario ? comentario : null,
          id_user: access.data.id_user,
          created_at: paidAt,
        }
      );
      return true;
    });
    if (!wasPaid) {
      return { ok: false, message: "El año no está por pagar o ya tiene un pago registrado" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al registrar el pago de vacaciones" };
  }
}

/** Revierte el pago de un año: deja el pago en NULL y registra `'V'` con motivo (spec 76). */
export async function revertVacationPayment(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = revertVacationPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, motivo } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const revertedAt = buildDate(new Date());
    const wasReverted = await db.transaction(async (tx) => {
      const previousRows = (await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_pago]      = NULL,
                [dias_pagados]    = NULL,
                [comentario_pago] = NULL,
                [pagado_by]       = NULL,
                [pagado_at]       = NULL
         OUTPUT CONVERT(varchar(10), DELETED.[fecha_pago], 120) AS fecha_pago,
                DELETED.[dias_pagados]                          AS dias_pagados
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_pago] IS NOT NULL`,
        { id_vacation_entitlement, id_empleado }
      )) as { fecha_pago: string; dias_pagados: number }[];
      if (previousRows.length === 0) return false;

      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion], [fecha_pago], [dias_pagados],
            [motivo], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'V', @fecha_pago, @dias_pagados,
            @motivo, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          ...previousRows[0],
          motivo,
          id_user: access.data.id_user,
          created_at: revertedAt,
        }
      );
      return true;
    });
    if (!wasReverted) {
      return { ok: false, message: "El año no tiene un pago registrado" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al revertir el pago de vacaciones" };
  }
}

/** Estatus del año vigente (el de mayor `anio_servicio`) para el badge del expediente. `null` si no hay año. */
export async function getCurrentVacationStatus(
  id_empleado: number
): Promise<IVacationBadgeSummary | null> {
  const [currentEntitlement] = (await db.queryParams(
    `SELECT TOP 1
            [dias_derecho],
            CONVERT(varchar(10), [fecha_limite_solicitud], 120) AS fecha_limite_solicitud,
            CONVERT(varchar(10), [fecha_inicio],           120) AS fecha_inicio,
            CONVERT(varchar(10), [fecha_fin],              120) AS fecha_fin,
            [dias_tomados],
            CONVERT(varchar(10), [fecha_pago],             120) AS fecha_pago,
            [dias_pagados]
       FROM [CentroPodologico].[RH].[vacation_entitlements]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [anio_servicio] DESC`,
    { id_empleado }
  )) as Parameters<typeof getVacationBadgeSummary>[0][];

  if (!currentEntitlement) return null;
  return getVacationBadgeSummary(currentEntitlement, addZeroToday(new Date()));
}

import "server-only";

import type { ITransactionClient } from "@/database/connection";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { buildDate } from "@/utils/date_helpper";

/** Resultado de una validación dentro de la transacción de una escritura de justificación. */
export type JustificationWriteCheck = { ok: true } | { ok: false; message: string };

/** El día de un empleado en un periodo, tal como llega de las actions de Faltas y Retardos. */
export interface IJustificationDayTarget {
  id_period: number;
  id_empleado: number;
  fecha: string;
}

/** Tablas de justificación con la misma forma: una fila por empleado y día, sin id de periodo. */
export type JustificationTable = "absence_justifications" | "lateness_justifications";

/**
 * Dentro de la transacción: valida que el periodo sea de la sucursal activa y admita cambios (estatus 1 o 2),
 * que la fecha caiga en su rango y que el empleado sea elegible ese día y tenga control de faltas/retardos
 * (la misma población). El periodo se lee con UPDLOCK/HOLDLOCK para que un cambio de estatus no se cuele a
 * mitad de la escritura. `notControlledMessage` es el error cuando el empleado no está controlado.
 */
export async function validateJustificationTarget(
  transaction: ITransactionClient,
  idSucursal: number,
  target: IJustificationDayTarget,
  notControlledMessage: string,
): Promise<JustificationWriteCheck> {
  const periodRows = await transaction.queryParams(
    `SELECT id_payment_period, status,
            CONVERT(varchar(10), fecha_inicio, 120) AS fecha_inicio,
            CONVERT(varchar(10), fecha_fin, 120)    AS fecha_fin
       FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
      WHERE id_period = @id_period AND id_sucursal = @id_sucursal`,
    { id_period: target.id_period, id_sucursal: idSucursal },
  );
  const period = periodRows[0] as
    | { id_payment_period: number; status: number; fecha_inicio: string; fecha_fin: string }
    | undefined;
  if (!period) return { ok: false, message: "El periodo no existe" };
  if (period.status !== 1 && period.status !== 2) {
    return { ok: false, message: "El periodo ya no admite cambios" };
  }
  if (target.fecha < period.fecha_inicio || target.fecha > period.fecha_fin) {
    return { ok: false, message: "La fecha está fuera del periodo" };
  }

  // Un día anterior a la fecha de ingreso tampoco es revisable.
  const employeeRows = await transaction.queryParams(
    `SELECT e.id_empleado
       FROM [CentroPodologico].[RH].[empleados] e
      WHERE e.id_empleado = @id_empleado
        AND ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
        AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
        AND e.fecha_ingreso <= CAST(@fecha AS date)`,
    {
      id_empleado: target.id_empleado,
      id_sucursal: idSucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin: period.fecha_fin,
      fecha: target.fecha,
    },
  );
  if (employeeRows.length === 0) return { ok: false, message: notControlledMessage };
  return { ok: true };
}

/** Inserta o reemplaza la justificación del día; el UNIQUE (id_empleado, fecha) garantiza una sola fila. */
export async function upsertJustification(
  transaction: ITransactionClient,
  table: JustificationTable,
  values: {
    id_empleado: number;
    fecha: string;
    estado: "J" | "N";
    url: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    comentario: string | null;
    decided_by: number;
  },
): Promise<void> {
  // `table` es una unión cerrada de dos nombres fijos, nunca texto del usuario.
  const qualifiedTable = `[CentroPodologico].[payroll].[${table}]`;
  await transaction.queryParams(
    `IF EXISTS (SELECT 1 FROM ${qualifiedTable} WITH (UPDLOCK, HOLDLOCK)
                 WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date))
       UPDATE ${qualifiedTable}
          SET estado     = @estado,
              url        = @url,
              mime_type  = @mime_type,
              size_bytes = @size_bytes,
              comentario = @comentario,
              decided_by = @decided_by,
              decided_at = CAST(@decided_at AS datetime2(0))
        WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date)
     ELSE
       INSERT INTO ${qualifiedTable}
         (id_empleado, fecha, estado, url, mime_type, size_bytes, comentario, decided_by, decided_at)
       VALUES (@id_empleado, CAST(@fecha AS date), @estado, @url, @mime_type, @size_bytes, @comentario,
               @decided_by, CAST(@decided_at AS datetime2(0)))`,
    { ...values, decided_at: buildDate(new Date()) },
  );
}

"use server";

import db from "@/database/connection";
import { IEmployeeSchedule, IScheduleDay } from "@/interfaces/employee_schedule";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { saveEmployeeScheduleSchema } from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Horario semanal del empleado: solo los días trabajados. Las horas llegan como "HH:mm". */
export async function getEmployeeSchedule(id_empleado: number): Promise<IEmployeeSchedule> {
  const rows = (await db.queryParams(
    `SELECT [dia_semana],
            CONVERT(varchar(5),  [hora_entrada_1], 108) AS hora_entrada_1,
            CONVERT(varchar(5),  [hora_salida_1],  108) AS hora_salida_1,
            CONVERT(varchar(5),  [hora_entrada_2], 108) AS hora_entrada_2,
            CONVERT(varchar(5),  [hora_salida_2],  108) AS hora_salida_2,
            CONVERT(varchar(19), [created_at],     120) AS created_at
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [dia_semana]`,
    { id_empleado }
  )) as (IScheduleDay & { created_at: string | null })[];

  // "YYYY-MM-DD HH:mm:ss" ordena bien como string, no hace falta Date.
  const updated_at = rows.reduce<string | null>(
    (latest, row) => (row.created_at && (!latest || row.created_at > latest) ? row.created_at : latest),
    null
  );

  return {
    id_empleado,
    days: rows.map((row) => ({
      dia_semana: row.dia_semana,
      hora_entrada_1: row.hora_entrada_1,
      hora_salida_1: row.hora_salida_1,
      hora_entrada_2: row.hora_entrada_2,
      hora_salida_2: row.hora_salida_2,
    })),
    updated_at,
  };
}

/** Reemplaza la semana completa del empleado (DELETE + INSERT en una transacción). */
export async function saveEmployeeSchedule(
  input: unknown
): Promise<ActionResult<IEmployeeSchedule>> {
  try {
    const parsed = saveEmployeeScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, days } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const createdAt = buildDate(new Date());
    await db.transaction(async (tx) => {
      await tx.queryParams(
        `DELETE FROM [CentroPodologico].[RH].[empleado_horarios]
          WHERE [id_empleado] = @id_empleado`,
        { id_empleado }
      );
      for (const day of days) {
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[RH].[empleado_horarios]
             ([id_empleado], [dia_semana], [hora_entrada_1], [hora_salida_1],
              [hora_entrada_2], [hora_salida_2], [created_at])
           VALUES
             (@id_empleado, @dia_semana, @hora_entrada_1, @hora_salida_1,
              @hora_entrada_2, @hora_salida_2, @created_at)`,
          { id_empleado, ...day, created_at: createdAt }
        );
      }
    });

    revalidatePath(`/dashboard/empleados/${id_empleado}`);
    revalidatePath(`/dashboard/empleados/${id_empleado}/horario`);
    return { ok: true, data: await getEmployeeSchedule(id_empleado) };
  } catch {
    return { ok: false, message: "Error al guardar el horario" };
  }
}

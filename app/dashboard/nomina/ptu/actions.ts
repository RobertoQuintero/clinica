"use server";

import db, { type ITransactionClient } from "@/database/connection";
import type {
  IPtuAddableEmployee,
  IPtuDistribution,
  IPtuDistributionDetail,
  IPtuDistributionEmployee,
  IPtuDistributionLogEntry,
  IPtuHistoryYear,
  PtuEmployeeOrigin,
  PtuLogAction,
} from "@/interfaces/payroll_ptu";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { calculatePtuDistribution } from "@/lib/payroll/ptuDistribution";
import { PTU_LOG_ENTRIES_LIMIT } from "@/lib/payroll/constants";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import {
  getPtuAverageYears,
  loadPtuAddableEmployees,
  loadPtuClosedDistributionYears,
  loadPtuHistoryYears,
  loadPtuPreloadRows,
  PTU_DISTRIBUTION_SELECT,
} from "@/lib/payroll/ptuDistributionSql";
import { lockPtuDistribution, recalculatePtuDistribution } from "@/lib/payroll/ptuRecalculation";
import {
  createPtuDistributionSchema,
  ptuDistributionEmployeeSchema,
  ptuDistributionIdSchema,
  savePtuHistorySchema,
  updatePtuDistributionEmployeeSchema,
  updatePtuDistributionParametersSchema,
} from "@/lib/payroll/ptuSchemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const PTU_PATH = "/dashboard/nomina/ptu";
const CLOSED_DISTRIBUTION_MESSAGE = "El reparto está cerrado. Reábrelo para modificarlo.";
const DISTRIBUTION_NOT_FOUND_MESSAGE = "El reparto no existe";

function buildDuplicateDistributionMessage(ejercicio: number): string {
  return `Ya existe el reparto de PTU de ${ejercicio}`;
}

/** SQL Server 2627 / 2601: violación de índice o llave única. */
function isUniqueViolation(error: unknown): boolean {
  const sqlError = error as { number?: number; message?: string } | null;
  return sqlError?.number === 2627 || sqlError?.number === 2601;
}

export async function getPtuDistributions(): Promise<ActionResult<IPtuDistribution[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  try {
    const rows = (await db.queryParams(
      `SELECT ${PTU_DISTRIBUTION_SELECT}
         FROM [CentroPodologico].[payroll].[ptu_distributions] d
        WHERE d.id_empresa = @id_empresa
        ORDER BY d.ejercicio DESC`,
      { id_empresa: access.data.id_empresa },
    )) as IPtuDistribution[];
    return { ok: true, data: rows };
  } catch (error) {
    console.error("getPtuDistributions", error);
    return { ok: false, message: "No se pudieron cargar los repartos de PTU" };
  }
}

export async function createPtuDistribution(rawInput: unknown): Promise<ActionResult<number>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = createPtuDistributionSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const newId = await db.transaction(async (tx) => {
      const duplicates = await tx.queryParams(
        `SELECT 1 AS found
           FROM [CentroPodologico].[payroll].[ptu_distributions] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_empresa = @id_empresa AND ejercicio = @ejercicio`,
        { id_empresa: access.data.id_empresa, ejercicio: input.ejercicio },
      );
      if (duplicates.length > 0) return null;

      // Sin trabajadores todavía: solo el fondo y las mitades salen de los parámetros.
      const { totals } = calculatePtuDistribution(input, [], new Map());
      const now = buildDate(new Date());
      const inserted = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[payroll].[ptu_distributions]
           ([id_empresa],[ejercicio],[tipo_persona],[renta_gravable],[ptu_no_cobrada_anterior],[factor_tres_meses],
            [fondo],[mitad_dias],[mitad_salario],[total_dias],[total_salario_reparto],[tope_salario_diario_confianza],
            [total_repartido],[remanente_topes],[remanente_redondeo],[created_by],[created_at],[updated_at])
         OUTPUT INSERTED.[id_ptu_distribution]
         VALUES
           (@id_empresa,@ejercicio,@tipo_persona,@renta_gravable,@ptu_no_cobrada_anterior,@factor_tres_meses,
            @fondo,@mitad_dias,@mitad_salario,@total_dias,@total_salario_reparto,@tope_salario_diario_confianza,
            @total_repartido,@remanente_topes,@remanente_redondeo,@created_by,@created_at,@updated_at)`,
        {
          ...totals,
          id_empresa: access.data.id_empresa,
          ejercicio: input.ejercicio,
          tipo_persona: input.tipo_persona,
          renta_gravable: input.renta_gravable,
          ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
          factor_tres_meses: input.factor_tres_meses,
          created_by: access.data.id_user,
          created_at: now,
          updated_at: now,
        },
      );
      return (inserted[0] as { id_ptu_distribution: number }).id_ptu_distribution;
    });

    if (newId === null) return { ok: false, message: buildDuplicateDistributionMessage(input.ejercicio) };
    revalidatePath(PTU_PATH);
    return { ok: true, data: newId };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, message: buildDuplicateDistributionMessage(input.ejercicio) };
    console.error("createPtuDistribution", error);
    return { ok: false, message: "No se pudo crear el reparto de PTU" };
  }
}

/** Parámetros editables con la etiqueta que se escribe en la bitácora (`campo`). */
const EDITABLE_PARAMETERS = [
  "tipo_persona",
  "renta_gravable",
  "ptu_no_cobrada_anterior",
  "factor_tres_meses",
] as const;

export async function updatePtuDistributionParameters(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = updatePtuDistributionParametersSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const changedParameters = EDITABLE_PARAMETERS.filter(
        (parameter) => String(distribution[parameter]) !== String(input[parameter]),
      );
      if (changedParameters.length === 0) return "unchanged" as const;

      const now = buildDate(new Date());
      await tx.queryParams(
        `UPDATE [CentroPodologico].[payroll].[ptu_distributions]
            SET [tipo_persona] = @tipo_persona, [renta_gravable] = @renta_gravable,
                [ptu_no_cobrada_anterior] = @ptu_no_cobrada_anterior, [factor_tres_meses] = @factor_tres_meses,
                [updated_at] = @updated_at
          WHERE [id_ptu_distribution] = @id_ptu_distribution`,
        {
          id_ptu_distribution: distribution.id_ptu_distribution,
          tipo_persona: input.tipo_persona,
          renta_gravable: input.renta_gravable,
          ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
          factor_tres_meses: input.factor_tres_meses,
          updated_at: now,
        },
      );

      await recalculatePtuDistribution(tx, {
        ...distribution,
        renta_gravable: input.renta_gravable,
        ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
        factor_tres_meses: input.factor_tres_meses,
      });

      // Una entrada por parámetro que cambió de verdad.
      for (const parameter of changedParameters) {
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_log]
             ([id_ptu_distribution],[id_empleado],[accion],[campo],[valor_anterior],[valor_nuevo],[changed_by],[changed_at])
           VALUES (@id_ptu_distribution, NULL, 'P', @campo, @valor_anterior, @valor_nuevo, @changed_by, @changed_at)`,
          {
            id_ptu_distribution: distribution.id_ptu_distribution,
            campo: parameter,
            valor_anterior: String(distribution[parameter]),
            valor_nuevo: String(input[parameter]),
            changed_by: access.data.id_user,
            changed_at: now,
          },
        );
      }
      return "updated" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "updated") {
      revalidatePath(PTU_PATH);
      revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    }
    return { ok: true, data: null };
  } catch (error) {
    console.error("updatePtuDistributionParameters", error);
    return { ok: false, message: "No se pudieron guardar los parámetros del reparto" };
  }
}

/** Solo en borrador. Las filas de trabajadores y la bitácora se borran en cascada. */
export async function deletePtuDistribution(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id_ptu_distribution } = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;
      await tx.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[ptu_distributions] WHERE [id_ptu_distribution] = @id_ptu_distribution`,
        { id_ptu_distribution },
      );
      return "deleted" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: "Solo se puede eliminar un reparto en borrador" };
    revalidatePath(PTU_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deletePtuDistribution", error);
    return { ok: false, message: "No se pudo eliminar el reparto" };
  }
}

const PTU_EMPLOYEE_ROW_SELECT = `
  pe.id_ptu_distribution_employee, pe.id_ptu_distribution, pe.id_empleado, pe.id_sucursal, pe.origen, pe.editado,
  pe.dias, pe.salario, pe.salario_diario_tope, pe.categoria_ptu, pe.tipo_contrato,
  pe.elegible, pe.motivo, pe.salario_reparto, pe.ptu_dias, pe.ptu_salario, pe.ptu_bruto,
  pe.tope_tres_meses, pe.promedio_tres_anios, pe.anios_promedio, pe.ptu_final,
  e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo, s.nombre AS nombre_sucursal`;

/** El reparto, sus trabajadores y las últimas entradas de la bitácora. `data: null` si no existe o es de otra empresa. */
export async function getPtuDistributionDetail(rawId: unknown): Promise<ActionResult<IPtuDistributionDetail | null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionIdSchema.safeParse({ id_ptu_distribution: rawId });
  if (!parsed.success) return { ok: true, data: null };
  const { id_ptu_distribution } = parsed.data;

  try {
    const distributions = (await db.queryParams(
      `SELECT ${PTU_DISTRIBUTION_SELECT}
         FROM [CentroPodologico].[payroll].[ptu_distributions] d
        WHERE d.id_ptu_distribution = @id_ptu_distribution AND d.id_empresa = @id_empresa`,
      { id_ptu_distribution, id_empresa: access.data.id_empresa },
    )) as IPtuDistribution[];
    if (distributions.length === 0) return { ok: true, data: null };

    const [employeeRows, logRows] = await Promise.all([
      db.queryParams(
        `SELECT ${PTU_EMPLOYEE_ROW_SELECT}
           FROM [CentroPodologico].[payroll].[ptu_distribution_employees] pe
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
           JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = pe.id_sucursal
          WHERE pe.id_ptu_distribution = @id_ptu_distribution
          ORDER BY pe.elegible DESC, nombre_completo`,
        { id_ptu_distribution },
      ) as Promise<IPtuDistributionEmployee[]>,
      db.queryParams(
        `SELECT TOP (@limit) l.id_ptu_distribution_log, l.id_empleado, l.accion, l.campo,
                l.valor_anterior, l.valor_nuevo, ISNULL(u.nombre, '') AS changed_by_name,
                CONVERT(varchar(19), l.changed_at, 120) AS changed_at,
                ${EMPLOYEE_FULL_NAME_SQL} AS nombre_empleado
           FROM [CentroPodologico].[payroll].[ptu_distribution_log] l
           LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.changed_by
           LEFT JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = l.id_empleado
          WHERE l.id_ptu_distribution = @id_ptu_distribution
          ORDER BY l.changed_at DESC, l.id_ptu_distribution_log DESC`,
        { id_ptu_distribution, limit: PTU_LOG_ENTRIES_LIMIT },
      ) as Promise<IPtuDistributionLogEntry[]>,
    ]);

    return { ok: true, data: { distribution: distributions[0], employees: employeeRows, log: logRows } };
  } catch (error) {
    console.error("getPtuDistributionDetail", error);
    return { ok: false, message: "No se pudo cargar el reparto de PTU" };
  }
}

export interface IPtuPreloadSummary {
  added: number;
  updated: number;
}

/**
 * Trae los trabajadores del ejercicio desde la nómina fiscal ordinaria. Agrega a los que faltan y
 * actualiza solo las filas sin la marca `editado`; nunca borra. Es idempotente: repetirla sin que
 * cambie la nómina no modifica nada ni escribe en la bitácora.
 */
export async function preloadPtuDistribution(rawInput: unknown): Promise<ActionResult<IPtuPreloadSummary>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id_ptu_distribution } = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const preloadRows = await loadPtuPreloadRows(tx, access.data.id_empresa, distribution.ejercicio);
      const existingRows = (await tx.queryParams(
        `SELECT id_empleado, editado, dias, salario, salario_diario_tope
           FROM [CentroPodologico].[payroll].[ptu_distribution_employees] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_ptu_distribution = @id_ptu_distribution`,
        { id_ptu_distribution },
      )) as { id_empleado: number; editado: boolean; dias: number; salario: number; salario_diario_tope: number }[];
      const existingByEmployee = new Map(existingRows.map((row) => [row.id_empleado, row]));

      let added = 0;
      let updated = 0;
      for (const preload of preloadRows) {
        const existing = existingByEmployee.get(preload.id_empleado);
        if (!existing) {
          // Las derivadas son un marcador: el recálculo de abajo las reescribe en esta misma transacción.
          await tx.queryParams(
            `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_employees]
               ([id_ptu_distribution],[id_empleado],[id_sucursal],[origen],[dias],[salario],[salario_diario_tope],
                [categoria_ptu],[tipo_contrato],[elegible],[motivo],[ptu_final])
             VALUES
               (@id_ptu_distribution,@id_empleado,@id_sucursal,'P',@dias,@salario,@salario_diario_tope,
                @categoria_ptu,@tipo_contrato,0,'no_days',0)`,
            { ...preload, id_ptu_distribution },
          );
          added++;
          continue;
        }
        if (existing.editado) continue;
        const hasChanged =
          Number(existing.dias) !== preload.dias ||
          Math.round(Number(existing.salario) * 100) !== Math.round(preload.salario * 100) ||
          Math.round(Number(existing.salario_diario_tope) * 100) !== Math.round(preload.salario_diario_tope * 100);
        if (!hasChanged) continue;
        await tx.queryParams(
          `UPDATE [CentroPodologico].[payroll].[ptu_distribution_employees]
              SET [dias] = @dias, [salario] = @salario, [salario_diario_tope] = @salario_diario_tope
            WHERE [id_ptu_distribution] = @id_ptu_distribution AND [id_empleado] = @id_empleado`,
          {
            id_ptu_distribution,
            id_empleado: preload.id_empleado,
            dias: preload.dias,
            salario: preload.salario,
            salario_diario_tope: preload.salario_diario_tope,
          },
        );
        updated++;
      }

      // Se recalcula siempre: la categoría, el contrato o el historial pudieron cambiar desde la última vez.
      await recalculatePtuDistribution(tx, distribution);

      if (added > 0 || updated > 0) {
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_log]
             ([id_ptu_distribution],[id_empleado],[accion],[campo],[valor_anterior],[valor_nuevo],[changed_by],[changed_at])
           VALUES (@id_ptu_distribution, NULL, 'R', NULL, NULL, @valor_nuevo, @changed_by, @changed_at)`,
          {
            id_ptu_distribution,
            valor_nuevo: `Agregó ${added} y actualizó ${updated}`,
            changed_by: access.data.id_user,
            changed_at: buildDate(new Date()),
          },
        );
      }
      return { added, updated };
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    revalidatePath(PTU_PATH);
    revalidatePath(`${PTU_PATH}/${id_ptu_distribution}`);
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("preloadPtuDistribution", error);
    return { ok: false, message: "No se pudo precargar los trabajadores" };
  }
}

const EMPLOYEE_NOT_IN_DISTRIBUTION_MESSAGE = "El trabajador no está en el reparto";

async function writePtuLogEntry(
  tx: ITransactionClient,
  entry: {
    id_ptu_distribution: number;
    id_empleado: number | null;
    accion: PtuLogAction;
    campo?: string | null;
    valor_anterior?: string | null;
    valor_nuevo?: string | null;
    changed_by: number;
    changed_at: string;
  },
): Promise<void> {
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_log]
       ([id_ptu_distribution],[id_empleado],[accion],[campo],[valor_anterior],[valor_nuevo],[changed_by],[changed_at])
     VALUES (@id_ptu_distribution, @id_empleado, @accion, @campo, @valor_anterior, @valor_nuevo, @changed_by, @changed_at)`,
    { campo: null, valor_anterior: null, valor_nuevo: null, ...entry },
  );
}

/** Empleados que se pueden agregar a mano a un reparto en borrador (alcance de la spec 89). */
export async function getPtuAddableEmployees(rawInput: unknown): Promise<ActionResult<IPtuAddableEmployee[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const distribution = await db.transaction((tx) =>
      lockPtuDistribution(tx, parsed.data.id_ptu_distribution, access.data.id_empresa),
    );
    if (!distribution) return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    return { ok: true, data: await loadPtuAddableEmployees(db, distribution) };
  } catch (error) {
    console.error("getPtuAddableEmployees", error);
    return { ok: false, message: "No se pudo cargar la lista de empleados" };
  }
}

/** Entradas editables de una fila, con la etiqueta que se escribe en la bitácora (`campo`). */
const EDITABLE_EMPLOYEE_FIELDS = ["dias", "salario", "salario_diario_tope"] as const;

/** Edita días, salario y salario diario tope de un trabajador. Marca la fila `editado` y recalcula todo. */
export async function updatePtuDistributionEmployee(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = updatePtuDistributionEmployeeSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const currentRows = (await tx.queryParams(
        `SELECT dias, salario, salario_diario_tope
           FROM [CentroPodologico].[payroll].[ptu_distribution_employees] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_ptu_distribution = @id_ptu_distribution AND id_empleado = @id_empleado`,
        { id_ptu_distribution: input.id_ptu_distribution, id_empleado: input.id_empleado },
      )) as { dias: number; salario: number; salario_diario_tope: number }[];
      const current = currentRows[0];
      if (!current) return "employee_not_found" as const;

      const changedFields = EDITABLE_EMPLOYEE_FIELDS.filter(
        (field) => Math.round(Number(current[field]) * 100) !== Math.round(input[field] * 100),
      );
      if (changedFields.length === 0) return "unchanged" as const;

      await tx.queryParams(
        `UPDATE [CentroPodologico].[payroll].[ptu_distribution_employees]
            SET [dias] = @dias, [salario] = @salario, [salario_diario_tope] = @salario_diario_tope, [editado] = 1
          WHERE [id_ptu_distribution] = @id_ptu_distribution AND [id_empleado] = @id_empleado`,
        {
          id_ptu_distribution: input.id_ptu_distribution,
          id_empleado: input.id_empleado,
          dias: input.dias,
          salario: input.salario,
          salario_diario_tope: input.salario_diario_tope,
        },
      );
      await recalculatePtuDistribution(tx, distribution);

      const now = buildDate(new Date());
      for (const field of changedFields) {
        await writePtuLogEntry(tx, {
          id_ptu_distribution: input.id_ptu_distribution,
          id_empleado: input.id_empleado,
          accion: "E",
          campo: field,
          valor_anterior: String(Number(current[field])),
          valor_nuevo: String(input[field]),
          changed_by: access.data.id_user,
          changed_at: now,
        });
      }
      return "updated" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "employee_not_found") return { ok: false, message: EMPLOYEE_NOT_IN_DISTRIBUTION_MESSAGE };
    if (outcome === "updated") revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    return { ok: true, data: null };
  } catch (error) {
    console.error("updatePtuDistributionEmployee", error);
    return { ok: false, message: "No se pudo guardar la fila del trabajador" };
  }
}

/** Agrega a mano a un trabajador sin snapshots en el ejercicio (por ejemplo, anterior al sistema). Entra en ceros. */
export async function addPtuDistributionEmployee(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionEmployeeSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      // Misma regla que la lista del modal: no se confía en lo que mande el cliente.
      const [employee] = await loadPtuAddableEmployees(tx, distribution, input.id_empleado);
      if (!employee) return "not_addable" as const;

      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_employees]
           ([id_ptu_distribution],[id_empleado],[id_sucursal],[origen],[dias],[salario],[salario_diario_tope],
            [categoria_ptu],[tipo_contrato],[elegible],[motivo],[ptu_final])
         VALUES
           (@id_ptu_distribution,@id_empleado,@id_sucursal,'M',0,0,@salario_diario_tope,
            @categoria_ptu,@tipo_contrato,0,'no_days',0)`,
        {
          id_ptu_distribution: input.id_ptu_distribution,
          id_empleado: employee.id_empleado,
          id_sucursal: employee.id_sucursal,
          salario_diario_tope: employee.salario_diario_fiscal ?? 0,
          categoria_ptu: employee.categoria_ptu,
          tipo_contrato: employee.tipo_contrato,
        },
      );
      await recalculatePtuDistribution(tx, distribution);
      await writePtuLogEntry(tx, {
        id_ptu_distribution: input.id_ptu_distribution,
        id_empleado: employee.id_empleado,
        accion: "A",
        changed_by: access.data.id_user,
        changed_at: buildDate(new Date()),
      });
      return "added" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "not_addable") {
      return { ok: false, message: "El empleado no se puede agregar: ya está en el reparto o no trabajó en el ejercicio" };
    }
    revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    return { ok: true, data: null };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, message: "El trabajador ya está en el reparto" };
    console.error("addPtuDistributionEmployee", error);
    return { ok: false, message: "No se pudo agregar al trabajador" };
  }
}

/** Quita a un trabajador agregado a mano. Uno precargado volvería con la siguiente precarga: se pone en 0 días. */
export async function removePtuDistributionEmployee(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionEmployeeSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const rows = (await tx.queryParams(
        `SELECT origen
           FROM [CentroPodologico].[payroll].[ptu_distribution_employees] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_ptu_distribution = @id_ptu_distribution AND id_empleado = @id_empleado`,
        { id_ptu_distribution: input.id_ptu_distribution, id_empleado: input.id_empleado },
      )) as { origen: PtuEmployeeOrigin }[];
      if (rows.length === 0) return "employee_not_found" as const;
      if (rows[0].origen !== "M") return "preloaded" as const;

      await tx.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[ptu_distribution_employees]
          WHERE [id_ptu_distribution] = @id_ptu_distribution AND [id_empleado] = @id_empleado`,
        { id_ptu_distribution: input.id_ptu_distribution, id_empleado: input.id_empleado },
      );
      await recalculatePtuDistribution(tx, distribution);
      await writePtuLogEntry(tx, {
        id_ptu_distribution: input.id_ptu_distribution,
        id_empleado: input.id_empleado,
        accion: "Q",
        changed_by: access.data.id_user,
        changed_at: buildDate(new Date()),
      });
      return "removed" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "employee_not_found") return { ok: false, message: EMPLOYEE_NOT_IN_DISTRIBUTION_MESSAGE };
    if (outcome === "preloaded") {
      return { ok: false, message: "Solo se pueden quitar los trabajadores agregados a mano. Para sacar a otro, pon sus días en 0" };
    }
    revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    return { ok: true, data: null };
  } catch (error) {
    console.error("removePtuDistributionEmployee", error);
    return { ok: false, message: "No se pudo quitar al trabajador" };
  }
}

/** Los tres ejercicios anteriores de un trabajador del reparto, con el origen de cada importe. */
export async function getPtuHistory(rawInput: unknown): Promise<ActionResult<IPtuHistoryYear[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionEmployeeSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      const members = await tx.queryParams(
        `SELECT 1 AS found FROM [CentroPodologico].[payroll].[ptu_distribution_employees]
          WHERE id_ptu_distribution = @id_ptu_distribution AND id_empleado = @id_empleado`,
        { id_ptu_distribution: input.id_ptu_distribution, id_empleado: input.id_empleado },
      );
      if (members.length === 0) return "employee_not_found" as const;
      return loadPtuHistoryYears(tx, distribution, input.id_empleado);
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "employee_not_found") return { ok: false, message: EMPLOYEE_NOT_IN_DISTRIBUTION_MESSAGE };
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("getPtuHistory", error);
    return { ok: false, message: "No se pudo cargar el historial de PTU" };
  }
}

/**
 * Crea, edita o borra (`importe: null`) la PTU capturada a mano de un ejercicio anterior y recalcula el
 * reparto. Un año con reparto cerrado de la empresa no se captura: ahí manda el reparto.
 */
export async function savePtuHistory(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = savePtuHistorySchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const members = await tx.queryParams(
        `SELECT 1 AS found FROM [CentroPodologico].[payroll].[ptu_distribution_employees] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_ptu_distribution = @id_ptu_distribution AND id_empleado = @id_empleado`,
        { id_ptu_distribution: input.id_ptu_distribution, id_empleado: input.id_empleado },
      );
      if (members.length === 0) return "employee_not_found" as const;

      if (!getPtuAverageYears(distribution.ejercicio).includes(input.ejercicio)) return "year_out_of_range" as const;
      const closedYears = await loadPtuClosedDistributionYears(tx, distribution);
      if (closedYears.has(input.ejercicio)) return "year_from_distribution" as const;

      const existingRows = (await tx.queryParams(
        `SELECT importe FROM [CentroPodologico].[payroll].[ptu_history] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_empleado = @id_empleado AND ejercicio = @ejercicio`,
        { id_empleado: input.id_empleado, ejercicio: input.ejercicio },
      )) as { importe: number }[];
      const existingAmount = existingRows.length > 0 ? Number(existingRows[0].importe) : null;

      const isSameAmount =
        existingAmount === null || input.importe === null
          ? existingAmount === input.importe
          : Math.round(existingAmount * 100) === Math.round(input.importe * 100);
      if (isSameAmount) return "unchanged" as const;

      const now = buildDate(new Date());
      if (input.importe === null) {
        await tx.queryParams(
          `DELETE FROM [CentroPodologico].[payroll].[ptu_history] WHERE [id_empleado] = @id_empleado AND [ejercicio] = @ejercicio`,
          { id_empleado: input.id_empleado, ejercicio: input.ejercicio },
        );
      } else if (existingAmount === null) {
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[ptu_history] ([id_empleado],[ejercicio],[importe],[captured_by],[captured_at])
           VALUES (@id_empleado, @ejercicio, @importe, @captured_by, @captured_at)`,
          { id_empleado: input.id_empleado, ejercicio: input.ejercicio, importe: input.importe, captured_by: access.data.id_user, captured_at: now },
        );
      } else {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[payroll].[ptu_history]
              SET [importe] = @importe, [captured_by] = @captured_by, [captured_at] = @captured_at
            WHERE [id_empleado] = @id_empleado AND [ejercicio] = @ejercicio`,
          { id_empleado: input.id_empleado, ejercicio: input.ejercicio, importe: input.importe, captured_by: access.data.id_user, captured_at: now },
        );
      }

      await recalculatePtuDistribution(tx, distribution);
      await writePtuLogEntry(tx, {
        id_ptu_distribution: input.id_ptu_distribution,
        id_empleado: input.id_empleado,
        accion: "H",
        campo: `ptu_ejercicio_${input.ejercicio}`,
        valor_anterior: existingAmount === null ? null : String(existingAmount),
        valor_nuevo: input.importe === null ? null : String(input.importe),
        changed_by: access.data.id_user,
        changed_at: now,
      });
      return "saved" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "employee_not_found") return { ok: false, message: EMPLOYEE_NOT_IN_DISTRIBUTION_MESSAGE };
    if (outcome === "year_out_of_range") {
      return { ok: false, message: "Solo se captura la PTU de los tres ejercicios anteriores al del reparto" };
    }
    if (outcome === "year_from_distribution") {
      return { ok: false, message: `El ejercicio ${input.ejercicio} ya tiene un reparto cerrado: se usa su PTU y no se captura a mano` };
    }
    if (outcome === "saved") revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    return { ok: true, data: null };
  } catch (error) {
    console.error("savePtuHistory", error);
    return { ok: false, message: "No se pudo guardar la PTU del ejercicio anterior" };
  }
}

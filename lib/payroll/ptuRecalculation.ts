import "server-only";

import type { ITransactionClient } from "@/database/connection";
import type {
  IPtuCalculationRow,
  IPtuDistribution,
  PtuCategory,
} from "@/interfaces/payroll_ptu";
import { calculatePtuDistribution } from "@/lib/payroll/ptuDistribution";
import { loadPtuHistoryByEmployee, PTU_DISTRIBUTION_SELECT } from "@/lib/payroll/ptuDistributionSql";
import { buildDate } from "@/utils/date_helpper";

/**
 * Lee el reparto de la empresa con bloqueo de actualización hasta el fin de la transacción, de modo
 * que dos escrituras simultáneas del mismo reparto se serialicen. Null si no existe o es de otra empresa.
 */
export async function lockPtuDistribution(
  client: ITransactionClient,
  id_ptu_distribution: number,
  id_empresa: number,
): Promise<IPtuDistribution | null> {
  const rows = (await client.queryParams(
    `SELECT ${PTU_DISTRIBUTION_SELECT}
       FROM [CentroPodologico].[payroll].[ptu_distributions] d WITH (UPDLOCK, HOLDLOCK)
      WHERE d.id_ptu_distribution = @id_ptu_distribution AND d.id_empresa = @id_empresa`,
    { id_ptu_distribution, id_empresa },
  )) as IPtuDistribution[];
  return rows[0] ?? null;
}

interface IStoredEmployeeRow {
  id_empleado: number;
  dias: number;
  salario: number;
  salario_diario_tope: number;
  categoria_ptu: PtuCategory;
  tipo_contrato: string | null;
  id_sucursal: number;
}

/**
 * Recalcula todo el reparto en la transacción de la acción que lo invoca: vuelve a leer la categoría,
 * el contrato y la sucursal actuales de cada empleado, corre el cálculo puro y escribe todas las
 * derivadas. Es el único cálculo; no hay espejo en SQL. `distribution` trae los parámetros ya vigentes.
 */
export async function recalculatePtuDistribution(
  client: ITransactionClient,
  distribution: Pick<
    IPtuDistribution,
    "id_ptu_distribution" | "id_empresa" | "ejercicio" | "renta_gravable" | "ptu_no_cobrada_anterior" | "factor_tres_meses"
  >,
): Promise<void> {
  const storedRows = (await client.queryParams(
    `SELECT pe.id_empleado, pe.dias, pe.salario, pe.salario_diario_tope,
            emp.categoria_ptu, emp.tipo_contrato, emp.id_sucursal
       FROM [CentroPodologico].[payroll].[ptu_distribution_employees] pe WITH (UPDLOCK, HOLDLOCK)
       JOIN [CentroPodologico].[RH].[empleados] emp ON emp.id_empleado = pe.id_empleado
      WHERE pe.id_ptu_distribution = @id_ptu_distribution
      ORDER BY pe.id_ptu_distribution_employee`,
    { id_ptu_distribution: distribution.id_ptu_distribution },
  )) as IStoredEmployeeRow[];

  const calculationRows: IPtuCalculationRow[] = storedRows.map((row) => ({
    id_empleado: row.id_empleado,
    dias: Number(row.dias),
    salario: Number(row.salario),
    salario_diario_tope: Number(row.salario_diario_tope),
    categoria_ptu: row.categoria_ptu,
    tipo_contrato: row.tipo_contrato,
  }));

  const history = await loadPtuHistoryByEmployee(client, distribution);
  const yearlyAmountsByEmployee = new Map<number, number[]>(
    [...history].map(([id_empleado, entries]) => [id_empleado, entries.map((entry) => entry.importe)]),
  );

  const { totals, rows } = calculatePtuDistribution(
    {
      renta_gravable: Number(distribution.renta_gravable),
      ptu_no_cobrada_anterior: Number(distribution.ptu_no_cobrada_anterior),
      factor_tres_meses: distribution.factor_tres_meses,
    },
    calculationRows,
    yearlyAmountsByEmployee,
  );

  for (const [index, calculated] of rows.entries()) {
    const stored = storedRows[index];
    await client.queryParams(
      `UPDATE [CentroPodologico].[payroll].[ptu_distribution_employees]
          SET [id_sucursal] = @id_sucursal, [categoria_ptu] = @categoria_ptu, [tipo_contrato] = @tipo_contrato,
              [elegible] = @elegible, [motivo] = @motivo, [salario_reparto] = @salario_reparto,
              [ptu_dias] = @ptu_dias, [ptu_salario] = @ptu_salario, [ptu_bruto] = @ptu_bruto,
              [tope_tres_meses] = @tope_tres_meses, [promedio_tres_anios] = @promedio_tres_anios,
              [anios_promedio] = @anios_promedio, [ptu_final] = @ptu_final
        WHERE [id_ptu_distribution] = @id_ptu_distribution AND [id_empleado] = @id_empleado`,
      {
        id_ptu_distribution: distribution.id_ptu_distribution,
        id_empleado: calculated.id_empleado,
        id_sucursal: stored.id_sucursal,
        categoria_ptu: stored.categoria_ptu,
        tipo_contrato: stored.tipo_contrato,
        elegible: calculated.elegible,
        motivo: calculated.motivo,
        salario_reparto: calculated.salario_reparto,
        ptu_dias: calculated.ptu_dias,
        ptu_salario: calculated.ptu_salario,
        ptu_bruto: calculated.ptu_bruto,
        tope_tres_meses: calculated.tope_tres_meses,
        promedio_tres_anios: calculated.promedio_tres_anios,
        anios_promedio: calculated.anios_promedio,
        ptu_final: calculated.ptu_final,
      },
    );
  }

  await client.queryParams(
    `UPDATE [CentroPodologico].[payroll].[ptu_distributions]
        SET [fondo] = @fondo, [mitad_dias] = @mitad_dias, [mitad_salario] = @mitad_salario,
            [total_dias] = @total_dias, [total_salario_reparto] = @total_salario_reparto,
            [tope_salario_diario_confianza] = @tope_salario_diario_confianza,
            [total_repartido] = @total_repartido, [remanente_topes] = @remanente_topes,
            [remanente_redondeo] = @remanente_redondeo, [updated_at] = @updated_at
      WHERE [id_ptu_distribution] = @id_ptu_distribution`,
    { ...totals, id_ptu_distribution: distribution.id_ptu_distribution, updated_at: buildDate(new Date()) },
  );
}

// Candado y requisitos previos de la semilla de la Empresa Demo (spec 93).
// Nunca importa módulos "server-only": corre fuera de Next, con tsx.
import db from "@/database/connection";
import type { TaxParameterKey, ITaxParameter } from "@/interfaces/payroll_tax_parameters";
import { resolveTaxParameterRow } from "@/lib/payroll/taxParameters";
import { addZeroToday } from "@/utils/date_helpper";

export interface IDemoPrerequisite {
  label: string;
  present: boolean;
}

/** Lanza si falta DEMO_USER_PASSWORD. La misma contraseña sirve para sembrar y para capturar. */
export function assertDemoUserPasswordConfigured(): string {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) {
    throw new Error("Falta la variable de entorno DEMO_USER_PASSWORD.");
  }
  return password;
}

/** Lanza si ALLOW_DEMO_SEED no vale "true". No depende de la confirmación escrita. */
export function assertDemoSeedAllowed(): void {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error('ALLOW_DEMO_SEED no está en "true". La semilla de la Empresa Demo no corre.');
  }
}

/** true solo si la confirmación escrita es exactamente "demo". */
export function isDemoSeedConfirmed(confirmation: string): boolean {
  return confirmation.trim() === "demo";
}

type TaxParameterRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;

/**
 * Revisa, para `year`, que la base tenga UMA diaria, salario mínimo general, tarifa ISR
 * semanal, tarifa ISR mensual y subsidio para el empleo. La UMA, el salario mínimo y el
 * subsidio se resuelven como lo hace la nómina real: la fila vigente más reciente con
 * `vigente_desde <= hoy` (`resolveTaxParameterRow`). Las tarifas de retención se buscan por
 * `ejercicio = year` exacto, como las resuelve `calculatePayrollPeriod`.
 */
export async function checkDemoPrerequisites(year: number): Promise<IDemoPrerequisite[]> {
  const today = addZeroToday(new Date());

  const parameterRows = (await db.queryParams(
    `SELECT [clave], [valor], CONVERT(varchar(10), [vigente_desde], 120) AS [vigente_desde]
       FROM [CentroPodologico].[payroll].[tax_parameters]`,
    {},
  )) as TaxParameterRow[];

  const hasParameter = (key: TaxParameterKey): boolean =>
    resolveTaxParameterRow(parameterRows, key, today) !== null;

  const hasTariff = async (claveSat: string): Promise<boolean> => {
    const rows = await db.queryParams(
      `SELECT TOP 1 1 AS found
         FROM [CentroPodologico].[payroll].[tablas_retencion] tr
         JOIN [CentroPodologico].[RH].[payment_periods] pp
           ON pp.[id_payment_period] = tr.[id_payment_period]
        WHERE tr.[ejercicio] = @year AND pp.[clave_sat] = @claveSat`,
      { year, claveSat },
    );
    return rows.length > 0;
  };

  return [
    { label: `UMA diaria ${year}`, present: hasParameter("UMA_DIARIA") },
    { label: `Salario mínimo general ${year}`, present: hasParameter("SALARIO_MINIMO_GENERAL") },
    { label: `Tarifa ISR semanal ${year}`, present: await hasTariff("02") },
    { label: `Tarifa ISR mensual ${year}`, present: await hasTariff("05") },
    {
      label: `Subsidio para el empleo ${year}`,
      present:
        hasParameter("SUBSIDIO_MONTO_MENSUAL") &&
        hasParameter("SUBSIDIO_TOPE_INGRESO_MENSUAL") &&
        hasParameter("SUBSIDIO_FACTOR_DIAS_MES"),
    },
  ];
}

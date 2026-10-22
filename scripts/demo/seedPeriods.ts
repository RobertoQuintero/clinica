// Siembra de periodos y PTU en borrador de la Empresa Demo (spec 93, paso 4 del plan): un periodo
// semanal por cada semana del año en curso hasta la actual (todas "Programada"/status 1), el
// periodo de aguinaldo del año y el reparto de PTU del año en borrador. Nada se calcula aquí: eso
// llega en el paso 6 (Fase de preparación). Corre dentro del mismo `db.transaction` que
// `seedOrganization` y `seedPayrollInputs`.
import type { ITransactionClient } from "@/database/connection";
import { EXTRAORDINARY_PERIOD_CODE_LETTER, EXTRAORDINARY_PERIOD_SAT_KEY } from "@/lib/payroll/constants";
import { buildPeriodCode, suggestPeriodDates } from "@/lib/payroll/periodDates";
import { calculatePtuDistribution } from "@/lib/payroll/ptuDistribution";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { DEMO_PAYMENT_PERIOD_ID_WEEKLY } from "./constants";
import type { ISeededDemoOrganization } from "./seedOrganization";

const WEEKLY_SAT_KEY = "02";

export interface ISeededDemoPeriods {
  weeklyPeriodIds: number[];
  aguinaldoPeriodId: number;
  ptuDistributionId: number;
}

async function fetchPaymentPeriodId(tx: ITransactionClient, claveSat: string): Promise<number> {
  const rows = (await tx.queryParams(
    `SELECT [id_payment_period] FROM [CentroPodologico].[RH].[payment_periods] WHERE [clave_sat] = @claveSat`,
    { claveSat },
  )) as { id_payment_period: number }[];
  return rows[0].id_payment_period;
}

async function insertPeriod(
  tx: ITransactionClient,
  params: {
    id_sucursal: number;
    id_payment_period: number;
    codigo: string;
    ejercicio: number;
    consecutivo: number;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_corte: string;
    fecha_pago: string;
    created_by: number;
    tipo_periodo?: "E";
    concepto_extraordinario?: "A";
  },
): Promise<number> {
  const columns = [
    "id_sucursal", "id_payment_period", "codigo", "ejercicio", "consecutivo",
    "fecha_inicio", "fecha_fin", "fecha_corte", "fecha_pago", "status", "created_by", "created_at",
  ];
  const values = [
    "@id_sucursal", "@id_payment_period", "@codigo", "@ejercicio", "@consecutivo",
    "CAST(@fecha_inicio AS date)", "CAST(@fecha_fin AS date)", "CAST(@fecha_corte AS date)", "CAST(@fecha_pago AS date)",
    "1", "@created_by", "CAST(@created_at AS datetime2(0))",
  ];
  if (params.tipo_periodo) {
    columns.push("tipo_periodo", "concepto_extraordinario");
    values.push("@tipo_periodo", "@concepto_extraordinario");
  }

  const rows = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[periods] (${columns.map((c) => `[${c}]`).join(", ")})
     OUTPUT INSERTED.[id_period]
     VALUES (${values.join(", ")})`,
    { ...params, created_at: buildDate(new Date()) },
  )) as { id_period: number }[];
  return rows[0].id_period;
}

/** Una semana (lunes-domingo) por `id_payment_period` semanal, desde la primera del año hasta la actual. */
async function seedWeeklyPeriods(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  today: string,
  currentYear: number,
): Promise<number[]> {
  const periodIds: number[] = [];
  const consecutivoByYear = new Map<number, number>();

  let dates = suggestPeriodDates(WEEKLY_SAT_KEY, null, `${currentYear}-01-01`);
  for (;;) {
    const ejercicio = Number(dates.fecha_inicio.slice(0, 4));
    const consecutivo = (consecutivoByYear.get(ejercicio) ?? 0) + 1;
    consecutivoByYear.set(ejercicio, consecutivo);

    const id_period = await insertPeriod(tx, {
      id_sucursal: context.id_sucursal,
      id_payment_period: DEMO_PAYMENT_PERIOD_ID_WEEKLY,
      codigo: buildPeriodCode(ejercicio, WEEKLY_SAT_KEY, consecutivo),
      ejercicio,
      consecutivo,
      fecha_inicio: dates.fecha_inicio,
      fecha_fin: dates.fecha_fin,
      fecha_corte: dates.fecha_corte,
      fecha_pago: dates.fecha_pago,
      created_by: context.id_user_demo,
    });
    periodIds.push(id_period);

    if (dates.fecha_fin >= today) break; // semana en curso: última a crear
    dates = suggestPeriodDates(WEEKLY_SAT_KEY, dates.fecha_fin, today);
  }
  return periodIds;
}

/** El aguinaldo del año en curso, único periodo extraordinario de esta empresa demo (consecutivo 1). */
async function seedAguinaldoPeriod(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  currentYear: number,
): Promise<number> {
  const idExtraordinaryPaymentPeriod = await fetchPaymentPeriodId(tx, EXTRAORDINARY_PERIOD_SAT_KEY);
  return insertPeriod(tx, {
    id_sucursal: context.id_sucursal,
    id_payment_period: idExtraordinaryPaymentPeriod,
    codigo: `NOM-${currentYear}-${EXTRAORDINARY_PERIOD_CODE_LETTER}01`,
    ejercicio: currentYear,
    consecutivo: 1,
    fecha_inicio: `${currentYear}-01-01`,
    fecha_fin: `${currentYear}-12-31`,
    fecha_corte: `${currentYear}-12-20`,
    fecha_pago: `${currentYear}-12-20`,
    created_by: context.id_user_demo,
    tipo_periodo: "E",
    concepto_extraordinario: "A",
  });
}

/** Reparto de PTU del año en borrador, sin precargar (llega en el paso 6): solo fondo y mitades. */
async function seedPtuDistribution(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  currentYear: number,
): Promise<number> {
  const parameters = { renta_gravable: 200000, ptu_no_cobrada_anterior: 0, factor_tres_meses: 91.25 as const };
  const { totals } = calculatePtuDistribution(parameters, [], new Map());
  const now = buildDate(new Date());

  const rows = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[ptu_distributions]
       ([id_empresa], [ejercicio], [tipo_persona], [renta_gravable], [ptu_no_cobrada_anterior], [factor_tres_meses],
        [fondo], [mitad_dias], [mitad_salario], [total_dias], [total_salario_reparto], [tope_salario_diario_confianza],
        [total_repartido], [remanente_topes], [remanente_redondeo], [created_by], [created_at], [updated_at])
     OUTPUT INSERTED.[id_ptu_distribution]
     VALUES
       (@id_empresa, @ejercicio, 'M', @renta_gravable, @ptu_no_cobrada_anterior, @factor_tres_meses,
        @fondo, @mitad_dias, @mitad_salario, @total_dias, @total_salario_reparto, @tope_salario_diario_confianza,
        @total_repartido, @remanente_topes, @remanente_redondeo, @created_by, @created_at, @updated_at)`,
    {
      ...totals,
      id_empresa: context.id_empresa,
      ejercicio: currentYear,
      ...parameters,
      created_by: context.id_user_demo,
      created_at: now,
      updated_at: now,
    },
  )) as { id_ptu_distribution: number }[];
  return rows[0].id_ptu_distribution;
}

export async function seedPeriods(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
): Promise<ISeededDemoPeriods> {
  const today = addZeroToday(new Date());
  const currentYear = Number(today.slice(0, 4));

  const weeklyPeriodIds = await seedWeeklyPeriods(tx, context, today, currentYear);
  const aguinaldoPeriodId = await seedAguinaldoPeriod(tx, context, currentYear);
  const ptuDistributionId = await seedPtuDistribution(tx, context, currentYear);

  return { weeklyPeriodIds, aguinaldoPeriodId, ptuDistributionId };
}

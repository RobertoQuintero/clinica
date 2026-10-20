import db from "@/database/connection";
import { assertPayrollAccess } from "@/lib/payroll/access";
import { getChristmasBonusDeadlineState } from "@/lib/payroll/christmasBonusDeadline";
import { addZeroToday } from "@/utils/date_helpper";
import ChristmasBonusDeadlineBanner from "./ChristmasBonusDeadlineBanner";

/**
 * Aviso del 20 de diciembre (spec 87) para Periodos y Procesar: del 1-dic en adelante, mientras la sucursal no haya
 * creado el periodo extraordinario del año. Crearlo (no calcularlo) lo quita. Lee la sucursal de la sesión del servidor.
 */
export default async function ChristmasBonusDeadlineNotice() {
  const today = addZeroToday(new Date());
  // Antes del 1-dic no hay aviso en ningún caso: se evita la consulta.
  if (getChristmasBonusDeadlineState(today, false) === "none") return null;

  const access = await assertPayrollAccess();
  if (!access.ok) return null;

  const year = Number(today.slice(0, 4));
  let hasExtraordinaryPeriod: boolean;
  try {
    const rows = await db.queryParams(
      `SELECT TOP 1 1 AS has_period
         FROM [CentroPodologico].[payroll].[periods]
        WHERE id_sucursal = @id_sucursal AND ejercicio = @ejercicio AND tipo_periodo = 'E' AND concepto_extraordinario = 'A'`,
      { id_sucursal: access.data.id_sucursal, ejercicio: year },
    );
    hasExtraordinaryPeriod = rows.length > 0;
  } catch (error) {
    console.error("ChristmasBonusDeadlineNotice", error);
    return null;
  }

  return (
    <ChristmasBonusDeadlineBanner state={getChristmasBonusDeadlineState(today, hasExtraordinaryPeriod)} year={year} />
  );
}

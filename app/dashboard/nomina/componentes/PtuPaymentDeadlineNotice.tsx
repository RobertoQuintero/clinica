import db from "@/database/connection";
import { assertPayrollAccess } from "@/lib/payroll/access";
import { formatLongDayMonth } from "@/lib/payroll/periodFormat";
import { getPtuPaymentDeadline, getPtuPaymentDeadlineState } from "@/lib/payroll/ptuPaymentDeadline";
import { loadBranchCompanyId, loadPtuPaymentSource } from "@/lib/payroll/ptuPaymentSource";
import { addZeroToday } from "@/utils/date_helpper";
import PayrollDeadlineBanner from "./PayrollDeadlineBanner";

/**
 * Aviso de la fecha límite de la PTU (spec 90) para Periodos y Procesar: ámbar desde 30 días antes y rojo desde el día
 * siguiente a la fecha límite, mientras la sucursal no haya creado su periodo PTU del año. Solo aparece si la empresa
 * tiene cerrado el reparto del año anterior y la sucursal tiene filas con `ptu_final > 0`: una empresa sin reparto
 * cerrado (por ejemplo, sin utilidades) no ve un aviso que nunca podría quitar. Crear el periodo (no calcularlo) lo quita.
 */
export default async function PtuPaymentDeadlineNotice() {
  const today = addZeroToday(new Date());
  const paymentYear = Number(today.slice(0, 4));

  // Antes de la ventana más temprana (persona moral) no hay aviso en ningún caso: se evita la consulta.
  if (getPtuPaymentDeadlineState(today, getPtuPaymentDeadline(paymentYear, "M"), false) === "none") return null;

  const access = await assertPayrollAccess();
  if (!access.ok) return null;
  const { id_sucursal } = access.data;

  let notice: { deadline: string; hasPtuPeriod: boolean };
  try {
    const idEmpresa = await loadBranchCompanyId(id_sucursal);
    if (idEmpresa === null) return null;

    const source = await loadPtuPaymentSource(idEmpresa, id_sucursal, paymentYear);
    if (!source.distribution || source.payableRowCount === 0) return null;

    const periodRows = await db.queryParams(
      `SELECT TOP 1 1 AS has_period
         FROM [CentroPodologico].[payroll].[periods]
        WHERE id_sucursal = @id_sucursal AND ejercicio = @ejercicio AND tipo_periodo = 'E' AND concepto_extraordinario = 'P'`,
      { id_sucursal, ejercicio: paymentYear },
    );
    notice = {
      deadline: getPtuPaymentDeadline(paymentYear, source.distribution.tipo_persona),
      hasPtuPeriod: periodRows.length > 0,
    };
  } catch (error) {
    console.error("PtuPaymentDeadlineNotice", error);
    return null;
  }

  const deadlineText = formatLongDayMonth(notice.deadline);
  return (
    <PayrollDeadlineBanner
      state={getPtuPaymentDeadlineState(today, notice.deadline, notice.hasPtuPeriod)}
      label={`PTU ${paymentYear - 1}`}
      headlines={{
        upcoming: `PTU ${paymentYear - 1}: debe pagarse a más tardar el ${deadlineText}`,
        overdue: `PTU ${paymentYear - 1}: venció el ${deadlineText}`,
      }}
      message="Esta sucursal aún no tiene su nómina de PTU."
    />
  );
}

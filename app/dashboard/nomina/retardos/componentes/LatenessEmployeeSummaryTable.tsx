import type { ILatenessEmployeeSummary } from "@/interfaces/payroll_lateness";

interface Props {
  employeeSummaries: ILatenessEmployeeSummary[];
}

/** Resumen por empleado del periodo completo: no cambia con los filtros. Los días son un estimado antes del tope. */
export default function LatenessEmployeeSummaryTable({ employeeSummaries }: Props) {
  if (employeeSummaries.length === 0) return null;

  return (
    <section
      aria-label="Resumen de retardos por empleado"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Retardos injustificados y días estimados a descontar por empleado</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Graves</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Acumulables</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Días a descontar (estimado)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {employeeSummaries.map((employeeSummary) => (
              <tr key={employeeSummary.id_empleado} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                  {employeeSummary.nombre_completo}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                  {employeeSummary.severeCount}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                  {employeeSummary.accumulableCount}
                </td>
                <td className="px-6 py-3 text-sm text-right tabular-nums font-semibold text-[#0b1c30] dark:text-zinc-100">
                  {employeeSummary.estimatedDays}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-6 py-3 border-t border-[#c4c6d0] dark:border-zinc-700 text-xs text-[#44474f] dark:text-zinc-400">
        Solo cuentan los retardos injustificados que ningún otro periodo descontó. Al calcular, el descuento nunca pasa
        de los días pagados.
      </p>
    </section>
  );
}

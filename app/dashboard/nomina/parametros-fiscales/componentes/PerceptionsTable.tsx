import { Info } from "lucide-react";
import type { IPerception } from "@/interfaces/payroll_tax_parameters";
import { formatExemptionLimit } from "@/lib/payroll/taxParametersFormat";
import PayrollEmptyState from "../../componentes/PayrollEmptyState";
import { EditPerceptionButton } from "./PerceptionModal";

interface Props {
  perceptions: IPerception[];
}

/** Spec 73: la nómina fiscal lee estas reglas al calcular, y el renglón guarda la que usó. */
function TaxRulesNotice() {
  return (
    <p className="flex gap-2 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-3 py-2 text-sm text-[#44474f] dark:text-zinc-300">
      <Info size={16} className="shrink-0 mt-0.5" aria-hidden />
      La nómina fiscal usa estas reglas al calcular. Un cambio solo aplica a los periodos que se recalculen.
    </p>
  );
}

export default function PerceptionsTable({ perceptions }: Props) {
  if (perceptions.length === 0) {
    return (
      <>
        <TaxRulesNotice />
        <PayrollEmptyState
          title="Sin percepciones en el catálogo"
          description="Las percepciones SAT y su tope de exención aparecen aquí cuando se dan de alta."
        />
      </>
    );
  }

  return (
    <>
      <TaxRulesNotice />
      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Clave SAT</th>
                <th className="px-6 py-4 font-semibold">Percepción</th>
                <th className="px-6 py-4 font-semibold">Tope de exención</th>
                <th className="px-6 py-4 font-semibold">Estatus</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
              {perceptions.map((perception) => (
                <tr key={perception.id_perception} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 tabular-nums whitespace-nowrap text-[#44474f] dark:text-zinc-400">
                    {perception.clave_sat}
                  </td>
                  <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100">{perception.description}</td>
                  <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{formatExemptionLimit(perception)}</td>
                  <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
                    {perception.status ? "Activa" : "Inactiva"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <EditPerceptionButton perception={perception} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

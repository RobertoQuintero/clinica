import { ChevronRight } from "lucide-react";
import { getPtuDistributions } from "./actions";
import { NewPtuDistributionButton } from "./componentes/PtuDistributionActions";
import PtuDistributionsTable from "./componentes/PtuDistributionsTable";

export default async function PtuNominaPage() {
  const result = await getPtuDistributions();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">PTU</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">Reparto de PTU</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Participación de los trabajadores en las utilidades, por ejercicio. Cubre a toda la empresa, sin importar la sucursal.
          </p>
        </div>
        <NewPtuDistributionButton />
      </div>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : (
        <PtuDistributionsTable distributions={result.data} />
      )}
    </div>
  );
}

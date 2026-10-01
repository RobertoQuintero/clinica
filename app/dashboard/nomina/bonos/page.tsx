import { ChevronRight } from "lucide-react";
import { readBonusKind } from "@/lib/payroll/bonusUrls";
import { readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import PayrollEmptyState from "../componentes/PayrollEmptyState";
import BonusKindTabs from "./componentes/BonusKindTabs";
import PunctualityBonusView from "./componentes/PunctualityBonusView";

/** Filtros que conservan las pestañas al cambiar de bono; `pagina` se reinicia. */
const TAB_PRESERVED_PARAM_KEYS = ["periodo", "resultado", "q"];

export default async function BonusesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;
  const bonusKind = readBonusKind(readSingleParam(rawSearchParams, "bono"));

  const preservedSearchParams: Record<string, string> = {};
  for (const key of TAB_PRESERVED_PARAM_KEYS) {
    const value = readSingleParam(rawSearchParams, key);
    if (value) preservedSearchParams[key] = value;
  }

  const kindTabs = <BonusKindTabs activeKind={bonusKind} preservedSearchParams={preservedSearchParams} />;

  if (bonusKind === "attendance") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Bonos</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">Bonos de asistencia</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Los podólogos que estuvieron el periodo completo cobran el bono si no tienen ninguna falta injustificada.
          </p>
        </div>
        {kindTabs}
        <PayrollEmptyState title="Próximamente" description="El bono de asistencia aún no está disponible." />
      </div>
    );
  }

  return <PunctualityBonusView rawSearchParams={rawSearchParams} kindTabs={kindTabs} />;
}

import { readBonusKind } from "@/lib/payroll/bonusUrls";
import { readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import AttendanceBonusView from "./componentes/AttendanceBonusView";
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

  return bonusKind === "attendance" ? (
    <AttendanceBonusView rawSearchParams={rawSearchParams} kindTabs={kindTabs} />
  ) : (
    <PunctualityBonusView rawSearchParams={rawSearchParams} kindTabs={kindTabs} />
  );
}

import Link from "next/link";
import type { BonusKind } from "@/interfaces/payroll_bonus";
import { BONUS_KIND_URL_VALUES } from "@/lib/payroll/bonusUrls";

interface Props {
  activeKind: BonusKind;
  /** Filtros vigentes de la URL (`periodo`, `resultado`, `q`); el cambio de pestaña los conserva y reinicia `pagina`. */
  preservedSearchParams: Record<string, string>;
}

const TABS: { kind: BonusKind; label: string }[] = [
  { kind: "punctuality", label: "Puntualidad" },
  { kind: "attendance", label: "Asistencia" },
];

function buildTabHref(kind: BonusKind, preservedSearchParams: Record<string, string>): string {
  const searchParams = new URLSearchParams({ ...preservedSearchParams, bono: BONUS_KIND_URL_VALUES[kind] });
  return `/dashboard/nomina/bonos?${searchParams.toString()}`;
}

/** Navegación entre bonos con `Link`: cambiar de bono es navegación, no estado del cliente. */
export default function BonusKindTabs({ activeKind, preservedSearchParams }: Props) {
  return (
    <nav aria-label="Tipo de bono" className="flex gap-1 border-b border-[#c4c6d0] dark:border-zinc-700">
      {TABS.map(({ kind, label }) => {
        const isActive = kind === activeKind;
        return (
          <Link
            key={kind}
            href={buildTabHref(kind, preservedSearchParams)}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              isActive
                ? "border-[#0051d5] text-[#0051d5] dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100 hover:border-[#c4c6d0] dark:hover:border-zinc-600"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

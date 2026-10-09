import Link from "next/link";
import {
  TAX_PARAMETERS_TAB_URL_VALUES,
  type TaxParametersTab,
} from "@/lib/payroll/taxParametersUrls";

interface Props {
  activeTab: TaxParametersTab;
  year: number;
}

const TABS: { tab: TaxParametersTab; label: string }[] = [
  { tab: "parameters", label: "Parámetros" },
  { tab: "withholding", label: "Tarifa ISR" },
  { tab: "perceptions", label: "Percepciones" },
];

/** Navegación entre pestañas con `Link`: conserva el ejercicio de la URL. */
export default function TaxParametersTabs({ activeTab, year }: Props) {
  return (
    <nav aria-label="Datos fiscales" className="flex gap-1 border-b border-[#c4c6d0] dark:border-zinc-700">
      {TABS.map(({ tab, label }) => {
        const isActive = tab === activeTab;
        const searchParams = new URLSearchParams({
          pestana: TAX_PARAMETERS_TAB_URL_VALUES[tab],
          ejercicio: String(year),
        });
        return (
          <Link
            key={tab}
            href={`/dashboard/nomina/parametros-fiscales?${searchParams.toString()}`}
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

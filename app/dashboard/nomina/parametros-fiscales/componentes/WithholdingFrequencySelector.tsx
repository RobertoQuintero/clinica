import Link from "next/link";
import {
  buildTaxParametersHref,
  WITHHOLDING_FREQUENCIES,
  WITHHOLDING_FREQUENCY_LABELS,
  type WithholdingFrequency,
} from "@/lib/payroll/taxParametersUrls";

interface Props {
  activeFrequency: WithholdingFrequency;
  year: number;
}

/** Control segmentado de la tarifa ISR: la frecuencia vive en la URL, así que no necesita estado de cliente. */
export default function WithholdingFrequencySelector({ activeFrequency, year }: Props) {
  return (
    <nav
      aria-label="Frecuencia de la tarifa ISR"
      className="inline-flex w-fit rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800 p-1"
    >
      {WITHHOLDING_FREQUENCIES.map((frequency) => {
        const isActive = frequency === activeFrequency;
        return (
          <Link
            key={frequency}
            href={buildTaxParametersHref("withholding", year, frequency)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5] ${
              isActive
                ? "bg-white dark:bg-zinc-900 text-[#0051d5] dark:text-blue-300 shadow-sm"
                : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
            }`}
          >
            {WITHHOLDING_FREQUENCY_LABELS[frequency]}
          </Link>
        );
      })}
    </nav>
  );
}

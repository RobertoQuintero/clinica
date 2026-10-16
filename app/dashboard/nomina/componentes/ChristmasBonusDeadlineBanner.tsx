import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { ChristmasBonusDeadlineState } from "@/interfaces/payroll_christmas_bonus";

interface Props {
  state: ChristmasBonusDeadlineState;
  year: number;
}

const BANNER_STYLES = {
  upcoming: {
    section: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20",
    icon: "text-amber-600 dark:text-amber-400",
    text: "text-amber-900 dark:text-amber-200",
  },
  overdue: {
    section: "border-[#ba1a1a]/30 dark:border-red-800 bg-[#ba1a1a]/10 dark:bg-red-900/20",
    icon: "text-[#ba1a1a] dark:text-red-400",
    text: "text-[#ba1a1a] dark:text-red-300",
  },
} as const;

/** Parte visual del aviso del 20 de diciembre (spec 87): ámbar hasta el 20-dic y rojo después. Sin estado, no pinta nada. */
export default function ChristmasBonusDeadlineBanner({ state, year }: Props) {
  if (state === "none") return null;
  const styles = BANNER_STYLES[state];

  return (
    <section
      aria-label={`Aguinaldo ${year}`}
      role="status"
      className={`rounded-xl border p-4 flex gap-3 ${styles.section}`}
    >
      <TriangleAlert size={20} className={`shrink-0 mt-0.5 ${styles.icon}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${styles.text}`}>
          {state === "upcoming"
            ? `Aguinaldo ${year}: debe pagarse a más tardar el 20 de diciembre`
            : `Aguinaldo ${year}: venció el 20 de diciembre`}
        </p>
        <p className={`text-sm mt-0.5 ${styles.text}`}>
          Esta sucursal aún no tiene su nómina de aguinaldo.{" "}
          <Link
            href="/dashboard/nomina/periodos"
            className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
          >
            Crear la nómina extraordinaria
          </Link>
        </p>
      </div>
    </section>
  );
}

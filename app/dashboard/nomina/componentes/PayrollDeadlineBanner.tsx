import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export type PayrollDeadlineState = "none" | "upcoming" | "overdue";

interface Props {
  state: PayrollDeadlineState;
  /** Nombre accesible de la sección: "Aguinaldo 2026", "PTU 2026". */
  label: string;
  /** Título según el estado: ámbar antes de la fecha límite y rojo después. */
  headlines: { upcoming: string; overdue: string };
  /** Qué falta hacer, antes del enlace a Periodos. */
  message: string;
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

/**
 * Parte visual de los avisos de fecha límite de las nóminas extraordinarias (aguinaldo, spec 87; PTU, spec 90):
 * ámbar hasta la fecha límite y rojo después. Sin estado, no pinta nada.
 */
export default function PayrollDeadlineBanner({ state, label, headlines, message }: Props) {
  if (state === "none") return null;
  const styles = BANNER_STYLES[state];

  return (
    <section aria-label={label} role="status" className={`rounded-xl border p-4 flex gap-3 ${styles.section}`}>
      <TriangleAlert size={20} className={`shrink-0 mt-0.5 ${styles.icon}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${styles.text}`}>{headlines[state]}</p>
        <p className={`text-sm mt-0.5 ${styles.text}`}>
          {message}{" "}
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

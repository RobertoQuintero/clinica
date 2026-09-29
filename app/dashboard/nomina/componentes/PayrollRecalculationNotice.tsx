import { TriangleAlert } from "lucide-react";

interface Props {
  recalculationNeeded: boolean;
  message: string;
}

/** Aviso compartido por Procesar, Horas extra y Faltas cuando las decisiones ya no coinciden con el último cálculo (specs 61 y 62). */
export default function PayrollRecalculationNotice({ recalculationNeeded, message }: Props) {
  if (!recalculationNeeded) return null;

  return (
    <section
      aria-label="Nómina sin recalcular"
      role="status"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {message}
      </p>
    </section>
  );
}

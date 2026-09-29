import { TriangleAlert } from "lucide-react";

interface Props {
  recalculationNeeded: boolean;
}

/** Aviso compartido por Procesar y Horas extra cuando las autorizaciones ya no coinciden con el último cálculo (spec 61). */
export default function OvertimeRecalculationNotice({ recalculationNeeded }: Props) {
  if (!recalculationNeeded) return null;

  return (
    <section
      aria-label="Horas extra sin recalcular"
      role="status"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Hay autorizaciones que no coinciden con el último cálculo. Recalcula la nómina.
      </p>
    </section>
  );
}

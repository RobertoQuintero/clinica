import Link from "next/link";
import { TriangleAlert } from "lucide-react";

interface Props {
  id_empleado: number;
  /** Lo que no se puede hacer sin horario, completando "Sin horario no se puede …". */
  blockedAction: string;
}

export default function EmployeeWithoutScheduleNotice({ id_empleado, blockedAction }: Props) {
  return (
    <section
      aria-label="Sin horario definido"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Sin horario definido
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          Sin horario no se puede {blockedAction}.{" "}
          <Link
            href={`/dashboard/empleados/${id_empleado}/horario`}
            className="font-semibold underline underline-offset-2"
          >
            Captura el horario
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

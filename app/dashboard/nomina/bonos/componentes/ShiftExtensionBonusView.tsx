import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import PayrollEmptyState from "../../componentes/PayrollEmptyState";

interface Props {
  /** Pestañas del selector de bono; la vista las muestra justo debajo de su encabezado. */
  kindTabs: ReactNode;
}

export default function ShiftExtensionBonusView({ kindTabs }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Bonos</span>
        </div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">
          Bono por extensión de jornada
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Bono para los podólogos asignados, por cada día con horario en el que checaron.
        </p>
      </div>

      {kindTabs}

      <PayrollEmptyState title="Próximamente" description="Esta pestaña todavía no está disponible." />
    </div>
  );
}

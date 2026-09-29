import { CalendarX2 } from "lucide-react";

export const PAYROLL_LINK_BUTTON_CLASSES =
  "inline-flex items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003ea7] transition-colors";

interface Props {
  title: string;
  description: string;
  action?: React.ReactNode;
}

/** Estado vacío de las pantallas de nómina por periodo (Procesar, Horas extra, Faltas). */
export default function PayrollEmptyState({ title, description, action }: Props) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-dashed border-[#c4c6d0] dark:border-zinc-700 rounded-xl px-6 py-12 flex flex-col items-center text-center gap-3">
      <span className="w-12 h-12 rounded-full bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-center text-[#747780] dark:text-zinc-500">
        <CalendarX2 size={22} />
      </span>
      <div>
        <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">{title}</h3>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1 max-w-md">{description}</p>
      </div>
      {action}
    </section>
  );
}

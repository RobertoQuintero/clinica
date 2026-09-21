import type { ReactNode } from "react";
import { Info } from "lucide-react";

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
}

/** Aviso en lugar de la tarjeta de percepciones cuando no hay cálculo que mostrar. */
export default function PayrollDetailNotice({ title, description, action }: Props) {
  return (
    <section
      role="status"
      className="w-full max-w-3xl rounded-xl border border-dashed border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <span className="w-10 h-10 shrink-0 rounded-full bg-[#eff4ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
        <Info size={20} aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-sm text-[#44474f] dark:text-zinc-400">{description}</p>
      </div>
      {action}
    </section>
  );
}

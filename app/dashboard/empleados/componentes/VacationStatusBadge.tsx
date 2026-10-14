import type { VacationStatus } from "@/interfaces/vacation";

interface Props {
  status: VacationStatus;
  label: string;
  /** Pendiente con 30 días o menos para la fecha límite: pasa de azul a ámbar. */
  isUrgent?: boolean;
}

const TONE_CLASSES = {
  blue: "bg-[#0051d5]/10 text-[#0051d5] border-[#0051d5]/20 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  green: "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  red: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  neutral: "bg-[#eff4ff] text-[#44474f] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
} as const;

const STATUS_TONE: Record<VacationStatus, keyof typeof TONE_CLASSES> = {
  pendiente: "blue",
  programada: "blue",
  en_curso: "green",
  tomada: "neutral",
  por_pagar: "red",
  pagada: "neutral",
};

/** Chip de estatus de vacaciones; compartido por el expediente, la pestaña y el listado. */
export default function VacationStatusBadge({ status, label, isUrgent = false }: Props) {
  const tone = status === "pendiente" && isUrgent ? "amber" : STATUS_TONE[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

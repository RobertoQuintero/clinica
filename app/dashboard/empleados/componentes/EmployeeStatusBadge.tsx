interface Props {
  activo: boolean;
}

/** Chip verde/rojo reutilizado por la fila del listado y el encabezado del expediente. */
export default function EmployeeStatusBadge({ activo }: Props) {
  if (activo) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-[#009c6b]/10 text-[#009c6b] border border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-[#009c6b] dark:bg-emerald-400" />
        Activo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
      <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] dark:bg-red-400" />
      Inactivo
    </span>
  );
}

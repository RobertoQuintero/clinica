interface Props {
  fotoUrl: string | null;
  nombreCompleto: string;
  /** Tamaño del avatar y de las iniciales, p. ej. "w-40 h-40 text-3xl". */
  sizeClassName: string;
}

function getInitials(nombreCompleto: string): string {
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  const firstInitial = parts[0]?.[0] ?? "";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${firstInitial}${lastInitial}`.toUpperCase() || "—";
}

/** Foto del empleado o, si no tiene, sus iniciales. Reutilizado por el expediente y el detalle de nómina. */
export default function EmployeeAvatar({ fotoUrl, nombreCompleto, sizeClassName }: Props) {
  return (
    <div
      className={`shrink-0 rounded-lg overflow-hidden border border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-center ${sizeClassName}`}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoUrl} alt={nombreCompleto} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-[#44474f] dark:text-zinc-400">{getInitials(nombreCompleto)}</span>
      )}
    </div>
  );
}

import { ICitaHoy } from "../actions";

interface Props {
  cita:        ICitaHoy;
  busy:        boolean;
  onCancelar:  (id_cita: number) => void;
  onEmpezar:   (cita: ICitaHoy) => void;
}

const fmtHora = (val: string) => {
  if (!val) return "—";
  return new Date(val.replace(" ", "T"))
    .toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

export default function CitaHoyFila({ cita, busy, onCancelar, onEmpezar }: Props) {
  return (
    <tr className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
      <td className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
        {fmtHora(cita.fecha_inicio)}
        {cita.fecha_fin && (
          <span className="text-zinc-400 font-normal"> – {fmtHora(cita.fecha_fin)}</span>
        )}
      </td>
      <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">{cita.nombre_paciente}</td>
      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">{cita.nombre_podologo}</td>
      <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
        <button
          disabled={busy}
          onClick={() => onCancelar(cita.id_cita)}
          className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
        {!cita.tiene_consulta && (
          <button
            disabled={busy}
            onClick={() => onEmpezar(cita)}
            className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
          >
            {busy ? "..." : "Empezar"}
          </button>
        )}
      </td>
    </tr>
  );
}

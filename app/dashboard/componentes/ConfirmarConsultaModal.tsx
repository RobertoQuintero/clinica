import { ICitaHoy } from "../actions";

interface Props {
  cita:      ICitaHoy;
  onCancel:  () => void;
  onConfirm: () => void;
}

const fmtHora = (val: string) => {
  if (!val) return "—";
  return new Date(val.replace(" ", "T"))
    .toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
};

export default function ConfirmarConsultaModal({ cita, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
          Iniciar consulta
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ¿Deseas iniciar la consulta para{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{cita.nombre_paciente}</span>
          {" "}con{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{cita.nombre_podologo}</span>
          {" "}a las{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{fmtHora(cita.fecha_inicio)}</span>?
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded text-sm font-medium bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

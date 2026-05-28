"use client";

interface Props {
  motivo:    string;
  saving:    boolean;
  error:     string | null;
  onChange:  (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onConfirm: () => void;
  onClose:   () => void;
}

export default function CancelarConsultaModal({
  motivo, saving, error, onChange, onConfirm, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Cancelar consulta
        </h2>

        <label className="block mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Motivo de cancelación
        </label>
        <textarea
          rows={3}
          value={motivo}
          onChange={onChange}
          placeholder="Escribe el motivo..."
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />

        {error && (
          <p className="mt-2 text-sm text-rose-600">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !motivo.trim()}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

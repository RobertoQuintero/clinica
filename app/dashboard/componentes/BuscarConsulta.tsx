"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buscarConsultaPorId, IConsultaBusqueda } from "../actions";

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(val.replace(" ", "T")).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function BuscarConsulta() {
  const router = useRouter();
  const [inputVal,  setInputVal ] = useState("");
  const [loading,   setLoading  ] = useState(false);
  const [resultado, setResultado] = useState<IConsultaBusqueda | null | undefined>(undefined);

  const handleBuscar = async () => {
    const id = Number(inputVal.trim());
    if (!id) return;
    setLoading(true);
    const r = await buscarConsultaPorId(id);
    setResultado(r);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleBuscar();
  };

  return (
    <div>
      <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-200 mb-3">
        Buscar consulta
      </h3>

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          min={1}
          placeholder="ID de consulta"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setResultado(undefined);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
        />
        <button
          type="button"
          onClick={handleBuscar}
          disabled={loading || !inputVal.trim()}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {resultado === null && (
        <p className="text-sm text-zinc-400">
          No se encontró ninguna consulta con ese ID en la sucursal actual.
        </p>
      )}

      {resultado != null && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                Consulta #{resultado.id_consulta}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium">Paciente:</span> {resultado.nombre_paciente}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium">Podólogo:</span>{" "}
                {resultado.nombre_podologo || "—"}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-medium">Fecha:</span> {fmtDatetime(resultado.fecha)}
              </p>
              {resultado.diagnostico && (
                <p className="text-zinc-600 dark:text-zinc-300 truncate">
                  <span className="font-medium">Diagnóstico:</span> {resultado.diagnostico}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/pacientes/${resultado.id_paciente}/consultas/${resultado.id_consulta}`,
                )
              }
              className="shrink-0 inline-flex items-center px-4 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
            >
              Ver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

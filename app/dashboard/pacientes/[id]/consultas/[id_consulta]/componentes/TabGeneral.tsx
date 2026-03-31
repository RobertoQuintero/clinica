import { IConsulta } from "@/interfaces/consulta";
import { fmtDatetime } from "./helpers";

interface Props {
  consulta:   IConsulta | null;
  costoTotal: number;
}

export default function TabGeneral({ consulta, costoTotal }: Props) {
  return (
    <div className="space-y-4">
      {!consulta ? (
        <p className="text-zinc-400 text-sm">No se encontró la consulta.</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-zinc-500 font-medium">Fecha</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{fmtDatetime(consulta.fecha)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Costo total</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">${costoTotal.toFixed(2)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 font-medium">Diagnóstico</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.diagnostico || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 font-medium">Tratamiento aplicado</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.tratamiento_aplicado || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 font-medium">Observaciones</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.observaciones || "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { getTratamientoDetalle } from "@/app/dashboard/tratamientos/actions";
import { ITratamientoOnicomicosis } from "@/interfaces/tratamiento_onicomicosis";

type DetailRow = ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
};

interface Props {
  params: Promise<{ id_tratamiento: string }>;
}

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-100">
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default function TratamientoDetallePage({ params }: Props) {
  const { id_tratamiento: id_str } = use(params);
  const id_tratamiento = Number(id_str);
  const router = useRouter();

  const [detalle, setDetalle] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getTratamientoDetalle(id_tratamiento).then((row) => {
      if (!row) setNotFound(true);
      else setDetalle(row as DetailRow);
      setLoading(false);
    });
  }, [id_tratamiento]);

  if (loading) {
    return <p className="p-6 text-zinc-500 dark:text-zinc-400">Cargando…</p>;
  }

  if (notFound || !detalle) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">Tratamiento no encontrado.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
          Detalle del Tratamiento #{detalle.id_tratamiento}
        </h1>
      </div>

      {/* General info */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Información general
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Campo label="Fecha"         value={fmtDatetime(detalle.created_at)} />
          <Campo label="Paciente"      value={detalle.nombre_paciente} />
          <Campo label="Especialista"  value={detalle.nombre_especialista} />
          <Campo label="Solicitó"      value={detalle.nombre_usuario} />
          <Campo label="Estado"        value={detalle.nombre_stage} />
          <Campo label="Consulta"      value={detalle.id_consulta} />
        </dl>
      </div>

      {/* Clinical data */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Datos clínicos
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Campo label="Peso"                     value={detalle.peso} />
          <Campo label="Talla"                    value={detalle.talla} />
          <Campo label="Altura"                   value={detalle.altura} />
          <Campo label="Antecedentes crónicos"    value={detalle.antecedentes_cronicos} />
          <Campo label="Antecedentes hepáticos"   value={detalle.antecedentes_hepaticos} />
          <Campo label="Medicación actual"        value={detalle.medicacion_actual} />
        </dl>
      </div>
    </div>
  );
}

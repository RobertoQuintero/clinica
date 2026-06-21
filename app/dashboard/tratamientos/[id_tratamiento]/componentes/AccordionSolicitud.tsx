"use client";

import { useState } from "react";
import { ITratamientoOnicomicosis } from "@/interfaces/tratamiento_onicomicosis";
import ImageSliderModal from "./ImageSliderModal";
import { useAuth } from "@/contexts/AuthContext";
import { updateTratamientoStage } from "@/app/dashboard/tratamientos/actions";

type DetailRow = ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
  whatsapp:            string | null;
  edad_paciente:       number | null;
};

interface Archivo {
  id_archivo: number;
  ruta:       string;
  categoria:  string;
}

interface Props {
  detalle:          DetailRow;
  archivos:         Archivo[];
  onStageUpdated?:  () => void;
}

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

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};

export default function AccordionSolicitud({ detalle, archivos, onStageUpdated }: Props) {
  const [open, setOpen]             = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [updating, setUpdating]     = useState(false);

  const { user } = useAuth();

  const canApprove = detalle.id_stage === 1 && (user?.id_role === 5 );

  const handleApprove = async () => {
    setUpdating(true);
    await updateTratamientoStage(detalle.id_tratamiento, 2);
    onStageUpdated?.();
    setUpdating(false);
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Solicitud de tratamiento
          </span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="px-6 pb-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* General info */}
              <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Información general
                </h2>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Campo label="Fecha"        value={fmtDatetime(detalle.created_at)} />
                  <Campo label="Paciente"     value={detalle.nombre_paciente} />
                  <Campo label="Edad"         value={detalle.edad_paciente != null ? `${detalle.edad_paciente} años` : null} />
                  <Campo label="WhatsApp"     value={detalle.whatsapp} />
                  <Campo label="Especialista" value={detalle.nombre_especialista} />
                  <Campo label="Solicitó"     value={detalle.nombre_usuario} />
                  <Campo label="Estado"       value={detalle.nombre_stage} />
                  <Campo label="Consulta"     value={detalle.id_consulta} />
                </dl>

                {(archivos.length > 0 ) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {archivos.length > 0 && (
                      <button
                        onClick={() => { 
                          setSlideIndex(0); setModalOpen(true);
                          if(canApprove) handleApprove();
                         }}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                      >
                        Ver imágenes ({archivos.length})
                      </button>
                    )}
                   
                  </div>
                )}
              </div>

              {/* Clinical data */}
              <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Datos clínicos
                </h2>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Campo label="Peso"                   value={detalle.peso} />
                  <Campo label="Talla"                  value={detalle.talla} />
                  <Campo label="Altura"                 value={detalle.altura} />
                  <Campo label="Antecedentes crónicos"  value={detalle.antecedentes_cronicos} />
                  <Campo label="Antecedentes hepáticos" value={detalle.antecedentes_hepaticos} />
                  <Campo label="Alergias"               value={detalle.alergias} />
                  <Campo label="Medicación actual"      value={detalle.medicacion_actual} />
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageSliderModal
        open={modalOpen}
        archivos={archivos}
        slideIndex={slideIndex}
        onClose={() => setModalOpen(false)}
        onSlide={setSlideIndex}
      />
    </>
  );
}

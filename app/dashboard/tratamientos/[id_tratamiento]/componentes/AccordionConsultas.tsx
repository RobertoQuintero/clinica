"use client";

import { useEffect, useState } from "react";
import { IConsulta } from "@/interfaces/consulta";
import {
  getConsultasByTratamiento,
  getArchivosByConsulta,
} from "@/app/dashboard/tratamientos/actions";
import ConsultaFila from "@/app/dashboard/pacientes/[id]/expediente/componentes/ConsultaFila";
import ImageSliderModal from "./ImageSliderModal";

interface Props {
  id_tratamiento: number;
  id_paciente:    number;
}

interface Archivo {
  id_archivo: number;
  ruta:       string;
  categoria:  string;
}

export default function AccordionConsultas({ id_tratamiento, id_paciente }: Props) {
  const [open, setOpen]             = useState(true);
  const [consultas, setConsultas]   = useState<IConsulta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Modal properties for image slider
  const [modalOpen, setModalOpen]   = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [archivos, setArchivos]     = useState<Archivo[]>([]);
  const [fetchingImgs, setFetchingImgs] = useState(false);

  useEffect(() => {
    getConsultasByTratamiento(id_tratamiento)
      .then((rows) => {
        setConsultas(rows);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Error al cargar las consultas");
        setLoading(false);
      });
  }, [id_tratamiento]);

  const handleVerImagenes = async (id_consulta: number) => {
    if (fetchingImgs) return;
    setFetchingImgs(true);
    try {
      const imgs = await getArchivosByConsulta(id_consulta);
      if (imgs.length === 0) {
        alert("Esta consulta no tiene imágenes de valoración o pedicure.");
      } else {
        setArchivos(imgs);
        setSlideIndex(0);
        setModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      alert("Error al obtener las imágenes de la consulta.");
    } finally {
      setFetchingImgs(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        {/* header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
            Consultas del tratamiento
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 px-5 py-4 space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-sm text-zinc-400">Cargando consultas…</p>
            ) : consultas.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin consultas registradas para este tratamiento.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      {["#", "Fecha", "Podólogo", "Sucursal", "H. Consulta", "H. Inicio", "H. Fin", "Duración", "Imágenes"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                    {consultas.map((c) => (
                      <ConsultaFila
                        key={c.id_consulta}
                        consulta={c}
                        id_paciente={id_paciente}
                        hideCostoTotal={true}
                        onVerImagenes={handleVerImagenes}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

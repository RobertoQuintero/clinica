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
  const [consultas, setConsultas]   = useState<IConsulta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Modal properties for image slider
  const [modalOpen, setModalOpen]   = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [archivos, setArchivos]     = useState<Archivo[]>([]);
  const [fetchingImgs, setFetchingImgs] = useState(false);
  const [imageNotice, setImageNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);

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
    setImageNotice(null);
    try {
      const imgs = await getArchivosByConsulta(id_consulta);
      if (imgs.length === 0) {
        setImageNotice({ type: "info", message: "Esta consulta no tiene imágenes de valoración o pedicure." });
      } else {
        setArchivos(imgs);
        setSlideIndex(0);
        setModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setImageNotice({ type: "error", message: "Error al obtener las imágenes de la consulta." });
    } finally {
      setFetchingImgs(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        {/* header */}
        <h2 className="px-4 py-4 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 sm:px-6">Consultas</h2>

          <div className="border-t border-[#c4c6d0] dark:border-zinc-700 px-5 py-4 space-y-4">
            {imageNotice && (
              <div
                role={imageNotice.type === "error" ? "alert" : "status"}
                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${imageNotice.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"}`}
              >
                <span>{imageNotice.message}</span>
                <button type="button" onClick={() => setImageNotice(null)} aria-label="Cerrar aviso" className="shrink-0 rounded px-2 py-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10">
                  ×
                </button>
              </div>
            )}
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
              <div className="overflow-x-auto rounded-lg border border-[#c4c6d0] dark:border-zinc-700">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                  <thead className="bg-[#eff4ff] dark:bg-zinc-800">
                    <tr>
                      {["#", "Fecha", "Podólogo", "Sucursal", "H. Consulta", "H. Inicio", "H. Fin", "Duración", "Imágenes"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-medium text-[#44474f] dark:text-zinc-300 whitespace-nowrap"
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

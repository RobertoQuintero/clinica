"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
  getTratamientoDetalle,
  getArchivosByConsulta,
  markTratamientoRevisado,
  updateTratamientoStage,
} from "@/app/dashboard/tratamientos/actions";
import { ITratamientoOnicomicosis } from "@/interfaces/tratamiento_onicomicosis";
import AccordionSolicitud from "./componentes/AccordionSolicitud";
import AccordionPagos from "./componentes/AccordionPagos";
import AccordionRecetas from "./componentes/AccordionRecetas";
import AccordionConsultas from "./componentes/AccordionConsultas";

import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { buildDate } from "@/utils/date_helpper";
import { getPacientes, getPodologos, saveCita } from "@/app/dashboard/citas/actions";
import CitaModal from "@/app/dashboard/citas/componentes/CitaModal";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

type DetailRow = ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
  id_paciente:         number;
  id_podologo:         number;
};

const EMPTY: ICita = {
  id_cita:            0,
  id_paciente:        0,
  id_podologo:        0,
  fecha_inicio:       "",
  fecha_fin:          "",
  estado:             "agendada",
  motivo_cancelacion: "",
  created_at:         "",
  deleted_at:         "",
  id_sucursal:        0,
  id_empresa:         0,
};

interface Props {
  params: Promise<{ id_tratamiento: string }>;
}

export default function TratamientoDetallePage({ params }: Props) {
  const { id_tratamiento: id_str } = use(params);
  const id_tratamiento = Number(id_str);
  const router = useRouter();

  const { user }                          = useAuth();
  const { selectedId }                    = useSucursal();

  const [detalle, setDetalle]   = useState<DetailRow | null>(null);
  const [marking, setMarking]   = useState(false);
  const [archivos, setArchivos] = useState<{ id_archivo: number; ruta: string; categoria: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // States for CitaModal
  const [pacientes, setPacientes]         = useState<IPaciente[]>([]);
  const [podologos, setPodologos]         = useState<IUser[]>([]);
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState<ICita>(EMPTY);
  const [savingCita, setSavingCita]       = useState(false);
  const [errorCita, setErrorCita]         = useState<string | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancellingStage, setCancellingStage]     = useState(false);
  const [errorCancel, setErrorCancel]             = useState<string | null>(null);

  useEffect(() => {
    getTratamientoDetalle(id_tratamiento).then(async (row) => {
      if (!row) {
        setNotFound(true);
      } else {
        setDetalle(row as DetailRow);
        const imgs = await getArchivosByConsulta(row.id_consulta);
        setArchivos(imgs);
      }
      setLoading(false);
    });
  }, [id_tratamiento]);

  useEffect(() => {
    getPacientes().then(setPacientes).catch(console.error);
    getPodologos().then(setPodologos).catch(console.error);
  }, []);

  const openCrearCitaByTratamiento = () => {
    if (!detalle) return;
    setForm({
      ...EMPTY,
      id_paciente:    detalle.id_paciente,
      id_podologo:    detalle.id_podologo,
      id_tratamiento: id_tratamiento,
      id_sucursal:    selectedId || user!.id_sucursal,
      id_empresa:     user!.id_empresa,
    });
    setErrorCita(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCita(true);
    setErrorCita(null);
    try {
      const payload = {
        ...form,
        created_at: form.created_at || buildDate(new Date()),
      };
      const result = await saveCita(payload);
      if (!result.ok) throw new Error(result.message ?? "Error al guardar");
      setShowModal(false);
    } catch (err: unknown) {
      setErrorCita(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      if(detalle && detalle.id_stage===3){
        await updateTratamientoStage(id_tratamiento, 4);
      }
      setSavingCita(false);
    }
  };

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            Detalle del Tratamiento #{detalle.id_tratamiento}
          </h1>
          {detalle.new_message && (
            <>
              <span className="rounded-md bg-yellow-100 px-3 py-1.5 text-sm text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                {detalle.message}
              </span>
              <button
                disabled={marking}
                onClick={async () => {
                  setMarking(true);
                  await markTratamientoRevisado(id_tratamiento);
                  setDetalle((prev) => prev ? { ...prev, new_message: false, message: "" } : prev);
                  setMarking(false);
                }}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {marking ? "…" : "Revisado"}
              </button>
            </>
          )}
        </div>
          {
            user?.id_role !== 5 && (
              <div className="flex gap-2">
                <button
                  onClick={openCrearCitaByTratamiento}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 whitespace-nowrap"
                >
                  Crear cita
                </button>
                {detalle.id_stage !== 6 && (
                  <button
                    onClick={() => { setErrorCancel(null); setShowConfirmCancel(true); }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )
          }
      </div>

      <div className="flex flex-col gap-4">
        <AccordionSolicitud
            detalle={detalle}
            archivos={archivos}
            onStageUpdated={() => setDetalle((prev) => prev ? { ...prev, id_stage: 2 } : prev)}
          />
        {
          user?.id_role !== 5 && 
          <AccordionPagos id_tratamiento={id_tratamiento} />
        }
        <AccordionRecetas
          id_tratamiento={id_tratamiento}
          nombre_paciente={detalle.nombre_paciente}
          id_stage={detalle.id_stage}
          id_role={user?.id_role || 0}
        />
        <AccordionConsultas
          id_tratamiento={id_tratamiento}
          id_paciente={detalle.id_paciente}
        />
      </div>

      {showConfirmCancel && (
        <ConfirmModal
          message="¿Estás seguro de que deseas cancelar este tratamiento?"
          loading={cancellingStage}
          error={errorCancel}
          onCancel={() => setShowConfirmCancel(false)}
          onConfirm={async () => {
            setCancellingStage(true);
            setErrorCancel(null);
            try {
              await updateTratamientoStage(id_tratamiento, 6);
              setDetalle((prev) => prev ? { ...prev, id_stage: 6 } : prev);
              setShowConfirmCancel(false);
            } catch {
              setErrorCancel("Error al cancelar el tratamiento");
            } finally {
              setCancellingStage(false);
            }
          }}
        />
      )}

      {showModal && (
        <CitaModal
          form={form}
          pacientes={pacientes}
          podologos={podologos}
          saving={savingCita}
          error={errorCita}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

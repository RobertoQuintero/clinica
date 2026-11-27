"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
  getTratamientoDetalle,
  getArchivosByConsulta,
  markTratamientoRevisado,
  updateTratamientoStage,
  hasPagoTipo2,
  getConsultasByTratamiento,
  createConsultaOnicomicosis,
} from "@/app/dashboard/tratamientos/actions";
import { getSucursalesActivas } from "@/app/dashboard/pacientes/[id]/expediente/actions";
import ConsultaModal from "@/app/dashboard/pacientes/[id]/expediente/componentes/ConsultaModal";
import { ITratamientoOnicomicosis } from "@/interfaces/tratamiento_onicomicosis";
import AccordionSolicitud from "./componentes/AccordionSolicitud";
import AccordionPagos from "./componentes/AccordionPagos";
import AccordionEgresos from "./componentes/AccordionEgresos";
import AccordionRecetas from "./componentes/AccordionRecetas";
import AccordionConsultas from "./componentes/AccordionConsultas";

import { useAuth } from "@/contexts/AuthContext";
import { IConsulta } from "@/interfaces/consulta";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { getPodologos } from "@/app/dashboard/citas/actions";
import { getSucursalCalendarios } from "@/app/dashboard/sucursales/actions";
import { useSucursal } from "@/contexts/SucursalContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import CopyButton, { WhatsAppIcon } from "@/app/dashboard/componentes/CopyButton";

type DetailRow = ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
  nombre_sucursal:     string | null;
  id_paciente:         number;
  id_podologo:         number;
  id_sucursal:         number;
  whatsapp:            string | null;
  phone_code:          string | null;
  edad_paciente:       number | null;
};

function buildSolicitudMessage(detalle: DetailRow): string {
  const fechaFmt = (() => {
    if (!detalle.created_at) return "";
    const d = new Date(String(detalle.created_at).replace(" ", "T"));
    const dd   = String(d.getDate()).padStart(2, "0");
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, "0");
    const min  = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  })();
  return [
    `Hola ${detalle.nombre_especialista ?? "especialista"}`,
    `Usted tiene un nuevo tratamiento de ${detalle.nombre_paciente ?? "Paciente"}${fechaFmt ? `, ${fechaFmt}` : ""}.`,
    `Sucursal: ${detalle.nombre_sucursal ?? "Desconocida"}.`,
    `Favor de revisar la página de Piezen.`,
  ].join("\n");
}

const EMPTY_CONSULTA: IConsulta = {
  id_consulta:          0,
  id_paciente:          0,
  id_podologo:          0,
  fecha:                "",
  diagnostico:          "",
  tratamiento_aplicado: "",
  observaciones:        "",
  created_at:           "",
  deleted_at:           "",
  costo_total:          0,
  id_sucursal:          0,
  id_empresa:           0,
  cancelada:            false,
  motivo_cancelada:     null,
  is_onicomicosis:      true,
  id_tratamiento:       null,
  id_buzon:             null,
};

interface Props {
  params: Promise<{ id_tratamiento: string }>;
}

export default function TratamientoDetallePage({ params }: Props) {
  const { id_tratamiento: id_str } = use(params);
  const id_tratamiento = Number(id_str);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("solicitud");

  const { user }                          = useAuth();
  const { selectedId } = useSucursal();
  const { data: calendarios } = useAsyncData([selectedId], () => getSucursalCalendarios(selectedId));

  const [detalle, setDetalle]   = useState<DetailRow | null>(null);
  const [marking, setMarking]   = useState(false);
  const [archivos, setArchivos] = useState<{ id_archivo: number; ruta: string; categoria: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [podologos, setPodologos]           = useState<IUser[]>([]);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [cancellingStage, setCancellingStage]     = useState(false);
  const [errorCancel, setErrorCancel]             = useState<string | null>(null);
  const [tienePagoTipo2, setTienePagoTipo2]       = useState(false);
  const [numConsultas, setNumConsultas]             = useState(0);
  const [finalizando, setFinalizando]               = useState(false);
  const [showConfirmFinalizar, setShowConfirmFinalizar] = useState(false);
  const [errorFinalizar, setErrorFinalizar]         = useState<string | null>(null);

  // States for ConsultaModal
  const [showConsultaModal,   setShowConsultaModal  ] = useState(false);
  const [consultaForm,        setConsultaForm       ] = useState<IConsulta>(EMPTY_CONSULTA);
  const [savingConsulta,      setSavingConsulta     ] = useState(false);
  const [errorConsulta,       setErrorConsulta      ] = useState<string | null>(null);
  const [sucursales,          setSucursales         ] = useState<ISucursal[]>([]);
  const [sucursalesLoaded,    setSucursalesLoaded   ] = useState(false);

  useEffect(() => {
    getTratamientoDetalle(id_tratamiento).then(async (row) => {
      if (!row) {
        setNotFound(true);
      } else {
        setDetalle(row as DetailRow);
        const [imgs, tienePago, consultas] = await Promise.all([
          getArchivosByConsulta(row.id_consulta),
          hasPagoTipo2(id_tratamiento),
          getConsultasByTratamiento(id_tratamiento),
        ]);
        setArchivos(imgs);
        setTienePagoTipo2(tienePago);
        setNumConsultas(consultas.length);
      }
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [id_tratamiento]);

  useEffect(() => {
    getPodologos().then(setPodologos).catch(console.error);
  }, []);

  const openCrearConsulta = async () => {
    if (!detalle) return;
    if (!sucursalesLoaded) {
      const data = await getSucursalesActivas();
      setSucursales(data);
      setSucursalesLoaded(true);
    }
    setConsultaForm({
      ...EMPTY_CONSULTA,
      id_paciente:    detalle.id_paciente,
      id_podologo:    user?.id_role === 2 ? user.id_user : detalle.id_podologo,
      id_sucursal:    detalle.id_sucursal,
      id_empresa:     user!.id_empresa,
      id_tratamiento: id_tratamiento,
    });
    setErrorConsulta(null);
    setShowConsultaModal(true);
  };

  const handleConsultaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setConsultaForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleConsultaPodologoChange = (id: number) => {
    setConsultaForm((prev) => ({ ...prev, id_podologo: id }));
  };

  const handleConsultaSucursalChange = (id: number) => {
    setConsultaForm((prev) => ({ ...prev, id_sucursal: id }));
  };

  const handleConsultaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConsulta(true);
    setErrorConsulta(null);
    try {
      const result = await createConsultaOnicomicosis({
        id_paciente:          consultaForm.id_paciente,
        id_podologo:          consultaForm.id_podologo,
        diagnostico:          consultaForm.diagnostico,
        tratamiento_aplicado: consultaForm.tratamiento_aplicado,
        observaciones:        consultaForm.observaciones,
        costo_total:          Number(consultaForm.costo_total),
        id_sucursal:          consultaForm.id_sucursal,
        id_empresa:           consultaForm.id_empresa,
        id_tratamiento:       id_tratamiento,
      });
      if (!result.ok) {
        setErrorConsulta(result.message ?? "Error al crear la consulta");
      } else {
        if (detalle && detalle.id_stage <= 3) {
          await updateTratamientoStage(id_tratamiento, 4);
        }
        setShowConsultaModal(false);
        router.push(`/dashboard/pacientes/${detalle!.id_paciente}/consultas/${result.id_consulta}`);
      }
    } catch {
      setErrorConsulta("Error inesperado");
    } finally {
      setSavingConsulta(false);
    }
  };

  if (loading) {
    return <p role="status" className="m-4 rounded-xl border border-[#c4c6d0] bg-white p-6 text-sm text-[#44474f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 sm:m-6">Cargando…</p>;
  }

  if (loadError || notFound || !detalle) {
    return (
      <div className="p-6">
        <p role={loadError ? "alert" : undefined} className="text-red-700 dark:text-red-400">{loadError ? "No se pudo cargar el tratamiento. Intenta nuevamente." : "Tratamiento no encontrado."}</p>
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
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-5 rounded-xl border border-[#c4c6d0] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg bg-[#eff4ff] px-3 py-2 text-sm font-semibold text-[#0051d5] transition-colors hover:bg-[#dbe1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] dark:bg-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-700 dark:focus-visible:ring-blue-400"
          >
            ← Volver
          </button>
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.02em] text-[#0b1c30] dark:text-zinc-50">
            Detalle del Tratamiento #{detalle.id_tratamiento}
          </h1>
          <CopyButton
            text={buildSolicitudMessage(detalle)}
            label="Copiar solicitud"
            icon={<WhatsAppIcon />}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#009c6b] bg-white px-3 py-2 text-sm font-semibold text-[#005236] transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009c6b] dark:border-emerald-700 dark:bg-zinc-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          />
          {detalle.new_message && (
            <>
              <span className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
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
                className="rounded-lg bg-[#005236] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009c6b] disabled:opacity-50"
              >
                {marking ? "…" : "Revisado"}
              </button>
            </>
          )}
        </div>
          {
            user?.id_role !== 5 && detalle.id_stage<5 && (
              <div className="flex flex-wrap gap-2 border-t border-[#e5eeff] pt-4 dark:border-zinc-700">
                {tienePagoTipo2 && (
                <button
                  onClick={openCrearConsulta}
                  className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#003ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] focus-visible:ring-offset-2 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-900"
                >
                  Crear consulta
                </button>
                )}
                {tienePagoTipo2 && (
                <button
                  onClick={() => {
                    if (calendarios?.[0]?.link_calendar) {
                      window.open(calendarios[0].link_calendar, "_blank");
                    }
                  }}
                  className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#003ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] focus-visible:ring-offset-2 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-900"
                >
                  Crear cita
                </button>
                )}
                {numConsultas >= 6 && detalle.id_stage < 5  && (
                  <button
                    onClick={() => { setErrorFinalizar(null); setShowConfirmFinalizar(true); }}
                    className="rounded-lg bg-[#005236] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009c6b] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    Finalizar
                  </button>
                )}
                {detalle.id_stage !== 6 && (
                  <button
                    onClick={() => { setErrorCancel(null); setShowConfirmCancel(true); }}
                    className="rounded-lg border border-[#ba1a1a] px-4 py-2 text-sm font-semibold text-[#ba1a1a] transition-colors hover:bg-[#ffdad6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba1a1a] dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950 dark:focus-visible:ring-red-400"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )
          }
      </div>

      <div>
        <div className="border-b border-[#c4c6d0] dark:border-zinc-700 overflow-x-auto">
          <nav className="flex gap-0 -mb-px" aria-label="Secciones del tratamiento">
            {[
              { id: "solicitud", label: "Solicitud" },
              ...(user?.id_role !== 5 ? [{ id: "pagos", label: "Pagos" }] : []),
              { id: "egresos", label: "Egresos" },
              { id: "recetas", label: "Recetas" },
              { id: "consultas", label: "Consultas" },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined}
                className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-[#0051d5] text-[#0051d5] dark:border-blue-400 dark:text-blue-400" : "border-transparent text-[#44474f] hover:text-[#0051d5] dark:text-zinc-400 dark:hover:text-blue-400"}`}
              >{tab.label}</button>
            ))}
          </nav>
        </div>
        <div className="mt-6">
        <div hidden={activeTab !== "solicitud"}><AccordionSolicitud
            detalle={detalle}
            archivos={archivos}
            onStageUpdated={() => setDetalle((prev) => prev ? { ...prev, id_stage: 2 } : prev)}
          /></div>
        {
          user?.id_role !== 5 && 
          <>
          <div hidden={activeTab !== "pagos"}><AccordionPagos
              id_tratamiento={id_tratamiento}
              nombre_paciente={detalle.nombre_paciente}
              onFirstPago={() => setTienePagoTipo2(true)}
              stage={detalle.id_stage}
            /></div>
          </>
        }
        <div hidden={activeTab !== "egresos"}><AccordionEgresos id_tratamiento={id_tratamiento} stage={detalle.id_stage}/></div>
        <div hidden={activeTab !== "recetas"}><AccordionRecetas
          id_tratamiento={id_tratamiento}
          nombre_paciente={detalle.nombre_paciente}
          nombre_podologo={detalle.nombre_usuario}
          nombre_especialista={detalle.nombre_especialista}
          id_stage={detalle.id_stage}
          id_role={user?.id_role || 0}
        /></div>
        <div hidden={activeTab !== "consultas"}><AccordionConsultas
          id_tratamiento={id_tratamiento}
          id_paciente={detalle.id_paciente}
        /></div>
        </div>
      </div>

      {showConfirmFinalizar && (
        <ConfirmModal
          message="¿Estás seguro de que deseas finalizar este tratamiento?"
          confirmLabel="Aceptar"
          loading={finalizando}
          error={errorFinalizar}
          onCancel={() => setShowConfirmFinalizar(false)}
          onConfirm={async () => {
            setFinalizando(true);
            setErrorFinalizar(null);
            try {
              await updateTratamientoStage(id_tratamiento, 5);
              setDetalle((prev) => prev ? { ...prev, id_stage: 5 } : prev);
              setShowConfirmFinalizar(false);
            } catch {
              setErrorFinalizar("Error al finalizar el tratamiento");
            } finally {
              setFinalizando(false);
            }
          }}
        />
      )}

      {showConfirmCancel && (
        <ConfirmModal
        confirmLabel="Aceptar"
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

      {showConsultaModal && (
        <ConsultaModal
          form={consultaForm}
          saving={savingConsulta}
          error={errorConsulta}
          podologos={podologos}
          sucursales={sucursales}
          currentUser={user ?? undefined}
          onChange={handleConsultaChange}
          onPodologoChange={handleConsultaPodologoChange}
          onSucursalChange={handleConsultaSucursalChange}
          onSubmit={handleConsultaSubmit}
          onClose={() => setShowConsultaModal(false)}
        />
      )}
    </div>
  );
}

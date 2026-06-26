"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarCita, crearConsultaDesdeCita, getTodaysCitas, ICitaHoy } from "../actions";
import CitaHoyFila from "./CitaHoyFila";
import ConfirmarConsultaModal from "./ConfirmarConsultaModal";
import PacientesFaltantes from "./PacientesFaltantes";
import PacientesCumpleanos from "./PacientesCumpleanos";
import ConsultasRango from "./ConsultasRango";
import { useSucursal } from "@/contexts/SucursalContext";
import { useAuth } from "@/contexts/AuthContext";
import ConsultaModal from "../pacientes/[id]/expediente/componentes/ConsultaModal";
import {
  getPodologos,
  getPodologosBySucursal,
  getSucursalesActivas,
} from "../pacientes/[id]/expediente/actions";
import { buildDate } from "@/utils/date_helpper";
import { IConsulta } from "@/interfaces/consulta";
import { IUser } from "@/interfaces/user";
import { ISucursal } from "@/interfaces/sucursal";

type Tab = "citas" | "faltantes" | "cumpleanos" | "consultas";

const TABS: { key: Tab; label: string }[] = [
  { key: "citas",      label: "Citas de hoy" },
  { key: "faltantes",  label: "Faltantes" },
  { key: "cumpleanos", label: "Cumpleaños" },
  { key: "consultas",  label: "Consultas" },
];

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
  is_onicomicosis:      false,
  id_tratamiento:       null,
  id_buzon:             null,
};

export default function CitasHoy() {
  const router = useRouter();
  const { selectedId } = useSucursal();
  const { user } = useAuth();
  const [tab, setTab]           = useState<Tab>("citas");
  const [citas, setCitas]       = useState<ICitaHoy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirm, setConfirm]   = useState<ICitaHoy | null>(null);

  // ── consulta modal state ─────────────────────────────────────────────────
  const [showConsultaModal,  setShowConsultaModal ] = useState(false);
  const [consultaForm,       setConsultaForm      ] = useState<IConsulta>(EMPTY_CONSULTA);
  const [consultaSaving,     setConsultaSaving    ] = useState(false);
  const [consultaError,      setConsultaError     ] = useState<string | null>(null);
  const [citaParaConsulta,   setCitaParaConsulta  ] = useState<ICitaHoy | null>(null);
  const [podologos,          setPodologos         ] = useState<IUser[]>([]);
  const [sucursales,         setSucursales        ] = useState<ISucursal[]>([]);

  useEffect(() => {
    setLoading(true);
    getTodaysCitas().then((data) => {
      setCitas(data);
      setLoading(false);
    });
  }, [selectedId]);

  const handleCancelar = async (id_cita: number) => {
    setActionId(id_cita);
    const res = await cancelarCita(id_cita);
    if (res.ok) {
      setCitas((prev) => prev.filter((c) => c.id_cita !== id_cita));
    }
    setActionId(null);
  };

  const handleEmpezarConfirm = async () => {
    if (!confirm) return;
    const cita = confirm;
    setConfirm(null);
    setActionId(cita.id_cita);
    const res = await crearConsultaDesdeCita(
      cita.id_cita,
      cita.id_paciente,
      cita.id_podologo,
      cita.fecha_inicio,
      cita.fecha_fin,
      cita.id_sucursal,
      cita.id_empresa,
      cita.id_tratamiento,
    );
    if (res.ok && res.id_consulta) {
      router.push(`/dashboard/pacientes/${cita.id_paciente}/consultas/${res.id_consulta}`);
    } else {
      setActionId(null);
    }
  };

  const openConsultaModal = async (cita: ICitaHoy) => {
    if (!user) return;
    setCitaParaConsulta(cita);
    const id_podologo = user.id_role === 2 ? user.id_user : cita.id_podologo;
    setConsultaForm({
      ...EMPTY_CONSULTA,
      id_paciente: cita.id_paciente,
      id_podologo,
      id_sucursal: cita.id_sucursal,
      id_empresa:  cita.id_empresa,
      fecha:       buildDate(new Date()),
    });
    setConsultaError(null);
    const [podos, sucs] = await Promise.all([
      getPodologosBySucursal(cita.id_sucursal),
      getSucursalesActivas(),
    ]);
    setPodologos(podos);
    setSucursales(sucs);
    setShowConsultaModal(true);
  };

  const handleConsultaChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setConsultaForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsultaPodologoChange = (id_podologo: number) => {
    setConsultaForm((prev) => ({ ...prev, id_podologo }));
  };

  const handleConsultaSucursalChange = async (id_sucursal: number) => {
    setConsultaForm((prev) => ({ ...prev, id_sucursal, id_podologo: 0 }));
    const data = await getPodologosBySucursal(id_sucursal);
    setPodologos(data);
  };

  const handleConsultaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citaParaConsulta) return;
    const cita = citaParaConsulta;
    setConsultaSaving(true);
    setConsultaError(null);
    try {
      const res = await crearConsultaDesdeCita(
        cita.id_cita,
        cita.id_paciente,
        consultaForm.id_podologo,
        buildDate(new Date()),
        cita.fecha_fin,
        consultaForm.id_sucursal,
        cita.id_empresa,
        cita.id_tratamiento,
      );
      if (res.ok && res.id_consulta) {
        router.push(`/dashboard/pacientes/${cita.id_paciente}/consultas/${res.id_consulta}`);
      } else {
        setConsultaError(res.message ?? "Error al crear la consulta");
      }
    } catch {
      setConsultaError("Error inesperado");
    } finally {
      setConsultaSaving(false);
    }
  };

  return (
    <div>
      {/* Tab switch */}
      <div className="flex gap-1 mb-3 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              tab === key
                ? "bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 text-zinc-900 dark:text-zinc-100 -mb-px"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "citas" && (
        <>
          {loading ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : citas.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay citas agendadas para hoy.</p>
          ) : (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Hora</th>
                    <th className="px-4 py-2 text-left">Paciente</th>
                    <th className="px-4 py-2 text-left hidden sm:table-cell">Servicio</th>
                    <th className="px-4 py-2 text-left"></th>
                    <th className="px-4 py-2 pr-15 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {citas.map((cita) => (
                    <CitaHoyFila
                      key={cita.id_cita}
                      cita={cita}
                      busy={actionId === cita.id_cita}
                      onCancelar={handleCancelar}
                      onEmpezar={openConsultaModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "faltantes"  && <PacientesFaltantes />}
      {tab === "cumpleanos" && <PacientesCumpleanos />}
      {tab === "consultas"  && <ConsultasRango />}

      {confirm && (
        <ConfirmarConsultaModal
          cita={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={handleEmpezarConfirm}
        />
      )}

      {showConsultaModal && user && (
        <ConsultaModal
          form={consultaForm}
          saving={consultaSaving}
          error={consultaError}
          podologos={podologos}
          sucursales={sucursales}
          currentUser={user}
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

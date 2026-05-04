"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarCita, crearConsultaDesdeCita, getTodaysCitas, ICitaHoy } from "../actions";
import CitaHoyFila from "./CitaHoyFila";
import ConfirmarConsultaModal from "./ConfirmarConsultaModal";
import PacientesFaltantes from "./PacientesFaltantes";
import PacientesCumpleanos from "./PacientesCumpleanos";
import { useSucursal } from "@/contexts/SucursalContext";

type Tab = "citas" | "faltantes" | "cumpleanos";

const TABS: { key: Tab; label: string }[] = [
  { key: "citas",      label: "Citas de hoy" },
  { key: "faltantes",  label: "Faltantes" },
  { key: "cumpleanos", label: "Cumpleaños" },
];

export default function CitasHoy() {
  const router = useRouter();
  const { selectedId } = useSucursal();
  const [tab, setTab]           = useState<Tab>("citas");
  const [citas, setCitas]       = useState<ICitaHoy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirm, setConfirm]   = useState<ICitaHoy | null>(null);

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
    );
    if (res.ok && res.id_consulta) {
      router.push(`/dashboard/pacientes/${cita.id_paciente}/consultas/${res.id_consulta}`);
    } else {
      setActionId(null);
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
                    <th className="px-4 py-2 text-left hidden sm:table-cell">Podólogo</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {citas.map((cita) => (
                    <CitaHoyFila
                      key={cita.id_cita}
                      cita={cita}
                      busy={actionId === cita.id_cita}
                      onCancelar={handleCancelar}
                      onEmpezar={setConfirm}
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

      {confirm && (
        <ConfirmarConsultaModal
          cita={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={handleEmpezarConfirm}
        />
      )}
    </div>
  );
}

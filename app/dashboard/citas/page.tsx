"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { useCallback, useEffect, useRef, useState } from "react";
import CalendarioCitas from "./componentes/CalendarioCitas";
import CitaModal from "./componentes/CitaModal";
import { buildDate } from "@/utils/date_helpper";
import {
  getCitas,
  getPacientes,
  getPodologos,
  saveCita,
  getExternalCalendarEvents,
  type IExternalEvent,
} from "./actions";

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

export default function CitasPage() {
  const { user }                          = useAuth();
  const { selectedId }                    = useSucursal();
  const [citas, setCitas]                 = useState<ICita[]>([]);
  const [pacientes, setPacientes]         = useState<IPaciente[]>([]);
  const [podologos, setPodologos]         = useState<IUser[]>([]);
  const [externalEvents, setExternalEvents] = useState<IExternalEvent[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingGCal, setLoadingGCal]     = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState<ICita>(EMPTY);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Track the currently visible calendar range so the sync button can use it
  const currentRange = useRef<{ timeMin: string; timeMax: string } | null>(null);

  const refreshCitas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCitas();
      setCitas(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshExternals = useCallback(async (timeMin: string, timeMax: string) => {
    setLoadingGCal(true);
    try {
      const data = await getExternalCalendarEvents(timeMin, timeMax);
      setExternalEvents(data);
    } finally {
      setLoadingGCal(false);
    }
  }, []);

  useEffect(() => {
    refreshCitas();
    getPacientes().then(setPacientes);
    getPodologos().then(setPodologos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleDatesChange = useCallback((timeMin: string, timeMax: string) => {
    currentRange.current = { timeMin, timeMax };
    refreshExternals(timeMin, timeMax);
  }, [refreshExternals]);

  const handleSync = () => {
    if (currentRange.current) {
      refreshCitas();
      refreshExternals(currentRange.current.timeMin, currentRange.current.timeMax);
    }
  };

  const openNew = () => {
    setForm({ ...EMPTY, id_sucursal: selectedId || user!.id_sucursal, id_empresa: user!.id_empresa });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (c: ICita) => {
    setForm({ ...c });
    setError(null);
    setShowModal(true);
  };

  const openExternal = (ext: IExternalEvent) => {
    setForm({
      ...EMPTY,
      fecha_inicio:    ext.fecha_inicio,
      fecha_fin:       ext.fecha_fin,
      google_event_id: ext.google_event_id,
      id_sucursal:     selectedId || user!.id_sucursal,
      id_empresa:      user!.id_empresa,
    });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        created_at: form.created_at || buildDate(new Date()),
      };
      const result = await saveCita(payload);
      if (!result.ok) throw new Error(result.message ?? "Error al guardar");
      setShowModal(false);
      await refreshCitas();
      // Refresh externals to remove the just-imported event from the purple list
      if (currentRange.current) {
        refreshExternals(currentRange.current.timeMin, currentRange.current.timeMax);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            title="Sincronizar con Google Calendar"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Sincronizar
          </button>
          <button
            onClick={openNew}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <CalendarioCitas
          citas={citas}
          externalEvents={externalEvents}
          pacientes={pacientes}
          podologos={podologos}
          onCitaClick={openEdit}
          onExternalClick={openExternal}
          onDatesChange={handleDatesChange}
          loadingGCal={loadingGCal}
        />
      )}

      {showModal && (
        <CitaModal
          form={form}
          pacientes={pacientes}
          podologos={podologos}
          saving={saving}
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}


import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { buildDate, toDateTimeLocal } from "@/utils/date_helpper";
import {
  getAntecedentesByPaciente,
  getConsultasByPaciente,
  getPacienteById,
  getPodologos,
  getPodologosBySucursal,
  getSucursalesActivas,
  saveConsulta,
  cancelarConsulta as cancelarConsultaAction,
} from "./actions";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";

const buildEmpty = (
  id_paciente: number,
  id_podologo: number,
  id_sucursal: number,
  id_empresa:  number,
): IConsulta => ({
  id_consulta:          0,
  id_paciente,
  id_podologo,
  fecha:                "",
  diagnostico:          "",
  tratamiento_aplicado: "",
  observaciones:        "",
  created_at:           "",
  deleted_at:           "",
  costo_total:          0,
  id_sucursal,
  id_empresa,
  cancelada:            false,
  motivo_cancelada:     null,
  is_onicomicosis:      false,
  id_tratamiento:       null,
  id_buzon:             null,
});

export function formatDate(val: Date | string) {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  const normalized = s.includes("T") ? s : s + "T00:00:00";
  return new Date(normalized).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

export function useExpediente() {
  const { user }       = useAuth();
  const { selectedId } = useSucursal();
  const router         = useRouter();
  const params         = useParams();
  const id_paciente    = Number(params.id);

  // Podólogos filtrados por la sucursal elegida en el modal; mientras no se elija, la lista completa.
  const [podologosForSucursal, setPodologosForSucursal] = useState<IUser[] | null>(null);
  const [showModal,          setShowModal         ] = useState(false);
  const [form,               setForm              ] = useState<IConsulta | null>(null);
  const [saving,             setSaving            ] = useState(false);
  const [error,              setError             ] = useState<string | null>(null);

  // Todas las cargas esperan al usuario y se repiten al cambiar de paciente, como antes.
  const expedienteKey = user ? [user.id_user, id_paciente] : null;

  const consultasData = useAsyncData(expedienteKey, () => getConsultasByPaciente(id_paciente));
  const consultas: IConsulta[] = consultasData.data ?? [];
  // Sin usuario autenticado todavía se muestra "Cargando", igual que antes.
  const loading = !user || consultasData.loading;
  const fetchConsultas = consultasData.reload;

  const pacienteData = useAsyncData(expedienteKey, () => getPacienteById(id_paciente));
  const paciente: IPaciente | null = pacienteData.data ?? null;

  const antecedentesData = useAsyncData(expedienteKey, () => getAntecedentesByPaciente(id_paciente));
  const latestAntecedente: IAntecedenteMedico | null = antecedentesData.data?.length
    ? [...antecedentesData.data].sort(
        (a: IAntecedenteMedico, b: IAntecedenteMedico) =>
          b.id_antecedente_medico - a.id_antecedente_medico
      )[0]
    : null;

  const allPodologosData = useAsyncData(expedienteKey, () => getPodologos());
  const podologos: IUser[] = podologosForSucursal ?? allPodologosData.data ?? [];

  const sucursalesData = useAsyncData(expedienteKey, () => getSucursalesActivas());
  const sucursales: ISucursal[] = sucursalesData.data ?? [];

  const openNew = async () => {
    if (!user) return;
    const id_sucursal_new = selectedId || user.id_sucursal;
    setForm(buildEmpty(id_paciente, user.id_user, id_sucursal_new, user.id_empresa));
    setError(null);
    setShowModal(true);
    if (id_sucursal_new) {
      const data = await getPodologosBySucursal(id_sucursal_new);
      setPodologosForSucursal(data);
    }
  };

  const openEdit = (c: IConsulta) => {
    setForm({ ...c, fecha: toDateTimeLocal(String(c.fecha ?? "")) });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => prev ? { ...prev, [e.target.name]: e.target.value } : prev);
  };

  const handlePodologoChange = (id_podologo: number) => {
    setForm((prev) => prev ? { ...prev, id_podologo } : prev);
  };

  const handleSucursalChange = async (id_sucursal: number) => {
    setForm((prev) => prev ? { ...prev, id_sucursal, id_podologo: 0 } : prev);
    const data = await getPodologosBySucursal(id_sucursal);
    setPodologosForSucursal(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const isNew = form.id_consulta === 0;
      const submitForm = { ...form };
      if (isNew) {
        const date = buildDate(new Date());
        submitForm.fecha = date;
        submitForm.created_at = date;
        // const tratamientoActivo = await getTratamientoActivoByPaciente(id_paciente);
        // if (tratamientoActivo) {
        //   submitForm.id_tratamiento = tratamientoActivo.id_tratamiento;
        //   submitForm.is_onicomicosis = true;
        // }
      }
      const result = await saveConsulta(submitForm);
      if (!result.ok) throw new Error(typeof result.data === "string" ? result.data : "Error al guardar");
      setShowModal(false);
      if (isNew && result.data && typeof result.data !== "string") {
        router.push(`/dashboard/pacientes/${id_paciente}/consultas/${result.data.id_consulta}`);
        return;
      }
      await fetchConsultas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return {
    user,
    paciente,
    id_paciente,
    consultas,
    latestAntecedente,
    podologos,
    sucursales,
    loading,
    showModal,
    form,
    saving,
    error,
    openNew,
    openEdit,
    handleChange,
    handlePodologoChange,
    handleSucursalChange,
    handleSubmit,
    closeModal:            () => setShowModal(false),
    goBack:                () => router.back(),
    goToExpedienteMedico:  () => router.push(`/dashboard/pacientes/${id_paciente}/expediente_medico`),
    refreshConsultas:      fetchConsultas,
    cancelarConsulta:      cancelarConsultaAction,
  };
}

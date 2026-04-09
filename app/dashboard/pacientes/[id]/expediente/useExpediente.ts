import { useAuth } from "@/contexts/AuthContext";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { toDateTimeLocal } from "@/utils/date_helpper";
import {
  getAntecedentesByPaciente,
  getConsultasByPaciente,
  getPacienteById,
  getPodologos,
  getSucursalesActivas,
  saveConsulta,
} from "./actions";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const { user }    = useAuth();
  const router      = useRouter();
  const params      = useParams();
  const id_paciente = Number(params.id);

  const [consultas,          setConsultas         ] = useState<IConsulta[]>([]);
  const [paciente,           setPaciente          ] = useState<IPaciente | null>(null);
  const [latestAntecedente,  setLatestAntecedente ] = useState<IAntecedenteMedico | null>(null);
  const [podologos,          setPodologos         ] = useState<IUser[]>([]);
  const [sucursales,         setSucursales        ] = useState<ISucursal[]>([]);
  const [loading,            setLoading           ] = useState(true);
  const [showModal,          setShowModal         ] = useState(false);
  const [form,               setForm              ] = useState<IConsulta | null>(null);
  const [saving,             setSaving            ] = useState(false);
  const [error,              setError             ] = useState<string | null>(null);

  const fetchPaciente = async () => {
    const data = await getPacienteById(id_paciente);
    if (data) setPaciente(data);
  };

  const fetchPodologos = async () => {
    const data = await getPodologos();
    setPodologos(data);
  };

  const fetchSucursales = async () => {
    const data = await getSucursalesActivas();
    setSucursales(data);
  };

  const fetchLatestAntecedente = async () => {
    const data = await getAntecedentesByPaciente(id_paciente);
    if (data.length) {
      const sorted = [...data].sort(
        (a: IAntecedenteMedico, b: IAntecedenteMedico) =>
          b.id_antecedente_medico - a.id_antecedente_medico
      );
      setLatestAntecedente(sorted[0]);
    }
  };

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const data = await getConsultasByPaciente(id_paciente);
      setConsultas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPaciente();
      fetchConsultas();
      fetchLatestAntecedente();
      fetchPodologos();
      fetchSucursales();
    }
  }, [user, id_paciente]);

  const openNew = () => {
    if (!user) return;
    setForm(buildEmpty(id_paciente, user.id_user, user.id_sucursal, user.id_empresa));
    setError(null);
    setShowModal(true);
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

  const handleSucursalChange = (id_sucursal: number) => {
    setForm((prev) => prev ? { ...prev, id_sucursal } : prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveConsulta(form);
      if (!result.ok) throw new Error(typeof result.data === "string" ? result.data : "Error al guardar");
      setShowModal(false);
      await fetchConsultas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}

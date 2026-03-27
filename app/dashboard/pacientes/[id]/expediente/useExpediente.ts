import { useAuth } from "@/contexts/AuthContext";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { buildDate, toDateTimeLocal } from "@/utils/date_helpper";
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
  const [loading,            setLoading           ] = useState(true);
  const [showModal,          setShowModal         ] = useState(false);
  const [form,               setForm              ] = useState<IConsulta | null>(null);
  const [saving,             setSaving            ] = useState(false);
  const [error,              setError             ] = useState<string | null>(null);

  const fetchPaciente = async () => {
    const res  = await fetch(`/api/pacientes?id_paciente=${id_paciente}`);
    const data = await res.json();
    if (data.ok && data.data?.length) setPaciente(data.data[0]);
  };

  const fetchLatestAntecedente = async () => {
    const res  = await fetch(`/api/antecedentes_medicos?id_paciente=${id_paciente}`);
    const data = await res.json();
    if (data.ok && data.data?.length) {
      const sorted = [...data.data].sort(
        (a: IAntecedenteMedico, b: IAntecedenteMedico) =>
          b.id_antecedente_medico - a.id_antecedente_medico
      );
      setLatestAntecedente(sorted[0]);
    }
  };

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/consultas?id_paciente=${id_paciente}`);
      const data = await res.json();
      if (data.ok) setConsultas(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPaciente();
      fetchConsultas();
      fetchLatestAntecedente();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/consultas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, created_at: buildDate(new Date()) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
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
    loading,
    showModal,
    form,
    saving,
    error,
    openNew,
    openEdit,
    handleChange,
    handleSubmit,
    closeModal:            () => setShowModal(false),
    goBack:                () => router.back(),
    goToExpedienteMedico:  () => router.push(`/dashboard/pacientes/${id_paciente}/expediente_medico`),
  };
}

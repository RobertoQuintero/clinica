import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IPaciente } from "@/interfaces/paciente";
import { addZeroToday } from "@/utils/date_helpper";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAntecedentes, getPacienteById, saveAntecedente } from "./actions";

export const BOOL_LABELS: Record<string, string> = {
  alergia_anestesia:           "Alergia anestesia",
  alergia_antibioticos:        "Alergia antibióticos",
  alergia_sulfas:              "Alergia sulfas",
  alergia_latex:               "Alergia látex",
  alergia_ninguna:             "Sin alergias",
  diabetico:                   "Diabético/a",
  hipertenso:                  "Hipertenso/a",
  hipotiroidismo:              "Hipotiroidismo",
  cancer:                      "Cáncer",
  embarazada:                  "Embarazada",
  lactando:                    "Lactando",
  fracturas:                   "Fracturas",
  antecedentes_dermatologicos: "Antec. dermatológicos",
};

const buildEmpty = (id_paciente: number): IAntecedenteMedico => ({
  id_antecedente_medico:       0,
  id_paciente,
  fecha_registro:              addZeroToday(new Date()),
  alergia_anestesia:           false,
  alergia_antibioticos:        false,
  alergia_sulfas:              false,
  alergia_latex:               false,
  alergia_ninguna:             false,
  diabetico:                   false,
  hipertenso:                  false,
  hipotiroidismo:              false,
  cancer:                      false,
  embarazada:                  false,
  lactando:                    false,
  fracturas:                   false,
  antecedentes_dermatologicos: false,
  medicamentos_actuales:       "",
  tipo_sangre:                 "",
  otros:                       "",
});

export function formatDate(val: Date | string) {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  const normalized = s.includes("T") ? s : s + "T00:00:00";
  return new Date(normalized).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

export function activeBools(a: IAntecedenteMedico): string[] {
  return Object.entries(BOOL_LABELS)
    .filter(([key]) => !!a[key as keyof IAntecedenteMedico])
    .map(([, label]) => label);
}

export function useExpedienteMedico() {
  const router      = useRouter();
  const params      = useParams();
  const id_paciente = Number(params.id);

  const [antecedentes, setAntecedentes] = useState<IAntecedenteMedico[]>([]);
  const [paciente, setPaciente]         = useState<IPaciente | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState<IAntecedenteMedico | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const fetchPaciente = async () => {
    const paciente = await getPacienteById(id_paciente);
    if (paciente) setPaciente(paciente);
  };

  const fetchAntecedentes = async () => {
    setLoading(true);
    try {
      const data = await getAntecedentes(id_paciente);
      setAntecedentes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaciente();
    fetchAntecedentes();
  }, [id_paciente]);

  const openNew = () => {
    const latest = antecedentes.length
      ? antecedentes.reduce((prev, curr) =>
          curr.id_antecedente_medico > prev.id_antecedente_medico ? curr : prev
        )
      : null;

    setForm(
      latest
        ? {
            ...latest,
            id_antecedente_medico: 0,
            fecha_registro: addZeroToday(new Date()),
          }
        : buildEmpty(id_paciente)
    );
    setError(null);
    setShowModal(true);
  };

  const openEdit = (a: IAntecedenteMedico) => {
    setForm({
      ...a,
      fecha_registro: a.fecha_registro
        ? (a.fecha_registro as string).slice(0, 10)
        : "",
    });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => prev ? { ...prev, [e.target.name]: e.target.value } : prev);
  };

  const handleCheck = (name: keyof IAntecedenteMedico) => {
    setForm((prev) => prev ? { ...prev, [name]: !prev[name] } : prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveAntecedente(form);
      if (!result.ok) throw new Error(result.message ?? "Error al guardar");
      setShowModal(false);
      await fetchAntecedentes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => setShowModal(false);

  return {
    router,
    id_paciente,
    paciente,
    antecedentes,
    loading,
    showModal,
    form,
    saving,
    error,
    openNew,
    openEdit,
    handleChange,
    handleCheck,
    handleSubmit,
    closeModal,
  };
}

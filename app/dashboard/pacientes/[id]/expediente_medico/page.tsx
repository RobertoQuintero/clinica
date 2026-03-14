"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IPaciente } from "@/interfaces/paciente";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AntecedenteMedicoModal from "./componentes/AntecedenteMedicoModal";

const buildEmpty = (id_paciente: number): IAntecedenteMedico => ({
  id_antecedente_medico:       0,
  id_paciente,
  fecha_registro:              new Date().toISOString().slice(0, 10),
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

const BOOL_LABELS: Record<string, string> = {
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

export default function ExpedienteMedicoPage() {
  const { user }    = useAuth();
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
    const res  = await fetch(`/api/pacientes?id_paciente=${id_paciente}`);
    const data = await res.json();
    if (data.ok && data.data?.length) setPaciente(data.data[0]);
  };

  const fetchAntecedentes = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/antecedentes_medicos?id_paciente=${id_paciente}`);
      const data = await res.json();
      if (data.ok) setAntecedentes(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPaciente();
      fetchAntecedentes();
    }
  }, [user, id_paciente]);

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
            fecha_registro: new Date().toISOString().slice(0, 10),
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
      const res  = await fetch("/api/antecedentes_medicos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setShowModal(false);
      await fetchAntecedentes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (val: Date | string) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("es-MX", {
      year: "numeric", month: "short", day: "2-digit",
    });
  };

  const activeBools = (a: IAntecedenteMedico) =>
    Object.entries(BOOL_LABELS)
      .filter(([key]) => !!a[key as keyof IAntecedenteMedico])
      .map(([, label]) => label);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          ← Volver
        </button>
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50 flex-1">
          Expediente médico —{" "}
          {paciente
            ? `${paciente.nombre} ${paciente.apellido_paterno} ${paciente.apellido_materno}`.trim()
            : `Paciente #${id_paciente}`}
        </h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nuevo registro
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : antecedentes.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-6 py-10 text-center text-zinc-400">
          Sin registros médicos guardados
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[...antecedentes].sort((a, b) => b.id_antecedente_medico - a.id_antecedente_medico).map((a) => {
            const activos = activeBools(a);
            return (
              <div
                key={a.id_antecedente_medico}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">#{a.id_antecedente_medico}</span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {formatDate(a.fecha_registro)}
                    </span>
                    {a.tipo_sangre && (
                      <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                        {a.tipo_sangre}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Editar
                  </button>
                </div>

                {activos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activos.map((lbl) => (
                      <span
                        key={lbl}
                        className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs text-amber-800 dark:text-amber-300"
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}

                {(a.medicamentos_actuales || a.otros) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {a.medicamentos_actuales && (
                      <div>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-0.5">
                          Medicamentos actuales
                        </span>
                        {a.medicamentos_actuales}
                      </div>
                    )}
                    {a.otros && (
                      <div>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-0.5">
                          Otros
                        </span>
                        {a.otros}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && form && (
        <AntecedenteMedicoModal
          form={form}
          saving={saving}
          error={error}
          onChange={handleChange}
          onCheck={handleCheck}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

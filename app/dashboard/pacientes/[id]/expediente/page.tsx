"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ConsultaModal from "./componentes/ConsultaModal";

const buildEmpty = (id_paciente: number, id_podologo: number, id_sucursal: number, id_empresa: number): IConsulta => ({
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

export default function ExpedientePage() {
  const { user }    = useAuth();
  const router      = useRouter();
  const params      = useParams();
  const id_paciente = Number(params.id);

  const [consultas, setConsultas]           = useState<IConsulta[]>([]);
  const [paciente, setPaciente]             = useState<IPaciente | null>(null);
  const [latestAntecedente, setLatestAntecedente] = useState<IAntecedenteMedico | null>(null);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<IConsulta | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
    setForm({ ...c, fecha: c.fecha ? (c.fecha as string).slice(0, 16) : "" });
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
        body:    JSON.stringify({ ...form, created_at: new Date().toISOString() }),
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

  const formatDate = (val: Date | string) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("es-MX", {
      year: "numeric", month: "short", day: "2-digit",
    });
  };

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
          Expediente —{" "}
          {paciente
            ? `${paciente.nombre} ${paciente.apellido_paterno} ${paciente.apellido_materno}`.trim()
            : `Paciente #${id_paciente}`}
        </h2>
        <button
          onClick={() => router.push(`/dashboard/pacientes/${id_paciente}/expediente_medico`)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Expediente médico
        </button>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nueva consulta
        </button>
      </div>

      {latestAntecedente && (
        <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Expediente médico — registro más reciente
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {new Date(latestAntecedente.fecha_registro).toLocaleDateString("es-MX", {
                year: "numeric", month: "short", day: "2-digit",
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {([
              ["alergia_anestesia",           "Alergia anestesia"],
              ["alergia_antibioticos",        "Alergia antibióticos"],
              ["alergia_sulfas",              "Alergia sulfas"],
              ["alergia_latex",               "Alergia látex"],
              ["alergia_ninguna",             "Sin alergias"],
              ["diabetico",                   "Diabético/a"],
              ["hipertenso",                  "Hipertenso/a"],
              ["hipotiroidismo",              "Hipotiroidismo"],
              ["cancer",                      "Cáncer"],
              ["embarazada",                  "Embarazada"],
              ["lactando",                    "Lactando"],
              ["fracturas",                   "Fracturas"],
              ["antecedentes_dermatologicos", "Antec. dermatológicos"],
            ] as [keyof IAntecedenteMedico, string][]).map(([key, label]) =>
              latestAntecedente[key] ? (
                <span
                  key={key}
                  className="inline-block rounded-full bg-zinc-200 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-200"
                >
                  {label}
                </span>
              ) : null
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Tipo de sangre: </span>
              <span className="text-zinc-800 dark:text-zinc-100">{latestAntecedente.tipo_sangre || "—"}</span>
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Medicamentos actuales: </span>
              <span className="text-zinc-800 dark:text-zinc-100">{latestAntecedente.medicamentos_actuales || "—"}</span>
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Otros: </span>
              <span className="text-zinc-800 dark:text-zinc-100">{latestAntecedente.otros || "—"}</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["#", "Fecha", "Diagnóstico", "Tratamiento aplicado", "Observaciones", "Costo total", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {consultas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin consultas registradas</td>
                </tr>
              ) : consultas.map((c) => (
                <tr key={c.id_consulta} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-500">{c.id_consulta}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{formatDate(c.fecha)}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">{c.diagnostico || "—"}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">{c.tratamiento_aplicado || "—"}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">{c.observaciones || "—"}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                    ${Number(c.costo_total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && form && (
        <ConsultaModal
          form={form}
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

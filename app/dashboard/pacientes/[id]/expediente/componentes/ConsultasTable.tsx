"use client";

import { IConsulta } from "@/interfaces/consulta";
import { useState } from "react";
import CancelarConsultaModal from "./CancelarConsultaModal";
import ConsultaFila from "./ConsultaFila";

interface Props {
  id_paciente:      number;
  consultas:        IConsulta[];
  loading:          boolean;
  onEdit:           (c: IConsulta) => void;
  onCancelled:      () => void;
  cancelarConsulta: (id_consulta: number, motivo: string) => Promise<{ ok: boolean; data?: string }>;
}

export default function ConsultasTable({
  id_paciente, consultas, loading, onEdit, onCancelled, cancelarConsulta,
}: Props) {
  const [cancelTarget, setCancelTarget] = useState<IConsulta | null>(null);
  const [motivo,       setMotivo       ] = useState("");
  const [saving,       setSaving       ] = useState(false);
  const [error,        setError        ] = useState<string | null>(null);

  const openCancel = (c: IConsulta) => {
    setCancelTarget(c);
    setMotivo("");
    setError(null);
  };

  const closeCancel = () => {
    if (saving) return;
    setCancelTarget(null);
  };

  const handleConfirm = async () => {
    if (!cancelTarget || !motivo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await cancelarConsulta(cancelTarget.id_consulta, motivo.trim());
      if (!result.ok) throw new Error(result.data ?? "Error al cancelar");
      setCancelTarget(null);
      await onCancelled();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {["#", "Fecha", "Podólogo", "Sucursal", "H. Consulta", "H. Inicio", "H. Fin", "Duración", "Costo total", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
            {consultas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-zinc-400">
                  Sin consultas registradas
                </td>
              </tr>
            ) : (
              consultas.map((c) => (
                <ConsultaFila
                  key={c.id_consulta}
                  consulta={c}
                  id_paciente={id_paciente}
                  onEdit={onEdit}
                  onCancel={openCancel}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {cancelTarget && (
        <CancelarConsultaModal
          motivo={motivo}
          saving={saving}
          error={error}
          onChange={(e) => setMotivo(e.target.value)}
          onConfirm={handleConfirm}
          onClose={closeCancel}
        />
      )}
    </>
  );
}

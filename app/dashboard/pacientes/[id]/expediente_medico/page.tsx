"use client";

import AntecedenteFila from "./componentes/AntecedenteFila";
import AntecedenteMedicoModal from "./componentes/AntecedenteMedicoModal";
import { useExpedienteMedico } from "./useExpedienteMedico";

export default function ExpedienteMedicoPage() {
  const {
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
  } = useExpedienteMedico();

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
          {[...antecedentes].sort((a, b) => b.id_antecedente_medico - a.id_antecedente_medico).map((a) => (
            <AntecedenteFila
              key={a.id_antecedente_medico}
              antecedente={a}
              onEdit={openEdit}
            />
          ))}
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
          onClose={closeModal}
        />
      )}
    </div>
  );
}

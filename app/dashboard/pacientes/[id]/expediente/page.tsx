"use client";

import AntecedenteSummary from "./componentes/AntecedenteSummary";
import ConsultaModal from "./componentes/ConsultaModal";
import ConsultasTable from "./componentes/ConsultasTable";
import ExpedienteHeader from "./componentes/ExpedienteHeader";
import { useExpediente } from "./useExpediente";

export default function ExpedientePage() {
  const {
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
    closeModal,
    goBack,
    goToExpedienteMedico,
  } = useExpediente();

  return (
    <div>
      <ExpedienteHeader
        paciente={paciente}
        id_paciente={id_paciente}
        onBack={goBack}
        onGoToExpedienteMedico={goToExpedienteMedico}
        onOpenNew={openNew}
      />

      {latestAntecedente && (
        <AntecedenteSummary antecedente={latestAntecedente} />
      )}

      <ConsultasTable
        id_paciente={id_paciente}
        consultas={consultas}
        loading={loading}
        onEdit={openEdit}
      />

      {showModal && form && (
        <ConsultaModal
          form={form}
          saving={saving}
          error={error}
          podologos={podologos}
          sucursales={sucursales}
          onChange={handleChange}
          onPodologoChange={handlePodologoChange}
          onSucursalChange={handleSucursalChange}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

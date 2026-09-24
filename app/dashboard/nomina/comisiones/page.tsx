import { ChevronRight } from "lucide-react";
import {
  getCommissionTiers,
  getTreatmentCommissionSettings,
  getTreatmentCommissionSettingsLog,
} from "./actions";
import { NewCommissionTierButton } from "./componentes/CommissionTierModal";
import CommissionTiersTable from "./componentes/CommissionTiersTable";
import TreatmentCommissionSettingsCard from "./componentes/TreatmentCommissionSettingsCard";
import { EditTreatmentCommissionSettingsButton } from "./componentes/TreatmentCommissionSettingsModal";
import TreatmentCommissionSettingsLog from "./componentes/TreatmentCommissionSettingsLog";

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
      {message}
    </p>
  );
}

export default async function ComisionesNominaPage() {
  const [result, treatmentSettingsResult, treatmentSettingsLogResult] = await Promise.all([
    getCommissionTiers(),
    getTreatmentCommissionSettings(),
    getTreatmentCommissionSettingsLog(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Comisiones</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">Comisiones por consultas</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Monto fijo que recibe cada empleado según las consultas atendidas en el periodo.
          </p>
        </div>
        {result.ok && <NewCommissionTierButton tiers={result.data} />}
      </div>

      {!result.ok ? <ErrorAlert message={result.message} /> : <CommissionTiersTable tiers={result.data} />}

      <div className="flex flex-col gap-5 mt-4">
        {!treatmentSettingsResult.ok ? (
          <ErrorAlert message={treatmentSettingsResult.message} />
        ) : (
          <TreatmentCommissionSettingsCard
            settings={treatmentSettingsResult.data}
            editAction={<EditTreatmentCommissionSettingsButton settings={treatmentSettingsResult.data} />}
          />
        )}

        {!treatmentSettingsLogResult.ok ? (
          <ErrorAlert message={treatmentSettingsLogResult.message} />
        ) : (
          <TreatmentCommissionSettingsLog entries={treatmentSettingsLogResult.data} />
        )}
      </div>
    </div>
  );
}

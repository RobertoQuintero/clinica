"use client";

import CitasHoy from "./componentes/CitasHoy";
import BuscarConsulta from "./componentes/BuscarConsulta";
import EstadisticasCharts from "./componentes/EstadisticasCharts";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const canSeeStats = user?.id_role === 1 || user?.id_role === 4;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="w-full lg:w-80 shrink-0">
          <BuscarConsulta />
        </div>
        <div className="w-full min-w-0">
          <CitasHoy />
        </div>

      </div>

      {canSeeStats && <EstadisticasCharts />}
    </div>
  );
}



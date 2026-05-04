"use client";

import CitasHoy from "./componentes/CitasHoy";
import BuscarConsulta from "./componentes/BuscarConsulta";
import EstadisticasCharts from "./componentes/EstadisticasCharts";

export default function DashboardPage() {
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

      <EstadisticasCharts />
    </div>
  );
}



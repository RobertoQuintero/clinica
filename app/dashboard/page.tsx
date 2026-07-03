"use client";

import CitasHoy from "./componentes/CitasHoy";
import BuscarConsulta from "./componentes/BuscarConsulta";
import EstadisticasCharts from "./componentes/EstadisticasCharts";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const canSeeStats = user?.id_role === 1 || user?.id_role === 4;

  console.log('<iframe src="https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=America%2FMexico_City&src=Y2FsLnBpZXplbi5wb3phcmljYXBldHJvbWV4QGdtYWlsLmNvbQ&src=ZXMtNDE5Lm1leGljYW4jaG9saWRheUBncm91cC52LmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23039be5&color=%230b8043" style="border:solid 1px #777" width="800" height="600" frameborder="0" scrolling="no"></iframe>'.length)
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



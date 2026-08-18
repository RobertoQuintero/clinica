"use client";

import { useSucursal } from "@/contexts/SucursalContext";
import { ISucursalCalendario } from "@/interfaces/sucursal";
import { useEffect, useState } from "react";
import { getSucursalCalendarios } from "@/app/dashboard/sucursales/actions";

export default function CitasPage() {
  const { selectedId } = useSucursal();
  const [calendarios, setCalendarios] = useState<ISucursalCalendario[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSucursalCalendarios(selectedId)
      .then((data) => {
        setCalendarios(data);
        setActiveCalendarId(data[0]?.id_sucursal_calendario ?? null);
      })
      .catch(() => {
        setCalendarios([]);
        setActiveCalendarId(null);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const activeCalendario = calendarios.find((c) => c.id_sucursal_calendario === activeCalendarId) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>

        {activeCalendario && (
          <button
            onClick={() => {
              if (activeCalendario.link_calendar) {
                window.open(activeCalendario.link_calendar, "_blank");
              }
            }}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            + Nueva cita
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-zinc-500">Espere…</p>
      ) : calendarios.length === 0 ? (
        <p className="text-zinc-500">No hay calendarios configurados para esta sucursal.</p>
      ) : (
        <>
          <div className="mb-4 flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
            {calendarios.map((c) => (
              <button
                key={c.id_sucursal_calendario}
                onClick={() => setActiveCalendarId(c.id_sucursal_calendario)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeCalendarId === c.id_sucursal_calendario
                    ? "border-zinc-800 text-zinc-800 dark:border-zinc-100 dark:text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <div className="calendar-container">
            {activeCalendario?.iframe && (
              <iframe className="google-calendar-iframe" src={activeCalendario.iframe}></iframe>
            )}
          </div>
        </>
      )}
    </div>
  );
}

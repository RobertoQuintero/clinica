"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import { ICita } from "@/interfaces/cita";
import type { IExternalEvent } from "@/app/dashboard/citas/actions";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";

// ── Colour palette by estado ──────────────────────────────────────────────────
const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  agendada:  { bg: "#3b82f6", text: "#fff", border: "#2563eb" },
  confirmada:{ bg: "#10b981", text: "#fff", border: "#059669" },
  atendida:  { bg: "#22c55e", text: "#fff", border: "#16a34a" },
  cancelada: { bg: "#d1d5db", text: "#9ca3af", border: "#9ca3af" },
  externo:   { bg: "#a855f7", text: "#fff", border: "#9333ea" },
};

interface Props {
  citas: ICita[];
  externalEvents: IExternalEvent[];
  pacientes: IPaciente[];
  podologos: IUser[];
  onCitaClick: (cita: ICita) => void;
  onExternalClick: (ext: IExternalEvent) => void;
  onDatesChange: (timeMin: string, timeMax: string) => void;
  loadingGCal: boolean;
}

function pacienteName(id: number, pacientes: IPaciente[]): string {
  const p = pacientes.find((x) => x.id_paciente === id);
  return p ? `${p.nombre} ${p.apellido_paterno}` : `#${id}`;
}

function podologoName(id: number, podologos: IUser[]): string {
  const u = podologos.find((x) => x.id_user === id);
  return u ? u.nombre : `#${id}`;
}

export default function CalendarioCitas({
  citas,
  externalEvents,
  pacientes,
  podologos,
  onCitaClick,
  onExternalClick,
  onDatesChange,
  loadingGCal,
}: Props) {

  const dbEvents: EventInput[] = citas.map((c) => {
    const color = ESTADO_COLORS[c.estado] ?? ESTADO_COLORS.agendada;
    return {
      id: String(c.id_cita),
      title: `${pacienteName(c.id_paciente, pacientes)} · ${podologoName(c.id_podologo, podologos)}`,
      start: String(c.fecha_inicio).replace(" ", "T"),
      end:   String(c.fecha_fin   ).replace(" ", "T"),
      backgroundColor: color.bg,
      borderColor:     color.border,
      textColor:       color.text,
      extendedProps: { type: "db", cita: c },
    };
  });

  const extEvents: EventInput[] = externalEvents.map((e) => {
    const color = ESTADO_COLORS.externo;
    return {
      id: `ext::${e.google_event_id}`,
      title: e.summary,
      start: e.fecha_inicio.replace(" ", "T"),
      end:   e.fecha_fin.replace(" ", "T"),
      backgroundColor: color.bg,
      borderColor:     color.border,
      textColor:       color.text,
      extendedProps: { type: "external", external: e },
    };
  });

  const handleEventClick = (info: EventClickArg) => {
    const { type, cita, external } = info.event.extendedProps;
    if (type === "db") {
      onCitaClick(cita as ICita);
    } else {
      onExternalClick(external as IExternalEvent);
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    onDatesChange(arg.startStr, arg.endStr);
  };

  // Custom event content: show a small badge for external events
  const renderEventContent = (arg: EventContentArg) => {
    const isExt = arg.event.extendedProps.type === "external";
    return (
      <div className="flex items-center gap-1 overflow-hidden px-1 py-0.5 text-xs leading-tight">
        {isExt && (
          <span className="shrink-0 rounded bg-white/30 px-0.5 font-semibold text-[10px]">ext</span>
        )}
        <span className="truncate">{arg.event.title}</span>
      </div>
    );
  };

  return (
    <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
      {/* Spinner while fetching external events */}
      {loadingGCal && (
        <div className="absolute right-5 top-5 z-10 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Sincronizando GCal…
        </div>
      )}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(["agendada", "confirmada", "atendida", "cancelada", "externo"] as const).map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: ESTADO_COLORS[e].bg }}
            />
            <span className="capitalize text-zinc-600 dark:text-zinc-400">
              {e === "externo" ? "GCal (ext)" : e}
            </span>
          </span>
        ))}
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={esLocale}
        events={[...dbEvents, ...extEvents]}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
        headerToolbar={{
          left:   "prev,next today",
          center: "title",
          right:  "dayGridMonth,dayGridWeek",
        }}
        height="auto"
        dayMaxEvents={4}
        eventDisplay="block"
      />
    </div>
  );
}
